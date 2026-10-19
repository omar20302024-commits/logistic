"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeArabic } from "@/lib/arabic";
import { destinationCount, resolveBasePayment, type RouteRate } from "@/lib/trip-calc";
import {
  parseSheetCsv,
  parseSheetUrl,
  sheetCsvUrl,
  type SheetTripRow,
} from "@/lib/import/parseSheetCsv";

// مزامنة رحلات من رابط جوجل شيت ترسله الشركة.
//
// ⚠️ محتوى الشيت **بيانات لا تعليمات**: نقرأ منه أرقاماً وأسماء فقط، ولا يغيّر
//    شيئاً من سلوك النظام مهما كُتب فيه.
//
// 🔒 الإدخال فقط: لا تحذف المزامنة رحلة ولا تعدّل رحلة قائمة. وحذف صف من الشيت
//    لا يمسّ النظام.

export type ActionResult = { error: string | null };

export type SyncPreviewRow = SheetTripRow & {
  sourceKey: string;
  alreadyImported: boolean;
  /** صف وُضع جانباً عمداً — رحلة بلا سائق أو ملغاة (0042) */
  dismissed: boolean;
};

export type SyncPreviewResult =
  | {
      ok: true;
      rows: SyncPreviewRow[];
      newCount: number;
      existingCount: number;
      dismissedCount: number;
      sheetId: string;
      gid: string;
    }
  | { ok: false; error: string };

/** يقرأ الشيت ويقارنه بما استُورد سابقاً — لا يكتب شيئاً */
export async function fetchSheetPreview(url: string): Promise<SyncPreviewResult> {
  const parsedUrl = parseSheetUrl(url);
  if (!parsedUrl) {
    return { ok: false, error: "رابط غير صالح — يجب أن يكون رابط جوجل شيت" };
  }

  let csv: string;
  try {
    const res = await fetch(sheetCsvUrl(parsedUrl.id, parsedUrl.gid), {
      cache: "no-store",
      redirect: "follow",
    });

    if (!res.ok) {
      return {
        ok: false,
        error:
          res.status === 401 || res.status === 403
            ? "الشيت غير متاح للقراءة — تأكد أن المشاركة «أي شخص لديه الرابط يمكنه الاطّلاع»"
            : `تعذّر قراءة الشيت (رمز ${res.status})`,
      };
    }

    csv = await res.text();
  } catch {
    return { ok: false, error: "تعذّر الوصول إلى جوجل شيت — تحقّق من الاتصال" };
  }

  // صفحة تسجيل دخول بدل CSV: جوجل يردّ 200 بصفحة HTML حين لا يكون عاماً
  if (csv.trimStart().startsWith("<")) {
    return {
      ok: false,
      error: "الشيت ليس متاحاً للعموم — غيّر المشاركة إلى «أي شخص لديه الرابط يمكنه الاطّلاع»",
    };
  }

  const parsed = parseSheetCsv(csv);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const prefix = `gsheet:${parsedUrl.id}:${parsedUrl.gid}:`;
  const keys = parsed.rows.map((r) => `${prefix}${r.serial}`);

  const supabase = await createClient();
  const [{ data: existing }, { data: dismissed }] = await Promise.all([
    supabase.from("trips").select("source_key").in("source_key", keys),
    supabase.from("sheet_sync_dismissed").select("source_key").in("source_key", keys),
  ]);

  const existingKeys = new Set((existing ?? []).map((t) => t.source_key as string));
  const dismissedKeys = new Set((dismissed ?? []).map((d) => d.source_key as string));

  const rows: SyncPreviewRow[] = parsed.rows.map((r) => {
    const sourceKey = `${prefix}${r.serial}`;
    return {
      ...r,
      sourceKey,
      alreadyImported: existingKeys.has(sourceKey),
      dismissed: dismissedKeys.has(sourceKey),
    };
  });

  return {
    ok: true,
    rows,
    newCount: rows.filter((r) => !r.alreadyImported && !r.dismissed).length,
    existingCount: rows.filter((r) => r.alreadyImported).length,
    dismissedCount: rows.filter((r) => r.dismissed).length,
    sheetId: parsedUrl.id,
    gid: parsedUrl.gid,
  };
}

export type SyncApplyRow = {
  sourceKey: string;
  /** عميل موجود في النظام، أو "" لإنشاء عميل جديد باسم clientName */
  companyId: string;
  /** الاسم كما في الشيت — يُستعمل للإنشاء فقط حين يكون companyId فارغاً */
  clientName: string;
  date: string;
  fromLocation: string;
  toLocation: string;
  /** سائق موجود في النظام، أو "" لإنشاء سائق جديد باسم driverName */
  driverId: string;
  /** الاسم كما في الشيت — يُستعمل للإنشاء فقط حين يكون driverId فارغاً */
  driverName: string;
  plateNo: string;
  vehicleTypeName: string;
  baseFare: number;
  branchesCount: number;
  extraFee: number;
  returnFee: number;
  totalPrice: number;
  statusMapped: "new" | "in_progress" | "completed" | "cancelled";
  requester: string;
  notes: string;
  /** السائق الجديد يُنشأ بهذا النوع — مقترح من الملاحظات وقابل للتغيير */
  employmentType: "internal" | "external";
  /** الترب الأساسي كما كتبه المستخدم — صفر يعني «حلّه من خط السير» */
  basePayment: number;
};

