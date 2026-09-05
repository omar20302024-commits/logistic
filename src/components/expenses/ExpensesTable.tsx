"use client";

import { useCallback, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Receipt } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ExpenseFormModal, type ExpenseRecord } from "./ExpenseFormModal";
import { deleteExpense } from "@/app/(dashboard)/expenses/actions";
import { formatCurrency } from "@/lib/format";

export function ExpensesTable({
  expenses,
  total,
  page,
  pageSize,
  currencySymbol,
  filters,
}: {
  expenses: ExpenseRecord[];
  total: number;
  page: number;
  pageSize: number;
  currencySymbol: string;
  filters: { from: string; to: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<ExpenseRecord | null>(null);

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([k, v]) => (v ? params.set(k, v) : params.delete(k)));
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const handleDelete = async () => {
    if (!deletingExpense) return;
    const result = await deleteExpense(deletingExpense.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("تم حذف المصروف");
      setDeletingExpense(null);
      router.refresh();
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-zinc-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <input type="date" value={filters.from} dir="ltr" onChange={(e) => updateParams({ from: e.target.value, page: "1" })} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900" />
          <span className="text-xs text-zinc-400">إلى</span>
          <input type="date" value={filters.to} dir="ltr" onChange={(e) => updateParams({ to: e.target.value, page: "1" })} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900" />
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingExpense(null);
            setFormOpen(true);
          }}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          <Plus size={16} /> إضافة مصروف
        </button>
      </div>

      {expenses.length === 0 ? (
        <EmptyState icon={Receipt} title="لا توجد مصروفات مسجَّلة" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-right text-xs text-zinc-500">
                <th className="px-4 py-3 font-medium">التاريخ</th>
                <th className="px-4 py-3 font-medium">التصنيف</th>
                <th className="px-4 py-3 font-medium">الوصف</th>
                <th className="px-4 py-3 font-medium">المبلغ</th>
                <th className="px-4 py-3 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-b border-zinc-50 hover:bg-zinc-50/60">
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-600" dir="ltr">{e.date}</td>
                  <td className="px-4 py-3 font-medium text-zinc-900">{e.category}</td>
                  <td className="px-4 py-3 text-zinc-600">{e.description || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap font-semibold" dir="ltr">{formatCurrency(e.amount, currencySymbol)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => { setEditingExpense(e); setFormOpen(true); }} title="تعديل" className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900">
                        <Pencil size={16} />
                      </button>
                      <button type="button" onClick={() => setDeletingExpense(e)} title="حذف" className="rounded-lg p-1.5 text-zinc-500 hover:bg-red-50 hover:text-red-600">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-zinc-200 bg-zinc-50 font-bold text-zinc-900">
                <td colSpan={3} className="px-4 py-3">الإجمالي (هذه الصفحة)</td>
                <td className="px-4 py-3 whitespace-nowrap" dir="ltr">{formatCurrency(totalAmount, currencySymbol)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={(p) => updateParams({ page: String(p) })} />

      <ExpenseFormModal open={formOpen} onClose={() => setFormOpen(false)} expense={editingExpense} onSaved={() => router.refresh()} />

      <ConfirmDialog
        open={!!deletingExpense}
        onClose={() => setDeletingExpense(null)}
        onConfirm={handleDelete}
        title="حذف المصروف"
        description={`هل أنت متأكد من حذف مصروف "${deletingExpense?.category}"؟`}
      />
    </div>
  );
}
