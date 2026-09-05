"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import {
  rentalContractSchema,
  type RentalContractInput,
  type RentalContractValues,
} from "@/lib/validation/rental";
import { createRentalContract, updateRentalContract } from "@/app/(dashboard)/rentals/actions";
import { monthLabels } from "@/lib/validation/salary";

type Option = { id: string; name: string };

export type RentalContractRecord = {
  id: string;
  driver_id: string;
  company_id: string;
  city: string | null;
  month: number;
  year: number;
  monthly_amount: number;
  housing_unit_id: string | null;
  diesel_amount: number;
  notes: string | null;
};

function emptyValues(): RentalContractInput {
  const now = new Date();
  return {
    driver_id: "",
    company_id: "",
    city: "",
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    monthly_amount: 0,
    housing_unit_id: "",
    diesel_amount: 0,
    notes: "",
  };
}

export function RentalContractFormModal({
  open,
  onClose,
  contract,
  drivers,
  companies,
  housingUnits,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  contract?: RentalContractRecord | null;
  drivers: Option[];
  companies: Option[];
  housingUnits: Option[];
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RentalContractInput, unknown, RentalContractValues>({
    resolver: zodResolver(rentalContractSchema),
    defaultValues: emptyValues(),
  });

  useEffect(() => {
    if (!open) return;
    reset(
      contract
        ? {
            driver_id: contract.driver_id,
            company_id: contract.company_id,
            city: contract.city ?? "",
            month: contract.month,
            year: contract.year,
            monthly_amount: contract.monthly_amount,
            housing_unit_id: contract.housing_unit_id ?? "",
            diesel_amount: contract.diesel_amount,
            notes: contract.notes ?? "",
          }
        : emptyValues()
    );
  }, [open, contract, reset]);

  const onSubmit = async (values: RentalContractValues) => {
    const result = contract
      ? await updateRentalContract(contract.id, values)
      : await createRentalContract(values);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(contract ? "تم تعديل عقد الإيجار" : "تم إضافة عقد الإيجار بنجاح");
    onSaved();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={contract ? "تعديل عقد إيجار" : "إضافة عقد إيجار جديد"}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">السائق *</label>
            <select {...register("driver_id")} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900">
              <option value="">اختر السائق</option>
              {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {errors.driver_id && <p className="text-xs text-red-600">{errors.driver_id.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">الشركة المستأجرة *</label>
            <select {...register("company_id")} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900">
              <option value="">اختر الشركة</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {errors.company_id && <p className="text-xs text-red-600">{errors.company_id.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">المدينة</label>
            <input {...register("city")} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">الشهر</label>
            <select {...register("month")} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900">
              {monthLabels.map((label, i) => <option key={i + 1} value={i + 1}>{label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">السنة</label>
            <input {...register("year")} type="number" dir="ltr" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">مبلغ الإيجار الشهري *</label>
            <input {...register("monthly_amount")} type="number" step="0.01" dir="ltr" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" />
            {errors.monthly_amount && <p className="text-xs text-red-600">{errors.monthly_amount.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">وحدة السكن (اختياري)</label>
            <select {...register("housing_unit_id")} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900">
              <option value="">بدون سكن مرتبط</option>
              {housingUnits.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700">الديزل اليدوي (فقط لو مفيش رحلات مسجَّلة)</label>
          <input {...register("diesel_amount")} type="number" step="0.01" dir="ltr" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" />
          <p className="text-[11px] text-zinc-400">لو السائق سجّل رحلات عادية لنفس الشركة في نفس الشهر، الديزل هياخده النظام منها تلقائياً بدل هذا الحقل.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700">ملاحظات</label>
          <textarea {...register("notes")} rows={2} className="resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" />
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
