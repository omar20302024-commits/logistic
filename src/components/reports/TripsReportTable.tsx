"use client";

import Link from "next/link";
import { useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Printer, Download, Truck } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatNumber } from "@/lib/format";
import { exportToCsv } from "@/lib/csv";
import { statusLabels } from "@/lib/validation/trip";

type TripRow = {
  id: string;
  trip_number: string;
  trip_date: string;
  company_name: string;
  driver_name: string;
  vehicle_no: string | null;
  vehicle_type_label: string | null;
  from_location: string;
  to_location: string;
  requester: string | null;
  status: string;
  base_fare: number;
  labor_fare: number;
  extra_location_fare: number;
  overnight_fare: number;
  trip_amount: number;
  driver_trip_payment: number;
};

type Option = { id: string; name: string };

export function TripsReportTable({
  trips,
  drivers,
  companies,
  currencySymbol,
  filters,
}: {
  trips: TripRow[];
  drivers: Option[];
  companies: Option[];
  currencySymbol: string;
  filters: { from: string; to: string; driver: string; company: string; status: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const update = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([k, v]) => (v ? params.set(k, v) : params.delete(k)));
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const totals = trips.reduce(
    (acc, t) => ({
      base: acc.base + Number(t.base_fare),
      labor: acc.labor + Number(t.labor_fare),
      extra: acc.extra + Number(t.extra_location_fare),
      overnight: acc.overnight + Number(t.overnight_fare),
      amount: acc.amount + Number(t.trip_amount),
      trab: acc.trab + Number(t.driver_trip_payment),
    }),
    { base: 0, labor: 0, extra: 0, overnight: 0, amount: 0, trab: 0 }
  );

  const handleExport = () => {
    exportToCsv(
      `تقرير-الرحلات-${filters.from}-${filters.to}.csv`,
      [
        "التاريخ",
        "رقم الرحلة",
        "العميل",
        "السائق",
        "السيارة",
        "النوع",
        "من",
        "إلى",
        "صاحب الطلب",
        "الحالة",
        "الأساسية",
        "العمالة",
        "الموقع الإضافي",
        "المبيت",
        "سعر الرحلة",
        "الترب",
      ],
      trips.map((t) => [
        t.trip_date,
        t.trip_number,
        t.company_name,
        t.driver_name,
        t.vehicle_no ?? "",
        t.vehicle_type_label ?? "",
        t.from_location,
        t.to_location,
        t.requester ?? "",
        statusLabels[t.status] ?? t.status,
        t.base_fare,
        t.labor_fare,
        t.extra_location_fare,
        t.overnight_fare,
        t.trip_amount,
        t.driver_trip_payment,
      ])
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm print:hidden">
        <Field label="من تاريخ">
          <input
            type="date"
            dir="ltr"
            value={filters.from}
            onChange={(e) => update({ from: e.target.value })}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          />
        </Field>
        <Field label="إلى تاريخ">
          <input
            type="date"
            dir="ltr"
            value={filters.to}
            onChange={(e) => update({ to: e.target.value })}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          />
        </Field>
        <Field label="السائق">
          <select
            value={filters.driver}
            onChange={(e) => update({ driver: e.target.value })}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          >
            <option value="">الكل</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="العميل">
          <select
            value={filters.company}
            onChange={(e) => update({ company: e.target.value })}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          >
            <option value="">الكل</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="الحالة">
          <select
            value={filters.status}
            onChange={(e) => update({ status: e.target.value })}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          >
            <option value="">الكل</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <div className="mr-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <Download size={15} /> تصدير CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            <Printer size={15} /> طباعة
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm print:border-0 print:shadow-none">
        {trips.length === 0 ? (
          <EmptyState icon={Truck} title="لا توجد رحلات في هذه الفترة" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-right text-xs text-zinc-500">
                  <th className="px-3 py-3 font-medium">التاريخ</th>
                  <th className="px-3 py-3 font-medium">رقم الرحلة</th>
                  <th className="px-3 py-3 font-medium">العميل</th>
                  <th className="px-3 py-3 font-medium">السائق</th>
                  <th className="px-3 py-3 font-medium">السيارة</th>
                  <th className="px-3 py-3 font-medium">خط السير</th>
                  <th className="px-3 py-3 font-medium">الحالة</th>
                  <th className="px-3 py-3 font-medium">سعر الرحلة</th>
                  <th className="px-3 py-3 font-medium">الترب</th>
                </tr>
              </thead>
              <tbody>
                {trips.map((t) => (
                  <tr key={t.id} className="border-b border-zinc-50 hover:bg-zinc-50/60">
                    <td className="px-3 py-2.5 whitespace-nowrap text-zinc-600" dir="ltr">
                      {t.trip_date}
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/trips/${t.id}`}
                        className="font-medium text-zinc-900 hover:underline"
                      >
                        {t.trip_number}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-zinc-600">{t.company_name}</td>
                    <td className="px-3 py-2.5 text-zinc-600">{t.driver_name}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-zinc-600" dir="ltr">
                      {t.vehicle_no ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-zinc-600">
                      {t.from_location} ← {t.to_location}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-zinc-500">
                      {statusLabels[t.status] ?? t.status}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-zinc-900" dir="ltr">
                      {formatCurrency(t.trip_amount, currencySymbol)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-zinc-700" dir="ltr">
                      {formatCurrency(t.driver_trip_payment, currencySymbol)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-zinc-50 font-semibold text-zinc-900">
                  <td className="px-3 py-3" colSpan={7}>
                    الإجمالي — {formatNumber(trips.length)} رحلة
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap" dir="ltr">
                    {formatCurrency(totals.amount, currencySymbol)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap" dir="ltr">
                    {formatCurrency(totals.trab, currencySymbol)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {trips.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 print:hidden">
          <Tile label="الأجرة الأساسية" value={totals.base} currencySymbol={currencySymbol} />
          <Tile label="أجرة العمالة" value={totals.labor} currencySymbol={currencySymbol} />
          <Tile label="المواقع الإضافية" value={totals.extra} currencySymbol={currencySymbol} />
          <Tile label="المبيت" value={totals.overnight} currencySymbol={currencySymbol} />
        </div>
      )}
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

function Tile({
  label,
  value,
  currencySymbol,
}: {
  label: string;
  value: number;
  currencySymbol: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3">
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="text-sm font-bold text-zinc-900" dir="ltr">
        {formatCurrency(value, currencySymbol)}
      </div>
    </div>
  );
}
