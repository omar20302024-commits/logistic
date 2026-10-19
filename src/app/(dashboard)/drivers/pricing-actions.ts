"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// سعر المورّد/السائق للحملة — يُكتب وقت تسجيل الرحلة في «الترب الأساسي»،
// ويُعدَّل بعدها من صفحة السائق أو صفحة المورّد.
//
// 🔢 نحرّر driver_base_payment وحده: المواقع الإضافية والمبيت يضيفها المشغّل
//    في قاعدة البيانات على driver_trip_payment — لا نحسبها هنا.
//
// 🔒 الرحلة المصفّاة أرقامها مجمَّدة في سند مصروف، فلا تُمَس أبداً. الحارس
//    مكرَّر في الواجهة (تُعرض مقفلة) وفي شرط التحديث — والثاني هو المعتبَر.

export type ActionResult = { error: string | null };

/** النطاق يحدّد ملكية الرحلة: سائق بعينه، أو كل سائقي مورّد */
export type PricingScope =
  | { kind: "driver"; id: string }
  | { kind: "vendor"; id: string };

export type TripPaymentRow = {
  id: string;
  trip_date: string;
  trip_number: string;
  driver_name?: string | null;
  company_name: string;
  from_location: string;
  to_location: string;
  trip_amount: number;
  /** المحرَّر: أساس الترب قبل المواقع الإضافية والمبيت */
  driver_base_payment: number;
  /** المحسوب في قاعدة البيانات: الأساسي + الإضافات */
  driver_trip_payment: number;
  settled: boolean;
};

export async function setTripBasePayments(
  scope: PricingScope,
  rows: { tripId: string; amount: number }[]
): Promise<ActionResult & { updated?: number }> {
  const valid = rows.filter((r) => r.tripId && Number.isFinite(Number(r.amount)));
  if (valid.length === 0) return { error: "لم تُدخل أي مبلغ" };

  if (valid.some((r) => Number(r.amount) < 0)) {
    return { error: "المبلغ يجب ألا يكون سالباً" };
  }

  const supabase = await createClient();

  // نطاق المورّد = سائقوه. نجلبهم أولاً لأن UPDATE لا يَصِل جدولاً آخر،
  // فيبقى شرط الملكية محروساً في الخادم لا في الواجهة.
  let driverIds: string[] = [];
  if (scope.kind === "vendor") {
    const { data, error } = await supabase
      .from("drivers")
      .select("id")
      .eq("vendor_id", scope.id);

    if (error) return { error: "تعذّر قراءة سائقي المورّد" };
    driverIds = (data ?? []).map((d) => d.id as string);
    if (driverIds.length === 0) return { error: "لا يوجد سائقون تحت هذا المورّد" };
  }

  // المبالغ تختلف من رحلة لأخرى، فلا مفرّ من تحديث كل صف على حدة
  for (const r of valid) {
    let q = supabase
      .from("trips")
      .update({ driver_base_payment: Number(r.amount) })
      .eq("id", r.tripId)
      .is("settlement_id", null)
      .is("vendor_settlement_id", null);

    q =
      scope.kind === "driver"
        ? q.eq("driver_id", scope.id)
        : q.in("driver_id", driverIds);

    const { error } = await q;
    if (error) return { error: "تعذّر حفظ الأسعار" };
  }

  if (scope.kind === "driver") revalidatePath(`/drivers/${scope.id}`);
  else revalidatePath(`/vendors/${scope.id}`);
  revalidatePath("/drivers");
  revalidatePath("/vendors");
  revalidatePath("/trips");
  revalidatePath("/dashboard");
  return { error: null, updated: valid.length };
}
