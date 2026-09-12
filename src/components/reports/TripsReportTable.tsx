"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Download, Truck, FileText } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatNumber } from "@/lib/format";
import { statusLabels } from "@/lib/validation/trip";
import type { ExcelColumn } from "@/lib/excel";

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
  unloading_count: number;
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
  orgName,
  currencySymbol,
  filters,
}: {
  trips: TripRow[];
  drivers: Option[];
  companies: Option[];
  orgName: string;
  currencySymbol: string;
  filters: { from: string; to: string; driver: string; company: string; status: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // التقريران المطلوبان: بالترب وبدونه. مفتاح واحد بدل زرّين لكل صيغة تصدير،
  // ويؤثر على الشاشة والطباعة أيضاً حتى لا يختلف ما تراه عمّا يُصدَّر.
  const [showTrab, setShowTrab] = useState(true);
  const [exporting, setExporting] = useState(false);

  // اسم العميل يتكرر في كل صف بلا فائدة حين يكون التقرير لعميل واحد،
  // فينتقل للرأس ويختفي العمود. أما عند "كل العملاء" فالعمود ضروري.
  const singleCompany = filters.company
    ? (companies.find((c) => c.id === filters.company)?.name ?? null)
    : null;
  const singleDriver = filters.driver
    ? (drivers.find((d) => d.id === filters.driver)?.name ?? null)
    : null;

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

  const periodLine = `من ${filters.from} إلى ${filters.to} · ${formatNumber(trips.length)} رحلة`;
  const reportTitle = `${orgName} — تقرير الرحلات${showTrab ? "" : " (بدون الترب)"}`;

  /** أعمدة التصدير — تُبنى حسب الفلاتر: بلا الحالة، وبلا العميل عند تحديده، وبلا الترب عند إخفائه */
  const buildColumns = (): ExcelColumn[] => {
    const cols: ExcelColumn[] = [
      { header: "التاريخ", key: "trip_date", width: 12, ltr: true },
      { header: "رقم الرحلة", key: "trip_number", width: 15, ltr: true },
    ];
    if (!singleCompany) cols.push({ header: "العميل", key: "company_name", width: 22 });
    if (!singleDriver) cols.push({ header: "السائق", key: "driver_name", width: 20 });
    cols.push(
      { header: "السيارة", key: "vehicle_no", width: 12, ltr: true },
      { header: "النوع", key: "vehicle_type_label", width: 10 },
      { header: "من", key: "from_location", width: 16 },
      { header: "إلى", key: "to_location", width: 16 },
      { header: "عدد الفروع", key: "unloading_count", width: 11, ltr: true },
      { header: "الأساسية", key: "base_fare", width: 13, money: true },
      { header: "العمالة", key: "labor_fare", width: 12, money: true },
      { header: "الموقع الإضافي", key: "extra_location_fare", width: 15, money: true },
      { header: "المبيت", key: "overnight_fare", width: 12, money: true },
      { header: "سعر الرحلة", key: "trip_amount", width: 14, money: true },
      { header: "صاحب الطلب", key: "requester", width: 16 }
    );
    if (showTrab) cols.push({ header: "الترب", key: "driver_trip_payment", width: 13, money: true });
    return cols;
  };

  const buildRows = () =>
    trips.map((t) => ({
      trip_date: t.trip_date,
      trip_number: t.trip_number,
      company_name: t.company_name,
      driver_name: t.driver_name,
      vehicle_no: t.vehicle_no ?? "—",
      vehicle_type_label: t.vehicle_type_label ?? "—",
      from_location: t.from_location,
      to_location: t.to_location,
      unloading_count: Number(t.unloading_count),
      requester: t.requester ?? "—",
      base_fare: Number(t.base_fare),
      labor_fare: Number(t.labor_fare),
      extra_location_fare: Number(t.extra_location_fare),
      overnight_fare: Number(t.overnight_fare),
      trip_amount: Number(t.trip_amount),
      driver_trip_payment: Number(t.driver_trip_payment),
    }));

  const buildTotals = () => ({
    trip_date: "الإجمالي",
    base_fare: totals.base,
    labor_fare: totals.labor,
    extra_location_fare: totals.extra,
    overnight_fare: totals.overnight,
    trip_amount: totals.amount,
    ...(showTrab ? { driver_trip_payment: totals.trab } : {}),
  });

  const headerLines = [periodLine];
  if (singleCompany) headerLines.push(`العميل: ${singleCompany}`);
  if (singleDriver) headerLines.push(`السائق: ${singleDriver}`);

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      // التحميل عند الطلب: exceljs كبيرة، فلا يدفع ثمنها إلا من يصدّر فعلاً
      const { exportToExcel } = await import("@/lib/excel");
      await exportToExcel({
        fileName: `تقرير-الرحلات-${singleCompany ? `${singleCompany}-` : ""}${filters.from}-${filters.to}`,
        sheetName: "الرحلات",
        title: reportTitle,
        subtitle: headerLines.join("  ·  "),
        columns: buildColumns(),
        rows: buildRows(),
        totals: buildTotals(),
      });
    } catch {
      toast.error("تعذّر إنشاء ملف Excel");
    } finally {
      setExporting(false);
    }
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

        <Field label="صيغة التقرير">
          <div className="flex overflow-hidden rounded-lg border border-zinc-300">
            <button
              type="button"
              onClick={() => setShowTrab(true)}
              className={`px-3 py-2 text-sm font-medium ${
                showTrab ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              بالترب
            </button>
            <button
              type="button"
              onClick={() => setShowTrab(false)}
              className={`border-e border-zinc-300 px-3 py-2 text-sm font-medium ${
                !showTrab ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              بدون الترب
            </button>
          </div>
        </Field>

        <div className="mr-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            <Download size={15} /> {exporting ? "جارٍ التصدير..." : "Excel"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
            title="في نافذة الطباعة اختر «حفظ بصيغة PDF» للحصول على ملف PDF"
          >
            <FileText size={15} /> PDF / طباعة
          </button>
        </div>
      </div>

      {/* رأس يظهر في الطباعة و PDF فقط — الرأس الذي على الشاشة غير مناسب للورق */}
      <div className="hidden print:block">
        <h1 className="text-center text-lg font-bold text-zinc-900">{reportTitle}</h1>
        <p className="mt-1 text-center text-xs text-zinc-500">{headerLines.join("  ·  ")}</p>
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
                  {!singleCompany && <th className="px-3 py-3 font-medium">العميل</th>}
                  {!singleDriver && <th className="px-3 py-3 font-medium">السائق</th>}
                  <th className="px-3 py-3 font-medium">السيارة</th>
                  <th className="px-3 py-3 font-medium">خط السير</th>
                  <th className="px-3 py-3 font-medium">الفروع</th>
                  <th className="px-3 py-3 font-medium">سعر الرحلة</th>
                  {showTrab && <th className="px-3 py-3 font-medium">الترب</th>}
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
                    {!singleCompany && (
                      <td className="px-3 py-2.5 text-zinc-600">{t.company_name}</td>
                    )}
                    {!singleDriver && <td className="px-3 py-2.5 text-zinc-600">{t.driver_name}</td>}
                    <td className="px-3 py-2.5 whitespace-nowrap text-zinc-600" dir="ltr">
                      {t.vehicle_no ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-zinc-600">
                      {t.from_location} ← {t.to_location}
                    </td>
                    <td className="px-3 py-2.5 text-center text-zinc-600" dir="ltr">
                      {t.unloading_count}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-zinc-900" dir="ltr">
                      {formatCurrency(t.trip_amount, currencySymbol)}
                    </td>
                    {showTrab && (
                      <td className="px-3 py-2.5 whitespace-nowrap text-zinc-700" dir="ltr">
                        {formatCurrency(t.driver_trip_payment, currencySymbol)}
                      </td>
                    )}
                  </tr>
                ))}
                <tr className="bg-zinc-50 font-semibold text-zinc-900">
                  <td
                    className="px-3 py-3"
                    colSpan={5 + (singleCompany ? 0 : 1) + (singleDriver ? 0 : 1)}
                  >
                    الإجمالي — {formatNumber(trips.length)} رحلة
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap" dir="ltr">
                    {formatCurrency(totals.amount, currencySymbol)}
                  </td>
                  {showTrab && (
                    <td className="px-3 py-3 whitespace-nowrap" dir="ltr">
                      {formatCurrency(totals.trab, currencySymbol)}
                    </td>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {trips.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
