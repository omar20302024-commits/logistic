"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { tripSchema } from "@/lib/validation/trip";

export type ActionResult = { error: string | null };

function buildLocationRows(
  tripId: string,
  values: { loading_locations: { location_name: string; amount: number; amount_status: string }[]; unloading_locations: { location_name: string; amount: number; amount_status: string }[] }
) {
  return [
    ...values.loading_locations.map((l) => ({
      trip_id: tripId,
      location_type: "loading" as const,
      location_name: l.location_name,
      amount: l.amount,
      amount_status: l.amount_status,
    })),
    ...values.unloading_locations.map((l) => ({
      trip_id: tripId,
      location_type: "unloading" as const,
      location_name: l.location_name,
      amount: l.amount,
      amount_status: l.amount_status,
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
      driver_trip_payment: values.driver_trip_payment,
      diesel_amount: values.diesel_amount,
      status: values.status,
      notes: values.notes || null,
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
      driver_trip_payment: values.driver_trip_payment,
      diesel_amount: values.diesel_amount,
      status: values.status,
      notes: values.notes || null,
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
