"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Download, Printer } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { exportToCsv } from "@/lib/csv";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { BarChart3 } from "lucide-react";
import { statusLabels } from "@/lib/validation/trip";

type Option = { id: string; name: string };

type Row = {
  id: string;
  trip_date: string;
  trip_number: string;
  driver_name: string;
  company_name: string;
  trip_amount: number;
  driver_trip_payment: number;
  diesel_amount: number;
  trip_profit: number;
};

type Totals = {
  trips_count: number;
  total_trip_amount: number;
  total_driver_payment: number;
  total_diesel: number;
  operating_profit: number;
};

export function ProfitabilityReportTable({
  rows,
  totals,
  total,
  page,
  pageSize,
  drivers,
  companies,
  currencySymbol,
  filters,
}: {
  rows: Row[];
  totals: Totals;
  total: number;
  page: number;
  pageSize: number;
  drivers: Option[];
  companies: Option[];
  currencySymbol: string;
  filters: { from: string; to: string; driverId: string; companyId: string; status: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => (v ? params.set(k, v) : params.delete(k)));
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleExport = () => {
    exportToCsv(
      `ربحية_الرحلات_${filters.from}_${filters.to}`,
      ["التاريخ", "رقم الرحلة", "السائق", "الشركة", "سعر الرحلة", "الترب", "الديزل", "الربح"],
      rows.map((r) => [
        r.trip_date,
        r.trip_number,
        r.driver_name,
        r.company_name,
        r.trip_amount,
        r.driver_trip_payment,
        r.diesel_amount,
        r.trip_profit,
      ])
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm print:hidden">
        <Field label="من تاريخ">
          <input type="date" value={filters.from} dir="ltr" onChange={(e) => handleChange({ from: e.target.value, page: "1" })} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900" />
        </Field>
        <Field label="إلى تاريخ">
          <input type="date" value={filters.to} dir="ltr" onChange={(e) => handleChange({ to: e.target.value, page: "1" })} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900" />
        </Field>
        <Field label="السائق">
          <select value={filters.driverId} onChange={(e) => handleChange({ driver: e.target.value, page: "1" })} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900">
            <option value="">الكل</option>
            {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="الشركة">
          <select value={filters.companyId} onChange={(e) => handleChange({ company: e.target.value, page: "1" })} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900">
            <option value="">الكل</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="الحالة">
          <select value={filters.status} onChange={(e) => handleChange({ status: e.target.value, page: "1" })} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900">
            <option value="">الكل</option>
            {Object.entries(statusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
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
          <EmptyState icon={BarChart3} title="لا توجد رحلات مطابقة" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-right text-xs text-zinc-500">
                  <th className="px-4 py-3 font-medium">التاريخ</th>
                  <th className="px-4 py-3 font-medium">رقم الرحلة</th>
                  <th className="px-4 py-3 font-medium">السائق</th>
                  <th className="px-4 py-3 font-medium">الشركة</th>
                  <th className="px-4 py-3 font-medium">سعر الرحلة</th>
                  <th className="px-4 py-3 font-medium">الترب</th>
                  <th className="px-4 py-3 font-medium">الديزل</th>
                  <th className="px-4 py-3 font-medium">الربح</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-50 hover:bg-zinc-50/60">
                    <td className="px-4 py-3 whitespace-nowrap" dir="ltr">{r.trip_date}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{r.trip_number}</td>
                    <td className="px-4 py-3">{r.driver_name}</td>
                    <td className="px-4 py-3">{r.company_name}</td>
                    <td className="px-4 py-3 whitespace-nowrap" dir="ltr">{formatCurrency(r.trip_amount, currencySymbol)}</td>
                    <td className="px-4 py-3 whitespace-nowrap" dir="ltr">{formatCurrency(r.driver_trip_payment, currencySymbol)}</td>
                    <td className="px-4 py-3 whitespace-nowrap" dir="ltr">{formatCurrency(r.diesel_amount, currencySymbol)}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-semibold text-emerald-700" dir="ltr">{formatCurrency(r.trip_profit, currencySymbol)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-zinc-200 bg-zinc-50 font-bold text-zinc-900">
                  <td colSpan={4} className="px-4 py-3">الإجمالي ({totals.trips_count} رحلة)</td>
                  <td className="px-4 py-3 whitespace-nowrap" dir="ltr">{formatCurrency(totals.total_trip_amount, currencySymbol)}</td>
                  <td className="px-4 py-3 whitespace-nowrap" dir="ltr">{formatCurrency(totals.total_driver_payment, currencySymbol)}</td>
                  <td className="px-4 py-3 whitespace-nowrap" dir="ltr">{formatCurrency(totals.total_diesel, currencySymbol)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-emerald-700" dir="ltr">{formatCurrency(totals.operating_profit, currencySymbol)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <div className="print:hidden">
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={(p) => handleChange({ page: String(p) })} />
        </div>
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
