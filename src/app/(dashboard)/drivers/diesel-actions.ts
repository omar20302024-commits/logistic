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
  input: { date: string; amount: number; reference?: string; notes?: string }
): Promise<ActionResult> {
  const invalid = validate(input.date, Number(input.amount));
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { error } = await supabase.from("driver_diesel_entries").insert({
    driver_id: driverId,
    date: input.date,
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
  input: { date: string; amount: number; reference?: string; notes?: string }
): Promise<ActionResult> {
  const invalid = validate(input.date, Number(input.amount));
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { error } = await supabase
    .from("driver_diesel_entries")
    .update({
      date: input.date,
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
