"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { expenseSchema } from "@/lib/validation/expense";

export type ActionResult = { error: string | null };

export async function createExpense(input: unknown): Promise<ActionResult> {
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };

  const supabase = await createClient();
  const { error } = await supabase.from("expenses").insert({
    date: parsed.data.date,
    category: parsed.data.category,
    description: parsed.data.description || null,
    amount: parsed.data.amount,
    notes: parsed.data.notes || null,
  });

  if (error) return { error: "حدث خطأ أثناء إضافة المصروف" };

  revalidatePath("/expenses");
  revalidatePath("/reports/financial");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function updateExpense(id: string, input: unknown): Promise<ActionResult> {
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("expenses")
    .update({
      date: parsed.data.date,
      category: parsed.data.category,
      description: parsed.data.description || null,
      amount: parsed.data.amount,
      notes: parsed.data.notes || null,
    })
    .eq("id", id);

  if (error) return { error: "حدث خطأ أثناء تعديل المصروف" };

  revalidatePath("/expenses");
  revalidatePath("/reports/financial");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").delete().eq("id", id);

  if (error) return { error: "حدث خطأ أثناء حذف المصروف" };

  revalidatePath("/expenses");
  revalidatePath("/reports/financial");
  revalidatePath("/dashboard");
  return { error: null };
}
