"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { custodyEntrySchema } from "@/lib/validation/custody";

export type ActionResult = { error: string | null };

// قيد 'work_expense' بقى يخصم من ربح الشركة، فلازم التقرير المالي يتحدّث كمان
function revalidateCustody(driverId: string) {
  revalidatePath(`/drivers/${driverId}`);
  revalidatePath("/statement");
  revalidatePath("/statement/public");
  revalidatePath("/statement/trab");
  revalidatePath("/reports/financial");
  revalidatePath("/dashboard");
}

function toRow(data: {
  date: string;
  type: "credit" | "debit";
  reason: string;
  expense_category?: string;
  trip_id?: string;
  amount: number;
  description?: string;
  notes?: string;
}) {
  return {
    date: data.date,
    type: data.type,
    reason: data.reason,
    expense_category: data.expense_category || null,
    trip_id: data.trip_id || null,
    amount: data.amount,
    description: data.description || null,
    notes: data.notes || null,
  };
}

export async function createCustodyEntry(driverId: string, input: unknown): Promise<ActionResult> {
  const parsed = custodyEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("driver_custody_entries")
    .insert({ driver_id: driverId, ...toRow(parsed.data) });

  if (error) return { error: "حدث خطأ أثناء إضافة حركة العهدة" };

  revalidateCustody(driverId);
  return { error: null };
}

export async function updateCustodyEntry(
  driverId: string,
  id: string,
  input: unknown
): Promise<ActionResult> {
  const parsed = custodyEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("driver_custody_entries")
    .update(toRow(parsed.data))
    .eq("id", id);

  if (error) return { error: "حدث خطأ أثناء تعديل حركة العهدة" };

  revalidateCustody(driverId);
  return { error: null };
}

export async function deleteCustodyEntry(driverId: string, id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("driver_custody_entries")
    .delete()
    .eq("id", id);

  if (error) return { error: "حدث خطأ أثناء حذف حركة العهدة" };

  revalidateCustody(driverId);
  return { error: null };
}
