"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { leaveSchema } from "@/lib/validation/leave";

export type ActionResult = { error: string | null };

// الإجازة بتغيّر الراتب المستحق، فكل شاشة بتعرض راتباً لازم تتحدّث
function revalidateLeave(driverId: string) {
  revalidatePath(`/drivers/${driverId}`);
  revalidatePath("/salaries");
  revalidatePath("/statement");
  revalidatePath("/statement/public");
  revalidatePath("/statement/trab");
}

/**
 * قاعدة البيانات بترفض تداخل إجازتين لنفس السائق (exclude constraint). الرسالة
 * الخام بتبقى إنجليزية وغير مفهومة، فنترجمها لسبب واضح.
 */
function mapError(message: string, fallback: string): string {
  if (message.includes("no_overlapping_driver_leaves")) {
    return "هذه الفترة متداخلة مع إجازة مسجَّلة بالفعل لنفس السائق";
  }
  return fallback;
}

export async function createLeave(driverId: string, input: unknown): Promise<ActionResult> {
  const parsed = leaveSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("driver_leaves").insert({
    driver_id: driverId,
    from_date: parsed.data.from_date,
    to_date: parsed.data.to_date || null,
    notes: parsed.data.notes || null,
  });

  if (error) return { error: mapError(error.message, "حدث خطأ أثناء تسجيل الإجازة") };

  revalidateLeave(driverId);
  return { error: null };
}

export async function updateLeave(
  driverId: string,
  id: string,
  input: unknown
): Promise<ActionResult> {
  const parsed = leaveSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("driver_leaves")
    .update({
      from_date: parsed.data.from_date,
      to_date: parsed.data.to_date || null,
      notes: parsed.data.notes || null,
    })
    .eq("id", id);

  if (error) return { error: mapError(error.message, "حدث خطأ أثناء تعديل الإجازة") };

  revalidateLeave(driverId);
  return { error: null };
}

export async function deleteLeave(driverId: string, id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("driver_leaves").delete().eq("id", id);

  if (error) return { error: "حدث خطأ أثناء حذف الإجازة" };

  revalidateLeave(driverId);
  return { error: null };
}
