"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { OIL_CATEGORY } from "@/lib/validation/expense";

// تغيير الزيت (0040): مصروف شركة مربوط بالسائق.
//
// يُسجَّل في جدول expenses الذي يُخصم من الربح أصلاً — فلا معادلة جديدة ولا
// تعديل على دوال الربح.
//
// ⚠️ هذا لمصروف الشركة المباشر. الزيت المدفوع من عهدة السائق أو من جيبه
//    يُسجَّل قيد عهدة ببند «صيانة» كما هو اليوم، فيُضاف لمستحقاته.

export type ActionResult = { error: string | null };

export type OilChangeRecord = {
  id: string;
  date: string;
  amount: number;
  notes: string | null;
};

function validate(date: string, amount: number): string | null {
  if (!date) return "التاريخ مطلوب";
  if (!Number.isFinite(amount) || amount <= 0) return "المبلغ يجب أن يكون أكبر من صفر";
  return null;
}

function touch(driverId: string) {
  revalidatePath(`/drivers/${driverId}`);
  revalidatePath("/expenses");
  revalidatePath("/reports/financial");
  revalidatePath("/dashboard");
}

export async function createOilChange(
  driverId: string,
  input: { date: string; amount: number; notes?: string }
): Promise<ActionResult> {
  const invalid = validate(input.date, Number(input.amount));
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { error } = await supabase.from("expenses").insert({
    driver_id: driverId,
    category: OIL_CATEGORY,
    date: input.date,
    amount: Number(input.amount),
    notes: input.notes?.trim() || null,
  });

  if (error) return { error: "تعذّر تسجيل تغيير الزيت" };

  touch(driverId);
  return { error: null };
}

export async function updateOilChange(
  driverId: string,
  id: string,
  input: { date: string; amount: number; notes?: string }
): Promise<ActionResult> {
  const invalid = validate(input.date, Number(input.amount));
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { error } = await supabase
    .from("expenses")
    .update({
      date: input.date,
      amount: Number(input.amount),
      notes: input.notes?.trim() || null,
    })
    .eq("id", id);

  if (error) return { error: "تعذّر تعديل تغيير الزيت" };

  touch(driverId);
  return { error: null };
}

export async function deleteOilChange(driverId: string, id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").delete().eq("id", id);

  if (error) return { error: "تعذّر حذف تغيير الزيت" };

  touch(driverId);
  return { error: null };
}
