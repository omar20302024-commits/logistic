"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Download, Printer, Fuel, Users, TrendingUp, Gauge } from "lucide-react";
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
 * استهلاك الديزل الشهري — الديزل وحده، مرتَّباً من الأكثر صرفاً إلى الأقل.
 *
 * 📌 لا تربات ولا مصاريف سيارة: لكلٍّ تقريره. والإيراد والصافي في
 *    «إيراد السائق/السيارة».
 *
 * 🖨️ التحديد يحكم الرسم والجدول والطباعة معاً — فما يُطبَع هو ما تراه،
 *    ولا ورقة فيها سائق لم تقصده.
 */
export function DieselMonthlyTable({
  rows,
  from,
  to,
  orgName,
  currencySymbol,
}: {
  rows: DieselMonthRow[];
  from: string;
  to: string;
  orgName: string;
  currencySymbol: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // التحديد بالاستثناء: الفارغ يعني «الكل»، فالتقرير يعمل بلا إعداد مسبق
  const [excluded, setExcluded] = useState<Record<string, boolean>>({});

  const setParam = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => (v ? params.set(k, v) : params.delete(k)));
    router.push(`${pathname}?${params.toString()}`);
  };

  /** تجميع الشهور لكل سائق — الترتيب سؤالٌ عن السائق لا عن الشهر */
  const perDriver = useMemo(() => {
    const map = new Map<
      string,
      {
        driver_id: string;
        driver_name: string;
        vehicles: Set<string>;
        trips: number;
        diesel: number;
        months: DieselMonthRow[];
      }
    >();

    for (const r of rows) {
      const cur =
        map.get(r.driver_id) ??
        {
          driver_id: r.driver_id,
          driver_name: r.driver_name,
          vehicles: new Set<string>(),
          trips: 0,
          diesel: 0,
          months: [] as DieselMonthRow[],
        };
      if (r.vehicle_no) cur.vehicles.add(r.vehicle_no);
      cur.trips += Number(r.trips_count || 0);
      cur.diesel += Number(r.diesel_amount || 0);
      cur.months.push(r);
      map.set(r.driver_id, cur);
    }

    return Array.from(map.values()).sort((a, b) => b.diesel - a.diesel);
  }, [rows]);

  const visible = perDriver.filter((d) => !excluded[d.driver_id]);

  const totals = visible.reduce(
    (a, d) => ({ trips: a.trips + d.trips, diesel: a.diesel + d.diesel }),
    { trips: 0, diesel: 0 }
  );

  const maxDiesel = visible.length > 0 ? visible[0].diesel : 0;
  const average = visible.length > 0 ? totals.diesel / visible.length : 0;
  const perTrip = totals.trips > 0 ? totals.diesel / totals.trips : 0;

  const chartData = visible.map((d) => ({
    name: d.driver_name,
    diesel: d.diesel,
  }));

  const handleExport = () => {
    exportToCsv(
      `الديزل_الشهري_${from}_${to}`,
      ["الترتيب", "السائق", "السيارة", "الرحلات", "الديزل"],
      visible.map((d, i) => [
        i + 1,
        d.driver_name,
        Array.from(d.vehicles).join(" / ") || "—",
        d.trips,
        d.diesel,
      ])
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* أدوات لا تُطبع */}
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

        {Object.keys(excluded).length > 0 && (
          <button
            type="button"
            onClick={() => setExcluded({})}
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 hover:bg-amber-100"
          >
            إظهار الكل ({formatNumber(perDriver.length - visible.length)} مستبعَد)
          </button>
        )}

        <div className="mr-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={visible.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            <Download size={15} /> تصدير
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={visible.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            <Printer size={15} /> طباعة
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <EmptyState
            icon={Fuel}
            title="لا يوجد ديزل مسجَّل"
            description="وسّع الفترة، أو أعِد السائقين المستبعَدين"
          />
        </div>
      ) : (
        <div className="print-statement overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
          {/* رأس المستند */}
          <div className="bg-zinc-900 px-6 py-5 text-white">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-lg font-bold">{orgName}</h1>
                <p className="text-sm text-zinc-300">تقرير استهلاك الديزل</p>
              </div>
              <div className="text-left">
                <div className="text-xs text-zinc-400">الفترة</div>
                <div className="text-sm font-bold" dir="ltr">
                  {from} ← {to}
                </div>
              </div>
            </div>
          </div>

          {/* المؤشرات */}
          <div className="grid grid-cols-2 gap-px border-b border-zinc-200 bg-zinc-200 sm:grid-cols-4">
            <Stat
              icon={Fuel}
              label="إجمالي الديزل"
              value={formatCurrency(totals.diesel, currencySymbol)}
            />
            <Stat icon={Users} label="عدد السائقين" value={formatNumber(visible.length)} />
            <Stat
              icon={Gauge}
              label="المتوسط لكل سائق"
              value={formatCurrency(average, currencySymbol)}
            />
            <Stat
              icon={TrendingUp}
              label="الأعلى صرفاً"
              value={visible[0].driver_name}
              sub={formatCurrency(visible[0].diesel, currencySymbol)}
            />
          </div>

          {/* الرسم البياني */}
          <div className="px-6 py-5">
            <h2 className="mb-3 text-sm font-bold text-zinc-900">
              الترتيب من الأكثر صرفاً إلى الأقل
            </h2>
            <div dir="ltr" style={{ height: Math.max(180, visible.length * 32) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 4, left: 10, right: 60, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    width={110}
                    interval={0}
                  />
                  <Tooltip
                    formatter={(v) => formatCurrency(Number(v), currencySymbol)}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Bar dataKey="diesel" name="الديزل" radius={[0, 4, 4, 0]}>
                    {/* الثلاثة الأوائل أغمق: العين تلتقط الأعلى قبل أن تقرأ */}
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={i < 3 ? "#b45309" : "#d4a574"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* الجدول */}
          <div className="overflow-x-auto border-t border-zinc-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-right text-xs text-zinc-500">
                  <th className="px-3 py-3 font-medium print:hidden" />
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">السائق</th>
                  <th className="px-4 py-3 font-medium">السيارة</th>
                  <th className="px-4 py-3 font-medium">الشهور</th>
                  <th className="px-4 py-3 font-medium">الرحلات</th>
                  <th className="px-4 py-3 font-medium">الديزل</th>
                  <th className="px-4 py-3 font-medium">النسبة</th>
                </tr>
              </thead>
              <tbody>
                {perDriver.map((d) => {
                  const hidden = !!excluded[d.driver_id];
                  const rank = visible.findIndex((v) => v.driver_id === d.driver_id) + 1;
                  const share = maxDiesel > 0 ? (d.diesel / maxDiesel) * 100 : 0;

                  return (
                    <tr
                      key={d.driver_id}
                      className={`border-b border-zinc-50 ${
                        hidden ? "opacity-40 print:hidden" : ""
                      }`}
                    >
                      <td className="px-3 py-3 print:hidden">
                        <input
                          type="checkbox"
                          checked={!hidden}
                          onChange={(e) =>
                            setExcluded((p) => ({ ...p, [d.driver_id]: !e.target.checked }))
                          }
                          className="size-4 rounded border-zinc-300 align-middle accent-zinc-900"
                        />
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-zinc-400">
                        {hidden ? "—" : rank}
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-900">{d.driver_name}</td>
                      <td className="px-4 py-3 text-zinc-700" dir="ltr">
                        {Array.from(d.vehicles).join(" / ") || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {d.months
                          .map((m) => `${MONTHS[m.month - 1]} ${m.year}`)
                          .join("، ")}
                      </td>
                      <td className="px-4 py-3 text-zinc-600" dir="ltr">
                        {formatNumber(d.trips)}
                      </td>
                      <td
                        className="px-4 py-3 whitespace-nowrap font-semibold text-amber-700"
                        dir="ltr"
                      >
                        {formatCurrency(d.diesel, currencySymbol)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-2 w-28 overflow-hidden rounded-full bg-zinc-100">
                          <div
                            className="h-full rounded-full bg-amber-500"
                            style={{ width: `${share}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-zinc-50 font-bold text-zinc-900">
                  <td className="px-3 py-3 print:hidden" />
                  <td className="px-4 py-3" colSpan={4}>
                    الإجمالي ({formatNumber(visible.length)} سائقاً)
                  </td>
                  <td className="px-4 py-3" dir="ltr">
                    {formatNumber(totals.trips)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" dir="ltr">
                    {formatCurrency(totals.diesel, currencySymbol)}
                  </td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="px-6 py-4 text-[11px] text-zinc-500">
            متوسط الديزل لكل رحلة في هذه الفترة:{" "}
            <strong dir="ltr">{formatCurrency(perTrip, currencySymbol)}</strong>. والديزل
            مصدره ما يُسجَّل في صفحة السائق، والسيارة هي المرتبطة به في ذلك الشهر.
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Fuel;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-white px-4 py-4">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] text-zinc-500">
        <Icon size={13} />
        {label}
      </div>
      <div className="truncate text-base font-bold text-zinc-900">{value}</div>
      {sub && (
        <div className="text-xs text-zinc-500" dir="ltr">
          {sub}
        </div>
      )}
    </div>
  );
}
