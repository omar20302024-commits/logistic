"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Download, Printer } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import { exportToCsv } from "@/lib/csv";
import { EmptyState } from "@/components/ui/EmptyState";
import { Home } from "lucide-react";
import { monthLabels } from "@/lib/validation/salary";

type Row = {
  contract_id: string;
  driver_name: string;
  company_name: string;
  city: string | null;
  monthly_amount: number;
  housing_unit_name: string | null;
  housing_share: number;
  salary_basic: number;
  trips_count: number;
  trabat: number;
  diesel: number;
  net_profit: number;
};

export function RentalReportView({
  rows,
  month,
  year,
  currencySymbol,
}: {
  rows: Row[];
  month: string;
  year: string;
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
      monthly_amount: acc.monthly_amount + r.monthly_amount,
      housing_share: acc.housing_share + r.housing_share,
      salary_basic: acc.salary_basic + r.salary_basic,
      trabat: acc.trabat + r.trabat,
      diesel: acc.diesel + r.diesel,
      net_profit: acc.net_profit + r.net_profit,
    }),
    { monthly_amount: 0, housing_share: 0, salary_basic: 0, trabat: 0, diesel: 0, net_profit: 0 }
  );

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);

  const handleExport = () => {
    exportToCsv(
      `ربحية_عقود_الإيجار_${year}_${month}`,
      ["السائق", "الشركة", "المدينة", "الإيجار", "نصيب السكن", "الراتب", "الترب", "الديزل", "صافي الربح"],
      rows.map((r) => [
        r.driver_name,
        r.company_name,
        r.city ?? "",
        r.monthly_amount,
        r.housing_share,
        r.salary_basic,
        r.trabat,
        r.diesel,
        r.net_profit,
      ])
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm print:hidden">
        <Field label="الشهر">
          <select value={month} onChange={(e) => handleChange({ month: e.target.value })} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900">
            {monthLabels.map((label, i) => <option key={i + 1} value={i + 1}>{label}</option>)}
          </select>
        </Field>
        <Field label="السنة">
          <select value={year} onChange={(e) => handleChange({ year: e.target.value })} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900">
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
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
        {rows.length === 0 ? (
          <EmptyState icon={Home} title="لا توجد عقود إيجار لهذا الشهر" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-right text-xs text-zinc-500">
                  <th className="px-4 py-3 font-medium">السائق</th>
                  <th className="px-4 py-3 font-medium">الشركة</th>
                  <th className="px-4 py-3 font-medium">المدينة</th>
                  <th className="px-4 py-3 font-medium">الإيجار</th>
                  <th className="px-4 py-3 font-medium">نصيب السكن</th>
                  <th className="px-4 py-3 font-medium">الراتب</th>
                  <th className="px-4 py-3 font-medium">الترب</th>
                  <th className="px-4 py-3 font-medium">الديزل</th>
                  <th className="px-4 py-3 font-medium">صافي الربح</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.contract_id} className="border-b border-zinc-50 hover:bg-zinc-50/60">
                    <td className="px-4 py-3 font-medium text-zinc-900">{r.driver_name}</td>
                    <td className="px-4 py-3 text-zinc-600">{r.company_name}</td>
                    <td className="px-4 py-3 text-zinc-600">{r.city || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap" dir="ltr">{formatCurrency(r.monthly_amount, currencySymbol)}</td>
                    <td className="px-4 py-3 whitespace-nowrap" dir="ltr">
                      {formatCurrency(r.housing_share, currencySymbol)}
                      {r.housing_unit_name && <span className="mr-1 text-[10px] text-zinc-400">({r.housing_unit_name})</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" dir="ltr">{formatCurrency(r.salary_basic, currencySymbol)}</td>
                    <td className="px-4 py-3 whitespace-nowrap" dir="ltr">{formatCurrency(r.trabat, currencySymbol)}</td>
                    <td className="px-4 py-3 whitespace-nowrap" dir="ltr">{formatCurrency(r.diesel, currencySymbol)}</td>
                    <td className={`px-4 py-3 whitespace-nowrap font-semibold ${r.net_profit >= 0 ? "text-emerald-700" : "text-red-600"}`} dir="ltr">
                      {formatCurrency(r.net_profit, currencySymbol)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-zinc-200 bg-zinc-50 font-bold text-zinc-900">
                  <td colSpan={3} className="px-4 py-3">الإجمالي ({formatNumber(rows.length)} عقد)</td>
                  <td className="px-4 py-3 whitespace-nowrap" dir="ltr">{formatCurrency(totals.monthly_amount, currencySymbol)}</td>
                  <td className="px-4 py-3 whitespace-nowrap" dir="ltr">{formatCurrency(totals.housing_share, currencySymbol)}</td>
                  <td className="px-4 py-3 whitespace-nowrap" dir="ltr">{formatCurrency(totals.salary_basic, currencySymbol)}</td>
                  <td className="px-4 py-3 whitespace-nowrap" dir="ltr">{formatCurrency(totals.trabat, currencySymbol)}</td>
                  <td className="px-4 py-3 whitespace-nowrap" dir="ltr">{formatCurrency(totals.diesel, currencySymbol)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-emerald-700" dir="ltr">{formatCurrency(totals.net_profit, currencySymbol)}</td>
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
