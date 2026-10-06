import { createClient } from "@/lib/supabase/server";
import { DriversRankingTable } from "@/components/reports/DriversRankingTable";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ReviewedByFooter } from "@/components/ui/ReviewedByFooter";

// ترتيب السائقين من الأكثر إلى الأقل — رحلاتٍ أو تربات.
// يعتمد على fn_drivers_report الموجودة، فلا ملف SQL جديد ولا حساب جديد:
// نفس أرقام تقرير السائقين بالضبط، مرتَّبة فقط.

function firstDayOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

export default async function DriversRankingPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; sort?: string; empty?: string }>;
}) {
  const params = await searchParams;
  const from = params.from || firstDayOfMonth();
  const to = params.to || today();
  const sort = params.sort === "trabs" ? "trabs" : "trips";
  const showEmpty = params.empty === "1";

  const supabase = await createClient();

  const [{ data: rows, error }, { data: settings }] = await Promise.all([
    supabase.rpc("fn_drivers_report", { p_from: from, p_to: to }),
    supabase.from("settings").select("org_name, org_phone, currency_symbol, reviewed_by").single(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <h1 className="text-xl font-bold text-zinc-900">ترتيب السائقين</h1>
        <p className="text-sm text-zinc-500">
          من الأكثر رحلاتٍ أو تربات إلى الأقل خلال الفترة المحددة
        </p>
      </div>

      <ErrorBanner error={error} hint="تأكد من تشغيل ملف SQL رقم 0007 (دالة fn_drivers_report)." />

      <DriversRankingTable
        rows={rows ?? []}
        from={from}
        to={to}
        sort={sort}
        showEmpty={showEmpty}
        orgName={settings?.org_name ?? "مؤسستي"}
        orgPhone={settings?.org_phone ?? null}
        currencySymbol={settings?.currency_symbol ?? "ر.س"}
      />

      <ReviewedByFooter name={settings?.reviewed_by} />
    </div>
  );
}
