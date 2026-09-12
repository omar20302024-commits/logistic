import { createClient } from "@/lib/supabase/server";
import { TripsReportTable } from "@/components/reports/TripsReportTable";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ReviewedByFooter } from "@/components/ui/ReviewedByFooter";

function firstDayOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

export default async function TripsReportPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    driver?: string;
    company?: string;
    status?: string;
  }>;
}) {
  const params = await searchParams;
  const from = params.from || firstDayOfMonth();
  const to = params.to || today();
  const driver = params.driver ?? "";
  const company = params.company ?? "";
  const status = params.status ?? "";

  const supabase = await createClient();

  let query = supabase
    .from("v_trips_full")
    .select(
      "id, trip_number, trip_date, company_name, driver_name, vehicle_type_label, vehicle_id, from_location, to_location, requester, status, base_fare, labor_fare, extra_location_fare, overnight_fare, trip_amount, driver_trip_payment"
    )
    .gte("trip_date", from)
    .lte("trip_date", to)
    .order("trip_date", { ascending: false });

  if (driver) query = query.eq("driver_id", driver);
  if (company) query = query.eq("company_id", company);
  if (status) query = query.eq("status", status);

  const [{ data: rows, error }, { data: drivers }, { data: companies }, { data: vehicles }, { data: settings }] =
    await Promise.all([
      query,
      supabase.from("drivers").select("id, name").order("name"),
      supabase.from("companies").select("id, name").order("name"),
      supabase.from("vehicles").select("id, vehicle_no"),
      supabase.from("settings").select("currency_symbol, reviewed_by").single(),
    ]);

  const vehicleNoById = new Map((vehicles ?? []).map((v) => [v.id, v.vehicle_no]));

  const trips = (rows ?? []).map((r) => ({
    ...r,
    vehicle_no: r.vehicle_id ? (vehicleNoById.get(r.vehicle_id) ?? null) : null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">تقرير الرحلات</h1>
        <p className="text-sm text-zinc-500">كل الرحلات بتفاصيلها وبنود أجرتها خلال الفترة</p>
      </div>

      <ErrorBanner
        error={error}
        hint="تأكد من تشغيل ملفات SQL حتى رقم 0022 (بنود الأجرة والسيارات)."
      />

      <TripsReportTable
        trips={trips}
        drivers={drivers ?? []}
        companies={companies ?? []}
        currencySymbol={settings?.currency_symbol ?? "ر.س"}
        filters={{ from, to, driver, company, status }}
      />

      <ReviewedByFooter name={settings?.reviewed_by} />
    </div>
  );
}
