import { createClient } from "@/lib/supabase/server";
import { RentalReportView } from "@/components/rentals/RentalReportView";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

export default async function RentalReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const month = params.month || String(now.getMonth() + 1);
  const year = params.year || String(now.getFullYear());

  const supabase = await createClient();

  const [{ data: rows, error }, { data: settings }] = await Promise.all([
    supabase.rpc("fn_rental_contracts_report", { p_month: Number(month), p_year: Number(year) }),
    supabase.from("settings").select("currency_symbol").single(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <h1 className="text-xl font-bold text-zinc-900">ربحية عقود الإيجار الشهري</h1>
        <p className="text-sm text-zinc-500">صافي الربح من كل عقد بعد خصم السكن (مقسوم تلقائياً) والراتب والترب والديزل</p>
      </div>

      <ErrorBanner error={error} hint="تأكد من تشغيل ملف SQL رقم 0008 (دالة fn_rental_contracts_report)." />

      <RentalReportView
        rows={rows ?? []}
        month={month}
        year={year}
        currencySymbol={settings?.currency_symbol ?? "ر.س"}
      />
    </div>
  );
}
