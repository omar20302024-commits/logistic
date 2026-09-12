"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { tripSchema } from "@/lib/validation/trip";

export type ActionResult = { error: string | null };

// سجل من أنشأ/عدّل — يُؤخذ من الجلسة نفسها لا من النموذج، حتى لا يُزوَّر
async function currentUserId(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/**
 * اسم نوع السيارة يُحفظ نصاً على الرحلة بجانب المعرّف. لو أُعيدت تسمية النوع
 * لاحقاً أو حُذف، تبقى الرحلة شاهدة على ما نُفِّذت به.
 */
async function vehicleTypeLabel(
  supabase: Awaited<ReturnType<typeof createClient>>,
  slug: string | undefined
): Promise<string | null> {
  if (!slug) return null;
  const { data } = await supabase
    .from("vehicle_types")
    .select("name_ar")
    .eq("slug", slug)
    .single();
  return data?.name_ar ?? null;
}

/**
 * ملاحظة: جدول trip_locations لم يعد يُكتب إليه — عدد الفروع صار رقماً واحداً
 * على الرحلة (branches_count منذ 0025). صفوف الرحلات القديمة تبقى كما هي ولا
 * تُلمس، فتاريخها محفوظ.
 */
export async function createTrip(input: unknown): Promise<ActionResult & { id?: string }> {
  const parsed = tripSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }
  const values = parsed.data;

  const supabase = await createClient();

  const { data: trip, error } = await supabase
    .from("trips")
    .insert({
      trip_number: values.trip_number || null,
      driver_id: values.driver_id,
      company_id: values.company_id,
      trip_date: values.trip_date,
      from_location: values.from_location,
      to_location: values.to_location,
      branches_count: values.branches_count,
      vehicle_type_slug: values.vehicle_type_slug || null,
      vehicle_type_label: await vehicleTypeLabel(supabase, values.vehicle_type_slug),
      base_fare: values.base_fare,
      labor_fare: values.labor_fare,
      extra_location_fare: values.extra_location_fare,
      overnight_fare: values.overnight_fare,
      driver_base_payment: values.driver_base_payment,
      driver_overnight_payment: values.driver_overnight_payment,
      diesel_amount: values.diesel_amount,
      requester: values.requester || null,
      status: values.status,
      notes: values.notes || null,
      created_by: await currentUserId(supabase),
    })
    .select("id")
    .single();

  if (error || !trip) {
    if (error?.code === "23505") {
      return { error: "رقم الرحلة مستخدم بالفعل، اختر رقماً آخر أو اتركه فارغاً للتوليد التلقائي" };
    }
    return { error: "حدث خطأ أثناء إضافة الرحلة" };
  }

  revalidatePath("/trips");
  revalidatePath("/dashboard");
  return { error: null, id: trip.id };
}

export async function updateTrip(id: string, input: unknown): Promise<ActionResult> {
  const parsed = tripSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }
  const values = parsed.data;

  const supabase = await createClient();

  const { error } = await supabase
    .from("trips")
    .update({
      trip_number: values.trip_number || null,
      driver_id: values.driver_id,
      company_id: values.company_id,
      trip_date: values.trip_date,
      from_location: values.from_location,
      to_location: values.to_location,
      branches_count: values.branches_count,
      vehicle_type_slug: values.vehicle_type_slug || null,
      vehicle_type_label: await vehicleTypeLabel(supabase, values.vehicle_type_slug),
      base_fare: values.base_fare,
      labor_fare: values.labor_fare,
      extra_location_fare: values.extra_location_fare,
      overnight_fare: values.overnight_fare,
      driver_base_payment: values.driver_base_payment,
      driver_overnight_payment: values.driver_overnight_payment,
      diesel_amount: values.diesel_amount,
      requester: values.requester || null,
      status: values.status,
      notes: values.notes || null,
      updated_by: await currentUserId(supabase),
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { error: "رقم الرحلة مستخدم بالفعل، اختر رقماً آخر" };
    }
    return { error: "حدث خطأ أثناء تعديل الرحلة" };
  }

  revalidatePath("/trips");
  revalidatePath(`/trips/${id}`);
  revalidatePath("/dashboard");
  return { error: null };
}

export async function deleteTrip(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("trips").delete().eq("id", id);

  if (error) return { error: "حدث خطأ أثناء حذف الرحلة" };

  revalidatePath("/trips");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function deleteTripAndRedirect(id: string) {
  const result = await deleteTrip(id);
  if (!result.error) redirect("/trips");
  return result;
}
