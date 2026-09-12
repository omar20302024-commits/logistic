"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import {
  branchSchema,
  type BranchFormInput,
  type BranchFormValues,
  type BranchRecord,
} from "@/lib/validation/branch";
import { createBranch, updateBranch } from "@/app/(dashboard)/companies/branch-actions";

const emptyValues: BranchFormInput = {
  branch_code: "",
  branch_name: "",
  city: "",
  address: "",
  contact: "",
  phone: "",
  is_active: true,
  notes: "",
};

export function BranchFormModal({
  open,
  onClose,
  companyId,
  branch,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  companyId: string;
  branch?: BranchRecord | null;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BranchFormInput, unknown, BranchFormValues>({
    resolver: zodResolver(branchSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (!open) return;
    reset(
      branch
        ? {
            branch_code: branch.branch_code,
            branch_name: branch.branch_name ?? "",
            city: branch.city ?? "",
            address: branch.address ?? "",
            contact: branch.contact ?? "",
            phone: branch.phone ?? "",
            is_active: branch.is_active,
            notes: branch.notes ?? "",
          }
        : emptyValues
    );
  }, [open, branch, reset]);

  const onSubmit = async (values: BranchFormValues) => {
    const result = branch
      ? await updateBranch(companyId, branch.id, values)
      : await createBranch(companyId, values);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(branch ? "تم تعديل الفرع" : "تم إضافة الفرع");
    onSaved();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={branch ? "تعديل الفرع" : "إضافة فرع"}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">كود الفرع *</label>
            <input
              {...register("branch_code")}
              dir="ltr"
              placeholder="5072"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
            {errors.branch_code && (
              <p className="text-xs text-red-600">{errors.branch_code.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">اسم الفرع</label>
            <input
              {...register("branch_name")}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">المدينة</label>
            <input
              {...register("city")}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">الهاتف</label>
            <input
              {...register("phone")}
              dir="ltr"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700">اسم المسؤول</label>
          <input
            {...register("contact")}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700">العنوان</label>
          <input
            {...register("address")}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input type="checkbox" {...register("is_active")} className="size-4 accent-zinc-900" />
          فرع نشط
        </label>

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
