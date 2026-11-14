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
import { Download, Printer, Wallet, Users, TrendingUp, Banknote } from "lucide-react";
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
  salary_amount: number;
  total_costs: number;
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
 * إيراد السائق/السيارة — اشتغل بكم، وصرف كم، وبقي كم.
 *
 * 🔑 التكاليف: الترب + الديزل + مصاريف العهدة + **الراتب**.
 *    والراتب من `fn_driver_earned_salary` نفسها التي تقرأ منها شاشة
 *    الرواتب، فلا يفترق الرقمان عند أول إجازة.
 *
 * 📌 بنود المصاريف يكتبها المستخدم حرّةً، فتأتي صفوفاً وتُبسَط هنا أعمدةً
 *    حسب الموجود في الفترة — لا عمودٌ فارغ ولا بندٌ يسقط.
 *
 * 🖨️ الرسم للشاشة وحدها: recharts لا يُعيد قياس حاويته للطباعة فتخرج
 *    أشرطة متساوية بلا محور (درس تقرير الديزل). وعلى الورق يحلّ محلّه
 *    سطر الأوائل وشريط النسبة — وكلاهما CSS خالص.
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

  // التحديد بالاستثناء: الفارغ يعني «الكل»، فالتقرير يعمل بلا إعداد مسبق
  const [excluded, setExcluded] = useState<Record<string, boolean>>({});

  const setParam = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => (v ? params.set(k, v) : params.delete(k)));
    router.push(`${pathname}?${params.toString()}`);
  };

  // البنود الموجودة فعلاً في الفترة، مرتَّبة بالأكبر إنفاقاً
  const { categories, byDriverCat } = useMemo(() => {
    const catTotals = new Map<string, number>();
    const perDriver = new Map<string, Map<string, number>>();

    for (const e of expenses) {
      const amount = Number(e.total || 0);
      catTotals.set(e.expense_category, (catTotals.get(e.expense_category) ?? 0) + amount);

      const inner = perDriver.get(e.driver_id) ?? new Map<string, number>();
      inner.set(e.expense_category, (inner.get(e.expense_category) ?? 0) + amount);
      perDriver.set(e.driver_id, inner);
    }

    return {
      categories: Array.from(catTotals.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name),
      byDriverCat: perDriver,
    };
  }, [expenses]);

  /** تجميع الشهور لكل سائق — السؤال عن السائق لا عن الشهر */
  const perDriver = useMemo(() => {
    const map = new Map<
      string,
      {
        driver_id: string;
        driver_name: string;
        vehicles: Set<string>;
        months: string[];
        trips: number;
        revenue: number;
        trabs: number;
        diesel: number;
        expenses: number;
        salary: number;
        costs: number;
        net: number;
      }
    >();

    for (const r of rows) {
      const cur =
        map.get(r.driver_id) ??
        {
          driver_id: r.driver_id,
          driver_name: r.driver_name,
          vehicles: new Set<string>(),
          months: [] as string[],
          trips: 0,
          revenue: 0,
          trabs: 0,
          diesel: 0,
          expenses: 0,
          salary: 0,
          costs: 0,
          net: 0,
        };
      if (r.vehicle_no) cur.vehicles.add(r.vehicle_no);
      cur.months.push(`${MONTHS[r.month - 1]} ${r.year}`);
      cur.trips += Number(r.trips_count || 0);
      cur.revenue += Number(r.total_trip_amount || 0);
      cur.trabs += Number(r.total_trabs || 0);
      cur.diesel += Number(r.diesel_amount || 0);
      cur.expenses += Number(r.custody_expenses || 0);
      cur.salary += Number(r.salary_amount || 0);
      cur.costs += Number(r.total_costs || 0);
      cur.net += Number(r.net_amount || 0);
      map.set(r.driver_id, cur);
    }

    return Array.from(map.values()).sort((a, b) => b.net - a.net);
  }, [rows]);

  const visible = perDriver.filter((d) => !excluded[d.driver_id]);

  const totals = visible.reduce(
    (a, d) => ({
      trips: a.trips + d.trips,
      revenue: a.revenue + d.revenue,
      trabs: a.trabs + d.trabs,
      diesel: a.diesel + d.diesel,
      expenses: a.expenses + d.expenses,
      salary: a.salary + d.salary,
      costs: a.costs + d.costs,
      net: a.net + d.net,
    }),
    { trips: 0, revenue: 0, trabs: 0, diesel: 0, expenses: 0, salary: 0, costs: 0, net: 0 }
  );

  const maxNet = visible.length > 0 ? Math.max(...visible.map((d) => Math.abs(d.net)), 1) : 1;

  const chartData = visible.map((d) => ({ name: d.driver_name, net: d.net }));

  const catOf = (driverId: string, cat: string) =>
    byDriverCat.get(driverId)?.get(cat) ?? 0;

  const handleExport = () => {
    exportToCsv(
      `إيراد_السائق_${from}_${to}`,
      [
        "الترتيب",
        "السائق",
        "السيارة",
        "الرحلات",
        "قيمة الرحلات",
        "التربات",
        "الديزل",
        ...categories,
        "الراتب",
        "إجمالي التكاليف",
        "الصافي",
      ],
      visible.map((d, i) => [
        i + 1,
        d.driver_name,
        Array.from(d.vehicles).join(" / ") || "—",
        d.trips,
        d.revenue,
        d.trabs,
        d.diesel,
        ...categories.map((c) => catOf(d.driver_id, c)),
        d.salary,
        d.costs,
        d.net,
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
            icon={Wallet}
            title="لا توجد حركة في هذه الفترة"
            description="وسّع الفترة، أو أعِد السائقين المستبعَدين"
          />
        </div>
      ) : (
        <div className="print-statement print-landscape overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
          <div className="bg-zinc-900 px-6 py-5 text-white">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-lg font-bold">{orgName}</h1>
                <p className="text-sm text-zinc-300">تقرير إيراد السائق/السيارة</p>
              </div>
              <div className="text-left">
                <div className="text-xs text-zinc-400">الفترة</div>
                <div className="text-sm font-bold" dir="ltr">
                  {from} ← {to}
                </div>
              </div>
            </div>
          </div>

          <div className="print-keep grid grid-cols-2 gap-px border-b border-zinc-200 bg-zinc-200 sm:grid-cols-4 print:grid-cols-4">
            <Stat
              icon={Banknote}
              label="قيمة الرحلات"
              value={formatCurrency(totals.revenue, currencySymbol)}
            />
            <Stat
              icon={Wallet}
              label="إجمالي التكاليف"
              value={formatCurrency(totals.costs, currencySymbol)}
              sub="ترب + ديزل + مصاريف + راتب"
            />
            <Stat
              icon={TrendingUp}
              label="الصافي"
              value={formatCurrency(totals.net, currencySymbol)}
              tone={totals.net < 0 ? "bad" : "good"}
            />
            <Stat icon={Users} label="عدد السائقين" value={formatNumber(visible.length)} />
          </div>

          {/* الأوائل — للورق، بدل رسمٍ لا يُطبع */}
          <div className="hidden border-b border-zinc-200 px-6 py-3 text-xs text-zinc-700 print:block">
            <strong>الأعلى صافياً:</strong>{" "}
            {visible.slice(0, 3).map((d, i) => (
              <span key={d.driver_id}>
                {i > 0 && " · "}
                {i + 1}. {d.driver_name} ({formatCurrency(d.net, currencySymbol)})
              </span>
            ))}
          </div>

          <div className="px-6 py-5 print:hidden">
            <h2 className="mb-3 text-sm font-bold text-zinc-900">
              الصافي لكل سائق — من الأعلى إلى الأقل
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
                  <Bar dataKey="net" name="الصافي" radius={[0, 4, 4, 0]}>
                    {/* الخاسر أحمر: الرقم السالب لا يُقرأ من الطول */}
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.net < 0 ? "#dc2626" : i < 3 ? "#047857" : "#6ee7b7"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="overflow-x-auto border-t border-zinc-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-right text-xs text-zinc-500">
                  <th className="px-2 py-3 font-medium print:hidden" />
                  <th className="px-3 py-3 font-medium">#</th>
                  <th className="px-3 py-3 font-medium">السائق</th>
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
                  <th className="px-3 py-3 font-medium">الراتب</th>
                  <th className="px-3 py-3 font-medium">إجمالي التكاليف</th>
                  <th className="px-3 py-3 font-medium">الصافي</th>
                  <th className="px-3 py-3 font-medium print:hidden">النسبة</th>
                </tr>
              </thead>
              <tbody>
                {perDriver.map((d) => {
                  const hidden = !!excluded[d.driver_id];
                  const rank = visible.findIndex((v) => v.driver_id === d.driver_id) + 1;
                  const share = (Math.abs(d.net) / maxNet) * 100;

                  return (
                    <tr
                      key={d.driver_id}
                      className={`border-b border-zinc-50 ${
                        hidden ? "opacity-40 print:hidden" : ""
                      }`}
                    >
                      <td className="px-2 py-2.5 print:hidden">
                        <input
                          type="checkbox"
                          checked={!hidden}
                          onChange={(e) =>
                            setExcluded((p) => ({ ...p, [d.driver_id]: !e.target.checked }))
                          }
                          className="size-4 rounded border-zinc-300 align-middle accent-zinc-900"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-xs font-bold text-zinc-400">
                        {hidden ? "—" : rank}
                      </td>
                      <td className="px-3 py-2.5 font-medium whitespace-nowrap text-zinc-900">
                        {d.driver_name}
                      </td>
                      <td className="px-3 py-2.5 text-zinc-700" dir="ltr">
                        {Array.from(d.vehicles).join(" / ") || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-zinc-600" dir="ltr">
                        {formatNumber(d.trips)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-zinc-900" dir="ltr">
                        {formatCurrency(d.revenue, currencySymbol)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-zinc-600" dir="ltr">
                        {formatCurrency(d.trabs, currencySymbol)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-amber-700" dir="ltr">
                        {formatCurrency(d.diesel, currencySymbol)}
                      </td>
                      {categories.map((c) => {
                        const v = catOf(d.driver_id, c);
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
                      <td className="px-3 py-2.5 whitespace-nowrap text-zinc-600" dir="ltr">
                        {formatCurrency(d.salary, currencySymbol)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-red-600" dir="ltr">
                        {formatCurrency(d.costs, currencySymbol)}
                      </td>
                      <td
                        className={`px-3 py-2.5 whitespace-nowrap font-bold ${
                          d.net < 0 ? "text-red-600" : "text-emerald-700"
                        }`}
                        dir="ltr"
                      >
                        {formatCurrency(d.net, currencySymbol)}
                      </td>
                      <td className="px-3 py-2.5 print:hidden">
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-zinc-100">
                          <div
                            className={`h-full rounded-full ${
                              d.net < 0 ? "bg-red-500" : "bg-emerald-500"
                            }`}
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
                  <td className="px-2 py-3 print:hidden" />
                  <td className="px-3 py-3" colSpan={3}>
                    الإجمالي ({formatNumber(visible.length)} سائقاً)
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
                      {formatCurrency(
                        visible.reduce((s, d) => s + catOf(d.driver_id, c), 0),
                        currencySymbol
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-3 whitespace-nowrap" dir="ltr">
                    {formatCurrency(totals.salary, currencySymbol)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap" dir="ltr">
                    {formatCurrency(totals.costs, currencySymbol)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap" dir="ltr">
                    {formatCurrency(totals.net, currencySymbol)}
                  </td>
                  <td className="px-3 py-3 print:hidden" />
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="px-6 py-4 text-[11px] text-zinc-500">
            الصافي = قيمة الرحلات − (التربات + الديزل + مصاريف العهدة + الراتب). والمصاريف
            هي ما صُرف من عهدة السائق على العمل ببنودها كما كُتبت في صفحته، والراتب هو
            المستحق عن أيام العمل — نفس رقم شاشة الرواتب.
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
  tone,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="bg-white px-4 py-4">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] text-zinc-500">
        <Icon size={13} />
        {label}
      </div>
      <div
        className={`truncate text-base font-bold ${
          tone === "bad" ? "text-red-600" : tone === "good" ? "text-emerald-700" : "text-zinc-900"
        }`}
        dir="ltr"
      >
        {value}
      </div>
      {sub && <div className="text-[10px] text-zinc-400">{sub}</div>}
    </div>
  );
}
