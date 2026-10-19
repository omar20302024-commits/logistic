"use client";

import { formatCurrency } from "@/lib/format";

/**
 * كم سيُدفع من المستحق الآن.
 *
 * الفارغ يعني «المستحق كاملاً» — لا صفراً. والنقص يبقى ديناً محمولاً يظهر في
 * المستحق القادم، فالمستخدم يرى المتبقي قبل أن يضغط.
 */
export function PaymentAmountField({
  due,
  value,
  onChange,
  currencySymbol,
  label = "المبلغ المدفوع الآن",
}: {
  due: number;
  value: string;
  onChange: (v: string) => void;
  currencySymbol: string;
  label?: string;
}) {
  const full = value === "";
  const paid = full ? due : Number(value) || 0;
  const remaining = due - paid;
  const over = paid > due;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-600">المستحق</span>
        <span className="font-bold text-zinc-900" dir="ltr">
          {formatCurrency(due, currencySymbol)}
        </span>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange("")}
          className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium ${
            full
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          المستحق كاملاً
        </button>
        <button
          type="button"
          onClick={() => onChange(String(due))}
          className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium ${
            full
              ? "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
              : "border-zinc-900 bg-zinc-900 text-white"
          }`}
        >
          مبلغ آخر
        </button>
      </div>

      {!full && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-600">{label}</label>
          <input
            type="number"
            step="0.01"
            dir="ltr"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`rounded-lg border px-3 py-2 text-right text-sm outline-none focus:border-zinc-900 ${
              over ? "border-red-400 bg-red-50" : "border-zinc-300"
            }`}
          />
        </div>
      )}

      {over ? (
        <p className="text-[11px] text-red-600">
          المبلغ أكبر من المستحق. الزيادة تُسجَّل كسلفة لا كسداد.
        </p>
      ) : remaining > 0 ? (
        <div className="flex items-center justify-between rounded-lg bg-amber-100 px-2.5 py-1.5 text-xs text-amber-900">
          <span>يبقى ديناً</span>
          <span className="font-bold" dir="ltr">
            {formatCurrency(remaining, currencySymbol)}
          </span>
        </div>
      ) : (
        <p className="text-[11px] text-emerald-700">سداد كامل — لا متبقٍّ.</p>
      )}
    </div>
  );
}
