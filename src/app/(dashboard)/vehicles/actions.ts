"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { vehicleSchema, vehicleTypeSchema } from "@/lib/validation/vehicle";

export type ActionResult = { error: string | null };

function revalidateVehicles() {
  revalidatePath("/vehicles");
  revalidatePath("/drivers");
  revalidatePath("/trips/new");
}

function toRow(data: {
  vehicle_no: string;
  plate_no?: string;
  type_slug?: string;
  status: "active" | "inactive" | "maintenance";
  notes?: string;
}) {
  return {
    vehicle_no: data.vehicle_no,
    plate_no: data.plate_no || null,
    type_slug: data.type_slug || null,
    status: data.status,
    notes: data.notes || null,
  };
}

export async function createVehicle(input: unknown): Promise<ActionResult> {
  const parsed = vehicleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("vehicles").insert(toRow(parsed.data));

  if (error?.code === "23505") return { error: "رقم السيارة مستخدم بالفعل" };
  if (error) return { error: "حدث خطأ أثناء إضافة السيارة" };

  revalidateVehicles();
  return { error: null };
}

export async function updateVehicle(id: string, input: unknown): Promise<ActionResult> {
  const parsed = vehicleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("vehicles").update(toRow(parsed.data)).eq("id", id);

  if (error?.code === "23505") return { error: "رقم السيارة مستخدم بالفعل" };
  if (error) return { error: "حدث خطأ أثناء تعديل السيارة" };

  revalidateVehicles();
  return { error: null };
}

export async function deleteVehicle(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  // الرحلات والسائقون المرتبطون يفقدون الربط فقط (on delete set null)،
  // لكن الرحلة تحتفظ باسم النوع المسجَّل عليها وقت تنفيذها
  const { error } = await supabase.from("vehicles").delete().eq("id", id);

  if (error) return { error: "حدث خطأ أثناء حذف السيارة" };

  revalidateVehicles();
  return { error: null };
}

export async function createVehicleType(input: unknown): Promise<ActionResult> {
  const parsed = vehicleTypeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("vehicle_types").insert(parsed.data);

  if (error?.code === "23505") return { error: "هذا المعرّف مستخدم بالفعل" };
  if (error) return { error: "حدث خطأ أثناء إضافة النوع" };

  revalidateVehicles();
  return { error: null };
}

export async function updateVehicleType(id: string, input: unknown): Promise<ActionResult> {
  const parsed = vehicleTypeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("vehicle_types").update(parsed.data).eq("id", id);

  if (error?.code === "23505") return { error: "هذا المعرّف مستخدم بالفعل" };
  if (error) return { error: "حدث خطأ أثناء تعديل النوع" };

  revalidateVehicles();
  return { error: null };
}
