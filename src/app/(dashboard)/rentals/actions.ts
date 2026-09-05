"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { rentalContractSchema } from "@/lib/validation/rental";

export type ActionResult = { error: string | null };

export async function createRentalContract(input: unknown): Promise<ActionResult> {
  const parsed = rentalContractSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };

  const supabase = await createClient();
  const { error } = await supabase.from("rental_contracts").insert({
    driver_id: parsed.data.driver_id,
    company_id: parsed.data.company_id,
    city: parsed.data.city || null,
    month: parsed.data.month,
    year: parsed.data.year,
    monthly_amount: parsed.data.monthly_amount,
    housing_unit_id: parsed.data.housing_unit_id || null,
    diesel_amount: parsed.data.diesel_amount,
    notes: parsed.data.notes || null,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "يوجد بالفعل عقد إيجار لهذا السائق في نفس الشهر والسنة" };
    }
    return { error: "حدث خطأ أثناء إضافة عقد الإيجار" };
  }

  revalidatePath("/rentals");
  revalidatePath("/rentals/report");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function updateRentalContract(id: string, input: unknown): Promise<ActionResult> {
  const parsed = rentalContractSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("rental_contracts")
    .update({
      driver_id: parsed.data.driver_id,
      company_id: parsed.data.company_id,
      city: parsed.data.city || null,
      month: parsed.data.month,
      year: parsed.data.year,
      monthly_amount: parsed.data.monthly_amount,
      housing_unit_id: parsed.data.housing_unit_id || null,
      diesel_amount: parsed.data.diesel_amount,
      notes: parsed.data.notes || null,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { error: "يوجد بالفعل عقد إيجار لهذا السائق في نفس الشهر والسنة" };
    }
    return { error: "حدث خطأ أثناء تعديل عقد الإيجار" };
  }

  revalidatePath("/rentals");
  revalidatePath("/rentals/report");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function deleteRentalContract(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("rental_contracts").delete().eq("id", id);

  if (error) return { error: "حدث خطأ أثناء حذف عقد الإيجار" };

  revalidatePath("/rentals");
  revalidatePath("/rentals/report");
  revalidatePath("/dashboard");
  return { error: null };
}
