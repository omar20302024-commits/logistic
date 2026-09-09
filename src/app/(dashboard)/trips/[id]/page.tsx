import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
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

  const [{ data: trip, error }, { data: locations }, { data: driversRaw }, { data: companies }, { data: settings }] =
    await Promise.all([
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
          "id, name, default_trip_payment, extra_stop_rate, driver_route_rates(from_city, to_city, trab_amount)"
        )
        .order("name"),
      supabase.from("companies").select("id, name").order("name"),
      supabase.from("settings").select("currency_symbol").single(),
    ]);

  if (error || !trip) notFound();

  const drivers = (driversRaw ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    default_trip_payment: d.default_trip_payment,
    extra_stop_rate: d.extra_stop_rate,
    route_rates: d.driver_route_rates ?? [],
  }));

  const loading_locations = (locations ?? [])
    .filter((l) => l.location_type === "loading")
    .map((l) => ({ location_name: l.location_name, amount: l.amount }));
  const unloading_locations = (locations ?? [])
    .filter((l) => l.location_type === "unloading")
    .map((l) => ({ location_name: l.location_name, amount: l.amount }));

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

      <TripForm
        drivers={drivers ?? []}
        companies={companies ?? []}
        currencySymbol={settings?.currency_symbol ?? "ر.س"}
        initialData={{
          id: trip.id,
          trip_number: trip.trip_number,
          driver_id: trip.driver_id,
          company_id: trip.company_id,
          trip_date: trip.trip_date,
          from_location: trip.from_location,
          to_location: trip.to_location,
          driver_base_payment: trip.driver_base_payment,
          diesel_amount: trip.diesel_amount,
          status: trip.status,
          notes: trip.notes,
          loading_locations,
          unloading_locations,
        }}
      />
    </div>
  );
}
