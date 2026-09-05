"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { salarySchema, monthLabels, type SalaryFormInput, type SalaryFormValues } from "@/lib/validation/salary";
import { createSalary, updateSalary } from "@/app/(dashboard)/salaries/actions";

type DriverOption = { id: string; name: string; salary: number };

export type SalaryRecord = {
  id: string;
  driver_id: string;
  month: number;
  year: number;
  basic_salary: number;
  paid_amount: number;
  payment_date: string | null;
  notes: string | null;
};

function emptyValues(): SalaryFormInput {
  const now = new Date();
  return {
    driver_id: "",
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    basic_salary: 0,
    paid_amount: 0,
    payment_date: "",
    notes: "",
  };
}

export function SalaryFormModal({
  open,
  onClose,
  salary,
  drivers,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  salary?: SalaryRecord | null;
  drivers: DriverOption[];
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SalaryFormInput, unknown, SalaryFormValues>({
    resolver: zodResolver(salarySchema),
    defaultValues: emptyValues(),
  });

  useEffect(() => {
    if (!open) return;
    reset(
      salary
        ? {
            driver_id: salary.driver_id,
            month: salary.month,
            year: salary.year,
            basic_salary: salary.basic_salary,
            paid_amount: salary.paid_amount,
            payment_date: salary.payment_date ?? "",
            notes: salary.notes ?? "",
          }
        : emptyValues()
    );
  }, [open, salary, reset]);

  const selectedDriverId = watch("driver_id");

  useEffect(() => {
    if (salary) return; // لا نغيّر الراتب الأساسي تلقائياً عند التعديل
    const driver = drivers.find((d) => d.id === selectedDriverId);
    if (driver) setValue("basic_salary", driver.salary);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDriverId]);

  const onSubmit = async (values: SalaryFormValues) => {
    const result = salary ? await updateSalary(salary.id, values) : await createSalary(values);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(salary ? "تم تعديل الراتب" : "تم تسجيل الراتب بنجاح");
    onSaved();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={salary ? "تعديل الراتب" : "تسجيل راتب جديد"}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700">السائق *</label>
          <select
            {...register("driver_id")}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
          >
            <option value="">اختر السائق</option>
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
            <label className="text-sm font-medium text-zinc-700">الشهر</label>
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
            <label className="text-sm font-medium text-zinc-700">السنة</label>
            <input
              {...register("year")}
              type="number"
              dir="ltr"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">الراتب الأساسي *</label>
            <input
              {...register("basic_salary")}
              type="number"
              step="0.01"
              dir="ltr"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
            {errors.basic_salary && <p className="text-xs text-red-600">{errors.basic_salary.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">المبلغ المدفوع</label>
            <input
              {...register("paid_amount")}
              type="number"
              step="0.01"
              dir="ltr"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700">تاريخ الدفع</label>
          <input
            {...register("payment_date")}
            type="date"
            dir="ltr"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
          />
        </div>

        <p className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
          الخصومات والسلف تُحسب تلقائياً من السجلات المضافة على صفحة السائق ضمن نفس الشهر —
          ليست حقلاً يُدخل هنا.
        </p>

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
