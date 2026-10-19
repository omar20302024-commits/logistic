"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// تسعير يدوي لرحلات مسجَّلة بترب صفر.
//
// سعر الحملة على العميل يبقى كما هو؛ هذا يخصّ ما يأخذه السائق أو المورد —
// يكتبه المستخدم بيده، بلا خطوط سير ولا جداول تسعيرة.
//
// الحاجة: الرحلات التي دخلت قبل وجود تسعيرة — ومنها المستورد من الشيت لسائق
// خارجي — بقيت بترب صفر، فلا تظهر في مستحقه ولا تُصفّى. وفتح كل رحلة على
// حدة غير عملي.
//
// 🔢 نكتب driver_base_payment وحده: المواقع الإضافية يضيفها المشغّل في قاعدة
//    البيانات على driver_trip_payment — لا نحسبها هنا.

export type ActionResult = { error: string | null };

export type UnpricedTrip = {
  id: string;
  trip_number: string;
  trip_date: string;
  company_name: string;
  from_location: string;
  to_location: string;
  branches_count: number;
  trip_amount: number;
  driver_base_payment: number;
  settled: boolean;
};

export async function setTripBasePayments(
  driverId: string,
  rows: { tripId: string; amount: number }[]
): Promise<ActionResult & { updated?: number }> {
  const valid = rows.filter((r) => r.tripId && Number.isFinite(Number(r.amount)));
  if (valid.length === 0) return { error: "لم تُدخل أي مبلغ" };

  const negative = valid.find((r) => Number(r.amount) < 0);
  if (negative) return { error: "المبلغ يجب ألا يكون سالباً" };

  const supabase = await createClient();

  // المبالغ تختلف من رحلة لأخرى، فلا مفرّ من تحديث كل صف على حدة
  for (const r of valid) {
    const { error } = await supabase
      .from("trips")
      .update({ driver_base_payment: Number(r.amount) })
      .eq("id", r.tripId)
      .eq("driver_id", driverId)
      // الرحلة المصفّاة جزء من سند مصروف بأرقام مجمّدة — لا تُمَس
      .is("settlement_id", null)
      .is("vendor_settlement_id", null);

    if (error) return { error: "تعذّر حفظ الأسعار" };
  }

  revalidatePath(`/drivers/${driverId}`);
  revalidatePath("/trips");
  revalidatePath("/vendors");
  revalidatePath("/dashboard");
  return { error: null, updated: valid.length };
}
