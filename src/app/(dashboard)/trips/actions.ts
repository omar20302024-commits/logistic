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

function buildLocationRows(
  tripId: string,
  values: {
    loading_locations: { location_name: string; amount: number }[];
    unloading_locations: { location_name: string; amount: number }[];
  }
) {
  return [
    ...values.loading_locations.map((l, i) => ({
      trip_id: tripId,
      location_type: "loading" as const,
      location_name: l.location_name,
      amount: l.amount,
      sort_order: i,
    })),
    ...values.unloading_locations.map((l, i) => ({
      trip_id: tripId,
      location_type: "unloading" as const,
      location_name: l.location_name,
      amount: l.amount,
      sort_order: i,
    })),
  ];
}

export async function createTrip(input: unknown): Promise<ActionResult & { id?: string }> {
  const parsed = tripSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }
  const values = parsed.data;

  const supabase = await createClient();

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .insert({
      trip_number: values.trip_number || null,
      driver_id: values.driver_id,
      company_id: values.company_id,
      trip_date: values.trip_date,
      from_location: values.from_location,
      to_location: values.to_location,
      base_fare: values.base_fare,
      labor_fare: values.labor_fare,
      extra_location_fare: values.extra_location_fare,
      driver_base_payment: values.driver_base_payment,
      diesel_amount: values.diesel_amount,
      requester: values.requester || null,
      status: values.status,
      notes: values.notes || null,
      created_by: await currentUserId(supabase),
    })
    .select("id")
    .single();

  if (tripError || !trip) {
    if (tripError?.code === "23505") {
      return { error: "رقم الرحلة مستخدم بالفعل، اختر رقماً آخر أو اتركه فارغاً للتوليد التلقائي" };
    }
    return { error: "حدث خطأ أثناء إضافة الرحلة" };
  }

  const locationRows = buildLocationRows(trip.id, values);
  if (locationRows.length > 0) {
    const { error: locError } = await supabase.from("trip_locations").insert(locationRows);
    if (locError) {
      return { error: "تم إنشاء الرحلة لكن حدث خطأ أثناء حفظ المواقع" };
    }
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

  const { error: tripError } = await supabase
    .from("trips")
    .update({
      trip_number: values.trip_number || null,
      driver_id: values.driver_id,
      company_id: values.company_id,
      trip_date: values.trip_date,
      from_location: values.from_location,
      to_location: values.to_location,
      base_fare: values.base_fare,
      labor_fare: values.labor_fare,
      extra_location_fare: values.extra_location_fare,
      driver_base_payment: values.driver_base_payment,
      diesel_amount: values.diesel_amount,
      requester: values.requester || null,
      status: values.status,
      notes: values.notes || null,
      updated_by: await currentUserId(supabase),
    })
    .eq("id", id);

  if (tripError) {
    if (tripError.code === "23505") {
      return { error: "رقم الرحلة مستخدم بالفعل، اختر رقماً آخر" };
    }
    return { error: "حدث خطأ أثناء تعديل الرحلة" };
  }

  // نستبدل كل مواقع الرحلة بالمجموعة الحالية من النموذج (أبسط وأضمن من محاولة المطابقة)
  const { error: deleteError } = await supabase.from("trip_locations").delete().eq("trip_id", id);
  if (deleteError) return { error: "حدث خطأ أثناء تحديث مواقع الرحلة" };

  const locationRows = buildLocationRows(id, values);
  if (locationRows.length > 0) {
    const { error: locError } = await supabase.from("trip_locations").insert(locationRows);
    if (locError) return { error: "حدث خطأ أثناء حفظ مواقع الرحلة" };
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
