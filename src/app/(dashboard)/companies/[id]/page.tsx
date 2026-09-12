import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Truck, Banknote, Fuel, TrendingUp, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatNumber } from "@/lib/format";
import { StatCard } from "@/components/dashboard/StatCard";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { BranchesSection } from "@/components/companies/BranchesSection";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .single();

  if (companyError || !company) notFound();

  const { data: settings } = await supabase
    .from("settings")
    .select("currency_symbol")
    .single();
  const currencySymbol = settings?.currency_symbol ?? "ر.س";

  const { data: summary, error: summaryError } = await supabase
    .rpc("fn_company_period_summary", {
      p_company_id: id,
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
    avg_trip_profit: number;
    drivers_involved: number;
  } | null) ?? {
    trips_count: 0,
    total_trip_amount: 0,
    total_driver_payment: 0,
    total_diesel: 0,
    operating_profit: 0,
    avg_trip_profit: 0,
    drivers_involved: 0,
  };

  const { data: driverRows } = await supabase
    .from("trips")
    .select("driver:drivers(id, name)")
    .eq("company_id", id);

  const { data: branches } = await supabase
    .from("company_branches")
    .select("*")
    .eq("company_id", id)
    .order("branch_code");

  const uniqueDrivers = new Map<string, string>();
  (driverRows ?? []).forEach((row) => {
    const driver = row.driver as unknown as { id: string; name: string } | null;
    if (driver) uniqueDrivers.set(driver.id, driver.name);
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/companies"
          className="mb-2 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ArrowRight size={15} />
          العودة للشركات
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-zinc-900">{company.name}</h1>
            <p className="text-sm text-zinc-500">{company.contact_person || "—"}</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              company.status === "active"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-zinc-100 text-zinc-500"
            }`}
          >
            {company.status === "active" ? "نشط" : "غير نشط"}
          </span>
        </div>
      </div>

      <ErrorBanner error={summaryError} hint="تأكد من تشغيل ملف SQL رقم 0003 (دالة fn_company_period_summary)." />

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
            label="إجمالي الترب"
            value={formatCurrency(s.total_driver_payment, currencySymbol)}
            icon={Banknote}
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
            label="متوسط ربح الرحلة"
            value={formatCurrency(s.avg_trip_profit, currencySymbol)}
            icon={TrendingUp}
          />
          <StatCard label="عدد السائقين" value={formatNumber(s.drivers_involved)} icon={Users} />
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-bold text-zinc-900">السائقون الذين نفذوا رحلات لهذه الشركة</h3>
        {uniqueDrivers.size === 0 ? (
          <p className="text-sm text-zinc-400">لا يوجد سائقون بعد</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {Array.from(uniqueDrivers.entries()).map(([driverId, name]) => (
              <Link
                key={driverId}
                href={`/drivers/${driverId}`}
                className="rounded-full border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                {name}
              </Link>
            ))}
          </div>
        )}
      </div>

      <BranchesSection companyId={id} branches={branches ?? []} />

      {company.address && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
          <span className="font-medium text-zinc-900">العنوان: </span>
          {company.address}
        </div>
      )}
    </div>
  );
}
