import { createClient } from "@/lib/supabase/server";
import {
  CompanyRevenuesTable,
} from "@/components/revenues/CompanyRevenuesTable";
import type { CompanyRevenue } from "@/app/(dashboard)/revenues/actions";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

// إيرادات العملاء الشهرية (0060): الرقم النهائي المفوتَر لكل عميل في الشهر.
//
// 🔑 لا يُمَسّ مبلغ أي رحلة. الفاتورة قد تزيد عن رحلات النظام (عمل سائق واحد
//    يُفوتَر كسيارتين)، والفرق يُعرض لا يُخفى.

function monthBounds(year: number, month: number) {
  const last = new Date(year, month, 0).getDate();
  const p = (n: number) => String(n).padStart(2, "0");
  return { from: `${year}-${p(month)}-01`, to: `${year}-${p(month)}-${p(last)}` };
}

export default async function RevenuesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;
  const { from, to } = monthBounds(year, month);

  const supabase = await createClient();

  const [{ data: companies }, { data: revenues, error }, { data: trips }, { data: settings }] =
    await Promise.all([
      supabase.from("companies").select("id, name").order("name"),
      supabase
        .from("company_monthly_revenues")
        .select("id, company_id, year, month, amount, notes")
        .eq("year", year)
        .eq("month", month),
      // إجمالي رحلات النظام لكل عميل في نفس الشهر — للمقارنة أثناء الإدخال
      supabase
        .from("trips")
        .select("company_id, trip_amount")
        .gte("trip_date", from)
        .lte("trip_date", to)
        .neq("status", "cancelled"),
      supabase.from("settings").select("currency_symbol").single(),
    ]);

  const tripTotals: Record<string, number> = {};
  for (const t of trips ?? []) {
    const key = t.company_id as string;
    tripTotals[key] = (tripTotals[key] ?? 0) + (Number(t.trip_amount) || 0);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">إيرادات العملاء</h1>
        <p className="text-sm text-zinc-500">
          الإجمالي المفوتَر لكل عميل في الشهر — وهو مصدر الإيراد في قائمة الدخل. مبالغ
          الرحلات لا تتغيّر، والفرق بين الاثنين معروض أمامك.
        </p>
      </div>

      <ErrorBanner
        error={error}
        hint="تأكد من تشغيل ملف SQL رقم 0060 (إيرادات العملاء)."
      />

      <CompanyRevenuesTable
        companies={(companies ?? []).map((c) => ({
          id: c.id as string,
          name: c.name as string,
        }))}
        revenues={(revenues ?? []) as CompanyRevenue[]}
        year={year}
        month={month}
        currencySymbol={settings?.currency_symbol ?? "ر.س"}
        tripTotals={tripTotals}
      />
    </div>
  );
}
