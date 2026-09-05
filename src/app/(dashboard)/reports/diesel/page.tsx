import { createClient } from "@/lib/supabase/server";
import { DieselReportTable } from "@/components/reports/DieselReportTable";

const PAGE_SIZE = 25;

function firstDayOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

export default async function DieselReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; driver?: string; company?: string; page?: string }>;
}) {
  const params = await searchParams;
  const from = params.from || firstDayOfMonth();
  const to = params.to || today();
  const driverId = params.driver ?? "";
  const companyId = params.company ?? "";
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const supabase = await createClient();

  let query = supabase
    .from("v_trips_full")
    .select("id, trip_date, trip_number, driver_name, company_name, diesel_amount", { count: "exact" })
    .gte("trip_date", from)
    .lte("trip_date", to);

  if (driverId) query = query.eq("driver_id", driverId);
  if (companyId) query = query.eq("company_id", companyId);

  const rangeFrom = (page - 1) * PAGE_SIZE;
  const rangeTo = rangeFrom + PAGE_SIZE - 1;

  type Totals = { trips_count: number; total_diesel: number };

  const [{ data: rows, count }, { data: totalsRaw }, { data: drivers }, { data: companies }, { data: settings }] =
    await Promise.all([
      query.order("trip_date", { ascending: false }).range(rangeFrom, rangeTo),
      supabase
        .rpc("fn_trips_report_totals", {
          p_from: from,
          p_to: to,
          p_driver_id: driverId || null,
          p_company_id: companyId || null,
        })
        .single(),
      supabase.from("drivers").select("id, name").order("name"),
      supabase.from("companies").select("id, name").order("name"),
      supabase.from("settings").select("currency_symbol").single(),
    ]);

  const totals = totalsRaw as Totals | null;

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <h1 className="text-xl font-bold text-zinc-900">تقرير الديزل</h1>
        <p className="text-sm text-zinc-500">مصروف الديزل لكل رحلة خلال الفترة المحددة</p>
      </div>

      <DieselReportTable
        rows={rows ?? []}
        totalDiesel={totals?.total_diesel ?? 0}
        tripsCount={totals?.trips_count ?? 0}
        total={count ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        drivers={drivers ?? []}
        companies={companies ?? []}
        currencySymbol={settings?.currency_symbol ?? "ر.س"}
        filters={{ from, to, driverId, companyId }}
      />
    </div>
  );
}
