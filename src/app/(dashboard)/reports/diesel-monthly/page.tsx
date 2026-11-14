import { createClient } from "@/lib/supabase/server";
import {
  DieselMonthlyTable,
  type DieselMonthRow,
} from "@/components/reports/DieselMonthlyTable";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ReviewedByFooter } from "@/components/ui/ReviewedByFooter";

// استهلاك الديزل الشهري (0059) — صفّ لكل سائق في كل شهر، مع سيارته.
// التقرير القديم /reports/diesel يعرض ديزل الرحلة سطراً سطراً للبيانات
// التاريخية، وهذا يعرض ما يُدخَل اليوم في صفحة السائق.

function firstDayOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

export default async function DieselMonthlyPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const from = params.from || firstDayOfMonth();
  const to = params.to || today();

  const supabase = await createClient();

  const [{ data: rows, error }, { data: settings }] = await Promise.all([
    supabase.rpc("fn_diesel_monthly_report", { p_from: from, p_to: to }),
    supabase.from("settings").select("org_name, currency_symbol, reviewed_by").single(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <h1 className="text-xl font-bold text-zinc-900">استهلاك الديزل الشهري</h1>
        <p className="text-sm text-zinc-500">
          من الأكثر صرفاً إلى الأقل — مع رسم بياني، وإمكانية استبعاد سائقين قبل الطباعة
        </p>
      </div>

      <ErrorBanner
        error={error}
        hint="تأكد من تشغيل ملف SQL رقم 0063 (فصل تقرير الديزل)."
      />

      <DieselMonthlyTable
        rows={(rows ?? []) as DieselMonthRow[]}
        from={from}
        to={to}
        orgName={settings?.org_name ?? "مؤسستي"}
        currencySymbol={settings?.currency_symbol ?? "ر.س"}
      />

      <ReviewedByFooter name={settings?.reviewed_by} />
    </div>
  );
}
