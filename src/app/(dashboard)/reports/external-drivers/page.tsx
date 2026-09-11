import { createClient } from "@/lib/supabase/server";
import { ExternalDriversReportTable } from "@/components/reports/ExternalDriversReportTable";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ReviewedByFooter } from "@/components/ui/ReviewedByFooter";

function firstDayOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

export default async function ExternalDriversReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const from = params.from || firstDayOfMonth();
  const to = params.to || today();

  const supabase = await createClient();

  const [{ data: rows, error }, { data: settings }] = await Promise.all([
    supabase.rpc("fn_external_drivers_report", { p_from: from, p_to: to }),
    supabase.from("settings").select("currency_symbol, reviewed_by").single(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <h1 className="text-xl font-bold text-zinc-900">كشف حساب الموردين الخارجيين</h1>
        <p className="text-sm text-zinc-500">
          كم رحلة نفّذ كل مورد، كم تستحق له، وكم ربحت منه بعد خصم تكلفته وديزله
        </p>
      </div>

      <ErrorBanner error={error} hint="تأكد من تشغيل ملف SQL رقم 0008 (دالة fn_external_drivers_report)." />

      <ExternalDriversReportTable
        rows={rows ?? []}
        from={from}
        to={to}
        currencySymbol={settings?.currency_symbol ?? "ر.س"}
      />

      <ReviewedByFooter name={settings?.reviewed_by} />
    </div>
  );
}
