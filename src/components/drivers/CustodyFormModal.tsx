"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import {
  custodyEntrySchema,
  type CustodyEntryInput,
  type CustodyEntryValues,
} from "@/lib/validation/custody";
import { createCustodyEntry, updateCustodyEntry } from "@/app/(dashboard)/drivers/custody-actions";

export type CustodyRecord = {
  id: string;
  date: string;
  type: "credit" | "debit";
  amount: number;
  description: string | null;
  notes: string | null;
};

function emptyValues(): CustodyEntryInput {
  return { date: new Date().toISOString().slice(0, 10), type: "credit", amount: 0, description: "", notes: "" };
}

export function CustodyFormModal({
  open,
  onClose,
  driverId,
  entry,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  driverId: string;
  entry?: CustodyRecord | null;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
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
            amount: entry.amount,
            description: entry.description ?? "",
            notes: entry.notes ?? "",
          }
        : emptyValues()
    );
  }, [open, entry, reset]);

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

  return (
    <Modal open={open} onClose={onClose} title={entry ? "تعديل حركة عهدة" : "إضافة حركة عهدة"} maxWidth="max-w-md">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700">نوع الحركة *</label>
          <select
            {...register("type")}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
          >
            <option value="credit">إضافة للعهدة (تسليم مبلغ / تحصيل من عميل)</option>
            <option value="debit">صرف من العهدة (مصروف / إرجاع للشركة)</option>
          </select>
        </div>

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
            placeholder="مثال: عهدة ديزل، تحصيل من عميل..."
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
