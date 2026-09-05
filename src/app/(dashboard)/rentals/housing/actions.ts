"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { housingUnitSchema } from "@/lib/validation/housing";

export type ActionResult = { error: string | null };

export async function createHousingUnit(input: unknown): Promise<ActionResult> {
  const parsed = housingUnitSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };

  const supabase = await createClient();
  const { error } = await supabase.from("housing_units").insert({
    name: parsed.data.name,
    city: parsed.data.city || null,
    monthly_rent: parsed.data.monthly_rent,
    notes: parsed.data.notes || null,
  });

  if (error) return { error: "حدث خطأ أثناء إضافة وحدة السكن" };

  revalidatePath("/rentals/housing");
  revalidatePath("/rentals");
  revalidatePath("/rentals/report");
  return { error: null };
}

export async function updateHousingUnit(id: string, input: unknown): Promise<ActionResult> {
  const parsed = housingUnitSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("housing_units")
    .update({
      name: parsed.data.name,
      city: parsed.data.city || null,
      monthly_rent: parsed.data.monthly_rent,
      notes: parsed.data.notes || null,
    })
    .eq("id", id);

  if (error) return { error: "حدث خطأ أثناء تعديل وحدة السكن" };

  revalidatePath("/rentals/housing");
  revalidatePath("/rentals");
  revalidatePath("/rentals/report");
  return { error: null };
}

export async function deleteHousingUnit(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("housing_units").delete().eq("id", id);

  if (error) return { error: "حدث خطأ أثناء حذف وحدة السكن" };

  revalidatePath("/rentals/housing");
  revalidatePath("/rentals");
  revalidatePath("/rentals/report");
  return { error: null };
}
