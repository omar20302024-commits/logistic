"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { routeRateSchema } from "@/lib/validation/routeRate";

export type ActionResult = { error: string | null };

export async function createRouteRate(driverId: string, input: unknown): Promise<ActionResult> {
  const parsed = routeRateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };

  const supabase = await createClient();
  const { error } = await supabase.from("driver_route_rates").insert({
    driver_id: driverId,
    from_city: parsed.data.from_city,
    to_city: parsed.data.to_city,
    trab_amount: parsed.data.trab_amount,
    notes: parsed.data.notes || null,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "يوجد بالفعل ترب محدَّد لنفس مدينتي التحميل والتنزيل لهذا السائق" };
    }
    return { error: "حدث خطأ أثناء إضافة خط السير" };
  }

  revalidatePath(`/drivers/${driverId}`);
  return { error: null };
}

export async function updateRouteRate(
  driverId: string,
  id: string,
  input: unknown
): Promise<ActionResult> {
  const parsed = routeRateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("driver_route_rates")
    .update({
      from_city: parsed.data.from_city,
      to_city: parsed.data.to_city,
      trab_amount: parsed.data.trab_amount,
      notes: parsed.data.notes || null,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { error: "يوجد بالفعل ترب محدَّد لنفس مدينتي التحميل والتنزيل لهذا السائق" };
    }
    return { error: "حدث خطأ أثناء تعديل خط السير" };
  }

  revalidatePath(`/drivers/${driverId}`);
  return { error: null };
}

export async function deleteRouteRate(driverId: string, id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("driver_route_rates").delete().eq("id", id);

  if (error) return { error: "حدث خطأ أثناء حذف خط السير" };

  revalidatePath(`/drivers/${driverId}`);
  return { error: null };
}
