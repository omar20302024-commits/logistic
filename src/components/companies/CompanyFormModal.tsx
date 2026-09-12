"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import {
  companySchema,
  type CompanyFormInput,
  type CompanyFormValues,
} from "@/lib/validation/company";
import { createCompany, updateCompany } from "@/app/(dashboard)/companies/actions";

export type CompanyRecord = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  contact_person: string | null;
  extra_location_rate: number;
  status: "active" | "inactive";
  notes: string | null;
};

const emptyValues: CompanyFormInput = {
  name: "",
  phone: "",
  address: "",
  contact_person: "",
  extra_location_rate: 0,
  status: "active",
  notes: "",
};

export function CompanyFormModal({
  open,
  onClose,
  company,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  company?: CompanyRecord | null;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CompanyFormInput, unknown, CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (!open) return;
    reset(
      company
        ? {
            name: company.name,
            phone: company.phone ?? "",
            address: company.address ?? "",
            contact_person: company.contact_person ?? "",
            extra_location_rate: company.extra_location_rate,
            status: company.status,
            notes: company.notes ?? "",
          }
        : emptyValues
    );
  }, [open, company, reset]);

  const onSubmit = async (values: CompanyFormValues) => {
    const result = company
      ? await updateCompany(company.id, values)
      : await createCompany(values);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(company ? "تم تعديل بيانات الشركة" : "تم إضافة الشركة بنجاح");
    onSaved();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={company ? "تعديل بيانات الشركة" : "إضافة شركة جديدة"}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700">اسم الشركة *</label>
          <input
            {...register("name")}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
          />
          {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">رقم الهاتف</label>
            <input
              {...register("phone")}
              dir="ltr"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">اسم المسؤول</label>
            <input
              {...register("contact_person")}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">سعر الموقع الإضافي</label>
            <input
              {...register("extra_location_rate")}
              type="number"
              step="0.01"
              dir="ltr"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
            <p className="text-[11px] text-zinc-400">
              يُقترَح تلقائياً في نموذج الرحلة. منفصل تماماً عن معدَّل السائق
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700">العنوان</label>
          <input
            {...register("address")}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700">الحالة</label>
          <select
            {...register("status")}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
          >
            <option value="active">نشط</option>
            <option value="inactive">غير نشط</option>
          </select>
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
