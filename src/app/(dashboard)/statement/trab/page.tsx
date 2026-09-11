import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TrabAdjustmentsStatementView } from "@/components/statement/TrabAdjustmentsStatementView";
import { PrintClientButton } from "@/components/statement/PrintClientButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { FileText } from "lucide-react";
import { ReviewedByFooter } from "@/components/ui/ReviewedByFooter";

function firstDayOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

// كشف الترب (بدون راتب): يستخدم فقط الدوال الآمنة (fn_driver_public_*) —
// لا سعر رحلة ولا ربح ولا راتب في أي مكان بهذه الصفحة.
export default async function TrabStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ driver?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const driverId = params.driver ?? "";
  const from = params.from || firstDayOfMonth();
  const to = params.to || today();

  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("settings")
    .select("currency_symbol, org_name, org_phone, reviewed_by")
    .single();
  const currencySymbol = settings?.currency_symbol ?? "ر.س";
  const orgName = settings?.org_name ?? "مؤسستي";
  const orgPhone = settings?.org_phone ?? null;

  if (!driverId) {
    return (
      <div className="flex flex-col gap-6">
        <Link href="/statement" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900">
          <ArrowRight size={15} />
          العودة للكشف الداخلي
        </Link>
        <EmptyState icon={FileText} title="لم يتم تحديد سائق" description="ارجع لكشف الحساب الداخلي واختر سائقاً أولاً" />
      </div>
    );
  }

  const [{ data: driver }, { data: summary, error: summaryError }, { data: trips, error: tripsError }] =
    await Promise.all([
      supabase.from("drivers").select("id, name, phone").eq("id", driverId).single(),
      supabase
        .rpc("fn_driver_public_summary", { p_driver_id: driverId, p_from: from, p_to: to })
        .single(),
      supabase.rpc("fn_driver_public_trips", { p_driver_id: driverId, p_from: from, p_to: to }),
    ]);

  const emptySummary = {
    trips_count: 0,
    total_driver_payment: 0,
    total_advances: 0,
    total_deductions: 0,
    custody_balance: 0,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <Link
            href={`/statement?driver=${driverId}&from=${from}&to=${to}`}
            className="mb-2 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
          >
            <ArrowRight size={15} />
            العودة للكشف الداخلي
          </Link>
          <h1 className="text-xl font-bold text-zinc-900">كشف الترب</h1>
          <p className="text-sm text-zinc-500">الترب + السلف والخصومات والعهدة — بدون ذكر الراتب</p>
        </div>
        <PrintClientButton />
      </div>

      <ErrorBanner error={summaryError ?? tripsError} hint="تأكد من تشغيل ملف SQL رقم 0008 (دوال العهدة الآمنة)." />

      <TrabAdjustmentsStatementView
        orgName={orgName}
        orgPhone={orgPhone}
        driverName={driver?.name ?? ""}
        driverPhone={driver?.phone ?? null}
        from={from}
        to={to}
        trips={trips ?? []}
        summary={(summary as typeof emptySummary | null) ?? emptySummary}
        currencySymbol={currencySymbol}
      />

      <ReviewedByFooter name={settings?.reviewed_by} />
    </div>
  );
}
