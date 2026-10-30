"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// إضافات على الراتب (0053): ما يزيد الراتب، مقابل السلف والخصومات التي
// تنقصه. أشهر حالاتها: أيام عمل من شهر سابق لم تُصرف.
//
// 🔑 التاريخ هو تاريخ **الصرف** — الشهر الذي تدخل مسيّره. والشهر الأصلي
//    يُوثَّق في forMonth/forYear للعرض والمراجعة لا للحساب.

export type ActionResult = { error: string | null };

export type SalaryAddition = {
  id: string;
  date: string;
  amount: number;
  reason: string | null;
  for_year: number | null;
  for_month: number | null;
  days: number | null;
};

export async function createSalaryAddition(
  driverId: string,
  input: {
    date: string;
    amount: number;
    reason?: string;
    forYear?: number | null;
    forMonth?: number | null;
    days?: number | null;
  }
): Promise<ActionResult> {
  if (!input.date) return { error: "التاريخ مطلوب" };

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "المبلغ يجب أن يكون أكبر من صفر" };
  }

  const month = input.forMonth ?? null;
  if (month !== null && (month < 1 || month > 12)) {
    return { error: "الشهر غير صحيح" };
  }

  const days = input.days ?? null;
  if (days !== null && (!Number.isFinite(days) || days < 0)) {
    return { error: "عدد الأيام غير صحيح" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("driver_salary_additions").insert({
    driver_id: driverId,
    date: input.date,
    amount,
    reason: input.reason?.trim() || null,
    for_year: input.forYear ?? null,
    for_month: month,
    days,
  });

  if (error) {
    if (error.code === "42P01") {
      return { error: "شغّل ملف SQL رقم 0053 (إضافات الراتب) ثم أعد المحاولة" };
    }
    return { error: "تعذّر حفظ الإضافة" };
  }

  revalidateAll(driverId);
  return { error: null };
}

export async function deleteSalaryAddition(
  driverId: string,
  id: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("driver_salary_additions").delete().eq("id", id);

  if (error) return { error: "تعذّر حذف الإضافة" };

  revalidateAll(driverId);
  return { error: null };
}

function revalidateAll(driverId: string) {
  revalidatePath(`/drivers/${driverId}`);
  revalidatePath("/salaries");
  revalidatePath("/statement");
  revalidatePath("/dashboard");
}
