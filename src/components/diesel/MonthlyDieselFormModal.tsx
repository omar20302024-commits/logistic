"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import {
  monthlyDieselSchema,
  type MonthlyDieselInput,
  type MonthlyDieselValues,
  type MonthlyDieselRecord,
} from "@/lib/validation/monthlyDiesel";
import { createMonthlyDiesel, updateMonthlyDiesel } from "@/app/(dashboard)/diesel/actions";
import { monthLabels } from "@/lib/validation/salary";

type DriverOption = { id: string; name: string };

export function MonthlyDieselFormModal({
  open,
  onClose,
  record,
  drivers,
  defaultYear,
  defaultMonth,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  record?: MonthlyDieselRecord | null;
  drivers: DriverOption[];
  defaultYear: number;
  defaultMonth: number;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MonthlyDieselInput, unknown, MonthlyDieselValues>({
    resolver: zodResolver(monthlyDieselSchema),
    defaultValues: {
      driver_id: "",
      year: defaultYear,
      month: defaultMonth,
      amount: 0,
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    reset(
      record
        ? {
            driver_id: record.driver_id,
            year: record.year,
            month: record.month,
            amount: record.amount,
            notes: record.notes ?? "",
          }
        : { driver_id: "", year: defaultYear, month: defaultMonth, amount: 0, notes: "" }
    );
  }, [open, record, defaultYear, defaultMonth, reset]);

  const onSubmit = async (values: MonthlyDieselValues) => {
    const result = record
      ? await updateMonthlyDiesel(record.id, values)
      : await createMonthlyDiesel(values);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(record ? "تم تعديل السجل" : "تم تسجيل الديزل الشهري");
    onSaved();
    onClose();
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={record ? "تعديل ديزل الشهر" : "تسجيل ديزل الشهر"}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700">السائق *</label>
          <select
            {...register("driver_id")}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
          >
            <option value="">— اختر السائق —</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          {errors.driver_id && <p className="text-xs text-red-600">{errors.driver_id.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">الشهر *</label>
            <select
              {...register("month")}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            >
              {monthLabels.map((label, i) => (
                <option key={i + 1} value={i + 1}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">السنة *</label>
            <select
              {...register("year")}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700">إجمالي الديزل *</label>
          <input
            {...register("amount")}
            type="number"
            step="0.01"
            dir="ltr"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
          />
          {errors.amount && <p className="text-xs text-red-600">{errors.amount.message}</p>}
          <p className="text-[11px] text-zinc-400">
            إجمالي ما صُرف على ديزل هذا السائق طوال الشهر
          </p>
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
