import { createClient } from "@/lib/supabase/server";
import {
  DriverIncomeTable,
  type DriverIncomeRow,
  type ExpenseCell,
} from "@/components/reports/DriverIncomeTable";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ReviewedByFooter } from "@/components/ui/ReviewedByFooter";

// إيراد السائق/السيارة (0063) — ما دخل وما خرج وما بقي، لكل سائق في كل شهر.
// الديزل والمصاريف معاً هنا؛ وتقرير الديزل الشهري صار للديزل وحده.

function firstDayOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

export default async function DriverIncomePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const from = params.from || firstDayOfMonth();
  const to = params.to || today();

  const supabase = await createClient();

  const [{ data: rows, error }, { data: expenses }, { data: settings }] = await Promise.all([
    supabase.rpc("fn_driver_income_report", { p_from: from, p_to: to }),
    supabase.rpc("fn_driver_expense_months", { p_from: from, p_to: to }),
    supabase.from("settings").select("org_name, currency_symbol, reviewed_by").single(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <h1 className="text-xl font-bold text-zinc-900">إيراد السائق/السيارة</h1>
        <p className="text-sm text-zinc-500">
          قيمة الرحلات مقابل الترب والديزل ومصاريف العهدة ببنودها — لكل سائق في كل شهر
        </p>
      </div>

      <ErrorBanner
        error={error}
        hint="تأكد من تشغيل ملف SQL رقم 0063 (فصل الديزل وإيراد السائق)."
      />

      <DriverIncomeTable
        rows={(rows ?? []) as DriverIncomeRow[]}
        expenses={(expenses ?? []) as ExpenseCell[]}
        from={from}
        to={to}
        orgName={settings?.org_name ?? "مؤسستي"}
        currencySymbol={settings?.currency_symbol ?? "ر.س"}
      />

      <ReviewedByFooter name={settings?.reviewed_by} />
    </div>
  );
}
