"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { BranchFormModal } from "./BranchFormModal";
import { deleteBranch } from "@/app/(dashboard)/companies/branch-actions";
import type { BranchRecord } from "@/lib/validation/branch";

export function BranchesSection({
  companyId,
  branches,
}: {
  companyId: string;
  branches: BranchRecord[];
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BranchRecord | null>(null);
  const [deleting, setDeleting] = useState<BranchRecord | null>(null);

  const handleDelete = async () => {
    if (!deleting) return;
    const result = await deleteBranch(companyId, deleting.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("تم حذف الفرع");
    setDeleting(null);
    router.refresh();
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-zinc-900">الفروع</h3>
          <p className="text-xs text-zinc-400">
            الكود مميز داخل هذه الشركة فقط، ويظهر كاقتراح في مواقع الرحلة
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          <Plus size={14} />
          إضافة فرع
        </button>
      </div>

      {branches.length === 0 ? (
        <p className="py-4 text-center text-xs text-zinc-400">لا توجد فروع مسجَّلة</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-right text-xs text-zinc-500">
                <th className="py-2 font-medium">الكود</th>
                <th className="py-2 font-medium">الاسم</th>
                <th className="py-2 font-medium">المدينة</th>
                <th className="py-2 font-medium">الهاتف</th>
                <th className="py-2 font-medium">الحالة</th>
                <th className="py-2 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {branches.map((b) => (
                <tr key={b.id} className="hover:bg-zinc-50/60">
                  <td className="py-2 font-medium text-zinc-900" dir="ltr">
                    {b.branch_code}
                  </td>
                  <td className="py-2 text-zinc-700">{b.branch_name ?? "—"}</td>
                  <td className="py-2 text-zinc-600">{b.city ?? "—"}</td>
                  <td className="py-2 text-zinc-600" dir="ltr">
                    {b.phone ?? "—"}
                  </td>
                  <td className="py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        b.is_active
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {b.is_active ? "نشط" : "غير نشط"}
                    </span>
                  </td>
                  <td className="py-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(b);
                          setFormOpen(true);
                        }}
                        className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(b)}
                        className="rounded-lg p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <BranchFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        companyId={companyId}
        branch={editing}
        onSaved={() => router.refresh()}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="حذف الفرع"
        description={`سيُحذف الفرع ${deleting?.branch_code ?? ""} من السجل. الرحلات السابقة تحتفظ بكوده المكتوب عليها ولا تتأثر أرقامها.`}
      />
    </div>
  );
}
