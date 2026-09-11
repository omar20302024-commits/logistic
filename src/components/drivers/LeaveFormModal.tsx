"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import {
  leaveSchema,
  leaveDayCount,
  type LeaveInput,
  type LeaveValues,
  type LeaveRecord,
} from "@/lib/validation/leave";
import { createLeave, updateLeave } from "@/app/(dashboard)/drivers/leave-actions";

function emptyValues(): LeaveInput {
  return { from_date: new Date().toISOString().slice(0, 10), to_date: "", notes: "" };
}

export function LeaveFormModal({
  open,
  onClose,
  driverId,
  leave,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  driverId: string;
  leave?: LeaveRecord | null;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LeaveInput, unknown, LeaveValues>({
    resolver: zodResolver(leaveSchema),
    defaultValues: emptyValues(),
  });

  useEffect(() => {
    if (!open) return;
    reset(
      leave
        ? { from_date: leave.from_date, to_date: leave.to_date ?? "", notes: leave.notes ?? "" }
        : emptyValues()
    );
  }, [open, leave, reset]);

  const fromDate = watch("from_date");
  const toDate = watch("to_date");
  const days = fromDate && toDate ? leaveDayCount(fromDate, toDate) : null;

  const onSubmit = async (values: LeaveValues) => {
    const result = leave
      ? await updateLeave(driverId, leave.id, values)
      : await createLeave(driverId, values);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(leave ? "تم تعديل الإجازة" : "تم تسجيل الإجازة");
    onSaved();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={leave ? "تعديل إجازة" : "تسجيل إجازة"}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] text-zinc-600">
          كل أيام الإجازة تُخصم من الراتب بلا استثناء، والشهر يُحسب 30 يوماً دائماً. مثال: إجازة
          20 يوماً تعني راتب 10 أيام فقط عن ذلك الشهر.
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">من تاريخ *</label>
            <input
              {...register("from_date")}
              type="date"
              dir="ltr"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
            {errors.from_date && <p className="text-xs text-red-600">{errors.from_date.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">إلى تاريخ (الرجوع)</label>
            <input
              {...register("to_date")}
              type="date"
              dir="ltr"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
            {errors.to_date && <p className="text-xs text-red-600">{errors.to_date.message}</p>}
          </div>
        </div>

        {days !== null && (
          <p className="text-[11px] text-zinc-500">
            مدة الإجازة: {days} يوماً (شاملة يومَي البداية والنهاية)
          </p>
        )}

        {!toDate && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              إجازة مفتوحة بلا تاريخ رجوع. ستُخصم كل الأيام من تاريخ البداية فصاعداً، وتُصفّر رواتب
              كل الأشهر التالية حتى تحدّد تاريخ الرجوع — لا تنسَ إغلاقها عند عودته.
            </span>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700">ملاحظات</label>
          <textarea
            {...register("notes")}
            rows={2}
            placeholder="مثال: إجازة سنوية — سافر للبلد"
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
