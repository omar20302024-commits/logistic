import { createClient } from "@/lib/supabase/server";
import {
  DriverRatesTable,
  type DriverRouteTrabRow,
} from "@/components/reports/DriverRatesTable";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ReviewedByFooter } from "@/components/ui/ReviewedByFooter";

// ترب خطوط السير من الرحلات الفعلية (0062) — كشف يُقدَّم للإدارة.
// المصدر جدول الرحلات نفسه كما في كشف حساب السائق، لا جداول التسعيرة.

function firstDayOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

export default async function DriverRatesReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const from = params.from || firstDayOfMonth();
  const to = params.to || today();

  const supabase = await createClient();

  const [{ data: rows, error }, { data: settings }] = await Promise.all([
    supabase.rpc("fn_driver_route_trabs", { p_from: from, p_to: to }),
    supabase.from("settings").select("org_name, currency_symbol, reviewed_by").single(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <h1 className="text-xl font-bold text-zinc-900">ترب خطوط السير</h1>
        <p className="text-sm text-zinc-500">
          كم أخذ كل سائق على كل خط سير — من رحلات النظام خلال الفترة المحددة
        </p>
      </div>

      <ErrorBanner
        error={error}
        hint="تأكد من تشغيل ملف SQL رقم 0062 (ترب خطوط السير من الرحلات)."
      />

      <DriverRatesTable
        rows={(rows ?? []) as DriverRouteTrabRow[]}
        from={from}
        to={to}
        orgName={settings?.org_name ?? "مؤسستي"}
        currencySymbol={settings?.currency_symbol ?? "ر.س"}
      />

      <ReviewedByFooter name={settings?.reviewed_by} />
    </div>
  );
}
