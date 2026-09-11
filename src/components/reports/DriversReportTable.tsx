"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Download, Printer } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import { exportToCsv } from "@/lib/csv";
import { EmptyState } from "@/components/ui/EmptyState";
import { BarChart3 } from "lucide-react";

type Row = {
  driver_id: string;
  driver_name: string;
  driver_status: "active" | "inactive";
  trips_count: number;
  total_trip_amount: number;
  total_driver_payment: number;
  total_diesel: number;
  operating_profit: number;
  salary_earned: number;
  net_profit: number;
};

export function DriversReportTable({
  rows,
  from,
  to,
  currencySymbol,
}: {
  rows: Row[];
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
    (acc, r) => ({
      trips_count: acc.trips_count + r.trips_count,
      total_trip_amount: acc.total_trip_amount + r.total_trip_amount,
      total_driver_payment: acc.total_driver_payment + r.total_driver_payment,
      total_diesel: acc.total_diesel + r.total_diesel,
      operating_profit: acc.operating_profit + r.operating_profit,
      salary_earned: acc.salary_earned + r.salary_earned,
      net_profit: acc.net_profit + r.net_profit,
    }),
    { trips_count: 0, total_trip_amount: 0, total_driver_payment: 0, total_diesel: 0, operating_profit: 0, salary_earned: 0, net_profit: 0 }
  );

  const handleExport = () => {
    exportToCsv(
      `تقرير_السائقين_${from}_${to}`,
      ["السائق", "الحالة", "عدد الرحلات", "قيمة الرحلات", "الترب", "الديزل", "الربح التشغيلي", "الراتب المستحق", "صافي الربح"],
      rows.map((r) => [
        r.driver_name,
        r.driver_status === "active" ? "نشط" : "غير نشط",
        r.trips_count,
        r.total_trip_amount,
        r.total_driver_payment,
        r.total_diesel,
        r.operating_profit,
        r.salary_earned,
        r.net_profit,
      ])
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm print:hidden">
        <Field label="من تاريخ">
          <input type="date" value={from} dir="ltr" onChange={(e) => handleChange({ from: e.target.value })} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900" />
        </Field>
        <Field label="إلى تاريخ">
          <input type="date" value={to} dir="ltr" onChange={(e) => handleChange({ to: e.target.value })} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900" />
        </Field>
        <div className="mr-auto flex items-center gap-2">
          <button onClick={handleExport} type="button" className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
            <Download size={15} /> تصدير CSV
          </button>
          <button onClick={() => window.print()} type="button" className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800">
            <Printer size={15} /> طباعة
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {rows.every((r) => r.trips_count === 0) && rows.length === 0 ? (
          <EmptyState icon={BarChart3} title="لا يوجد سائقون" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-right text-xs text-zinc-500">
                  <th className="px-4 py-3 font-medium">السائق</th>
                  <th className="px-4 py-3 font-medium">الرحلات</th>
                  <th className="px-4 py-3 font-medium">قيمة الرحلات</th>
                  <th className="px-4 py-3 font-medium">الترب</th>
                  <th className="px-4 py-3 font-medium">الديزل</th>
                  <th className="px-4 py-3 font-medium">الربح التشغيلي</th>
                  <th className="px-4 py-3 font-medium">الراتب المستحق</th>
                  <th className="px-4 py-3 font-medium">صافي الربح</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.driver_id} className="border-b border-zinc-50 hover:bg-zinc-50/60">
                    <td className="px-4 py-3 font-medium text-zinc-900">{r.driver_name}</td>
                    <td className="px-4 py-3" dir="ltr">{formatNumber(r.trips_count)}</td>
                    <td className="px-4 py-3 whitespace-nowrap" dir="ltr">{formatCurrency(r.total_trip_amount, currencySymbol)}</td>
                    <td className="px-4 py-3 whitespace-nowrap" dir="ltr">{formatCurrency(r.total_driver_payment, currencySymbol)}</td>
                    <td className="px-4 py-3 whitespace-nowrap" dir="ltr">{formatCurrency(r.total_diesel, currencySymbol)}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-semibold text-emerald-700" dir="ltr">{formatCurrency(r.operating_profit, currencySymbol)}</td>
                    <td className="px-4 py-3 whitespace-nowrap" dir="ltr">{formatCurrency(r.salary_earned, currencySymbol)}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-semibold text-zinc-900" dir="ltr">{formatCurrency(r.net_profit, currencySymbol)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-zinc-200 bg-zinc-50 font-bold text-zinc-900">
                  <td className="px-4 py-3">الإجمالي</td>
                  <td className="px-4 py-3" dir="ltr">{formatNumber(totals.trips_count)}</td>
                  <td className="px-4 py-3 whitespace-nowrap" dir="ltr">{formatCurrency(totals.total_trip_amount, currencySymbol)}</td>
                  <td className="px-4 py-3 whitespace-nowrap" dir="ltr">{formatCurrency(totals.total_driver_payment, currencySymbol)}</td>
                  <td className="px-4 py-3 whitespace-nowrap" dir="ltr">{formatCurrency(totals.total_diesel, currencySymbol)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-emerald-700" dir="ltr">{formatCurrency(totals.operating_profit, currencySymbol)}</td>
                  <td className="px-4 py-3 whitespace-nowrap" dir="ltr">{formatCurrency(totals.salary_earned, currencySymbol)}</td>
                  <td className="px-4 py-3 whitespace-nowrap" dir="ltr">{formatCurrency(totals.net_profit, currencySymbol)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-zinc-500">{label}</label>
      {children}
    </div>
  );
}
