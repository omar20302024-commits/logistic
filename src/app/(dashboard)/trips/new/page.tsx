import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TripForm } from "@/components/trips/TripForm";

export default async function NewTripPage() {
  const supabase = await createClient();

  const [
    { data: driversRaw },
    { data: companies },
    { data: branches },
    { data: vehiclesRaw },
    { data: settings },
  ] =
    await Promise.all([
    supabase
      .from("drivers")
      .select(
        "id, name, default_trip_payment, extra_stop_rate, vehicle_id, driver_route_rates(from_city, to_city, trab_amount)"
      )
      .eq("status", "active")
      .order("name"),
    supabase.from("companies").select("id, name, extra_location_rate").eq("status", "active").order("name"),
    supabase
      .from("company_branches")
      .select("company_id, branch_code, branch_name")
      .eq("is_active", true)
      .order("branch_code"),
    supabase
      .from("vehicles")
      .select("id, vehicle_no, plate_no, vehicle_types(name_ar)")
      .eq("status", "active")
      .order("vehicle_no"),
    supabase.from("settings").select("currency_symbol").single(),
  ]);

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
        drivers={drivers ?? []}
        companies={companies ?? []}
        branches={branches ?? []}
        vehicles={vehicles}
        currencySymbol={settings?.currency_symbol ?? "ر.س"}
      />
    </div>
  );
}
