"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { driverSchema } from "@/lib/validation/driver";

export type ActionResult = { error: string | null };

/** تاريخ التحويل وسببه — مطلوبان حين تكون السيارة مرتبطة بسائق آخر */
export type VehicleTransfer = { date?: string; reason?: string };

export async function createDriver(
  input: unknown,
  transfer?: VehicleTransfer
): Promise<ActionResult> {
  const parsed = driverSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("drivers")
    .insert({
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      salary: parsed.data.salary,
      default_trip_payment: parsed.data.default_trip_payment,
      extra_stop_rate: parsed.data.extra_stop_rate,
      hire_date: parsed.data.hire_date || null,
      status: parsed.data.status,
      employment_type: parsed.data.employment_type,
      notes: parsed.data.notes || null,
    })
    .select("id")
    .single();

  if (error || !created) return { error: "حدث خطأ أثناء إضافة السائق" };

  // السيارة بعد الإنشاء وعبر الدالة — نفس سبب updateDriver أدناه.
  // السائق أُنشئ فعلاً، فلو فشل الربط نُبلغ به ولا نتظاهر بالنجاح.
  if (parsed.data.vehicle_id) {
    const assignError = await assignVehicle(
      created.id,
      parsed.data.vehicle_id,
      transfer?.date,
      transfer?.reason
    );
    if (assignError) {
      revalidatePath("/drivers");
      return { error: `أُضيف السائق لكن تعذّر ربط السيارة: ${assignError}` };
    }
  }

  revalidatePath("/drivers");
  revalidatePath("/dashboard");
  revalidatePath("/vehicles");
  return { error: null };
}

export async function updateDriver(
  id: string,
  input: unknown,
  transfer?: VehicleTransfer
): Promise<ActionResult> {
  const parsed = driverSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const transferDate = transfer?.date;
  const transferReason = transfer?.reason;

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
      status: parsed.data.status,
      employment_type: parsed.data.employment_type,
      notes: parsed.data.notes || null,
    })
    .eq("id", id);

  if (error) return { error: "حدث خطأ أثناء تعديل بيانات السائق" };

  // السيارة لا تُكتب مع بقية الحقول: ربطها قد يستلزم فكّها عن سائق آخر، وهما
  // خطوتان لا تصحّ إحداهما دون الأخرى — fn_assign_vehicle تنفّذهما معاً (0034).
  const assignError = await assignVehicle(
    id,
    parsed.data.vehicle_id || null,
    transferDate,
    transferReason
  );
  if (assignError) return { error: assignError };

  revalidatePath("/drivers");
  revalidatePath(`/drivers/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/vehicles");
  return { error: null };
}

/**
 * ربط سيارة بسائق أو فكّها، عبر دالة قاعدة البيانات.
 * تُرجع نص الخطأ أو null عند النجاح.
 */
async function assignVehicle(
  driverId: string,
  vehicleId: string | null,
  date?: string,
  reason?: string
): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_assign_vehicle", {
    p_driver_id: driverId,
    p_vehicle_id: vehicleId,
    p_date: date || new Date().toISOString().slice(0, 10),
    p_reason: reason || null,
  });

  if (!error) return null;

  // رسائل الدالة نفسها عربية ومفهومة، فنمرّرها كما هي بدل رسالة عامة
  if (error.message?.includes("سبب التحويل")) return error.message;
  if (error.code === "23505") {
    return "هذه السيارة مرتبطة بسائق آخر — اختر تحويلها مع ذكر التاريخ والسبب";
  }
  return "تعذّر ربط السيارة بالسائق";
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
