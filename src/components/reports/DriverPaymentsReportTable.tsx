"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Download, Printer } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import { exportToCsv } from "@/lib/csv";
import { EmptyState } from "@/components/ui/EmptyState";
import { Banknote } from "lucide-react";

type Option = { id: string; name: string };

type Row = { driver_id: string; driver_name: string; trips_count: number; total_driver_payment: number };

export function DriverPaymentsReportTable({
  rows,
  drivers,
  companies,
  currencySymbol,
  filters,
}: {
  rows: Row[];
  drivers: Option[];
  companies: Option[];
  currencySymbol: string;
  filters: { from: string; to: string; driverId: string; companyId: string };
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
    (acc, r) => ({ trips_count: acc.trips_count + r.trips_count, total_driver_payment: acc.total_driver_payment + r.total_driver_payment }),
    { trips_count: 0, total_driver_payment: 0 }
  );

  const handleExport = () => {
    exportToCsv(
      `تقرير_الترب_${filters.from}_${filters.to}`,
      ["السائق", "عدد الرحلات", "إجمالي الترب"],
      rows.map((r) => [r.driver_name, r.trips_count, r.total_driver_payment])
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm print:hidden">
        <Field label="من تاريخ">
          <input type="date" value={filters.from} dir="ltr" onChange={(e) => handleChange({ from: e.target.value })} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900" />
        </Field>
        <Field label="إلى تاريخ">
          <input type="date" value={filters.to} dir="ltr" onChange={(e) => handleChange({ to: e.target.value })} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900" />
        </Field>
        <Field label="السائق">
          <select value={filters.driverId} onChange={(e) => handleChange({ driver: e.target.value })} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900">
            <option value="">الكل</option>
            {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="الشركة">
          <select value={filters.companyId} onChange={(e) => handleChange({ company: e.target.value })} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900">
            <option value="">الكل</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
          <EmptyState icon={Banknote} title="لا توجد بيانات" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-right text-xs text-zinc-500">
                  <th className="px-4 py-3 font-medium">السائق</th>
                  <th className="px-4 py-3 font-medium">عدد الرحلات</th>
                  <th className="px-4 py-3 font-medium">إجمالي الترب</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.driver_id} className="border-b border-zinc-50 hover:bg-zinc-50/60">
                    <td className="px-4 py-3 font-medium text-zinc-900">{r.driver_name}</td>
                    <td className="px-4 py-3" dir="ltr">{formatNumber(r.trips_count)}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-semibold" dir="ltr">{formatCurrency(r.total_driver_payment, currencySymbol)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-zinc-200 bg-zinc-50 font-bold text-zinc-900">
                  <td className="px-4 py-3">الإجمالي</td>
                  <td className="px-4 py-3" dir="ltr">{formatNumber(totals.trips_count)}</td>
                  <td className="px-4 py-3 whitespace-nowrap" dir="ltr">{formatCurrency(totals.total_driver_payment, currencySymbol)}</td>
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
