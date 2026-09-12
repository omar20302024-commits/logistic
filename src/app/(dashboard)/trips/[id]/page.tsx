import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TripForm } from "@/components/trips/TripForm";
import { DeleteTripButton } from "@/components/trips/DeleteTripButton";

export default async function EditTripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: trip, error },
    { data: locations },
    { data: driversRaw },
    { data: companies },
    { data: branches },
    { data: vehiclesRaw },
    { data: settings },
  ] = await Promise.all([
      supabase.from("trips").select("*").eq("id", id).single(),
      supabase
        .from("trip_locations")
        .select("*")
        .eq("trip_id", id)
        .order("sort_order")
        .order("created_at"),
      supabase
        .from("drivers")
        .select(
          "id, name, default_trip_payment, extra_stop_rate, vehicle_id, driver_route_rates(from_city, to_city, trab_amount)"
        )
        .order("name"),
      supabase.from("companies").select("id, name, extra_location_rate").order("name"),
      supabase
        .from("company_branches")
        .select("company_id, branch_code, branch_name")
        .eq("is_active", true)
        .order("branch_code"),
      supabase
        .from("vehicles")
        .select("id, vehicle_no, plate_no, vehicle_types(name_ar)")
        .order("vehicle_no"),
      supabase.from("settings").select("currency_symbol").single(),
    ]);

  if (error || !trip) notFound();

  const vehicles = (vehiclesRaw ?? []).map((v) => {
    const raw = v as unknown as {
      id: string;
      vehicle_no: string;
      plate_no: string | null;
      vehicle_types: { name_ar: string } | { name_ar: string }[] | null;
    };
    const type = Array.isArray(raw.vehicle_types) ? raw.vehicle_types[0] : raw.vehicle_types;
    return {
      id: raw.id,
      vehicle_no: raw.vehicle_no,
      plate_no: raw.plate_no,
      type_name: type?.name_ar ?? null,
    };
  });

  const drivers = (driversRaw ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    default_trip_payment: d.default_trip_payment,
    extra_stop_rate: d.extra_stop_rate,
    vehicle_id: d.vehicle_id,
    route_rates: d.driver_route_rates ?? [],
  }));

  const loading_locations = (locations ?? [])
    .filter((l) => l.location_type === "loading")
    .map((l) => ({
      location_name: l.location_name,
      branch_code: l.branch_code ?? null,
      amount: l.amount,
    }));
  const unloading_locations = (locations ?? [])
    .filter((l) => l.location_type === "unloading")
    .map((l) => ({
      location_name: l.location_name,
      branch_code: l.branch_code ?? null,
      amount: l.amount,
    }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/trips"
            className="mb-2 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
          >
            <ArrowRight size={15} />
            العودة للرحلات
          </Link>
          <h1 className="text-xl font-bold text-zinc-900">تعديل الرحلة {trip.trip_number}</h1>
        </div>
        <DeleteTripButton tripId={trip.id} tripNumber={trip.trip_number} />
      </div>

      {trip.settlement_id && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">ترب هذه الرحلة مُصفّى بالفعل</p>
            <p className="text-xs">
              التعديل مسموح، لكن مبلغ سند التصفية لن يتغيّر لأنه مجمَّد وقت الصرف — والرحلة لن
              تدخل أي تصفية قادمة لأنها موسومة بهذا السند. فلو عدّلت الترب هنا، سوِّ الفرق بإلغاء
              السند وإعادة تصفيته، أو بقيد عهدة يدوي.{" "}
              <Link href={`/settlements/${trip.settlement_id}`} className="font-medium underline">
                عرض السند
              </Link>
            </p>
          </div>
        </div>
      )}

      <TripForm
        drivers={drivers ?? []}
        companies={companies ?? []}
        branches={branches ?? []}
        vehicles={vehicles}
        currencySymbol={settings?.currency_symbol ?? "ر.س"}
        initialData={{
          id: trip.id,
          trip_number: trip.trip_number,
          driver_id: trip.driver_id,
          company_id: trip.company_id,
          trip_date: trip.trip_date,
          from_location: trip.from_location,
          to_location: trip.to_location,
          base_fare: trip.base_fare,
          labor_fare: trip.labor_fare,
          extra_location_fare: trip.extra_location_fare,
          overnight_fare: trip.overnight_fare,
          driver_overnight_payment: trip.driver_overnight_payment,
          driver_base_payment: trip.driver_base_payment,
          diesel_amount: trip.diesel_amount,
          requester: trip.requester,
          vehicle_id: trip.vehicle_id,
          status: trip.status,
          notes: trip.notes,
          loading_locations,
          unloading_locations,
        }}
      />
    </div>
  );
}
