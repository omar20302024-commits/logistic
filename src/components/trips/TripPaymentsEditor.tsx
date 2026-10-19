"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import {
  setTripBasePayments,
  type TripPaymentRow,
  type PricingScope,
} from "@/app/(dashboard)/drivers/pricing-actions";

/**
 * تحرير سعر المورّد/السائق لكل رحلة بعد تسجيلها.
 *
 * يُستعمل في صفحة السائق وصفحة المورّد معاً — نفس العمود المحرَّر
 * (driver_base_payment)، ونفس الحارس: الرحلة المصفّاة أرقامها مجمَّدة في سند
 * مصروف فتُعرض مقفلة ولا تُحفظ.
 *
 * «الإجمالي» المعروض = الأساسي + المواقع الإضافية + المبيت، يحسبه المشغّل في
 * قاعدة البيانات. نحن نحرّر الأساسي وحده.
 */
export function TripPaymentsEditor({
  scope,
  rows,
  currencySymbol,
  showDriver = false,
}: {
  scope: PricingScope;
  rows: TripPaymentRow[];
  currencySymbol: string;
  showDriver?: boolean;
}) {
  const router = useRouter();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [bulkAmount, setBulkAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const editable = rows.filter((r) => !r.settled);
  const unpricedCount = editable.filter((r) => Number(r.driver_base_payment) === 0).length;

  const valueOf = (r: TripPaymentRow) => amounts[r.id] ?? String(r.driver_base_payment ?? 0);

  const isChanged = (r: TripPaymentRow) =>
    amounts[r.id] !== undefined &&
    amounts[r.id] !== "" &&
    Number(amounts[r.id]) !== Number(r.driver_base_payment);

  // نحفظ ما تغيّر فعلاً فقط — فلا نكتب صفوفاً لم يلمسها المستخدم
  const changed = editable.filter(isChanged);

  const selectedIds = editable.filter((r) => selected[r.id]).map((r) => r.id);
  const allSelected = editable.length > 0 && selectedIds.length === editable.length;

  const toggleAll = () =>
    setSelected(allSelected ? {} : Object.fromEntries(editable.map((r) => [r.id, true])));

  // ينسخ المبلغ في الخانات ولا يحفظ — ليراجعه المستخدم ويعدّل ما يشاء
  const applyBulk = () => {
    if (selectedIds.length === 0) {
      toast.error("حدّد رحلة واحدة على الأقل");
      return;
    }
    if (bulkAmount === "" || Number(bulkAmount) < 0) {
      toast.error("اكتب مبلغاً صحيحاً");
      return;
    }
    setAmounts((prev) => {
      const next = { ...prev };
      for (const id of selectedIds) next[id] = bulkAmount;
      return next;
    });
  };

  const handleSave = async () => {
    if (changed.length === 0) {
      toast.error("لم تغيّر أي مبلغ");
      return;
    }

    setSaving(true);
    const result = await setTripBasePayments(
      scope,
      changed.map((r) => ({ tripId: r.id, amount: Number(amounts[r.id]) }))
    );
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`تم تحديث ${formatNumber(changed.length)} رحلة`);
    setAmounts({});
    setSelected({});
    setBulkAmount("");
    router.refresh();
  };

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-zinc-200 bg-white px-4 py-6 text-center text-sm text-zinc-500">
        لا توجد رحلات في هذه الفترة.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {unpricedCount > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <span className="font-medium">{formatNumber(unpricedCount)} رحلة بسعر صفر.</span> لا
          تدخل المستحق ولا يمكن تصفيتها حتى تُسعَّر.
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-zinc-200 bg-white p-3 print:hidden">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-zinc-500">
            مبلغ موحَّد للمحدَّد ({formatNumber(selectedIds.length)})
          </label>
          <input
            type="number"
            step="0.01"
            dir="ltr"
            value={bulkAmount}
            onChange={(e) => setBulkAmount(e.target.value)}
            placeholder="1400"
            className="w-32 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-right text-xs outline-none focus:border-zinc-900"
          />
        </div>
        <button
          type="button"
          onClick={applyBulk}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
        >
          انسخه للمحدَّد
        </button>
        <span className="pb-2 text-[11px] text-zinc-500">
          ثم راجع الخانات واضغط «حفظ التعديلات»
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-right text-xs text-zinc-500">
              <th className="px-3 py-2 print:hidden">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="size-3.5 align-middle accent-zinc-900"
                />
              </th>
              <th className="px-3 py-2 font-medium">التاريخ</th>
              <th className="px-3 py-2 font-medium">رقم الرحلة</th>
              {showDriver && <th className="px-3 py-2 font-medium">السائق</th>}
              <th className="px-3 py-2 font-medium">العميل</th>
              <th className="px-3 py-2 font-medium">خط السير</th>
              <th className="px-3 py-2 font-medium">على العميل</th>
              <th className="px-3 py-2 font-medium">السعر الأساسي</th>
              <th className="px-3 py-2 font-medium">الإجمالي الحالي</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((r) => (
              <tr
                key={r.id}
                className={
                  r.settled
                    ? "bg-zinc-50/70"
                    : selected[r.id]
                      ? "bg-amber-50/60"
                      : undefined
                }
              >
                <td className="px-3 py-2 print:hidden">
                  {r.settled ? (
                    <Lock size={13} className="text-zinc-400" />
                  ) : (
                    <input
                      type="checkbox"
                      checked={!!selected[r.id]}
                      onChange={(e) =>
                        setSelected((p) => ({ ...p, [r.id]: e.target.checked }))
                      }
                      className="size-3.5 align-middle accent-zinc-900"
                    />
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-zinc-600" dir="ltr">
                  {r.trip_date}
                </td>
                <td className="px-3 py-2 text-zinc-600" dir="ltr">
                  {r.trip_number}
                </td>
                {showDriver && (
                  <td className="px-3 py-2 text-zinc-700">{r.driver_name ?? "—"}</td>
                )}
                <td className="px-3 py-2 text-zinc-700">{r.company_name}</td>
                <td className="px-3 py-2 text-zinc-700">
                  {r.from_location} ← {r.to_location}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-zinc-500" dir="ltr">
                  {formatCurrency(r.trip_amount, currencySymbol)}
                </td>
                <td className="px-3 py-2">
                  {r.settled ? (
                    <span className="whitespace-nowrap text-zinc-500" dir="ltr">
                      {formatCurrency(r.driver_base_payment, currencySymbol)}
                    </span>
                  ) : (
                    <input
                      type="number"
                      step="0.01"
                      dir="ltr"
                      value={valueOf(r)}
                      onChange={(e) => setAmounts((p) => ({ ...p, [r.id]: e.target.value }))}
                      className={`w-24 rounded border px-2 py-1 text-right text-xs outline-none focus:border-zinc-900 ${
                        isChanged(r) ? "border-amber-400 bg-amber-50" : "border-zinc-300"
                      }`}
                    />
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-zinc-700" dir="ltr">
                  {formatCurrency(r.driver_trip_payment, currencySymbol)}
                  {r.settled && (
                    <span className="mr-1.5 rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] text-zinc-600">
                      مصفّاة
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 print:hidden">
        <p className="text-[11px] text-zinc-500">
          «الإجمالي الحالي» يشمل المواقع الإضافية والمبيت ويُحدَّث بعد الحفظ. والرحلة المصفّاة
          مقفلة — أرقامها مجمَّدة في سند مصروف.
        </p>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || changed.length === 0}
          className="shrink-0 rounded-lg bg-zinc-900 px-5 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {saving
            ? "جارٍ الحفظ..."
            : `حفظ التعديلات${changed.length > 0 ? ` (${formatNumber(changed.length)})` : ""}`}
        </button>
      </div>
    </div>
  );
}
