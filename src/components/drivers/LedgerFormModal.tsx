"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { ledgerEntrySchema, type LedgerEntryInput, type LedgerEntryValues } from "@/lib/validation/ledger";
import { createLedgerEntry, updateLedgerEntry, type LedgerType } from "@/app/(dashboard)/drivers/ledger-actions";

export type LedgerRecord = {
  id: string;
  date: string;
  amount: number;
  description: string | null;
  notes: string | null;
};

function emptyValues(): LedgerEntryInput {
  return { date: new Date().toISOString().slice(0, 10), amount: 0, description: "", notes: "" };
}

export function LedgerFormModal({
  open,
  onClose,
  type,
  driverId,
  entry,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  type: LedgerType;
  driverId: string;
  entry?: LedgerRecord | null;
  onSaved: () => void;
}) {
  const title = type === "advance" ? "سلفة" : "خصم";

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LedgerEntryInput, unknown, LedgerEntryValues>({
    resolver: zodResolver(ledgerEntrySchema),
    defaultValues: emptyValues(),
  });

  useEffect(() => {
    if (!open) return;
    reset(
      entry
        ? {
            date: entry.date,
            amount: entry.amount,
            description: entry.description ?? "",
            notes: entry.notes ?? "",
          }
        : emptyValues()
    );
  }, [open, entry, reset]);

  const onSubmit = async (values: LedgerEntryValues) => {
    const result = entry
      ? await updateLedgerEntry(type, driverId, entry.id, values)
      : await createLedgerEntry(type, driverId, values);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(entry ? `تم تعديل ${title}` : `تم إضافة ${title} بنجاح`);
    onSaved();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={entry ? `تعديل ${title}` : `إضافة ${title}`} maxWidth="max-w-md">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
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
          <label className="text-sm font-medium text-zinc-700">السبب</label>
          <input
            {...register("description")}
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
