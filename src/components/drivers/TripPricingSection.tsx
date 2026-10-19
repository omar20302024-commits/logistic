"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Banknote } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import {
  setTripBasePayments,
  type UnpricedTrip,
} from "@/app/(dashboard)/drivers/pricing-actions";

/**
 * تسعير يدوي لرحلات هذا السائق.
 *
 * سعر الحملة على العميل يبقى كما هو؛ هنا يُكتب ما يأخذه السائق أو المورد —
 * بالكتابة المباشرة، بلا خطوط سير ولا جداول تسعيرة.
 *
 * تظهر فقط حين توجد رحلة واحدة على الأقل بترب صفر، فلا تزحم صفحة سائق
 * أموره منضبطة.
 */
export function TripPricingSection({
  driverId,
  trips,
  currencySymbol,
}: {
  driverId: string;
  trips: UnpricedTrip[];
  currencySymbol: string;
}) {
  const router = useRouter();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [bulkAmount, setBulkAmount] = useState("");
  const [saving, setSaving] = useState(false);

  if (trips.length === 0) return null;

  const selectedIds = trips.filter((t) => selected[t.id]).map((t) => t.id);
  const allSelected = selectedIds.length === trips.length;

  const toggleAll = () =>
    setSelected(
      allSelected ? {} : Object.fromEntries(trips.map((t) => [t.id, true]))
    );

  // نسخ مبلغ واحد إلى خانات المحدَّد — لا يحفظ، فيبقى للمستخدم أن يراجع ويعدّل
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

  const handleSaveAll = async () => {
    const rows = Object.entries(amounts)
      .filter(([, v]) => v !== "" && Number(v) > 0)
      .map(([tripId, amount]) => ({ tripId, amount: Number(amount) }));

    if (rows.length === 0) {
      toast.error("اكتب مبلغاً لرحلة واحدة على الأقل");
      return;
    }

    setSaving(true);
    const result = await setTripBasePayments(driverId, rows);
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`تم تسعير ${formatNumber(rows.length)} رحلة`);
    setAmounts({});
    setSelected({});
    setBulkAmount("");
    router.refresh();
  };

  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50/40 p-5 shadow-sm">
      <div className="mb-3">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-zinc-900">
          <Banknote size={15} />
          رحلات بلا سعر ({formatNumber(trips.length)})
        </h3>
        <p className="text-xs text-amber-800">
          هذه الرحلات مسجَّلة بترب صفر، فلا تدخل مستحق السائق ولا يمكن تصفيتها. اكتب سعر
          السائق أو المورد لكل رحلة — سعر الحملة على العميل لا يتغيّر. والرحلات المصفّاة
          سابقاً لا تظهر هنا ولا تتأثر.
        </p>
      </div>

      {/* مبلغ واحد للمحدَّد — ينسخه في الخانات ليراجعه المستخدم قبل الحفظ */}
      <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-amber-200 bg-white p-3">
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
          ثم راجع الخانات واضغط «حفظ الأسعار»
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-amber-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-right text-xs text-zinc-500">
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="size-3.5 align-middle accent-zinc-900"
                />
              </th>
              <th className="px-3 py-2 font-medium">التاريخ</th>
              <th className="px-3 py-2 font-medium">رقم الرحلة</th>
              <th className="px-3 py-2 font-medium">العميل</th>
              <th className="px-3 py-2 font-medium">خط السير</th>
              <th className="px-3 py-2 font-medium">على العميل</th>
              <th className="px-3 py-2 font-medium">سعر السائق</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {trips.map((t) => (
              <tr key={t.id} className={selected[t.id] ? "bg-amber-50/60" : undefined}>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={!!selected[t.id]}
                    onChange={(e) =>
                      setSelected((p) => ({ ...p, [t.id]: e.target.checked }))
                    }
                    className="size-3.5 align-middle accent-zinc-900"
                  />
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-zinc-600" dir="ltr">
                  {t.trip_date}
                </td>
                <td className="px-3 py-2 text-zinc-600" dir="ltr">
                  {t.trip_number}
                </td>
                <td className="px-3 py-2 text-zinc-700">{t.company_name}</td>
                <td className="px-3 py-2 text-zinc-700">
                  {t.from_location} ← {t.to_location}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-zinc-500" dir="ltr">
                  {formatCurrency(t.trip_amount, currencySymbol)}
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    step="0.01"
                    dir="ltr"
                    value={amounts[t.id] ?? ""}
                    onChange={(e) =>
                      setAmounts((p) => ({ ...p, [t.id]: e.target.value }))
                    }
                    placeholder="0.00"
                    className="w-24 rounded border border-zinc-300 px-2 py-1 text-right text-xs outline-none focus:border-zinc-900"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={handleSaveAll}
          disabled={saving}
          className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {saving ? "جارٍ الحفظ..." : "حفظ الأسعار"}
        </button>
      </div>
    </div>
  );
}
