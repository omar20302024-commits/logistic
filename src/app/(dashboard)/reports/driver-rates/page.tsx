import { createClient } from "@/lib/supabase/server";
import {
  DriverRatesTable,
  type DriverRateRow,
} from "@/components/reports/DriverRatesTable";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ReviewedByFooter } from "@/components/ui/ReviewedByFooter";

// ترب خطوط السير لكل سائق (0061) — كشف يُقدَّم للإدارة.
// يعرض الترب المطبَّق فعلاً بعد ترتيب الأولوية: خاص بالسائق ← مورّده ← العام.

export default async function DriverRatesReportPage() {
  const supabase = await createClient();

  const [{ data: rows, error }, { data: settings }] = await Promise.all([
    supabase.rpc("fn_driver_rates_report"),
    supabase.from("settings").select("org_name, currency_symbol, reviewed_by").single(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <h1 className="text-xl font-bold text-zinc-900">ترب خطوط السير</h1>
        <p className="text-sm text-zinc-500">
          كم يأخذ كل سائق على كل خط سير — للتصدير إلى Excel أو الطباعة
        </p>
      </div>

      <ErrorBanner
        error={error}
        hint="تأكد من تشغيل ملف SQL رقم 0061 (تقرير ترب خطوط السير)."
      />

      <DriverRatesTable
        rows={(rows ?? []) as DriverRateRow[]}
        orgName={settings?.org_name ?? "مؤسستي"}
        currencySymbol={settings?.currency_symbol ?? "ر.س"}
      />

      <ReviewedByFooter name={settings?.reviewed_by} />
    </div>
  );
}
