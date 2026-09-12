"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { monthlyDieselSchema, type DieselOverlap } from "@/lib/validation/monthlyDiesel";

export type ActionResult = { error: string | null };

function revalidateDiesel() {
  revalidatePath("/diesel");
  revalidatePath("/reports/diesel");
  revalidatePath("/reports/financial");
  revalidatePath("/dashboard");
}

export async function createMonthlyDiesel(input: unknown): Promise<ActionResult> {
  const parsed = monthlyDieselSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("driver_monthly_diesel").insert({
    driver_id: parsed.data.driver_id,
    year: parsed.data.year,
    month: parsed.data.month,
    amount: parsed.data.amount,
    notes: parsed.data.notes || null,
  });

  // القيد الفريد (سائق، سنة، شهر) هو الحارس الحقيقي ضد تسجيل نفس الشهر مرتين
  if (error?.code === "23505") {
    return { error: "هذا السائق له سجل ديزل لهذا الشهر بالفعل — عدّله بدل إضافة سجل ثانٍ" };
  }
  if (error) return { error: "حدث خطأ أثناء حفظ الديزل الشهري" };

  revalidateDiesel();
  return { error: null };
}

export async function updateMonthlyDiesel(id: string, input: unknown): Promise<ActionResult> {
  const parsed = monthlyDieselSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("driver_monthly_diesel")
    .update({
      driver_id: parsed.data.driver_id,
      year: parsed.data.year,
      month: parsed.data.month,
      amount: parsed.data.amount,
      notes: parsed.data.notes || null,
    })
    .eq("id", id);

  if (error?.code === "23505") {
    return { error: "هذا السائق له سجل ديزل لهذا الشهر بالفعل" };
  }
  if (error) return { error: "حدث خطأ أثناء تعديل الديزل الشهري" };

  revalidateDiesel();
  return { error: null };
}

export async function deleteMonthlyDiesel(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("driver_monthly_diesel").delete().eq("id", id);

  if (error) return { error: "حدث خطأ أثناء حذف السجل" };

  revalidateDiesel();
  return { error: null };
}

/**
 * سائقون لهم ديزل مسجَّل على رحلاتهم **وكذلك** سجل ديزل شهري لنفس الشهر.
 * هذه هي الحالة الوحيدة التي يُحتسب فيها الديزل مرتين، وتحدث عادةً في شهر
 * التحويل من التسجيل لكل رحلة إلى التسجيل الشهري.
 */
export async function getDieselOverlaps(
  year: number,
  month: number
): Promise<{ overlaps: DieselOverlap[]; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_diesel_overlap_check", {
    p_year: year,
    p_month: month,
  });

  if (error) {
    return { overlaps: [], error: "تعذّر فحص ازدواج الديزل — تأكد من تشغيل ملف SQL رقم 0020" };
  }

  return { overlaps: (data ?? []) as DieselOverlap[], error: null };
}
