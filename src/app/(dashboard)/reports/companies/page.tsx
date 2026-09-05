import { createClient } from "@/lib/supabase/server";
import { CompaniesReportTable } from "@/components/reports/CompaniesReportTable";

function firstDayOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

export default async function CompaniesReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const from = params.from || firstDayOfMonth();
  const to = params.to || today();

  const supabase = await createClient();

  const [{ data: rows, error }, { data: settings }] = await Promise.all([
    supabase.rpc("fn_companies_report", { p_from: from, p_to: to }),
    supabase.from("settings").select("currency_symbol").single(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <h1 className="text-xl font-bold text-zinc-900">تقرير الشركات</h1>
        <p className="text-sm text-zinc-500">ربحية كل شركة خلال الفترة المحددة</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 print:hidden">
          تأكد من تشغيل ملف SQL رقم 0007.
        </div>
      )}

      <CompaniesReportTable
        rows={rows ?? []}
        from={from}
        to={to}
        currencySymbol={settings?.currency_symbol ?? "ر.س"}
      />
    </div>
  );
}
