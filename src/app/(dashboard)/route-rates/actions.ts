"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeArabic } from "@/lib/arabic";

export type ActionResult = { error: string | null };

export type RouteRateRecord = {
  id: string;
  from_city: string;
  to_city: string;
  trab_amount: number;
  notes: string | null;
};

export type RouteSuggestion = {
  from_city: string;
  to_city: string;
  suggested_trab: number;
  drivers_count: number;
  differing: number;
  already_global: boolean;
};

/**
 * منع التكرار المطبَّع: قاعدة البيانات فريدة على النص الحرفي، فـ«جده ← الرياض»
 * و«جدة ← الرياض» يمرّان كصفّين مختلفين ويفوز أحدهما عشوائياً وقت المطابقة.
 * الفحص هنا يمنع ذلك قبل الكتابة.
 */
async function findNormalizedClash(
  fromCity: string,
  toCity: string,
  excludeId?: string
): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("route_rates").select("id, from_city, to_city");

  const from = normalizeArabic(fromCity);
  const to = normalizeArabic(toCity);

  const clash = (data ?? []).find(
    (r) =>
      r.id !== excludeId &&
      normalizeArabic(r.from_city as string) === from &&
      normalizeArabic(r.to_city as string) === to
  );

  if (!clash) return null;
  return `يوجد خط سير بنفس المدينتين بإملاء مختلف: «${clash.from_city} ← ${clash.to_city}». عدّله بدل إضافة صف ثانٍ.`;
}

function validate(fromCity: string, toCity: string, trab: number): string | null {
  if (!fromCity.trim()) return "مدينة التحميل مطلوبة";
  if (!toCity.trim()) return "مدينة التنزيل مطلوبة";
  if (!Number.isFinite(trab) || trab < 0) return "الترب يجب أن يكون رقماً موجباً";
  return null;
}

export async function createRouteRate(input: {
  from_city: string;
  to_city: string;
  trab_amount: number;
  notes?: string;
}): Promise<ActionResult> {
  const invalid = validate(input.from_city, input.to_city, Number(input.trab_amount));
  if (invalid) return { error: invalid };

  const clash = await findNormalizedClash(input.from_city, input.to_city);
  if (clash) return { error: clash };

  const supabase = await createClient();
  const { error } = await supabase.from("route_rates").insert({
    from_city: input.from_city.trim(),
    to_city: input.to_city.trim(),
    trab_amount: Number(input.trab_amount),
    notes: input.notes?.trim() || null,
  });

  if (error) {
    if (error.code === "23505") return { error: "هذا الخط مسجَّل بالفعل" };
    return { error: "تعذّر إضافة خط السير" };
  }

  revalidatePath("/route-rates");
  return { error: null };
}

export async function updateRouteRate(
  id: string,
  input: { from_city: string; to_city: string; trab_amount: number; notes?: string }
): Promise<ActionResult> {
  const invalid = validate(input.from_city, input.to_city, Number(input.trab_amount));
  if (invalid) return { error: invalid };

  const clash = await findNormalizedClash(input.from_city, input.to_city, id);
  if (clash) return { error: clash };

  const supabase = await createClient();
  const { error } = await supabase
    .from("route_rates")
    .update({
      from_city: input.from_city.trim(),
      to_city: input.to_city.trim(),
      trab_amount: Number(input.trab_amount),
      notes: input.notes?.trim() || null,
    })
    .eq("id", id);

  if (error) return { error: "تعذّر تعديل خط السير" };

  revalidatePath("/route-rates");
  return { error: null };
}

export async function deleteRouteRate(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("route_rates").delete().eq("id", id);
  if (error) return { error: "تعذّر حذف خط السير" };

  revalidatePath("/route-rates");
  return { error: null };
}

/** اقتراحات مبنية على خطوط سير سائقي الشركة المسجَّلة فعلاً (0035) */
export async function suggestRouteRates(): Promise<
  { ok: true; rows: RouteSuggestion[] } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_suggest_route_rates");

  if (error) {
    return { ok: false, error: "تعذّر قراءة الاقتراحات — تأكد من تشغيل ملف SQL رقم 0035" };
  }

  return {
    ok: true,
    rows: (data ?? []).map((r: Record<string, unknown>) => ({
      from_city: r.from_city as string,
      to_city: r.to_city as string,
      suggested_trab: Number(r.suggested_trab) || 0,
      drivers_count: Number(r.drivers_count) || 0,
      differing: Number(r.differing) || 0,
      already_global: Boolean(r.already_global),
    })),
  };
}

/** اعتماد الاقتراحات المختارة — لا تلمس ما هو مسجَّل عاماً بالفعل */
export async function applyRouteSuggestions(
  rows: { from_city: string; to_city: string; trab_amount: number }[]
): Promise<ActionResult> {
  if (rows.length === 0) return { error: "لم تختر أي خط سير" };

  const supabase = await createClient();
  const { error } = await supabase.from("route_rates").upsert(
    rows.map((r) => ({
      from_city: r.from_city,
      to_city: r.to_city,
      trab_amount: Number(r.trab_amount) || 0,
    })),
    { onConflict: "from_city,to_city" }
  );

  if (error) return { error: "تعذّر اعتماد الاقتراحات" };

  revalidatePath("/route-rates");
  return { error: null };
}
