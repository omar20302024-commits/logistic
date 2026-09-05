import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Truck, Banknote, Fuel, TrendingUp, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatNumber } from "@/lib/format";
import { StatCard } from "@/components/dashboard/StatCard";
import { LedgerSection } from "@/components/drivers/LedgerSection";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

export default async function DriverDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: driver, error: driverError } = await supabase
    .from("drivers")
    .select("*")
    .eq("id", id)
    .single();

  if (driverError || !driver) notFound();

  const { data: settings } = await supabase
    .from("settings")
    .select("currency_symbol")
    .single();
  const currencySymbol = settings?.currency_symbol ?? "ر.س";

  const { data: summary, error: summaryError } = await supabase
    .rpc("fn_driver_period_summary", {
      p_driver_id: id,
      p_from: "2000-01-01",
      p_to: new Date().toISOString().slice(0, 10),
    })
    .single();

  const s = (summary as {
    trips_count: number;
    total_trip_amount: number;
    total_driver_payment: number;
    total_diesel: number;
    operating_profit: number;
    net_salary: number;
    total_due_to_driver: number;
  } | null) ?? {
    trips_count: 0,
    total_trip_amount: 0,
    total_driver_payment: 0,
    total_diesel: 0,
    operating_profit: 0,
    net_salary: 0,
    total_due_to_driver: 0,
  };

  const [{ data: advances }, { data: deductions }] = await Promise.all([
    supabase
      .from("driver_advances")
      .select("*")
      .eq("driver_id", id)
      .order("date", { ascending: false }),
    supabase
      .from("driver_deductions")
      .select("*")
      .eq("driver_id", id)
      .order("date", { ascending: false }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/drivers"
          className="mb-2 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ArrowRight size={15} />
          العودة للسائقين
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-zinc-900">{driver.name}</h1>
            <p className="text-sm text-zinc-500" dir="ltr">
              {driver.phone || "—"}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              driver.status === "active"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-zinc-100 text-zinc-500"
            }`}
          >
            {driver.status === "active" ? "نشط" : "غير نشط"}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/statement?driver=${id}`}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          كشف حساب السائق
        </Link>
        <button
          disabled
          title="سيُفعَّل في مرحلة لاحقة"
          className="cursor-not-allowed rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-400"
        >
          تقرير الربحية (قريباً)
        </button>
      </div>

      <ErrorBanner error={summaryError} hint="تأكد من تشغيل ملف SQL رقم 0003 (دالة fn_driver_period_summary)." />

      <div>
        <h2 className="mb-3 text-sm font-bold text-zinc-900">ملخص كل الأوقات</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard label="عدد الرحلات" value={formatNumber(s.trips_count)} icon={Truck} />
          <StatCard
            label="إجمالي قيمة الرحلات"
            value={formatCurrency(s.total_trip_amount, currencySymbol)}
            icon={Banknote}
          />
          <StatCard
            label="إجمالي التربات"
            value={formatCurrency(s.total_driver_payment, currencySymbol)}
            icon={Wallet}
          />
          <StatCard
            label="إجمالي الديزل"
            value={formatCurrency(s.total_diesel, currencySymbol)}
            icon={Fuel}
            tone="warning"
          />
          <StatCard
            label="الربح التشغيلي"
            value={formatCurrency(s.operating_profit, currencySymbol)}
            icon={TrendingUp}
            tone="positive"
          />
          <StatCard
            label="صافي الراتب (كل الفترات)"
            value={formatCurrency(s.net_salary, currencySymbol)}
            icon={Wallet}
          />
          <StatCard
            label="إجمالي المستحق للسائق"
            value={formatCurrency(s.total_due_to_driver, currencySymbol)}
            icon={Banknote}
            tone="positive"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <LedgerSection
          type="advance"
          driverId={id}
          entries={advances ?? []}
          currencySymbol={currencySymbol}
        />
        <LedgerSection
          type="deduction"
          driverId={id}
          entries={deductions ?? []}
          currencySymbol={currencySymbol}
        />
      </div>

      {driver.notes && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
          <span className="font-medium text-zinc-900">ملاحظات: </span>
          {driver.notes}
        </div>
      )}
    </div>
  );
}
