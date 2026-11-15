"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Download, Printer, Receipt, Users, Repeat, Coins, Search, X } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import { exportToCsv } from "@/lib/csv";
import { EmptyState } from "@/components/ui/EmptyState";

export type ExpenseItemRow = {
  driver_id: string;
  driver_name: string;
  vehicle_no: string | null;
  item: string;
  entries_count: number;
  total_amount: number;
  first_date: string;
  last_date: string;
};

/**
 * بنود مصاريف السائقين — مَن صرف، وكم مرة، وبكم.
 *
 * 🔑 «غسيل» ليس بنداً في القائمة، فالمستخدم يكتبه في الوصف تحت «أخرى».
 *    ولذلك البحث هنا ليس زينة: اكتب «غسيل» فيُجمع كل ما كُتب بأي صيغة
 *    («غسيل»، «غسيل سيارة»، «غسيل الشاحنة») في صفٍّ واحد لكل سائق.
 *
 * 📌 بلا بحث: صفٌّ لكل سائق في كل بند، مرتَّباً بالأكثر إنفاقاً.
 *    مع بحث: صفٌّ لكل سائق، وتُسرَد البنود المطابقة في عمود — فيصير
 *    «كم مرة» رقماً واحداً كما سأل السؤال.
 *
 * 🖨️ أدوات الفلترة لا تُطبع، والمطبوع هو ما تراه بعد البحث.
 */
