import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, AlertTriangle, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TripForm } from "@/components/trips/TripForm";
import { DeleteTripButton } from "@/components/trips/DeleteTripButton";

export default async function EditTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: trip, error }, { data: driversRaw }, { data: companies }, { data: vehicleTypes }, { data: settings }] =
    await Promise.all([
      supabase.from("trips").select("*").eq("id", id).single(),
      supabase
        .from("drivers")
        .select(
          "id, name, default_trip_payment, extra_stop_rate, driver_route_rates(from_city, to_city, trab_amount)"
        )
        .order("name"),
      supabase.from("companies").select("id, name, extra_location_rate").order("name"),
      supabase
        .from("vehicle_types")
        .select("slug, name_ar")
        .eq("is_active", true)
        .order("sort_order"),
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
        <div className="flex items-center gap-2">
          <Link
            href={`/trips/${trip.id}/waybill`}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <FileText size={15} />
            بوليصة الشحن
          </Link>
          <DeleteTripButton tripId={trip.id} tripNumber={trip.trip_number} />
        </div>
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
        drivers={drivers}
        companies={companies ?? []}
        vehicleTypes={vehicleTypes ?? []}
        currencySymbol={settings?.currency_symbol ?? "ر.س"}
        initialData={{
          id: trip.id,
          trip_number: trip.trip_number,
          driver_id: trip.driver_id,
          company_id: trip.company_id,
          trip_date: trip.trip_date,
          from_location: trip.from_location,
          to_location: trip.to_location,
          branches_count: trip.branches_count,
          vehicle_type_slug: trip.vehicle_type_slug,
          base_fare: trip.base_fare,
          labor_fare: trip.labor_fare,
          extra_location_fare: trip.extra_location_fare,
          overnight_fare: trip.overnight_fare,
          driver_base_payment: trip.driver_base_payment,
          driver_overnight_payment: trip.driver_overnight_payment,
          diesel_amount: trip.diesel_amount,
          requester: trip.requester,
          status: trip.status,
          notes: trip.notes,
        }}
      />
    </div>
  );
}
