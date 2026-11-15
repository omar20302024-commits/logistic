import { createClient } from "@/lib/supabase/server";
import {
  DriverExpenseItemsTable,
  type ExpenseItemRow,
} from "@/components/reports/DriverExpenseItemsTable";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ReviewedByFooter } from "@/components/ui/ReviewedByFooter";

// بنود مصاريف السائقين (0065) — مَن صرف، وكم مرة، وبكم.
// «غسيل» يُكتب غالباً في الوصف تحت بند «أخرى»، فالدالة توحّد الاثنين في
// عمود `item` واحد، والبحث في الواجهة يجمع صيغه المختلفة.

function firstDayOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

export default async function DriverExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const from = params.from || firstDayOfMonth();
  const to = params.to || today();

  const supabase = await createClient();

  const [{ data: rows, error }, { data: settings }] = await Promise.all([
    supabase.rpc("fn_driver_expense_items", { p_from: from, p_to: to }),
    supabase.from("settings").select("org_name, currency_symbol, reviewed_by").single(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <h1 className="text-xl font-bold text-zinc-900">بنود مصاريف السائقين</h1>
        <p className="text-sm text-zinc-500">
          مَن صرف، وكم مرة، وبكم — ابحث عن «غسيل» أو أي بند لتجميعه لكل سائق
        </p>
      </div>

      <ErrorBanner
        error={error}
        hint="تأكد من تشغيل ملف SQL رقم 0065 (تقرير بنود مصاريف السائقين)."
      />

      <DriverExpenseItemsTable
        rows={(rows ?? []) as ExpenseItemRow[]}
        from={from}
        to={to}
        orgName={settings?.org_name ?? "مؤسستي"}
        currencySymbol={settings?.currency_symbol ?? "ر.س"}
      />

      <ReviewedByFooter name={settings?.reviewed_by} />
    </div>
  );
}