export function DriverExpenseItemsTable({
  rows,
  from,
  to,
  orgName,
  currencySymbol,
}: {
  rows: ExpenseItemRow[];
  from: string;
  to: string;
  orgName: string;
  currencySymbol: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState("");

  const setParam = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => (v ? params.set(k, v) : params.delete(k)));
    router.push(`${pathname}?${params.toString()}`);
  };

  /** أكثر البنود تكراراً — أزرار جاهزة بدل الكتابة */
  const topItems = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of rows) {
      totals.set(r.item, (totals.get(r.item) ?? 0) + Number(r.total_amount || 0));
    }
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name]) => name);
  }, [rows]);

  const term = search.trim();
  const matched = useMemo(() => {
    if (!term) return rows;
    return rows.filter(
      (r) => r.item.includes(term) || r.driver_name.includes(term)
    );
  }, [rows, term]);

  /**
   * مع بحثٍ فعّال نجمع لكل سائق صفاً واحداً: السؤال «مين غسل وكام مرة»
   * لا «كم صيغةً كُتبت بها كلمة غسيل».
   */
  const display = useMemo(() => {
    if (!term) {
      return matched.map((r) => ({
        key: `${r.driver_id}|${r.item}`,
        driver_name: r.driver_name,
        vehicle_no: r.vehicle_no,
        items: [r.item],
        count: Number(r.entries_count || 0),
        total: Number(r.total_amount || 0),
        first: r.first_date,
        last: r.last_date,
      }));
    }

    const map = new Map<
      string,
      {
        key: string;
        driver_name: string;
        vehicle_no: string | null;
        items: string[];
        count: number;
        total: number;
        first: string;
        last: string;
      }
    >();

    for (const r of matched) {
      const cur = map.get(r.driver_id);
      if (!cur) {
        map.set(r.driver_id, {
          key: r.driver_id,
          driver_name: r.driver_name,
          vehicle_no: r.vehicle_no,
          items: [r.item],
          count: Number(r.entries_count || 0),
          total: Number(r.total_amount || 0),
          first: r.first_date,
          last: r.last_date,
        });
        continue;
      }
      if (!cur.items.includes(r.item)) cur.items.push(r.item);
      cur.count += Number(r.entries_count || 0);
      cur.total += Number(r.total_amount || 0);
      if (r.first_date < cur.first) cur.first = r.first_date;
      if (r.last_date > cur.last) cur.last = r.last_date;
      if (!cur.vehicle_no) cur.vehicle_no = r.vehicle_no;
    }

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [matched, term]);

  const totals = display.reduce(
    (a, d) => ({ count: a.count + d.count, total: a.total + d.total }),
    { count: 0, total: 0 }
  );
  const perTime = totals.count > 0 ? totals.total / totals.count : 0;
  const maxTotal = display.length > 0 ? Math.max(...display.map((d) => d.total), 1) : 1;

  const handleExport = () => {
    exportToCsv(
      `مصاريف_السائقين_${term || "الكل"}_${from}_${to}`,
      ["السائق", "السيارة", "البند", "عدد المرات", "الإجمالي", "أول مرة", "آخر مرة"],
      display.map((d) => [
        d.driver_name,
        d.vehicle_no || "—",
        d.items.join(" / "),
        d.count,
        d.total,
        d.first,
        d.last,
      ])
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* أدوات لا تُطبع */}
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm print:hidden">
        <div className="flex flex-wrap items-end gap-3">
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

          <div className="flex min-w-56 flex-1 flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-500">
              بحث في البنود (مثلاً: غسيل)
            </label>
            <div className="relative">
              <Search
                size={15}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="اكتب كلمة من البند أو اسم السائق"
                className="w-full rounded-lg border border-zinc-300 py-2 pr-9 pl-8 text-sm outline-none focus:border-zinc-900"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="mr-auto flex items-center gap-2">
            <button
              type="button"
              onClick={handleExport}
              disabled={display.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              <Download size={15} /> تصدير
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={display.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              <Printer size={15} /> طباعة
            </button>
          </div>
        </div>

        {topItems.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-zinc-100 pt-3">
            <span className="text-xs text-zinc-500">الأكثر صرفاً:</span>
            {topItems.map((it) => (
              <button
                key={it}
                type="button"
                onClick={() => setSearch(search === it ? "" : it)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  search === it
                    ? "bg-zinc-900 text-white"
                    : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {it}
              </button>
            ))}
          </div>
        )}
      </div>

      {display.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <EmptyState
            icon={Receipt}
            title={term ? `لا يوجد «${term}» في هذه الفترة` : "لا توجد مصاريف مسجَّلة"}
            description="وسّع الفترة، أو جرّب كلمة أقصر — البحث يطابق جزءاً من البند"
          />
        </div>
      ) : (
        <div className="print-statement overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm print:overflow-visible print:rounded-none print:border-0 print:shadow-none">
          {/* رأس المستند */}
          <div className="bg-zinc-900 px-6 py-5 text-white">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-lg font-bold">{orgName}</h1>
                <p className="text-sm text-zinc-300">
                  {term ? `تقرير مصروف: ${term}` : "تقرير بنود مصاريف السائقين"}
                </p>
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
          <div className="print-keep grid grid-cols-2 gap-px border-b border-zinc-200 bg-zinc-200 sm:grid-cols-4 print:grid-cols-4">
            <Stat
              icon={Coins}
              label="الإجمالي"
              value={formatCurrency(totals.total, currencySymbol)}
            />
            <Stat icon={Repeat} label="عدد المرات" value={formatNumber(totals.count)} />
            <Stat
              icon={Receipt}
              label="متوسط المرة"
              value={formatCurrency(perTime, currencySymbol)}
            />
            <Stat
              icon={Users}
              label={term ? "سائقون صرفوا" : "صفوف"}
              value={formatNumber(display.length)}
            />
          </div>

          <div className="overflow-x-auto border-t border-zinc-200 print:overflow-visible">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-right text-xs text-zinc-500">
                  <th className="px-3 py-3 font-medium">السائق</th>
                  <th className="px-3 py-3 font-medium">السيارة</th>
                  <th className="px-3 py-3 font-medium">البند</th>
                  <th className="px-3 py-3 font-medium">عدد المرات</th>
                  <th className="px-3 py-3 font-medium">الإجمالي</th>
                  <th className="px-3 py-3 font-medium">متوسط المرة</th>
                  <th className="px-3 py-3 font-medium whitespace-nowrap">آخر مرة</th>
                  <th className="px-3 py-3 font-medium print:hidden">النسبة</th>
                </tr>
              </thead>
              <tbody>
                {display.map((d) => (
                  <tr key={d.key} className="border-b border-zinc-50">
                    <td className="px-3 py-2.5 font-medium whitespace-nowrap text-zinc-900">
                      {d.driver_name}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-700" dir="ltr">
                      {d.vehicle_no || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-700">{d.items.join(" / ")}</td>
                    <td className="px-3 py-2.5 font-semibold text-zinc-900" dir="ltr">
                      {formatNumber(d.count)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-bold text-zinc-900" dir="ltr">
                      {formatCurrency(d.total, currencySymbol)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-zinc-600" dir="ltr">
                      {formatCurrency(d.count > 0 ? d.total / d.count : 0, currencySymbol)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-zinc-500" dir="ltr">
                      {d.last}
                    </td>
                    <td className="px-3 py-2.5 print:hidden">
                      <div className="h-2 w-20 overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className="h-full rounded-full bg-zinc-800"
                          style={{ width: `${(d.total / maxTotal) * 100}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-zinc-50 font-bold text-zinc-900">
                  <td className="px-3 py-3" colSpan={3}>
                    الإجمالي
                  </td>
                  <td className="px-3 py-3" dir="ltr">
                    {formatNumber(totals.count)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap" dir="ltr">
                    {formatCurrency(totals.total, currencySymbol)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap" dir="ltr">
                    {formatCurrency(perTime, currencySymbol)}
                  </td>
                  <td className="px-3 py-3" />
                  <td className="px-3 py-3 print:hidden" />
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="px-6 py-4 text-[11px] text-zinc-500">
            البند هو ما اختاره المُدخِل من القائمة، وإن اختار «أخرى» فهو ما كتبه في
            الوصف. والبحث يطابق جزءاً من الكلمة، فـ «غسيل» تجمع «غسيل سيارة» و«غسيل
            الشاحنة» معاً في صفٍّ واحد لكل سائق.
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
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white px-4 py-3">
      <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
        <Icon size={13} /> {label}
      </div>
      <div className="mt-1 text-base font-bold text-zinc-900" dir="ltr">
        {value}
      </div>
    </div>
  );
}
