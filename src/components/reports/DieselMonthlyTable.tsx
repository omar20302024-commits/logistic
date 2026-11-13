"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Download, Printer, Fuel } from "lucide-react";
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

export type DieselMonthRow = {
  driver_id: string;
  driver_name: string;
  year: number;
  month: number;
  vehicle_id: string | null;
  vehicle_no: string | null;
  trips_count: number;
  total_trip_amount: number;
  total_trabs: number;
  diesel_amount: number;
  vehicle_expenses: number;
  remaining: number;
};

/**
 * استهلاك الديزل الشهري — صفّ لكل سائق في كل شهر داخل الفترة.
 *
 * «المتبقي» = قيمة الرحلات − (الترب + الديزل + مصاريف السيارة): ما تركته
 * السيارة للشركة في ذلك الشهر، قبل الراتب.
 */
export function DieselMonthlyTable({
  rows,
  from,
  to,
  currencySymbol,
}: {
  rows: DieselMonthRow[];
  from: string;
  to: string;
  currencySymbol: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => (v ? params.set(k, v) : params.delete(k)));
    router.push(`${pathname}?${params.toString()}`);
  };

  const totals = rows.reduce(
    (a, r) => ({
      trips_count: a.trips_count + Number(r.trips_count || 0),
      total_trip_amount: a.total_trip_amount + Number(r.total_trip_amount || 0),
      total_trabs: a.total_trabs + Number(r.total_trabs || 0),
      diesel_amount: a.diesel_amount + Number(r.diesel_amount || 0),
      vehicle_expenses: a.vehicle_expenses + Number(r.vehicle_expenses || 0),
      remaining: a.remaining + Number(r.remaining || 0),
    }),
    {
      trips_count: 0,
      total_trip_amount: 0,
      total_trabs: 0,
      diesel_amount: 0,
      vehicle_expenses: 0,
      remaining: 0,
    }
  );

  const handleExport = () => {
    exportToCsv(
      `الديزل_الشهري_${from}_${to}`,
      [
        "السائق",
        "الشهر",
        "رقم السيارة",
        "الرحلات",
        "قيمة الرحلات",
        "التربات",
        "الديزل",
        "مصاريف السيارة",
        "المتبقي",
      ],
      rows.map((r) => [
        r.driver_name,
        `${MONTHS[r.month - 1]} ${r.year}`,
        r.vehicle_no ?? "—",
        r.trips_count,
        r.total_trip_amount,
        r.total_trabs,
        r.diesel_amount,
        r.vehicle_expenses,
        r.remaining,
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
            onChange={(e) => handleChange({ from: e.target.value })}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-500">إلى تاريخ</label>
          <input
            type="date"
            dir="ltr"
            value={to}
            onChange={(e) => handleChange({ to: e.target.value })}
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

      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {rows.length === 0 ? (
          <EmptyState
            icon={Fuel}
            title="لا توجد حركة في هذه الفترة"
            description="لا رحلات ولا ديزل ولا مصروفات لأي سائق داخلي"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-right text-xs text-zinc-500">
                  <th className="px-4 py-3 font-medium">السائق</th>
                  <th className="px-4 py-3 font-medium">الشهر</th>
                  <th className="px-4 py-3 font-medium">رقم السيارة</th>
                  <th className="px-4 py-3 font-medium">الرحلات</th>
                  <th className="px-4 py-3 font-medium">قيمة الرحلات</th>
                  <th className="px-4 py-3 font-medium">التربات</th>
                  <th className="px-4 py-3 font-medium">الديزل</th>
                  <th className="px-4 py-3 font-medium">مصاريف السيارة</th>
                  <th className="px-4 py-3 font-medium">المتبقي</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={`${r.driver_id}-${r.year}-${r.month}`}
                    className="border-b border-zinc-50"
                  >
                    <td className="px-4 py-3 font-medium text-zinc-900">{r.driver_name}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-zinc-600">
                      {MONTHS[r.month - 1]} {r.year}
                    </td>
                    <td className="px-4 py-3 text-zinc-700" dir="ltr">
                      {r.vehicle_no ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-600" dir="ltr">
                      {formatNumber(r.trips_count)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-zinc-700" dir="ltr">
                      {formatCurrency(r.total_trip_amount, currencySymbol)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-zinc-600" dir="ltr">
                      {formatCurrency(r.total_trabs, currencySymbol)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-semibold text-amber-700" dir="ltr">
                      {formatCurrency(r.diesel_amount, currencySymbol)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-zinc-600" dir="ltr">
                      {formatCurrency(r.vehicle_expenses, currencySymbol)}
                    </td>
                    <td
                      className={`px-4 py-3 whitespace-nowrap font-bold ${
                        r.remaining < 0 ? "text-red-600" : "text-emerald-700"
                      }`}
                      dir="ltr"
                    >
                      {formatCurrency(r.remaining, currencySymbol)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-zinc-50 font-bold text-zinc-900">
                  <td className="px-4 py-3" colSpan={3}>
                    الإجمالي
                  </td>
                  <td className="px-4 py-3" dir="ltr">
                    {formatNumber(totals.trips_count)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" dir="ltr">
                    {formatCurrency(totals.total_trip_amount, currencySymbol)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" dir="ltr">
                    {formatCurrency(totals.total_trabs, currencySymbol)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" dir="ltr">
                    {formatCurrency(totals.diesel_amount, currencySymbol)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" dir="ltr">
                    {formatCurrency(totals.vehicle_expenses, currencySymbol)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" dir="ltr">
                    {formatCurrency(totals.remaining, currencySymbol)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
