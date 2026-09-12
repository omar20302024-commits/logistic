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
 * اسم نوع السيارة وقت الرحلة يُحفظ نصاً على الرحلة نفسها. لو تغيّر نوع السيارة
 * لاحقاً أو حُذفت، تبقى الرحلة شاهدة على ما نُفِّذت به — نفس مبدأ branch_code.
 */
async function vehicleTypeLabel(
  supabase: Awaited<ReturnType<typeof createClient>>,
  vehicleId: string | undefined
): Promise<string | null> {
  if (!vehicleId) return null;
  const { data } = await supabase
    .from("vehicles")
    .select("vehicle_types(name_ar)")
    .eq("id", vehicleId)
    .single();
  const types = (data as { vehicle_types?: { name_ar: string } | { name_ar: string }[] } | null)
    ?.vehicle_types;
  const type = Array.isArray(types) ? types[0] : types;
  return type?.name_ar ?? null;
}

type LocationRow = { location_name: string; branch_code?: string; amount: number };

/**
 * كود الفرع يُحفظ نصاً دائماً، ويُربط بسجل الفرع إن وُجد له كود مطابق لدى هذا
 * العميل. الكود النصي هو الأصل: لو حُذف الفرع من السجل لاحقاً تبقى الرحلة شاهدة
 * على الكود الذي نُفِّذت عليه فعلاً.
 */
async function buildLocationRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tripId: string,
  companyId: string,
  values: { loading_locations: LocationRow[]; unloading_locations: LocationRow[] }
) {
  const codes = [...values.loading_locations, ...values.unloading_locations]
    .map((l) => l.branch_code?.trim())
    .filter((c): c is string => !!c);

  const codeToId = new Map<string, string>();
  if (codes.length > 0) {
    const { data } = await supabase
      .from("company_branches")
      .select("id, branch_code")
      .eq("company_id", companyId)
      .in("branch_code", codes);
    for (const b of data ?? []) codeToId.set(b.branch_code, b.id);
  }

  const row = (l: LocationRow, i: number, type: "loading" | "unloading") => {
    const code = l.branch_code?.trim() || null;
    return {
      trip_id: tripId,
      location_type: type,
      location_name: l.location_name,
      branch_code: code,
      branch_id: code ? (codeToId.get(code) ?? null) : null,
      amount: l.amount,
      sort_order: i,
    };
  };

  return [
    ...values.loading_locations.map((l, i) => row(l, i, "loading")),
    ...values.unloading_locations.map((l, i) => row(l, i, "unloading")),
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
      overnight_fare: values.overnight_fare,
      driver_overnight_payment: values.driver_overnight_payment,
      driver_base_payment: values.driver_base_payment,
      diesel_amount: values.diesel_amount,
      requester: values.requester || null,
      vehicle_id: values.vehicle_id || null,
      vehicle_type_label: await vehicleTypeLabel(supabase, values.vehicle_id),
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

  const locationRows = await buildLocationRows(supabase, trip.id, values.company_id, values);
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
      overnight_fare: values.overnight_fare,
      driver_overnight_payment: values.driver_overnight_payment,
      driver_base_payment: values.driver_base_payment,
      diesel_amount: values.diesel_amount,
      requester: values.requester || null,
      vehicle_id: values.vehicle_id || null,
      vehicle_type_label: await vehicleTypeLabel(supabase, values.vehicle_id),
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

  const locationRows = await buildLocationRows(supabase, id, values.company_id, values);
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

/**
 * فروع آخر رحلة لنفس العميل ونفس الوجهة — يوفّر إعادة كتابتها للوجهات المتكررة.
 * المطابقة على الوجهة تتجاهل الفروق الإملائية العربية (fn_normalize_ar).
 */
export async function getLastTripBranches(
  companyId: string,
  toLocation: string
): Promise<{
  branches: { location_name: string; branch_code: string | null; amount: number }[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_last_trip_branches", {
    p_company_id: companyId,
    p_to_location: toLocation,
  });

  if (error) {
    return { branches: [], error: "تعذّر جلب الفروع — تأكد من تشغيل ملف SQL رقم 0021" };
  }

  return {
    branches: (data ?? []) as {
      location_name: string;
      branch_code: string | null;
      amount: number;
    }[],
    error: null,
  };
}
