"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Lock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  getMonthClosePreview,
  applyMonthClose,
  type MonthClosePreviewRow,
  type MonthCloseResultRow,
} from "@/app/(dashboard)/month-close/actions";

type DriverOption = {
  id: string;
  name: string;
  employment_type: "internal" | "external";
};

function monthBounds(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, "0")}` };
}

function lastMonth(): string {
  const d = new Date();
  const p = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * إقفال الشهر لمجموعة سائقين.
 *
 * ⚠️ العملية تكتب مالاً لعدّة سائقين بضغطة. فالمعاينة إجبارية في الطريق:
 * لا يُفعَّل زرّ التنفيذ قبل أن تُحسب الأرقام وتُعرض، ثم يُسأل تأكيد يذكر
 * العدد والمبالغ. والنتيجة تُعرض صفّاً لكل سائق — ما تمّ وما لم يتمّ ولماذا.
 */
export function MonthCloseWorkflow({
  drivers,
  currencySymbol,
}: {
  drivers: DriverOption[];
  currencySymbol: string;
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [month, setMonth] = useState(lastMonth);
  const [settledOn, setSettledOn] = useState(today);
  const [kind, setKind] = useState<"internal" | "external" | "all">("internal");
  const [settleTrabs, setSettleTrabs] = useState(true);
  const [paySalary, setPaySalary] = useState(true);
  const [notes, setNotes] = useState("");

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [preview, setPreview] = useState<MonthClosePreviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [results, setResults] = useState<MonthCloseResultRow[] | null>(null);

  const visible = drivers.filter((d) =>
    kind === "all" ? true : d.employment_type === kind
  );
  const visibleIds = visible.map((d) => d.id);
  const selectedIds = visibleIds.filter((id) => selected[id]);
  const allSelected = visible.length > 0 && selectedIds.length === visible.length;

  const { from, to } = monthBounds(month);

  // المعاينة تتبع الاختيار: أي تغيير في الفترة أو القائمة يُبطل أرقاماً قديمة
  const refresh = useCallback(async () => {
    if (selectedIds.length === 0) {
      setPreview([]);
      return;
    }
    setLoading(true);
    const res = await getMonthClosePreview(selectedIds, from, to);
    setLoading(false);
    if (res.error) {
      toast.error(res.error);
      setPreview([]);
      return;
    }
    setPreview(res.rows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds.join(","), from, to]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const totals = preview.reduce(
    (acc, r) => ({
      trab: acc.trab + Number(r.trab_net || 0),
      salary: acc.salary + Math.max(Number(r.salary_net || 0), 0),
    }),
    { trab: 0, salary: 0 }
  );

  const missingSalary = preview.filter((r) => !r.has_salary_row).length;

  const handleApply = async () => {
    setConfirm(false);
    setApplying(true);
    const res = await applyMonthClose(selectedIds, {
      from,
      to,
      settledOn,
      settleTrabs,
      paySalary,
      notes,
    });
    setApplying(false);

    if (res.error) {
      toast.error(res.error);
      return;
    }

    setResults(res.rows);
    const settled = res.rows.filter((r) => r.settlement_id).length;
    toast.success(`تم إقفال ${formatNumber(res.rows.length)} سائقاً — ${formatNumber(settled)} سند تصفية`);
    setSelected({});
    setPreview([]);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-500">الشهر</label>
          <input
            type="month"
            dir="ltr"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-500">تاريخ الصرف</label>
          <input
            type="date"
            dir="ltr"
            value={settledOn}
            onChange={(e) => setSettledOn(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-500">الفئة</label>
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as typeof kind);
              setSelected({});
            }}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          >
            <option value="internal">سائقو الشركة (داخلي)</option>
            <option value="external">الخارجيون</option>
            <option value="all">الكل</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-500">ما يُقفَل</span>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={settleTrabs}
                onChange={(e) => setSettleTrabs(e.target.checked)}
                className="size-4 rounded border-zinc-300 accent-zinc-900"
              />
              التربات والعهدة
            </label>
            <label className="flex items-center gap-1.5 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={paySalary}
                onChange={(e) => setPaySalary(e.target.checked)}
                className="size-4 rounded border-zinc-300 accent-zinc-900"
              />
              الراتب
            </label>
          </div>
        </div>

        <div className="mr-auto">
          <button
            type="button"
            onClick={() => setConfirm(true)}
            disabled={
              applying ||
              loading ||
              preview.length === 0 ||
              (!settleTrabs && !paySalary)
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-5 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {applying ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
            {applying ? "جارٍ الإقفال..." : `إقفال ${formatNumber(selectedIds.length)} سائق`}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-600">
        الإقفال يُنشئ <strong>سند تصفية تربات</strong> لكل سائق — يَسِم رحلات الفترة
        وحركات عهدتها فلا تُصرف مرة أخرى — ويُسجّل <strong>راتب الشهر مدفوعاً</strong>.
        والسلف والخصومات تبقى على دلوها كما هي؛ نقلها بين الراتب والتربات قرار فردي لا
        يُؤخذ جماعياً.
      </div>

      {/* الاختيار */}
      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-right text-xs text-zinc-500">
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() =>
                    setSelected(
                      allSelected
                        ? {}
                        : Object.fromEntries(visibleIds.map((id) => [id, true]))
                    )
                  }
                  className="size-4 rounded border-zinc-300 align-middle accent-zinc-900"
                />
              </th>
              <th className="px-4 py-3 font-medium">السائق</th>
              <th className="px-4 py-3 font-medium">الرحلات</th>
              <th className="px-4 py-3 font-medium">التربات</th>
              <th className="px-4 py-3 font-medium">العهدة</th>
              <th className="px-4 py-3 font-medium">صافي سند التربات</th>
              <th className="px-4 py-3 font-medium">صافي الراتب</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-zinc-400">
                  لا يوجد سائقون في هذه الفئة
                </td>
              </tr>
            ) : (
              visible.map((d) => {
                const p = preview.find((r) => r.driver_id === d.id);
                return (
                  <tr
                    key={d.id}
                    className={`border-b border-zinc-50 ${
                      selected[d.id] ? "bg-amber-50/60" : "hover:bg-zinc-50/60"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={!!selected[d.id]}
                        onChange={(e) =>
                          setSelected((s) => ({ ...s, [d.id]: e.target.checked }))
                        }
                        className="size-4 rounded border-zinc-300 align-middle accent-zinc-900"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/drivers/${d.id}`}
                        className="font-medium text-zinc-900 hover:underline"
                      >
                        {d.name}
                      </Link>
                      {p && !p.has_salary_row && (
                        <span className="mr-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800">
                          لا راتب مسجَّل
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-600" dir="ltr">
                      {p ? formatNumber(p.trips_count) : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-zinc-700" dir="ltr">
                      {p ? formatCurrency(p.total_trabs, currencySymbol) : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-zinc-600" dir="ltr">
                      {p ? formatCurrency(p.custody_balance, currencySymbol) : "—"}
                    </td>
                    <td
                      className="px-4 py-3 whitespace-nowrap font-semibold text-zinc-900"
                      dir="ltr"
                    >
                      {p ? formatCurrency(p.trab_net, currencySymbol) : "—"}
                    </td>
                    <td
                      className="px-4 py-3 whitespace-nowrap font-semibold text-zinc-900"
                      dir="ltr"
                    >
                      {p ? formatCurrency(p.salary_net, currencySymbol) : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {preview.length > 0 && (
            <tfoot>
              <tr className="bg-zinc-50 text-sm font-bold text-zinc-900">
                <td className="px-4 py-3" colSpan={5}>
                  الإجمالي ({formatNumber(preview.length)} سائق)
                  {loading && (
                    <Loader2 size={13} className="mr-2 inline animate-spin text-zinc-400" />
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap" dir="ltr">
                  {formatCurrency(totals.trab, currencySymbol)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap" dir="ltr">
                  {formatCurrency(totals.salary, currencySymbol)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {missingSalary > 0 && paySalary && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            {formatNumber(missingSalary)} سائقاً بلا راتب مسجَّل لهذا الشهر — ولّد الرواتب
            من صفحة الرواتب أولاً، وإلا فسيُقفَل لهم التربات وحدها.
          </span>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-zinc-500">ملاحظة تُكتب في السندات</label>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={`إقفال شهر ${month}`}
          className="max-w-md rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
        />
      </div>

      {/* النتيجة بعد التنفيذ */}
      {results && (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center gap-1.5 border-b border-zinc-100 px-4 py-3 text-sm font-bold text-zinc-900">
            <CheckCircle2 size={15} className="text-emerald-600" />
            نتيجة الإقفال
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-right text-xs text-zinc-500">
                <th className="px-4 py-3 font-medium">السائق</th>
                <th className="px-4 py-3 font-medium">التربات</th>
                <th className="px-4 py-3 font-medium">الراتب</th>
                <th className="px-4 py-3 font-medium">السند</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.driver_id} className="border-b border-zinc-50">
                  <td className="px-4 py-3 font-medium text-zinc-900">{r.driver_name}</td>
                  <td className="px-4 py-3">
                    <span dir="ltr" className="font-semibold text-zinc-900">
                      {formatCurrency(r.trab_amount, currencySymbol)}
                    </span>
                    <span className="mr-2 text-[11px] text-zinc-500">{r.trab_note}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span dir="ltr" className="font-semibold text-zinc-900">
                      {formatCurrency(r.salary_amount, currencySymbol)}
                    </span>
                    <span className="mr-2 text-[11px] text-zinc-500">{r.salary_note}</span>
                  </td>
                  <td className="px-4 py-3">
                    {r.settlement_id ? (
                      <Link
                        href={`/settlements/${r.settlement_id}`}
                        className="text-xs text-zinc-700 underline-offset-2 hover:underline"
                      >
                        فتح السند
                      </Link>
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={handleApply}
        title="تأكيد إقفال الشهر"
        description={`سيُقفَل ${formatNumber(selectedIds.length)} سائقاً عن الفترة ${from} إلى ${to}. ${
          settleTrabs
            ? `تربات بإجمالي ${formatCurrency(totals.trab, currencySymbol)} — وتُوسَم رحلاتها وعهدتها فلا تُصرف ثانيةً. `
            : ""
        }${paySalary ? `ورواتب بإجمالي ${formatCurrency(totals.salary, currencySymbol)}. ` : ""}هل تريد المتابعة؟`}
      />
    </div>
  );
}
