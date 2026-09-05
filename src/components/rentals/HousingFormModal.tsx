"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { housingUnitSchema, type HousingUnitInput, type HousingUnitValues } from "@/lib/validation/housing";
import { createHousingUnit, updateHousingUnit } from "@/app/(dashboard)/rentals/housing/actions";

export type HousingUnitRecord = {
  id: string;
  name: string;
  city: string | null;
  monthly_rent: number;
  notes: string | null;
};

const emptyValues: HousingUnitInput = { name: "", city: "", monthly_rent: 0, notes: "" };

export function HousingFormModal({
  open,
  onClose,
  unit,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  unit?: HousingUnitRecord | null;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<HousingUnitInput, unknown, HousingUnitValues>({
    resolver: zodResolver(housingUnitSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (!open) return;
    reset(
      unit
        ? { name: unit.name, city: unit.city ?? "", monthly_rent: unit.monthly_rent, notes: unit.notes ?? "" }
        : emptyValues
    );
  }, [open, unit, reset]);

  const onSubmit = async (values: HousingUnitValues) => {
    const result = unit ? await updateHousingUnit(unit.id, values) : await createHousingUnit(values);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(unit ? "تم تعديل وحدة السكن" : "تم إضافة وحدة السكن بنجاح");
    onSaved();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={unit ? "تعديل وحدة سكن" : "إضافة وحدة سكن جديدة"} maxWidth="max-w-md">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700">اسم/وصف وحدة السكن *</label>
          <input
            {...register("name")}
            placeholder="مثال: شقة السلي"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
          />
          {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">المدينة</label>
            <input
              {...register("city")}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">الإيجار الشهري *</label>
            <input
              {...register("monthly_rent")}
              type="number"
              step="0.01"
              dir="ltr"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
            {errors.monthly_rent && <p className="text-xs text-red-600">{errors.monthly_rent.message}</p>}
          </div>
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
