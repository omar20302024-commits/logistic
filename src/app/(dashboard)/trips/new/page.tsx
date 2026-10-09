import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TripForm } from "@/components/trips/TripForm";

export default async function NewTripPage() {
  const supabase = await createClient();

  const [{ data: driversRaw }, { data: companies }, { data: vehicleTypes }, { data: settings }, { data: globalRouteRates }] =
    await Promise.all([
      supabase
        .from("drivers")
        .select(
          "id, name, default_trip_payment, extra_stop_rate, employment_type, driver_route_rates(from_city, to_city, trab_amount)"
        )
        .eq("status", "active")
        .order("name"),
      supabase
        .from("companies")
        .select("id, name, extra_location_rate")
        .eq("status", "active")
        .order("name"),
      supabase
        .from("vehicle_types")
        .select("slug, name_ar")
        .eq("is_active", true)
        .order("sort_order"),
      supabase.from("settings").select("currency_symbol").single(),
      supabase.from("route_rates").select("from_city, to_city, trab_amount"),
    ]);

  const drivers = (driversRaw ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    default_trip_payment: d.default_trip_payment,
    extra_stop_rate: d.extra_stop_rate,
    employment_type: d.employment_type,
    route_rates: d.driver_route_rates ?? [],
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/trips"
          className="mb-2 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ArrowRight size={15} />
          العودة للرحلات
        </Link>
        <h1 className="text-xl font-bold text-zinc-900">إضافة رحلة جديدة</h1>
      </div>

      <TripForm
        drivers={drivers}
        companies={companies ?? []}
        vehicleTypes={vehicleTypes ?? []}
        globalRouteRates={globalRouteRates ?? []}
        currencySymbol={settings?.currency_symbol ?? "ر.س"}
      />
    </div>
  );
}
