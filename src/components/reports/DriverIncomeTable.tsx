"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Download, Printer, Wallet } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import { exportToCsv } from "@/lib/csv";
import { EmptyState } from "@/components/ui/EmptyState";

const MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

export type DriverIncomeRow = {
  driver_id: string;
  driver_name: string;
  year: number;
  month: number;
  vehicle_no: string | null;
  trips_count: number;
  total_trip_amount: number;
  total_trabs: number;
  diesel_amount: number;
  custody_expenses: number;
  net_amount: number;
};

export type ExpenseCell = {
  driver_id: string;
  year: number;
  month: number;
  expense_category: string;
  total: number;
};

/**
 * إيراد السائق/السيارة — ما دخل وما خرج وما بقي، لكل سائق في كل شهر.
 *
 * 🔑 بنود المصاريف يكتبها المستخدم حرّةً (غسيل، بنشر، أخرى…) فلا تُثبَّت
 *    أعمدةً في SQL. تأتي صفوفاً وتُبسَط هنا أعمدةً حسب الموجود فعلاً في
 *    الفترة — فلا عمودٌ فارغ ولا بندٌ يسقط.
 *
 * 📌 الراتب خارج الحساب عمداً: هذا كشف السيارة لا كشف الموظف، والراتب
 *    يُصرف سواء دارت السيارة أم وقفت.
 */
