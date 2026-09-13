"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseTripsFile, type ParsedTripRow } from "@/lib/import/parseTripsFile";
import { parseTripsXlsx } from "@/lib/import/parseTripsXlsx";
import { normalizeArabic } from "@/lib/arabic";
import { destinationCount } from "@/lib/trip-calc";

export type ParseFileResult =
  | { ok: true; companyNameGuess: string | null; rows: ParsedTripRow[]; driverNames: string[] }
  | { ok: false; error: string };

export async function parseImportFile(formData: FormData): Promise<ParseFileResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "لم يتم اختيار ملف" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // ملفات xlsx مضغوطة وتبدأ بتوقيع ZIP — الفحص بالمحتوى لا بالامتداد، لأن
  // بعض الأنظمة بتصدّر HTML بامتداد .xls وده بيتلخبط
  const isXlsx = buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (isXlsx) {
    const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    return parseTripsXlsx(ab as ArrayBuffer);
  }

  return parseTripsFile(buffer.toString("utf-8"));
}

export type ImportRowInput = {
  date: string;
  fromLocation: string;
  toLocation: string;
  driverId: string; // إما id موجود، أو "" لو سيتم إنشاء سائق جديد
  newDriverName: string; // مطلوب لو driverId فاضي
  baseFare: number; // -> موقع التحميل
  extraAmount: number; // موقع إضافي + أجرة المرتجع -> موقع التنزيل
  driverTripPayment: number; // تكلفة المورد/الترب — صفر يعني "استخدم الترب الافتراضي للسائق"
  branchesCount: number;
  vehicleTypeName: string;
  requester: string;
  status: "new" | "in_progress" | "completed" | "cancelled";
  notes: string;
};

export type ConfirmImportResult =
  | {
      ok: true;
      createdDrivers: number;
      createdCompany: boolean;
      createdTrips: number;
    }
  | { ok: false; error: string };

export async function confirmImport(
  companyId: string,
  newCompanyName: string,
  rows: ImportRowInput[]
): Promise<ConfirmImportResult> {
  if (rows.length === 0) {
    return { ok: false, error: "لا توجد صفوف لاستيرادها" };
  }

  const supabase = await createClient();

  let finalCompanyId = companyId;
  let createdCompany = false;

  if (!finalCompanyId) {
    if (!newCompanyName.trim()) {
      return { ok: false, error: "اختر شركة موجودة أو أدخل اسم شركة جديدة" };
    }
    const { data: newCompany, error: companyError } = await supabase
      .from("companies")
      .insert({ name: newCompanyName.trim(), status: "active" })
      .select("id")
      .single();

    if (companyError || !newCompany) {
      return { ok: false, error: "حدث خطأ أثناء إنشاء الشركة" };
    }
    finalCompanyId = newCompany.id;
    createdCompany = true;
  }

  // إنشاء السائقين الجدد المطلوبين
  const driverIdByName = new Map<string, string>();
  let createdDrivers = 0;

  for (const row of rows) {
    if (row.driverId || !row.newDriverName) continue;
    if (driverIdByName.has(row.newDriverName)) continue;

    const { data: newDriver, error: driverError } = await supabase
      .from("drivers")
      .insert({ name: row.newDriverName, salary: 0, status: "active", employment_type: "internal" })
      .select("id")
      .single();

    if (driverError || !newDriver) {
      return { ok: false, error: `حدث خطأ أثناء إنشاء السائق "${row.newDriverName}"` };
    }
    driverIdByName.set(row.newDriverName, newDriver.id);
    createdDrivers += 1;
  }

  // الترب الافتراضي لكل سائق — يُستخدم للصفوف التي لا ترب فيها في الملف
  const { data: allDrivers } = await supabase.from("drivers").select("id, default_trip_payment");
  const defaultTrab = new Map((allDrivers ?? []).map((d) => [d.id, Number(d.default_trip_payment) || 0]));

  // مطابقة أنواع السيارات بالاسم مع تجاهل الفروق الإملائية
  const { data: types } = await supabase.from("vehicle_types").select("slug, name_ar");
  const typeBySlug = new Map(
    (types ?? []).map((t) => [normalizeArabic(t.name_ar), { slug: t.slug, name: t.name_ar }])
  );

  let createdTrips = 0;

  for (const row of rows) {
    const driverId = row.driverId || driverIdByName.get(row.newDriverName);
    if (!driverId) {
      return { ok: false, error: "تعذّر تحديد السائق لأحد الصفوف" };
    }

    const matchedType = row.vehicleTypeName
      ? typeBySlug.get(normalizeArabic(row.vehicleTypeName))
      : undefined;

    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .insert({
        driver_id: driverId,
        company_id: finalCompanyId,
        trip_date: row.date,
        from_location: row.fromLocation,
        to_location: row.toLocation,
        // سعر الرحلة بقى من بنود الأجرة لا من مجموع المواقع (0019). من غير
        // السطرين دول كانت كل رحلة مستوردة تطلع بسعر صفر.
        base_fare: row.baseFare,
        extra_location_fare: row.extraAmount,
        // عدد الفروع كما في الملف؛ لو فاضي نضع عدد مدن التنزيل فيصير المحاسَب عليه صفراً
        branches_count: row.branchesCount > 0 ? row.branchesCount : destinationCount(row.toLocation),
        vehicle_type_slug: matchedType?.slug ?? null,
        vehicle_type_label: matchedType?.name ?? (row.vehicleTypeName || null),
        // الملف لا يحمل ترب السائق، فنأخذ تربه الافتراضي بدل تركه صفراً
        driver_base_payment: row.driverTripPayment || defaultTrab.get(driverId) || 0,
        diesel_amount: 0,
        requester: row.requester || null,
        status: row.status,
        notes: row.notes || null,
      })
      .select("id")
      .single();

    if (tripError || !trip) {
      return { ok: false, error: "حدث خطأ أثناء إنشاء إحدى الرحلات" };
    }

    createdTrips += 1;
  }

  revalidatePath("/trips");
  revalidatePath("/companies");
  revalidatePath("/drivers");
  revalidatePath("/dashboard");

  return { ok: true, createdDrivers, createdCompany, createdTrips };
}
