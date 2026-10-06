"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Printer, Trophy, BarChart3 } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import { EmptyState } from "@/components/ui/EmptyState";

// ترتيب السائقين: من الأكثر رحلاتٍ أو تربات إلى الأقل.
// العمودان معاً ظاهران دائماً، والاختيار يغيّر الترتيب فقط — فتُقرأ الصورتان
// من كشف واحد بدل كشفين.

type Row = {
  driver_id: string;
  driver_name: string;
  driver_status: "active" | "inactive";
  trips_count: number;
  total_driver_payment: number;
};

type SortKey = "trips" | "trabs";

export function DriversRankingTable({
  rows,
  from,
  to,
  sort,
  showEmpty,
  orgName,
  orgPhone,
  currencySymbol,
}: {
  rows: Row[];
  from: string;
  to: string;
  sort: SortKey;
  showEmpty: boolean;
  orgName: string;
  orgPhone: string | null;
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

  const metric = (r: Row) => (sort === "trips" ? r.trips_count : r.total_driver_payment);

  const visible = showEmpty
    ? rows
    : rows.filter((r) => r.trips_count > 0 || r.total_driver_payment > 0);

  // ترتيب تنازلي، والاسم يفصل عند التساوي حتى لا يتغيّر الترتيب بين طلبين
  const sorted = [...visible].sort(
    (a, b) => metric(b) - metric(a) || a.driver_name.localeCompare(b.driver_name, "ar")
  );

  // المتساوون يأخذون نفس الرقم — ترتيب كثيف (1، 2، 2، 4)
  let lastValue: number | null = null;
  let lastRank = 0;
  const ranked = sorted.map((r, i) => {
    const v = metric(r);
    if (v !== lastValue) {
      lastRank = i + 1;
      lastValue = v;
    }
    return { ...r, rank: lastRank };
  });

  const totals = ranked.reduce(
    (acc, r) => ({
      trips: acc.trips + r.trips_count,
      trabs: acc.trabs + r.total_driver_payment,
    }),
    { trips: 0, trabs: 0 }
  );

  const printedOn = new Date().toISOString().slice(0, 10);
  const sortLabel = sort === "trips" ? "عدد الرحلات" : "إجمالي الترب";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm print:hidden">
        <Field label="من تاريخ">
          <input
            type="date"
            value={from}
            dir="ltr"
            onChange={(e) => handleChange({ from: e.target.value })}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          />
        </Field>
        <Field label="إلى تاريخ">
          <input
            type="date"
            value={to}
            dir="ltr"
            onChange={(e) => handleChange({ to: e.target.value })}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          />
        </Field>
        <Field label="الترتيب حسب">
          <select
            value={sort}
            onChange={(e) => handleChange({ sort: e.target.value })}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          >
            <option value="trips">عدد الرحلات — الأكثر أولاً</option>
            <option value="trabs">إجمالي الترب — الأكثر أولاً</option>
          </select>
        </Field>
        <Field label="من بلا رحلات">
          <select
            value={showEmpty ? "1" : ""}
            onChange={(e) => handleChange({ empty: e.target.value })}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          >
            <option value="">إخفاؤهم</option>
            <option value="1">إظهارهم</option>
          </select>
        </Field>

        <div className="mr-auto flex items-center gap-2">
          <button
            onClick={() => window.print()}
            type="button"
            className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            <Printer size={15} /> طباعة / حفظ PDF
          </button>
        </div>
      </div>

      <div className="print-keep rounded-2xl border border-zinc-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
        {/* رأس الورقة — طباعة فقط */}
        <div className="hidden print:block print:mb-4">
          <div className="flex items-start justify-between border-b border-zinc-300 pb-3">
            <div>
              <div className="text-base font-bold text-zinc-900">{orgName}</div>
              {orgPhone && (
                <div dir="ltr" className="text-xs text-zinc-500">
                  {orgPhone}
                </div>
              )}
            </div>
            <div className="text-left">
              <div className="text-sm font-bold text-zinc-900">
                ترتيب السائقين حسب {sortLabel}
              </div>
              <div dir="ltr" className="text-xs text-zinc-500">
                {from} ← {to} · {printedOn}
              </div>
            </div>
          </div>
        </div>

        {ranked.length === 0 ? (
          <EmptyState icon={BarChart3} title="لا توجد بيانات في هذه الفترة" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-right text-xs text-zinc-500">
                  <th className="px-4 py-3 font-medium">الترتيب</th>
                  <th className="px-4 py-3 font-medium">السائق</th>
                  <th
                    className={`px-4 py-3 font-medium ${
                      sort === "trips" ? "text-zinc-900" : ""
                    }`}
                  >
                    عدد الرحلات
                  </th>
                  <th
                    className={`px-4 py-3 font-medium ${
                      sort === "trabs" ? "text-zinc-900" : ""
                    }`}
                  >
                    إجمالي الترب
                  </th>
                  <th className="px-4 py-3 font-medium print:hidden">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((r) => (
                  <tr key={r.driver_id} className="border-b border-zinc-50">
                    <td className="px-4 py-2.5" dir="ltr">
                      {r.rank <= 3 ? (
                        <span className="inline-flex items-center gap-1 font-bold text-zinc-900">
                          <Trophy size={13} className="text-amber-500" />
                          {formatNumber(r.rank)}
                        </span>
                      ) : (
                        <span className="text-zinc-400">{formatNumber(r.rank)}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-zinc-900">{r.driver_name}</td>
                    <td
                      className={`px-4 py-2.5 ${
                        sort === "trips" ? "font-semibold text-zinc-900" : "text-zinc-600"
                      }`}
                      dir="ltr"
                    >
                      {formatNumber(r.trips_count)}
                    </td>
                    <td
                      className={`px-4 py-2.5 whitespace-nowrap ${
                        sort === "trabs" ? "font-semibold text-zinc-900" : "text-zinc-600"
                      }`}
                      dir="ltr"
                    >
                      {formatCurrency(r.total_driver_payment, currencySymbol)}
                    </td>
                    <td className="px-4 py-2.5 print:hidden">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          r.driver_status === "active"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {r.driver_status === "active" ? "نشط" : "غير نشط"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-zinc-200 bg-zinc-50 font-bold text-zinc-900">
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3">الإجمالي ({formatNumber(ranked.length)})</td>
                  <td className="px-4 py-3" dir="ltr">
                    {formatNumber(totals.trips)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" dir="ltr">
                    {formatCurrency(totals.trabs, currencySymbol)}
                  </td>
                  <td className="px-4 py-3 print:hidden" />
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
