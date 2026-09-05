import { createClient } from "@/lib/supabase/server";
import { StatementFilters } from "@/components/statement/StatementFilters";
import { InternalStatementView } from "@/components/statement/InternalStatementView";
import { EmptyState } from "@/components/ui/EmptyState";
import { FileText } from "lucide-react";

function firstDayOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default async function StatementPage({
  searchParams,
}: {
  searchParams: Promise<{ driver?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const driverId = params.driver ?? "";
  const from = params.from || firstDayOfMonth();
  const to = params.to || today();

  const supabase = await createClient();

  const [{ data: drivers }, { data: settings }] = await Promise.all([
    supabase.from("drivers").select("id, name").order("name"),
    supabase.from("settings").select("currency_symbol, org_name").single(),
  ]);

  const currencySymbol = settings?.currency_symbol ?? "ر.س";
  const orgName = settings?.org_name ?? "مؤسستي";

  type Summary = {
    trips_count: number;
    total_trip_amount: number;
    total_driver_payment: number;
    total_diesel: number;
    operating_profit: number;
    total_advances: number;
    total_deductions: number;
    salary_basic: number;
    net_salary: number;
    total_due_to_driver: number;
  };

  let driver: { id: string; name: string; phone: string | null } | null = null;
  let summary: Summary | null = null;
  let trips: unknown[] = [];

  if (driverId) {
    const [driverRes, summaryRes, tripsRes] = await Promise.all([
      supabase.from("drivers").select("id, name, phone").eq("id", driverId).single(),
      supabase.rpc("fn_driver_period_summary", { p_driver_id: driverId, p_from: from, p_to: to }).single(),
      supabase.rpc("fn_driver_internal_trips", { p_driver_id: driverId, p_from: from, p_to: to }),
    ]);
    driver = driverRes.data;
    summary = summaryRes.data as Summary | null;
    trips = tripsRes.data ?? [];
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <h1 className="text-xl font-bold text-zinc-900">كشف حساب السائق (داخلي)</h1>
        <p className="text-sm text-zinc-500">كشف تفصيلي كامل — يحتوي بيانات سرية للإدارة فقط</p>
      </div>

      <StatementFilters
        drivers={drivers ?? []}
        driverId={driverId}
        from={from}
        to={to}
        hasSelection={!!driverId}
      />

      {!driverId ? (
        <EmptyState
          icon={FileText}
          title="اختر سائقاً لعرض كشف حسابه"
          description="حدد السائق والفترة من الأعلى"
        />
      ) : (
        <InternalStatementView
          orgName={orgName}
          driverName={driver?.name ?? ""}
          driverPhone={driver?.phone ?? null}
          from={from}
          to={to}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          trips={trips as any}
          summary={
            summary ?? {
              trips_count: 0,
              total_trip_amount: 0,
              total_driver_payment: 0,
              total_diesel: 0,
              operating_profit: 0,
              total_advances: 0,
              total_deductions: 0,
              salary_basic: 0,
              net_salary: 0,
              total_due_to_driver: 0,
            }
          }
          currencySymbol={currencySymbol}
        />
      )}
    </div>
  );
}