export type SyncApplyResult =
  | { ok: true; createdTrips: number; createdDrivers: number; createdCompanies: number }
  | { ok: false; error: string };

export async function applySheetSync(rows: SyncApplyRow[]): Promise<SyncApplyResult> {
  if (rows.length === 0) return { ok: false, error: "لم تختر أي رحلة" };

  const supabase = await createClient();

  // --- العملاء: مطابقة بالاسم المطبَّع، وإنشاء الناقص
  const { data: companies } = await supabase.from("companies").select("id, name");
  const companyByName = new Map(
    (companies ?? []).map((c) => [normalizeArabic(c.name as string), c.id as string])
  );
  let createdCompanies = 0;

  // لا يُنشأ عميل إلا للصفوف التي لم يُربط فيها عميل موجود: تسميات الشيت تختلف
  // عن تسميات النظام، فالمستخدم يطابقها في المعاينة ولا نكرّر من اختلف اسمه.
  for (const row of rows) {
    if (row.companyId) continue;

    const key = normalizeArabic(row.clientName);
    if (!key || companyByName.has(key)) continue;

    const { data: created, error } = await supabase
      .from("companies")
      .insert({ name: row.clientName.trim(), status: "active" })
      .select("id")
      .single();

    if (error || !created) {
      return { ok: false, error: `تعذّر إنشاء العميل «${row.clientName}»` };
    }
    companyByName.set(key, created.id);
    createdCompanies += 1;
  }

  // --- السواقون: مطابقة بالاسم المطبَّع، وإنشاء الناقص
  const { data: drivers } = await supabase
    .from("drivers")
    .select("id, name, default_trip_payment, employment_type");

  const driverByName = new Map(
    (drivers ?? []).map((d) => [normalizeArabic(d.name as string), d.id as string])
  );
  const defaultTrab = new Map(
    (drivers ?? []).map((d) => [d.id as string, Number(d.default_trip_payment) || 0])
  );
  const employmentById = new Map(
    (drivers ?? []).map((d) => [d.id as string, d.employment_type as "internal" | "external"])
  );
  let createdDrivers = 0;

  // لا يُنشأ سائق إلا للصفوف التي لم يُربط فيها سائق موجود: أسماء الشيت تختلف
  // عن أسماء النظام، فالمستخدم يطابقها في المعاينة ولا نكرّر من اختلف إملاؤه.
  for (const row of rows) {
    if (row.driverId) continue;

    const key = normalizeArabic(row.driverName);
    if (!key || driverByName.has(key)) continue;

    const { data: created, error } = await supabase
      .from("drivers")
      .insert({
        name: row.driverName.trim(),
        salary: 0,
        status: "active",
        employment_type: row.employmentType,
      })
      .select("id")
      .single();

    if (error || !created) {
      return { ok: false, error: `تعذّر إنشاء السائق «${row.driverName}»` };
    }
    driverByName.set(key, created.id);
    defaultTrab.set(created.id, 0);
    employmentById.set(created.id, row.employmentType);
    createdDrivers += 1;
  }

  // --- معدَّلات الترب: خاص بالسائق ثم العام (0035)
  const { data: allRates } = await supabase
    .from("v_driver_effective_rates")
    .select("driver_id, from_city, to_city, trab_amount");

  const ratesByDriver = new Map<string, RouteRate[]>();
  for (const r of allRates ?? []) {
    const list = ratesByDriver.get(r.driver_id as string) ?? [];
    list.push({
      from_city: r.from_city as string,
      to_city: r.to_city as string,
      trab_amount: Number(r.trab_amount) || 0,
    });
    ratesByDriver.set(r.driver_id as string, list);
  }

  const { data: globalRatesRaw } = await supabase
    .from("route_rates")
    .select("from_city, to_city, trab_amount");
  const globalRates: RouteRate[] = (globalRatesRaw ?? []).map((r) => ({
    from_city: r.from_city as string,
    to_city: r.to_city as string,
    trab_amount: Number(r.trab_amount) || 0,
  }));

  // --- أنواع السيارات بالاسم
  const { data: types } = await supabase.from("vehicle_types").select("slug, name_ar");
  const typeByName = new Map(
    (types ?? []).map((t) => [
      normalizeArabic(t.name_ar as string),
      { slug: t.slug as string, name: t.name_ar as string },
    ])
  );

  let createdTrips = 0;

  for (const row of rows) {
    // العميل المختار في المعاينة أولاً، وإلا المُنشأ حديثاً باسم الشيت
    const companyId = row.companyId || companyByName.get(normalizeArabic(row.clientName));
    // السائق المختار في المعاينة أولاً، وإلا المُنشأ حديثاً باسم الشيت
    const driverId = row.driverId || driverByName.get(normalizeArabic(row.driverName));
    if (!companyId || !driverId) {
      return { ok: false, error: "تعذّر تحديد العميل أو السائق لأحد الصفوف" };
    }

    const matchedType = row.vehicleTypeName
      ? typeByName.get(normalizeArabic(row.vehicleTypeName))
      : undefined;

    // إجمالي الشيت هو المرجع، والأساسية تُشتق منه — فيطابق السعر المحفوظ ما في
    // الشيت تماماً مهما كان تفصيله
    const fileTotal =
      row.totalPrice > 0 ? row.totalPrice : row.baseFare + row.extraFee + row.returnFee;

    // رقم اللوحة يُحفظ في الملاحظات ولا يُربط بسيارة: ربط السيارة حصري لسائق
    // واحد (0034)، وربطه تلقائياً من الشيت قد ينزع سيارة من سائق آخر بلا قصد.
    const noteParts = [row.notes, row.plateNo ? `لوحة: ${row.plateNo}` : ""].filter(Boolean);

    const { error } = await supabase.from("trips").insert({
      driver_id: driverId,
      company_id: companyId,
      trip_date: row.date,
      from_location: row.fromLocation,
      to_location: row.toLocation,
      base_fare: Math.max(0, fileTotal - row.extraFee - row.returnFee),
      extra_location_fare: row.extraFee,
      overnight_fare: row.returnFee,
      branches_count:
        row.branchesCount > 0 ? row.branchesCount : destinationCount(row.toLocation),
      vehicle_type_slug: matchedType?.slug ?? null,
      vehicle_type_label: matchedType?.name ?? (row.vehicleTypeName || null),
      // ما كتبه المستخدم في المعاينة أولاً، وإلا خط السير (خاص ثم عام) ثم
      // الافتراضي. والمواقع الإضافية يضيفها المشغّل في قاعدة البيانات.
      driver_base_payment:
        row.basePayment ||
        resolveBasePayment(
          ratesByDriver.get(driverId) ?? [],
          globalRates,
          defaultTrab.get(driverId) ?? 0,
          row.fromLocation,
          row.toLocation,
          employmentById.get(driverId) ?? "internal"
        ),
      diesel_amount: 0,
      requester: row.requester || null,
      status: row.statusMapped,
      notes: noteParts.join(" · ") || null,
      source_key: row.sourceKey,
    });

    if (error) {
      // الفهرس الفريد على source_key يمنع التكرار حتى لو أُرسل الصف مرتين
      if (error.code === "23505") continue;
      return { ok: false, error: "حدث خطأ أثناء إنشاء إحدى الرحلات" };
    }

    createdTrips += 1;
  }

  revalidatePath("/trips");
  revalidatePath("/drivers");
  revalidatePath("/companies");
  revalidatePath("/dashboard");

  return { ok: true, createdTrips, createdDrivers, createdCompanies };
}

