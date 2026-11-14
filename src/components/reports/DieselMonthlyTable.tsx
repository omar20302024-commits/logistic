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
  diesel_amount: number;
};

/**
 * استهلاك الديزل الشهري — الديزل وحده.
 *
 * 📌 لا تربات ولا مصاريف سيارة هنا بطلب المستخدم: لكلٍّ تقريره. وهذا يجيب
 *    عن سؤال واحد — «كم شرب هذا السائق هذا الشهر، وبأي سيارة».
 *    والإيراد والتكلفة والصافي في «إيراد السائق/السيارة».
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
      trips: a.trips + Number(r.trips_count || 0),
      diesel: a.diesel + Number(r.diesel_amount || 0),
    }),
    { trips: 0, diesel: 0 }
  );

  const handleExport = () => {
    exportToCsv(
      `الديزل_الشهري_${from}_${to}`,
      ["السائق", "الشهر", "رقم السيارة", "الرحلات", "الديزل"],
      rows.map((r) => [
        r.driver_name,
        `${MONTHS[r.month - 1]} ${r.year}`,
        r.vehicle_no ?? "—",
        r.trips_count,
        r.diesel_amount,
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
            title="لا يوجد ديزل مسجَّل في هذه الفترة"
            description="يُسجَّل الديزل من صفحة السائق"
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
                  <th className="px-4 py-3 font-medium">الديزل</th>
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
                    <td
                      className="px-4 py-3 whitespace-nowrap font-semibold text-amber-700"
                      dir="ltr"
                    >
                      {formatCurrency(r.diesel_amount, currencySymbol)}
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
                    {formatNumber(totals.trips)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" dir="ltr">
                    {formatCurrency(totals.diesel, currencySymbol)}
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
