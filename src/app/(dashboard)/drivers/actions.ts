"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { driverSchema } from "@/lib/validation/driver";

export type ActionResult = { error: string | null };

export async function createDriver(input: unknown): Promise<ActionResult> {
  const parsed = driverSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("drivers").insert({
    name: parsed.data.name,
    phone: parsed.data.phone || null,
    salary: parsed.data.salary,
    default_trip_payment: parsed.data.default_trip_payment,
    extra_stop_rate: parsed.data.extra_stop_rate,
    hire_date: parsed.data.hire_date || null,
    vehicle_id: parsed.data.vehicle_id || null,
    status: parsed.data.status,
    employment_type: parsed.data.employment_type,
    notes: parsed.data.notes || null,
  });

  if (error) return { error: "حدث خطأ أثناء إضافة السائق" };

  revalidatePath("/drivers");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function updateDriver(id: string, input: unknown): Promise<ActionResult> {
  const parsed = driverSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("drivers")
    .update({
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      salary: parsed.data.salary,
      default_trip_payment: parsed.data.default_trip_payment,
      extra_stop_rate: parsed.data.extra_stop_rate,
      hire_date: parsed.data.hire_date || null,
      vehicle_id: parsed.data.vehicle_id || null,
      status: parsed.data.status,
      employment_type: parsed.data.employment_type,
      notes: parsed.data.notes || null,
    })
    .eq("id", id);

  if (error) return { error: "حدث خطأ أثناء تعديل بيانات السائق" };

  revalidatePath("/drivers");
  revalidatePath(`/drivers/${id}`);
  revalidatePath("/dashboard");
  return { error: null };
}

export async function deleteDriver(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("drivers").delete().eq("id", id);

  if (error) {
    if (error.code === "23503") {
      return {
        error: "لا يمكن حذف هذا السائق لوجود رحلات مسجَّلة له. يمكنك تغيير حالته إلى (غير نشط) بدلاً من الحذف.",
      };
    }
    return { error: "حدث خطأ أثناء حذف السائق" };
  }

  revalidatePath("/drivers");
  revalidatePath("/dashboard");
  return { error: null };
}
