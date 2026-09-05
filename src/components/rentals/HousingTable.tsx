"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Home } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { HousingFormModal, type HousingUnitRecord } from "./HousingFormModal";
import { deleteHousingUnit } from "@/app/(dashboard)/rentals/housing/actions";
import { formatCurrency } from "@/lib/format";

export function HousingTable({
  units,
  currencySymbol,
}: {
  units: HousingUnitRecord[];
  currencySymbol: string;
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<HousingUnitRecord | null>(null);
  const [deletingUnit, setDeletingUnit] = useState<HousingUnitRecord | null>(null);

  const handleDelete = async () => {
    if (!deletingUnit) return;
    const result = await deleteHousingUnit(deletingUnit.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("تم حذف وحدة السكن");
      setDeletingUnit(null);
      router.refresh();
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-100 p-4">
        <p className="text-sm text-zinc-500">
          كل وحدة سكن ممكن تتشارك فيها أكتر من عقد إيجار — التكلفة بتتقسم بينهم تلقائياً في تقرير الربحية
        </p>
        <button
          type="button"
          onClick={() => {
            setEditingUnit(null);
            setFormOpen(true);
          }}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          <Plus size={16} /> إضافة وحدة سكن
        </button>
      </div>

      {units.length === 0 ? (
        <EmptyState icon={Home} title="لا توجد وحدات سكن مسجَّلة" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-right text-xs text-zinc-500">
                <th className="px-4 py-3 font-medium">الاسم</th>
                <th className="px-4 py-3 font-medium">المدينة</th>
                <th className="px-4 py-3 font-medium">الإيجار الشهري</th>
                <th className="px-4 py-3 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr key={u.id} className="border-b border-zinc-50 hover:bg-zinc-50/60">
                  <td className="px-4 py-3 font-medium text-zinc-900">{u.name}</td>
                  <td className="px-4 py-3 text-zinc-600">{u.city || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-700" dir="ltr">
                    {formatCurrency(u.monthly_rent, currencySymbol)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => { setEditingUnit(u); setFormOpen(true); }} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900">
                        <Pencil size={16} />
                      </button>
                      <button type="button" onClick={() => setDeletingUnit(u)} className="rounded-lg p-1.5 text-zinc-500 hover:bg-red-50 hover:text-red-600">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <HousingFormModal open={formOpen} onClose={() => setFormOpen(false)} unit={editingUnit} onSaved={() => router.refresh()} />

      <ConfirmDialog
        open={!!deletingUnit}
        onClose={() => setDeletingUnit(null)}
        onConfirm={handleDelete}
        title="حذف وحدة السكن"
        description={`هل أنت متأكد من حذف "${deletingUnit?.name}"؟ أي عقود إيجار مرتبطة بيها هتفضل موجودة لكن من غير سكن مرتبط.`}
      />
    </div>
  );
}
