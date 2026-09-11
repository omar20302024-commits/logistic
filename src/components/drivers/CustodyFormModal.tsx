"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import {
  custodyEntrySchema,
  custodyReasonLabels,
  CREDIT_REASONS,
  DEBIT_REASONS,
  EXPENSE_CATEGORIES,
  type CustodyEntryInput,
  type CustodyEntryValues,
} from "@/lib/validation/custody";
import { createCustodyEntry, updateCustodyEntry } from "@/app/(dashboard)/drivers/custody-actions";
import { formatCurrency } from "@/lib/format";

export type CustodyTripOption = {
  id: string;
  trip_number: string;
  trip_date: string;
  diesel_amount: number;
};

export type CustodyRecord = {
  id: string;
  date: string;
  type: "credit" | "debit";
  reason: string | null;
  expense_category: string | null;
  trip_id: string | null;
  amount: number;
  description: string | null;
  notes: string | null;
  settlement_id: string | null;
};

function emptyValues(): CustodyEntryInput {
  return {
    date: new Date().toISOString().slice(0, 10),
    type: "credit",
    reason: "from_company",
    expense_category: "",
    trip_id: "",
    amount: 0,
    description: "",
    notes: "",
  };
}

export function CustodyFormModal({
  open,
  onClose,
  driverId,
  entry,
  trips,
  currencySymbol,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  driverId: string;
  entry?: CustodyRecord | null;
  trips: CustodyTripOption[];
  currencySymbol: string;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CustodyEntryInput, unknown, CustodyEntryValues>({
    resolver: zodResolver(custodyEntrySchema),
    defaultValues: emptyValues(),
  });

  useEffect(() => {
    if (!open) return;
    reset(
      entry
        ? {
            date: entry.date,
            type: entry.type,
            reason: (entry.reason ?? "unspecified") as CustodyEntryInput["reason"],
            expense_category: entry.expense_category ?? "",
            trip_id: entry.trip_id ?? "",
            amount: entry.amount,
            description: entry.description ?? "",
            notes: entry.notes ?? "",
          }
        : emptyValues()
    );
  }, [open, entry, reset]);

  const watchedType = watch("type");
  const watchedReason = watch("reason");
  const watchedTripId = watch("trip_id");
  const watchedCategory = watch("expense_category");
  const isWorkExpense = watchedReason === "work_expense";

  // تبديل نوع الحركة يخلّي السبب القديم غير صالح — نرجّعه لأول سبب مسموح بدل
  // ما يفضل النموذج في حالة مرفوضة والمستخدم مش عارف السبب
  useEffect(() => {
    if (!open || watchedReason === "unspecified") return;
    const allowed: readonly string[] = watchedType === "credit" ? CREDIT_REASONS : DEBIT_REASONS;
    if (!allowed.includes(watchedReason)) {
      setValue("reason", allowed[0] as CustodyEntryInput["reason"]);
      setValue("expense_category", "");
    }
  }, [watchedType, watchedReason, open, setValue]);

  // البند يُلغى لما القيد يبطل يكون مصروف عمل — القيد في قاعدة البيانات يرفض غير كده
  useEffect(() => {
    if (!isWorkExpense) setValue("expense_category", "");
  }, [isWorkExpense, setValue]);

  const linkedTrip = watchedTripId ? trips.find((t) => t.id === watchedTripId) : undefined;

  // الحالة الوحيدة اللي الديزل ممكن يتحسب فيها مرتين: الرحلة مسجَّل عليها ديزل
  // مدفوع من الشركة، وكمان بنسجّل مصروف ديزل دفعه السائق على نفس الرحلة
  const dieselDoubleCount =
    isWorkExpense && watchedCategory === "ديزل" && !!linkedTrip && linkedTrip.diesel_amount > 0;

  const onSubmit = async (values: CustodyEntryValues) => {
    const result = entry
      ? await updateCustodyEntry(driverId, entry.id, values)
      : await createCustodyEntry(driverId, values);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(entry ? "تم تعديل حركة العهدة" : "تم تسجيل حركة العهدة بنجاح");
    onSaved();
    onClose();
  };

  const reasonOptions = watchedType === "credit" ? CREDIT_REASONS : DEBIT_REASONS;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={entry ? "تعديل حركة عهدة" : "إضافة حركة عهدة"}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {entry?.settlement_id && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              هذه الحركة داخلة في سند تصفية. التعديل مسموح، لكن أرقام السند لن تتغيّر لأنها مجمّدة
              وقت التصفية.
            </span>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700">نوع الحركة *</label>
          <select
            {...register("type")}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
          >
            <option value="credit">إضافة للعهدة (السائق استلم مبلغاً)</option>
            <option value="debit">صرف من العهدة (السائق دفع أو أرجع مبلغاً)</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700">السبب *</label>
          <select
            {...register("reason")}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
          >
            {reasonOptions.map((r) => (
              <option key={r} value={r}>
                {custodyReasonLabels[r]}
              </option>
            ))}
            {watchedReason === "unspecified" && (
              <option value="unspecified">غير مصنّف (قيد قديم)</option>
            )}
          </select>
          {errors.reason && <p className="text-xs text-red-600">{errors.reason.message}</p>}
          {isWorkExpense && (
            <p className="text-[11px] text-zinc-500">
              يُضاف لحساب السائق عند المحاسبة، ويُخصم من ربح الشركة كمصروف.
            </p>
          )}
          {watchedReason === "returned_to_company" && (
            <p className="text-[11px] text-zinc-500">
              حركة نقدية فقط — لا تُخصم من الربح لأنها ليست مصروفاً.
            </p>
          )}
        </div>

        {isWorkExpense && (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">بند المصروف *</label>
              <select
                {...register("expense_category")}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
              >
                <option value="">— اختر البند —</option>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {errors.expense_category && (
                <p className="text-xs text-red-600">{errors.expense_category.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">مرتبط برحلة (اختياري)</label>
              <select
                {...register("trip_id")}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
              >
                <option value="">— بدون ربط —</option>
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.trip_number} — {t.trip_date}
                  </option>
                ))}
              </select>
              {dieselDoubleCount && linkedTrip && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>
                    هذه الرحلة مسجَّل عليها ديزل بمبلغ{" "}
                    {formatCurrency(linkedTrip.diesel_amount, currencySymbol)} مدفوع من الشركة. لو
                    كان نفس الديزل، سيُحتسب مرتين في المصروفات — راجع أيهما الصحيح.
                  </span>
                </div>
              )}
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">التاريخ *</label>
            <input
              {...register("date")}
              type="date"
              dir="ltr"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
            {errors.date && <p className="text-xs text-red-600">{errors.date.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">المبلغ *</label>
            <input
              {...register("amount")}
              type="number"
              step="0.01"
              dir="ltr"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
            {errors.amount && <p className="text-xs text-red-600">{errors.amount.message}</p>}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700">الوصف</label>
          <input
            {...register("description")}
            placeholder="مثال: تعبئة ديزل في الطريق، تحصيل من عميل..."
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700">ملاحظات</label>
          <textarea
            {...register("notes")}
            rows={2}
            className="resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
          />
        </div>

        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {isSubmitting ? "جارٍ الحفظ..." : "حفظ"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
