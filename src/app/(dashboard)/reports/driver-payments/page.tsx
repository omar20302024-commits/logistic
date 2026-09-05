import { createClient } from "@/lib/supabase/server";
import { DriverPaymentsReportTable } from "@/components/reports/DriverPaymentsReportTable";

function firstDayOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

export default async function DriverPaymentsReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; driver?: string; company?: string }>;
}) {
  const params = await searchParams;
  const from = params.from || firstDayOfMonth();
  const to = params.to || today();
  const driverId = params.driver ?? "";
  const companyId = params.company ?? "";

  const supabase = await createClient();

  const [{ data: rows, error }, { data: drivers }, { data: companies }, { data: settings }] = await Promise.all([
    supabase.rpc("fn_driver_payments_report", {
      p_from: from,
      p_to: to,
      p_driver_id: driverId || null,
      p_company_id: companyId || null,
    }),
    supabase.from("drivers").select("id, name").order("name"),
    supabase.from("companies").select("id, name").order("name"),
    supabase.from("settings").select("currency_symbol").single(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <h1 className="text-xl font-bold text-zinc-900">تقرير التربات</h1>
        <p className="text-sm text-zinc-500">إجمالي تربات كل سائق خلال الفترة المحددة</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 print:hidden">
          تأكد من تشغيل ملف SQL رقم 0007.
        </div>
      )}

      <DriverPaymentsReportTable
        rows={rows ?? []}
        drivers={drivers ?? []}
        companies={companies ?? []}
        currencySymbol={settings?.currency_symbol ?? "ر.س"}
        filters={{ from, to, driverId, companyId }}
      />
    </div>
  );
}
