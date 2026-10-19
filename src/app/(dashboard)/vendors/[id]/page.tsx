import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Truck, Banknote, TrendingUp, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatNumber } from "@/lib/format";
import { StatCard } from "@/components/dashboard/StatCard";
import { VendorDetailTabs } from "@/components/vendors/VendorDetailTabs";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import type {
  VendorSummary,
  VendorTripRow,
  VendorPayableTripRow,
  VendorSettlementRecord,
  VendorAdvanceRecord,
} from "@/lib/validation/vendor";

function firstDayOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

export default async function VendorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const from = sp.from || firstDayOfMonth();
  const to = sp.to || today();

  const supabase = await createClient();

  const { data: vendor } = await supabase
    .from("vendors")
    .select(
      "id, name, phone, notes, status, opening_balance, opening_reason, opening_date, opening_settlement_id"
    )
    .eq("id", id)
    .single();

  if (!vendor) notFound();

  const [
    { data: summaryRaw, error: summaryError },
    { data: trips },
    { data: payableTrips },
    { data: advances },
    { data: settlements },
    { data: drivers },
    { data: settings },
  ] = await Promise.all([
    supabase.rpc("fn_vendor_period_summary", { p_vendor_id: id, p_from: from, p_to: to }).single(),
    supabase.rpc("fn_vendor_trips", { p_vendor_id: id, p_from: from, p_to: to }),
    // 🔒 الكشف الذي يُسلَّم للمورّد — دالة لا تُرجع سعر العميل ولا الربح
    supabase.rpc("fn_vendor_payable_trips", { p_vendor_id: id, p_from: from, p_to: to }),
    supabase
      .from("vendor_advances")
      .select("id, date, amount, description, settlement_id")
      .eq("vendor_id", id)
      .order("date", { ascending: false }),
    supabase
      .from("vendor_settlements")
      .select("*")
      .eq("vendor_id", id)
      .order("to_date", { ascending: false }),
    supabase.from("drivers").select("id, name, status").eq("vendor_id", id).order("name"),
    supabase.from("settings").select("currency_symbol, org_name, org_phone, reviewed_by").single(),
  ]);

  const s = (summaryRaw as VendorSummary | null) ?? {
    trips_count: 0,
    drivers_count: 0,
    total_client_amount: 0,
    total_vendor_cost: 0,
    total_profit: 0,
    total_advances: 0,
    settled_cost: 0,
    unsettled_cost: 0,
    net_due: 0,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <Link
          href="/vendors"
          className="mb-2 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ArrowRight size={15} />
          العودة للموردين
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-zinc-900">{vendor.name}</h1>
            <p className="text-sm text-zinc-500" dir="ltr">
              {vendor.phone || "—"}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              vendor.status === "active"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-zinc-100 text-zinc-500"
            }`}
          >
            {vendor.status === "active" ? "نشط" : "غير نشط"}
          </span>
        </div>
      </div>

      <ErrorBanner
        error={summaryError}
        hint="تأكد من تشغيل ملفَّي SQL رقم 0043 و 0044 (الموردون وكشوفاتهم)."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 print:hidden">
        <StatCard label="الرحلات" value={formatNumber(s.trips_count)} icon={Truck} />
        <StatCard
          label="على العملاء"
          value={formatCurrency(s.total_client_amount, settings?.currency_symbol ?? "ر.س")}
          icon={Banknote}
        />
        <StatCard
          label="للمورّد"
          value={formatCurrency(s.total_vendor_cost, settings?.currency_symbol ?? "ر.س")}
          icon={Wallet}
        />
        <StatCard
          label="الربح"
          value={formatCurrency(s.total_profit, settings?.currency_symbol ?? "ر.س")}
          icon={TrendingUp}
          tone="positive"
        />
        <StatCard
          label="المستحق الآن"
          value={formatCurrency(s.net_due, settings?.currency_symbol ?? "ر.س")}
          icon={Wallet}
          tone="warning"
        />
      </div>

      <VendorDetailTabs
        vendorId={id}
        vendorName={vendor.name as string}
        vendorPhone={(vendor.phone as string | null) ?? null}
        from={from}
        to={to}
        trips={(trips ?? []) as VendorTripRow[]}
        payableTrips={(payableTrips ?? []) as VendorPayableTripRow[]}
        advances={(advances ?? []) as VendorAdvanceRecord[]}
        settlements={(settlements ?? []) as VendorSettlementRecord[]}
        drivers={(drivers ?? []) as { id: string; name: string; status: string }[]}
        openingBalance={
          vendor.opening_settlement_id ? 0 : Number(vendor.opening_balance) || 0
        }
        openingReason={(vendor.opening_reason as string | null) ?? null}
        orgName={settings?.org_name ?? "مؤسستي"}
        orgPhone={settings?.org_phone ?? null}
        currencySymbol={settings?.currency_symbol ?? "ر.س"}
      />
    </div>
  );
}
