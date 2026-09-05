import { createClient } from "@/lib/supabase/server";
import { ProfitabilityReportTable } from "@/components/reports/ProfitabilityReportTable";

const PAGE_SIZE = 25;

function firstDayOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

export default async function ProfitabilityReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; driver?: string; company?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const from = params.from || firstDayOfMonth();
  const to = params.to || today();
  const driverId = params.driver ?? "";
  const companyId = params.company ?? "";
  const status = params.status ?? "";
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const supabase = await createClient();

  let query = supabase
    .from("v_trips_full")
    .select("id, trip_date, trip_number, driver_name, company_name, trip_amount, driver_trip_payment, diesel_amount, trip_profit", { count: "exact" })
    .gte("trip_date", from)
    .lte("trip_date", to);

  if (driverId) query = query.eq("driver_id", driverId);
  if (companyId) query = query.eq("company_id", companyId);
  if (status) query = query.eq("status", status);

  const rangeFrom = (page - 1) * PAGE_SIZE;
  const rangeTo = rangeFrom + PAGE_SIZE - 1;

  const [{ data: rows, count }, { data: totals }, { data: drivers }, { data: companies }, { data: settings }] =
    await Promise.all([
      query.order("trip_date", { ascending: false }).range(rangeFrom, rangeTo),
      supabase
        .rpc("fn_trips_report_totals", {
          p_from: from,
          p_to: to,
          p_driver_id: driverId || null,
          p_company_id: companyId || null,
          p_status: status || null,
        })
        .single(),
      supabase.from("drivers").select("id, name").order("name"),
      supabase.from("companies").select("id, name").order("name"),
      supabase.from("settings").select("currency_symbol").single(),
    ]);

  type Totals = {
    trips_count: number;
    total_trip_amount: number;
    total_driver_payment: number;
    total_diesel: number;
    operating_profit: number;
  };

  const emptyTotals: Totals = { trips_count: 0, total_trip_amount: 0, total_driver_payment: 0, total_diesel: 0, operating_profit: 0 };

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <h1 className="text-xl font-bold text-zinc-900">ربحية الرحلات</h1>
        <p className="text-sm text-zinc-500">تفاصيل ربح كل رحلة مع إمكانية الفلترة والتصدير</p>
      </div>

      <ProfitabilityReportTable
        rows={rows ?? []}
        totals={(totals as Totals | null) ?? emptyTotals}
        total={count ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        drivers={drivers ?? []}
        companies={companies ?? []}
        currencySymbol={settings?.currency_symbol ?? "ر.س"}
        filters={{ from, to, driverId, companyId, status }}
      />
    </div>
  );
}
