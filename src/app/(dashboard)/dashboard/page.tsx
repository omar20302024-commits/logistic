import {
  Users,
  UserCheck,
  Building2,
  Truck,
  Banknote,
  Fuel,
  Wallet,
  MinusCircle,
  PlusCircle,
  TrendingUp,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatNumber } from "@/lib/format";
import { StatCard } from "@/components/dashboard/StatCard";
import { ProfitabilityBreakdown } from "@/components/dashboard/ProfitabilityBreakdown";
import { MonthlyRevenueChart } from "@/components/dashboard/MonthlyRevenueChart";
import { TripsCountChart } from "@/components/dashboard/TripsCountChart";
import { ProfitabilityRankingChart } from "@/components/dashboard/ProfitabilityRankingChart";

type Overview = {
  drivers_count: number;
  active_drivers_count: number;
  companies_count: number;
  trips_count: number;
  total_trip_amount: number;
  total_driver_payments: number;
  total_diesel: number;
  operating_profit: number;
  total_salaries: number;
  total_deductions: number;
  total_advances: number;
  total_other_expenses: number;
  net_profit: number;
};

const emptyOverview: Overview = {
  drivers_count: 0,
  active_drivers_count: 0,
  companies_count: 0,
  trips_count: 0,
  total_trip_amount: 0,
  total_driver_payments: 0,
  total_diesel: 0,
  operating_profit: 0,
  total_salaries: 0,
  total_deductions: 0,
  total_advances: 0,
  total_other_expenses: 0,
  net_profit: 0,
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth() - 11, 1);
  const fromStr = from.toISOString().slice(0, 10);
  const toStr = today.toISOString().slice(0, 10);

  const [overviewRes, trendsRes, topDriversRes, topCompaniesRes, settingsRes] =
    await Promise.all([
      supabase.rpc("fn_dashboard_overview").single(),
      supabase.rpc("fn_monthly_trends", { p_months: 12 }),
      supabase.rpc("fn_top_drivers_profitability", {
        p_from: fromStr,
        p_to: toStr,
        p_limit: 8,
      }),
      supabase.rpc("fn_top_companies_profitability", {
        p_from: fromStr,
        p_to: toStr,
        p_limit: 8,
      }),
      supabase.from("settings").select("currency_symbol, org_name").single(),
    ]);

  const overview: Overview = (overviewRes.data as Overview | null) ?? emptyOverview;
  const trends = trendsRes.data ?? [];
  const topDrivers = (topDriversRes.data ?? []).map(
    (d: { driver_name: string; operating_profit: number; trips_count: number }) => ({
      name: d.driver_name,
      operating_profit: d.operating_profit,
      trips_count: d.trips_count,
    })
  );
  const topCompanies = (topCompaniesRes.data ?? []).map(
    (c: { company_name: string; operating_profit: number; trips_count: number }) => ({
      name: c.company_name,
      operating_profit: c.operating_profit,
      trips_count: c.trips_count,
    })
  );
  const currencySymbol = settingsRes.data?.currency_symbol ?? "ر.س";

  const setupNeeded = overviewRes.error?.code === "PGRST202" || overviewRes.error?.code === "42883";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">لوحة التحكم</h1>
        <p className="text-sm text-zinc-500">
          {settingsRes.data?.org_name ?? "نظرة عامة على النشاط والربحية"}
        </p>
      </div>

      {setupNeeded && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          يبدو أن دوال التحليلات (supabase/migrations/0004_dashboard_analytics.sql) لم تُشغَّل بعد
          على قاعدة البيانات. شغّلها من Supabase SQL Editor ثم أعد تحميل الصفحة.
        </div>
      )}

      {/* بطاقات الإحصائيات */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="إجمالي السائقين" value={formatNumber(overview.drivers_count)} icon={Users} />
        <StatCard
          label="السائقون النشطون"
          value={formatNumber(overview.active_drivers_count)}
          icon={UserCheck}
          tone="positive"
        />
        <StatCard label="إجمالي الشركات" value={formatNumber(overview.companies_count)} icon={Building2} />
        <StatCard label="إجمالي الرحلات" value={formatNumber(overview.trips_count)} icon={Truck} />
        <StatCard
          label="إجمالي قيمة الرحلات"
          value={formatCurrency(overview.total_trip_amount, currencySymbol)}
          icon={Banknote}
        />
        <StatCard
          label="إجمالي التربات"
          value={formatCurrency(overview.total_driver_payments, currencySymbol)}
          icon={MinusCircle}
          tone="warning"
        />
        <StatCard
          label="إجمالي الديزل"
          value={formatCurrency(overview.total_diesel, currencySymbol)}
          icon={Fuel}
          tone="warning"
        />
        <StatCard
          label="إجمالي الرواتب"
          value={formatCurrency(overview.total_salaries, currencySymbol)}
          icon={Wallet}
        />
        <StatCard
          label="إجمالي الخصومات"
          value={formatCurrency(overview.total_deductions, currencySymbol)}
          icon={MinusCircle}
        />
        <StatCard
          label="إجمالي السلف"
          value={formatCurrency(overview.total_advances, currencySymbol)}
          icon={PlusCircle}
        />
        <StatCard
          label="الربح التشغيلي"
          value={formatCurrency(overview.operating_profit, currencySymbol)}
          icon={TrendingUp}
          tone="positive"
        />
        <StatCard
          label="صافي الربح"
          value={formatCurrency(overview.net_profit, currencySymbol)}
          icon={TrendingUp}
          tone={overview.net_profit >= 0 ? "positive" : "negative"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MonthlyRevenueChart data={trends} currencySymbol={currencySymbol} />
        </div>
        <ProfitabilityBreakdown
          totalTripAmount={overview.total_trip_amount}
          totalDriverPayments={overview.total_driver_payments}
          totalDiesel={overview.total_diesel}
          operatingProfit={overview.operating_profit}
          totalSalaries={overview.total_salaries}
          totalOtherExpenses={overview.total_other_expenses}
          netProfit={overview.net_profit}
          currencySymbol={currencySymbol}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <TripsCountChart data={trends} />
        </div>
        <ProfitabilityRankingChart
          title="ربحية السائقين (آخر 12 شهر)"
          data={topDrivers}
          currencySymbol={currencySymbol}
          emptyLabel="لا توجد بيانات رحلات بعد"
        />
        <ProfitabilityRankingChart
          title="ربحية الشركات (آخر 12 شهر)"
          data={topCompanies}
          currencySymbol={currencySymbol}
          emptyLabel="لا توجد بيانات رحلات بعد"
        />
      </div>
    </div>
  );
}
