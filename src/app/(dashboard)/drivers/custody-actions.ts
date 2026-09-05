"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { custodyEntrySchema } from "@/lib/validation/custody";

export type ActionResult = { error: string | null };

export async function createCustodyEntry(driverId: string, input: unknown): Promise<ActionResult> {
  const parsed = custodyEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("driver_custody_entries").insert({
    driver_id: driverId,
    date: parsed.data.date,
    type: parsed.data.type,
    amount: parsed.data.amount,
    description: parsed.data.description || null,
    notes: parsed.data.notes || null,
  });

  if (error) return { error: "حدث خطأ أثناء إضافة حركة العهدة" };

  revalidatePath(`/drivers/${driverId}`);
  revalidatePath("/statement");
  revalidatePath("/statement/public");
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
    .update({
      date: parsed.data.date,
      type: parsed.data.type,
      amount: parsed.data.amount,
      description: parsed.data.description || null,
      notes: parsed.data.notes || null,
    })
    .eq("id", id);

  if (error) return { error: "حدث خطأ أثناء تعديل حركة العهدة" };

  revalidatePath(`/drivers/${driverId}`);
  revalidatePath("/statement");
  revalidatePath("/statement/public");
  return { error: null };
}

export async function deleteCustodyEntry(driverId: string, id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("driver_custody_entries").delete().eq("id", id);

  if (error) return { error: "حدث خطأ أثناء حذف حركة العهدة" };

  revalidatePath(`/drivers/${driverId}`);
  revalidatePath("/statement");
  revalidatePath("/statement/public");
  return { error: null };
}
