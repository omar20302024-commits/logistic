"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { routeRateSchema, type RouteRateInput, type RouteRateValues } from "@/lib/validation/routeRate";
import { createRouteRate, updateRouteRate } from "@/app/(dashboard)/drivers/route-rates-actions";

export type RouteRateRecord = {
  id: string;
  from_city: string;
  to_city: string;
  trab_amount: number;
  notes: string | null;
};

const emptyValues: RouteRateInput = { from_city: "", to_city: "", trab_amount: 0, notes: "" };

export function RouteRateFormModal({
  open,
  onClose,
  driverId,
  rate,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  driverId: string;
  rate?: RouteRateRecord | null;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RouteRateInput, unknown, RouteRateValues>({
    resolver: zodResolver(routeRateSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (!open) return;
    reset(
      rate
        ? { from_city: rate.from_city, to_city: rate.to_city, trab_amount: rate.trab_amount, notes: rate.notes ?? "" }
        : emptyValues
    );
  }, [open, rate, reset]);

  const onSubmit = async (values: RouteRateValues) => {
    const result = rate
      ? await updateRouteRate(driverId, rate.id, values)
      : await createRouteRate(driverId, values);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(rate ? "تم تعديل خط السير" : "تم إضافة خط السير بنجاح");
    onSaved();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={rate ? "تعديل خط سير" : "إضافة خط سير جديد"} maxWidth="max-w-md">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">مدينة التحميل *</label>
            <input
              {...register("from_city")}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
            {errors.from_city && <p className="text-xs text-red-600">{errors.from_city.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">مدينة التنزيل *</label>
            <input
              {...register("to_city")}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
            {errors.to_city && <p className="text-xs text-red-600">{errors.to_city.message}</p>}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700">الترب المتفق عليه *</label>
          <input
            {...register("trab_amount")}
            type="number"
            step="0.01"
            dir="ltr"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
          />
          {errors.trab_amount && <p className="text-xs text-red-600">{errors.trab_amount.message}</p>}
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
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">إلغاء</button>
          <button type="submit" disabled={isSubmitting} className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">
            {isSubmitting ? "جارٍ الحفظ..." : "حفظ"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
