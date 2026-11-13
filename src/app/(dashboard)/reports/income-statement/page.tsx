import { createClient } from "@/lib/supabase/server";
import {
  IncomeStatementView,
  type IncomeStatement,
  type ReconciliationRow,
} from "@/components/reports/IncomeStatementView";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ReviewedByFooter } from "@/components/ui/ReviewedByFooter";

// قائمة الدخل (0060) — إيرادها فواتير العملاء لا مبالغ الرحلات.
// لوحة التحكم والتقرير المالي لم يتغيّرا: يبقيان على إيراد الرحلات.

function firstDayOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY: IncomeStatement = {
  invoiced_revenue: 0,
  trips_revenue: 0,
  revenue_difference: 0,
  rental_revenue: 0,
  total_revenue: 0,
  total_driver_payments: 0,
  total_trip_diesel: 0,
  total_monthly_diesel: 0,
  total_rental_diesel: 0,
  total_salaries: 0,
  total_driver_expenses: 0,
  total_housing_cost: 0,
  total_other_expenses: 0,
  total_costs: 0,
  net_profit: 0,
};

export default async function IncomeStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const from = params.from || firstDayOfMonth();
  const to = params.to || today();

  const supabase = await createClient();

  const [{ data: stmt, error }, { data: recon }, { data: settings }] = await Promise.all([
    supabase.rpc("fn_income_statement", { p_from: from, p_to: to }).single(),
    supabase.rpc("fn_revenue_reconciliation", { p_from: from, p_to: to }),
    supabase.from("settings").select("org_name, currency_symbol, reviewed_by").single(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <h1 className="text-xl font-bold text-zinc-900">قائمة الدخل</h1>
        <p className="text-sm text-zinc-500">
          الأرباح والخسائر بناءً على إيرادات العملاء المفوتَرة — مع مطابقتها برحلات
          النظام
        </p>
      </div>

      <ErrorBanner
        error={error}
        hint="تأكد من تشغيل ملف SQL رقم 0060 (إيرادات العملاء وقائمة الدخل)."
      />

      <IncomeStatementView
        statement={(stmt as IncomeStatement | null) ?? EMPTY}
        reconciliation={(recon ?? []) as ReconciliationRow[]}
        from={from}
        to={to}
        orgName={settings?.org_name ?? "مؤسستي"}
        currencySymbol={settings?.currency_symbol ?? "ر.س"}
      />

      <ReviewedByFooter name={settings?.reviewed_by} />
    </div>
  );
}
