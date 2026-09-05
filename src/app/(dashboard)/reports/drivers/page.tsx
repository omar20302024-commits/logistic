import { createClient } from "@/lib/supabase/server";
import { DriversReportTable } from "@/components/reports/DriversReportTable";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

function firstDayOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

export default async function DriversReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const from = params.from || firstDayOfMonth();
  const to = params.to || today();

  const supabase = await createClient();

  const [{ data: rows, error }, { data: settings }] = await Promise.all([
    supabase.rpc("fn_drivers_report", { p_from: from, p_to: to }),
    supabase.from("settings").select("currency_symbol").single(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <h1 className="text-xl font-bold text-zinc-900">تقرير السائقين</h1>
        <p className="text-sm text-zinc-500">ربحية كل سائق خلال الفترة المحددة</p>
      </div>

      <ErrorBanner error={error} hint="تأكد من تشغيل ملف SQL رقم 0007 (دالة fn_drivers_report)." />

      <DriversReportTable
        rows={rows ?? []}
        from={from}
        to={to}
        currencySymbol={settings?.currency_symbol ?? "ر.س"}
      />
    </div>
  );
}