/** حفظ رابط الشيت في الإعدادات ليبقى بين الجلسات */
export async function saveSheetUrl(url: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update({ trips_sheet_url: url.trim() || null })
    .eq("id", true);

  if (error) return { error: "تعذّر حفظ الرابط" };

  revalidatePath("/trips/sync");
  return { error: null };
}

/**
 * وضع صفوف جانباً فلا تُقترح في المزامنات القادمة.
 *
 * للرحلات التي لا تُستورد أبداً: رحلة بلا سائق حُوِّلت بضاعتها لغيره لكن كشف
 * العميل يذكرها، أو رحلة ملغاة. تبقى في الشيت — لا سلطان لنا عليه — لكن
 * المزامنة تعرفها وتضعها جانباً.
 *
 * ⚠️ لا رحلة تُنشأ ولا تُحذف — يُحفظ المفتاح وحده، فلا أثر في أي حساب.
 */
export async function dismissSheetRows(
  sourceKeys: string[],
  reason?: string
): Promise<ActionResult> {
  if (sourceKeys.length === 0) return { error: "لم تختر أي صف" };

  const supabase = await createClient();
  const { error } = await supabase.from("sheet_sync_dismissed").upsert(
    sourceKeys.map((k) => ({ source_key: k, reason: reason?.trim() || null })),
    { onConflict: "source_key" }
  );

  if (error) return { error: "تعذّر تجاهل الصفوف" };

  revalidatePath("/trips/sync");
  return { error: null };
}

/** التراجع عن التجاهل — يعود الصف «جديداً» في المزامنة التالية */
export async function undismissSheetRows(sourceKeys: string[]): Promise<ActionResult> {
  if (sourceKeys.length === 0) return { error: "لم تختر أي صف" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("sheet_sync_dismissed")
    .delete()
    .in("source_key", sourceKeys);

  if (error) return { error: "تعذّر التراجع عن التجاهل" };

  revalidatePath("/trips/sync");
  return { error: null };
}
