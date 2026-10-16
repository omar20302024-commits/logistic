"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// حركات ديزل السائق (0039).
//
// 🔒 المجموع الشهري **لا يُكتب من هنا**: مشغّل في قاعدة البيانات يعيد حسابه من
//    الحركات بعد كل إضافة أو تعديل أو حذف (قاعدة #5 — لا مجموع يُكتب يدوياً).

export type ActionResult = { error: string | null };

export type DieselEntryRecord = {
  id: string;
  date: string;
  to_date: string | null;
  amount: number;
  reference: string | null;
  notes: string | null;
};

function validate(date: string, amount: number): string | null {
  if (!date) return "التاريخ مطلوب";
  if (!Number.isFinite(amount) || amount <= 0) return "المبلغ يجب أن يكون أكبر من صفر";
  return null;
}

export async function createDieselEntry(
  driverId: string,
  input: { date: string; toDate?: string | null; amount: number; reference?: string; notes?: string }
): Promise<ActionResult> {
  const invalid = validate(input.date, Number(input.amount));
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { error } = await supabase.from("driver_diesel_entries").insert({
    driver_id: driverId,
    date: input.date,
    to_date: input.toDate || null,
    amount: Number(input.amount),
    reference: input.reference?.trim() || null,
    notes: input.notes?.trim() || null,
  });

  if (error) return { error: "تعذّر تسجيل التفويلة" };

  revalidatePath(`/drivers/${driverId}`);
  revalidatePath("/reports/diesel");
  revalidatePath("/reports/financial");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function updateDieselEntry(
  driverId: string,
  id: string,
  input: { date: string; toDate?: string | null; amount: number; reference?: string; notes?: string }
): Promise<ActionResult> {
  const invalid = validate(input.date, Number(input.amount));
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { error } = await supabase
    .from("driver_diesel_entries")
    .update({
      date: input.date,
      to_date: input.toDate || null,
      amount: Number(input.amount),
      reference: input.reference?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .eq("id", id);

  if (error) return { error: "تعذّر تعديل التفويلة" };

  revalidatePath(`/drivers/${driverId}`);
  revalidatePath("/reports/diesel");
  revalidatePath("/reports/financial");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function deleteDieselEntry(driverId: string, id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("driver_diesel_entries").delete().eq("id", id);

  if (error) return { error: "تعذّر حذف التفويلة" };

  revalidatePath(`/drivers/${driverId}`);
  revalidatePath("/reports/diesel");
  revalidatePath("/reports/financial");
  revalidatePath("/dashboard");
  return { error: null };
}

export type DieselOverlap = {
  year: number;
  month: number;
  trips_diesel: number;
  monthly_diesel: number;
};

/** شهور اجتمع فيها ديزل رحلات وديزل شهري — ازدواج حقيقي لا مجرّد رقم قديم */
export async function getDriverDieselOverlaps(
  driverId: string
): Promise<{ overlaps: DieselOverlap[]; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_driver_diesel_overlap", {
    p_driver_id: driverId,
  });

  if (error) {
    return { overlaps: [], error: "تعذّر فحص الازدواج — تأكد من تشغيل ملف SQL رقم 0041" };
  }
  return { overlaps: (data ?? []) as DieselOverlap[], error: null };
}

/**
 * تصفير ديزل الرحلات القديمة لشهر بعينه.
 *
 * ⚠️ يعدّل رحلات مسجَّلة — بطلب صريح من المستخدم وبتأكيد، ولشهر واحد فقط.
 *    الحقل لم يعد يُدخل من نموذج الرحلة، فلا سبيل آخر لتصحيحه من الواجهة.
 */
export async function zeroTripDieselForMonth(
  driverId: string,
  year: number,
  month: number
): Promise<ActionResult> {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0); // اليوم الأخير من الشهر
  const end = `${year}-${String(month).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;

  const supabase = await createClient();
  const { error } = await supabase
    .from("trips")
    .update({ diesel_amount: 0 })
    .eq("driver_id", driverId)
    .gte("trip_date", start)
    .lte("trip_date", end);

  if (error) return { error: "تعذّر تصفير ديزل الرحلات" };

  revalidatePath(`/drivers/${driverId}`);
  revalidatePath("/reports/diesel");
  revalidatePath("/reports/financial");
  revalidatePath("/dashboard");
  return { error: null };
}
