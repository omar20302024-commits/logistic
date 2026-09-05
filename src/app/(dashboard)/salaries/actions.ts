"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { salarySchema } from "@/lib/validation/salary";

export type ActionResult = { error: string | null };

export async function createSalary(input: unknown): Promise<ActionResult> {
  const parsed = salarySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("salaries").insert({
    driver_id: parsed.data.driver_id,
    month: parsed.data.month,
    year: parsed.data.year,
    basic_salary: parsed.data.basic_salary,
    paid_amount: parsed.data.paid_amount,
    payment_date: parsed.data.payment_date || null,
    notes: parsed.data.notes || null,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "يوجد بالفعل راتب مسجَّل لهذا السائق في هذا الشهر والسنة" };
    }
    return { error: "حدث خطأ أثناء إضافة الراتب" };
  }

  revalidatePath("/salaries");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function updateSalary(id: string, input: unknown): Promise<ActionResult> {
  const parsed = salarySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("salaries")
    .update({
      driver_id: parsed.data.driver_id,
      month: parsed.data.month,
      year: parsed.data.year,
      basic_salary: parsed.data.basic_salary,
      paid_amount: parsed.data.paid_amount,
      payment_date: parsed.data.payment_date || null,
      notes: parsed.data.notes || null,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { error: "يوجد بالفعل راتب مسجَّل لهذا السائق في هذا الشهر والسنة" };
    }
    return { error: "حدث خطأ أثناء تعديل الراتب" };
  }

  revalidatePath("/salaries");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function deleteSalary(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("salaries").delete().eq("id", id);

  if (error) return { error: "حدث خطأ أثناء حذف الراتب" };

  revalidatePath("/salaries");
  revalidatePath("/dashboard");
  return { error: null };
}
