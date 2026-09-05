"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ledgerEntrySchema } from "@/lib/validation/ledger";

export type ActionResult = { error: string | null };
export type LedgerType = "advance" | "deduction";

const tableFor = (type: LedgerType) =>
  type === "advance" ? "driver_advances" : "driver_deductions";

export async function createLedgerEntry(
  type: LedgerType,
  driverId: string,
  input: unknown
): Promise<ActionResult> {
  const parsed = ledgerEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from(tableFor(type)).insert({
    driver_id: driverId,
    date: parsed.data.date,
    amount: parsed.data.amount,
    description: parsed.data.description || null,
    notes: parsed.data.notes || null,
  });

  if (error) return { error: type === "advance" ? "حدث خطأ أثناء إضافة السلفة" : "حدث خطأ أثناء إضافة الخصم" };

  revalidatePath(`/drivers/${driverId}`);
  revalidatePath("/salaries");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function updateLedgerEntry(
  type: LedgerType,
  driverId: string,
  id: string,
  input: unknown
): Promise<ActionResult> {
  const parsed = ledgerEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from(tableFor(type))
    .update({
      date: parsed.data.date,
      amount: parsed.data.amount,
      description: parsed.data.description || null,
      notes: parsed.data.notes || null,
    })
    .eq("id", id);

  if (error) return { error: "حدث خطأ أثناء التعديل" };

  revalidatePath(`/drivers/${driverId}`);
  revalidatePath("/salaries");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function deleteLedgerEntry(
  type: LedgerType,
  driverId: string,
  id: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from(tableFor(type)).delete().eq("id", id);

  if (error) return { error: "حدث خطأ أثناء الحذف" };

  revalidatePath(`/drivers/${driverId}`);
  revalidatePath("/salaries");
  revalidatePath("/dashboard");
  return { error: null };
}
