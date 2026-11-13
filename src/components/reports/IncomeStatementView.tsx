"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";

export type IncomeStatement = {
  invoiced_revenue: number;
  trips_revenue: number;
  revenue_difference: number;
  rental_revenue: number;
  total_revenue: number;
  total_driver_payments: number;
  total_trip_diesel: number;
  total_monthly_diesel: number;
  total_rental_diesel: number;
  total_salaries: number;
  total_driver_expenses: number;
  total_housing_cost: number;
  total_other_expenses: number;
  total_costs: number;
  net_profit: number;
};

export type ReconciliationRow = {
  company_id: string;
  company_name: string;
  invoiced_amount: number;
  trips_amount: number;
  trips_count: number;
  difference: number;
};

/**
 * قائمة الدخل — إيرادها الفواتير لا الرحلات.
 *
 * وتحتها تقرير المطابقة: المفوتَر مقابل رحلات النظام لكل عميل. الفرق
 * يُعرض صراحةً — سائق واحد يُفوتَر عمله كسيارتين سببٌ مشروع له، لكن
 * الفرق الذي لا تفسير له يُرى هنا قبل أن يصير عادة.
 */
export function IncomeStatementView({
  statement,
  reconciliation,
  from,
  to,
  orgName,
  currencySymbol,
}: {
  statement: IncomeStatement;
  reconciliation: ReconciliationRow[];
  from: string;
  to: string;
  orgName: string;
  currencySymbol: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => (v ? params.set(k, v) : params.delete(k)));
    router.push(`${pathname}?${params.toString()}`);
  };

  const c = (v: number) => formatCurrency(v, currencySymbol);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm print:hidden">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-500">من تاريخ</label>
          <input
            type="date"
            dir="ltr"
            value={from}
            onChange={(e) => setParam({ from: e.target.value })}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-500">إلى تاريخ</label>
          <input
            type="date"
            dir="ltr"
            value={to}
            onChange={(e) => setParam({ to: e.target.value })}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          />
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="mr-auto inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          <Printer size={15} /> طباعة
        </button>
      </div>

      <div className="print-statement overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
        <div className="bg-zinc-900 px-6 py-5 text-white">
          <h1 className="text-lg font-bold">{orgName}</h1>
          <p className="text-sm text-zinc-300">
            قائمة الدخل — من <span dir="ltr">{from}</span> إلى <span dir="ltr">{to}</span>
          </p>
        </div>

        <div className="px-6 py-5">
          <h2 className="mb-2 text-sm font-bold text-zinc-900">الإيرادات</h2>
          <Row label="إيراد العملاء (مفوتَر)" value={c(statement.invoiced_revenue)} />
          {statement.rental_revenue > 0 && (
            <Row label="إيراد عقود الإيجار" value={c(statement.rental_revenue)} />
          )}
          <Row label="إجمالي الإيرادات" value={c(statement.total_revenue)} bold />

          <h2 className="mb-2 mt-5 text-sm font-bold text-zinc-900">التكاليف</h2>
          <Row label="تربات السائقين" value={c(statement.total_driver_payments)} />
          {statement.total_trip_diesel > 0 && (
            <Row label="ديزل مسجَّل على الرحلات" value={c(statement.total_trip_diesel)} />
          )}
          <Row label="ديزل السائقين الشهري" value={c(statement.total_monthly_diesel)} />
          {statement.total_rental_diesel > 0 && (
            <Row label="ديزل عقود الإيجار" value={c(statement.total_rental_diesel)} />
          )}
          <Row label="الرواتب" value={c(statement.total_salaries)} />
          <Row label="مصروفات دفعها السائقون" value={c(statement.total_driver_expenses)} />
          {statement.total_housing_cost > 0 && (
            <Row label="تكلفة السكن" value={c(statement.total_housing_cost)} />
          )}
          <Row label="مصروفات أخرى" value={c(statement.total_other_expenses)} />
          <Row label="إجمالي التكاليف" value={c(statement.total_costs)} bold />

          <div
            className={`mt-4 flex items-center justify-between rounded-xl px-4 py-3 ${
              statement.net_profit >= 0
                ? "bg-emerald-50 text-emerald-900"
                : "bg-red-50 text-red-900"
            }`}
          >
            <span className="text-sm font-bold">
              {statement.net_profit >= 0 ? "صافي الربح" : "صافي الخسارة"}
            </span>
            <span className="text-lg font-bold" dir="ltr">
              {c(Math.abs(statement.net_profit))}
            </span>
          </div>

          {/* المطابقة: الفرق بين ما فُوتر وما في النظام، لكل عميل */}
          <h2 className="mb-2 mt-6 text-sm font-bold text-zinc-900">
            مطابقة الإيراد بالرحلات
          </h2>
          <p className="mb-2 text-[11px] text-zinc-500">
            الفرق الموجب طبيعي حين يُفوتَر عمل سائق واحد على العميل كسيارتين. والفرق
            الذي لا تفسير له يُراجَع من هنا.
          </p>

          <div className="overflow-x-auto rounded-xl border border-zinc-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-right text-xs text-zinc-500">
                  <th className="px-3 py-2 font-medium">العميل</th>
                  <th className="px-3 py-2 font-medium">الرحلات</th>
                  <th className="px-3 py-2 font-medium">قيمة الرحلات</th>
                  <th className="px-3 py-2 font-medium">المفوتَر</th>
                  <th className="px-3 py-2 font-medium">الفرق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {reconciliation.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-zinc-400">
                      لا توجد بيانات في هذه الفترة
                    </td>
                  </tr>
                ) : (
                  reconciliation.map((r) => (
                    <tr key={r.company_id}>
                      <td className="px-3 py-2 text-zinc-800">{r.company_name}</td>
                      <td className="px-3 py-2 text-zinc-600" dir="ltr">
                        {formatNumber(r.trips_count)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-zinc-600" dir="ltr">
                        {c(r.trips_amount)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap font-semibold text-zinc-900" dir="ltr">
                        {c(r.invoiced_amount)}
                      </td>
                      <td
                        className={`px-3 py-2 whitespace-nowrap font-semibold ${
                          r.difference === 0
                            ? "text-zinc-400"
                            : r.difference > 0
                              ? "text-emerald-700"
                              : "text-red-600"
                        }`}
                        dir="ltr"
                      >
                        {c(r.difference)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-[11px] text-zinc-400">
            الإيراد في هذه القائمة من فواتير العملاء. ولوحة التحكم والتقرير المالي
            يعرضان إيراد الرحلات كما هو، فلا يتعارضان مع هذه الصفحة بل يكمّلانها.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between py-1.5 ${
        bold ? "mt-1 border-t border-zinc-300 pt-2.5 font-bold text-zinc-900" : "text-zinc-700"
      }`}
    >
      <span className={bold ? "text-sm" : "text-xs"}>{label}</span>
      <span className={bold ? "text-sm" : "text-sm"} dir="ltr">
        {value}
      </span>
    </div>
  );
}
