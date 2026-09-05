"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { expenseSchema, type ExpenseFormInput, type ExpenseFormValues } from "@/lib/validation/expense";
import { createExpense, updateExpense } from "@/app/(dashboard)/expenses/actions";

export type ExpenseRecord = {
  id: string;
  date: string;
  category: string;
  description: string | null;
  amount: number;
  notes: string | null;
};

function emptyValues(): ExpenseFormInput {
  return { date: new Date().toISOString().slice(0, 10), category: "", description: "", amount: 0, notes: "" };
}

export function ExpenseFormModal({
  open,
  onClose,
  expense,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  expense?: ExpenseRecord | null;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFormInput, unknown, ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: emptyValues(),
  });

  useEffect(() => {
    if (!open) return;
    reset(
      expense
        ? {
            date: expense.date,
            category: expense.category,
            description: expense.description ?? "",
            amount: expense.amount,
            notes: expense.notes ?? "",
          }
        : emptyValues()
    );
  }, [open, expense, reset]);

  const onSubmit = async (values: ExpenseFormValues) => {
    const result = expense ? await updateExpense(expense.id, values) : await createExpense(values);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(expense ? "تم تعديل المصروف" : "تم إضافة المصروف بنجاح");
    onSaved();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={expense ? "تعديل مصروف" : "إضافة مصروف جديد"} maxWidth="max-w-md">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">التاريخ *</label>
            <input {...register("date")} type="date" dir="ltr" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" />
            {errors.date && <p className="text-xs text-red-600">{errors.date.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">المبلغ *</label>
            <input {...register("amount")} type="number" step="0.01" dir="ltr" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" />
            {errors.amount && <p className="text-xs text-red-600">{errors.amount.message}</p>}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700">التصنيف *</label>
          <input {...register("category")} placeholder="مثال: صيانة، إيجار، اتصالات..." className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" />
          {errors.category && <p className="text-xs text-red-600">{errors.category.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700">الوصف</label>
          <input {...register("description")} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" />
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
