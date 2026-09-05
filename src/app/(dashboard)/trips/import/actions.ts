"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseTripsFile, type ParsedTripRow } from "@/lib/import/parseTripsFile";

export type ParseFileResult =
  | { ok: true; companyNameGuess: string | null; rows: ParsedTripRow[]; driverNames: string[] }
  | { ok: false; error: string };

export async function parseImportFile(formData: FormData): Promise<ParseFileResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "لم يتم اختيار ملف" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const content = buffer.toString("utf-8");

  return parseTripsFile(content);
}

export type ImportRowInput = {
  date: string;
  fromLocation: string;
  toLocation: string;
  driverId: string; // إما id موجود، أو "" لو سيتم إنشاء سائق جديد
  newDriverName: string; // مطلوب لو driverId فاضي
  baseFare: number; // -> موقع التحميل
  extraAmount: number; // موقع إضافي + أجرة المرتجع -> موقع التنزيل
  driverTripPayment: number; // تكلفة المورد/التربة
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

  let createdTrips = 0;

  for (const row of rows) {
    const driverId = row.driverId || driverIdByName.get(row.newDriverName);
    if (!driverId) {
      return { ok: false, error: "تعذّر تحديد السائق لأحد الصفوف" };
    }

    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .insert({
        driver_id: driverId,
        company_id: finalCompanyId,
        trip_date: row.date,
        from_location: row.fromLocation,
        to_location: row.toLocation,
        driver_trip_payment: row.driverTripPayment,
        diesel_amount: 0,
        status: row.status,
        notes: row.notes || null,
      })
      .select("id")
      .single();

    if (tripError || !trip) {
      return { ok: false, error: "حدث خطأ أثناء إنشاء إحدى الرحلات" };
    }

    const locationRows = [
      {
        trip_id: trip.id,
        location_type: "loading" as const,
        location_name: row.fromLocation,
        amount: row.baseFare,
        amount_status: "confirmed" as const,
      },
      {
        trip_id: trip.id,
        location_type: "unloading" as const,
        location_name: row.toLocation,
        amount: row.extraAmount,
        amount_status: "confirmed" as const,
      },
    ];

    const { error: locError } = await supabase.from("trip_locations").insert(locationRows);
    if (locError) {
      return { ok: false, error: "تم إنشاء بعض الرحلات لكن حدث خطأ أثناء حفظ مواقعها" };
    }

    createdTrips += 1;
  }

  revalidatePath("/trips");
  revalidatePath("/companies");
  revalidatePath("/drivers");
  revalidatePath("/dashboard");

  return { ok: true, createdDrivers, createdCompany, createdTrips };
}
