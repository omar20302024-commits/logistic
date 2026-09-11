import { createClient } from "@/lib/supabase/server";
import { FinancialReportView } from "@/components/reports/FinancialReportView";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ReviewedByFooter } from "@/components/ui/ReviewedByFooter";

function firstDayOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

export default async function FinancialReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const from = params.from || firstDayOfMonth();
  const to = params.to || today();

  const supabase = await createClient();

  const [{ data: summary, error }, { data: settings }] = await Promise.all([
    supabase.rpc("fn_financial_summary", { p_from: from, p_to: to }).single(),
    supabase.from("settings").select("currency_symbol, reviewed_by").single(),
  ]);

  type Summary = {
    total_revenue: number;
    total_driver_payments: number;
    total_diesel: number;
    operating_profit: number;
    total_salaries: number;
    total_driver_expenses: number;
    total_other_expenses: number;
    net_profit: number;
  };

  const emptySummary: Summary = {
    total_revenue: 0,
    total_driver_payments: 0,
    total_diesel: 0,
    operating_profit: 0,
    total_salaries: 0,
    total_driver_expenses: 0,
    total_other_expenses: 0,
    net_profit: 0,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <h1 className="text-xl font-bold text-zinc-900">التقرير المالي الشامل</h1>
        <p className="text-sm text-zinc-500">الإيرادات، المصروفات، والربح الصافي للفترة</p>
      </div>

      <ErrorBanner error={error} hint="تأكد من تشغيل ملف SQL رقم 0003 (دالة fn_financial_summary)." />

      <FinancialReportView
        from={from}
        to={to}
        summary={(summary as Summary | null) ?? emptySummary}
        currencySymbol={settings?.currency_symbol ?? "ر.س"}
      />

      <ReviewedByFooter name={settings?.reviewed_by} />
    </div>
  );
}