export function DriverIncomeTable({
  rows,
  expenses,
  from,
  to,
  orgName,
  currencySymbol,
}: {
  rows: DriverIncomeRow[];
  expenses: ExpenseCell[];
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

  // البنود الموجودة فعلاً في الفترة، مرتَّبة بالأكبر إنفاقاً
  const categoryTotals = new Map<string, number>();
  for (const e of expenses) {
    categoryTotals.set(
      e.expense_category,
      (categoryTotals.get(e.expense_category) ?? 0) + Number(e.total || 0)
    );
  }
  const categories = Array.from(categoryTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  const cellKey = (driverId: string, year: number, month: number, cat: string) =>
    `${driverId}|${year}|${month}|${cat}`;

  const byCell = new Map<string, number>();
  for (const e of expenses) {
    byCell.set(
      cellKey(e.driver_id, e.year, e.month, e.expense_category),
      Number(e.total || 0)
    );
  }

  const totals = rows.reduce(
    (a, r) => ({
      trips: a.trips + Number(r.trips_count || 0),
      revenue: a.revenue + Number(r.total_trip_amount || 0),
      trabs: a.trabs + Number(r.total_trabs || 0),
      diesel: a.diesel + Number(r.diesel_amount || 0),
      expenses: a.expenses + Number(r.custody_expenses || 0),
      net: a.net + Number(r.net_amount || 0),
    }),
    { trips: 0, revenue: 0, trabs: 0, diesel: 0, expenses: 0, net: 0 }
  );

  const handleExport = () => {
    exportToCsv(
      `إيراد_السائق_${from}_${to}`,
      [
        "السائق",
        "الشهر",
        "رقم السيارة",
        "الرحلات",
        "قيمة الرحلات",
        "التربات",
        "الديزل",
        ...categories,
        "إجمالي المصاريف",
        "الصافي",
      ],
      rows.map((r) => [
        r.driver_name,
        `${MONTHS[r.month - 1]} ${r.year}`,
        r.vehicle_no ?? "—",
        r.trips_count,
        r.total_trip_amount,
        r.total_trabs,
        r.diesel_amount,
        ...categories.map((c) => byCell.get(cellKey(r.driver_id, r.year, r.month, c)) ?? 0),
        r.custody_expenses,
        r.net_amount,
      ])
    );
  };

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

        <div className="mr-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            <Download size={15} /> تصدير
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            <Printer size={15} /> طباعة
          </button>
        </div>
      </div>

      <div className="print-statement rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="hidden border-b border-zinc-200 px-6 py-4 print:block">
          <h1 className="text-lg font-bold text-zinc-900">{orgName}</h1>
          <p className="text-sm text-zinc-500">
            إيراد السائق/السيارة — من {from} إلى {to}
          </p>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="لا توجد حركة في هذه الفترة"
            description="لا رحلات ولا ديزل ولا مصاريف لأي سائق داخلي"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-right text-xs text-zinc-500">
                  <th className="px-3 py-3 font-medium">السائق</th>
                  <th className="px-3 py-3 font-medium">الشهر</th>
                  <th className="px-3 py-3 font-medium">السيارة</th>
                  <th className="px-3 py-3 font-medium">الرحلات</th>
                  <th className="px-3 py-3 font-medium">قيمة الرحلات</th>
                  <th className="px-3 py-3 font-medium">التربات</th>
                  <th className="px-3 py-3 font-medium">الديزل</th>
                  {categories.map((c) => (
                    <th key={c} className="px-3 py-3 font-medium whitespace-nowrap">
                      {c}
                    </th>
                  ))}
                  <th className="px-3 py-3 font-medium">إجمالي المصاريف</th>
                  <th className="px-3 py-3 font-medium">الصافي</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={`${r.driver_id}-${r.year}-${r.month}`}
                    className="border-b border-zinc-50"
                  >
                    <td className="px-3 py-2.5 font-medium text-zinc-900">{r.driver_name}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-zinc-600">
                      {MONTHS[r.month - 1]} {r.year}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-700" dir="ltr">
                      {r.vehicle_no ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-600" dir="ltr">
                      {formatNumber(r.trips_count)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-zinc-900" dir="ltr">
                      {formatCurrency(r.total_trip_amount, currencySymbol)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-zinc-600" dir="ltr">
                      {formatCurrency(r.total_trabs, currencySymbol)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-amber-700" dir="ltr">
                      {formatCurrency(r.diesel_amount, currencySymbol)}
                    </td>
                    {categories.map((c) => {
                      const v = byCell.get(cellKey(r.driver_id, r.year, r.month, c));
                      return (
                        <td
                          key={c}
                          className="px-3 py-2.5 whitespace-nowrap text-zinc-600"
                          dir="ltr"
                        >
                          {v ? formatCurrency(v, currencySymbol) : "—"}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 whitespace-nowrap text-red-600" dir="ltr">
                      {formatCurrency(r.custody_expenses, currencySymbol)}
                    </td>
                    <td
                      className={`px-3 py-2.5 whitespace-nowrap font-bold ${
                        r.net_amount < 0 ? "text-red-600" : "text-emerald-700"
                      }`}
                      dir="ltr"
                    >
                      {formatCurrency(r.net_amount, currencySymbol)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-zinc-50 font-bold text-zinc-900">
                  <td className="px-3 py-3" colSpan={3}>
                    الإجمالي
                  </td>
                  <td className="px-3 py-3" dir="ltr">
                    {formatNumber(totals.trips)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap" dir="ltr">
                    {formatCurrency(totals.revenue, currencySymbol)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap" dir="ltr">
                    {formatCurrency(totals.trabs, currencySymbol)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap" dir="ltr">
                    {formatCurrency(totals.diesel, currencySymbol)}
                  </td>
                  {categories.map((c) => (
                    <td key={c} className="px-3 py-3 whitespace-nowrap" dir="ltr">
                      {formatCurrency(categoryTotals.get(c) ?? 0, currencySymbol)}
                    </td>
                  ))}
                  <td className="px-3 py-3 whitespace-nowrap" dir="ltr">
                    {formatCurrency(totals.expenses, currencySymbol)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap" dir="ltr">
                    {formatCurrency(totals.net, currencySymbol)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11px] text-zinc-500 print:text-zinc-600">
        الصافي = قيمة الرحلات − (التربات + الديزل + المصاريف). والمصاريف هي ما صُرف من
        عهدة السائق على العمل ببنودها كما كُتبت في صفحته. والراتب خارج هذا الحساب — فهو
        كشف السيارة لا كشف الموظف.
      </p>
    </div>
  );
}
