"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Droplet } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  createOilChange,
  updateOilChange,
  deleteOilChange,
  type OilChangeRecord,
} from "@/app/(dashboard)/drivers/oil-actions";

export function OilChangeSection({
  driverId,
  entries,
  currencySymbol,
}: {
  driverId: string;
  entries: OilChangeRecord[];
  currencySymbol: string;
}) {
  const router = useRouter();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<OilChangeRecord | null>(null);
  const [deleting, setDeleting] = useState<OilChangeRecord | null>(null);
  const [saving, setSaving] = useState(false);

  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const total = entries.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const openForm = (entry: OilChangeRecord | null) => {
    setEditing(entry);
    setDate(entry?.date ?? new Date().toISOString().slice(0, 10));
    setAmount(entry ? String(entry.amount) : "");
    setNotes(entry?.notes ?? "");
    setFormOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = { date, amount: Number(amount) || 0, notes };
    const result = editing
      ? await updateOilChange(driverId, editing.id, payload)
      : await createOilChange(driverId, payload);
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(editing ? "تم تعديل تغيير الزيت" : "تم تسجيل تغيير الزيت");
    setFormOpen(false);
    router.refresh();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const result = await deleteOilChange(driverId, deleting.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("تم الحذف");
    setDeleting(null);
    router.refresh();
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-zinc-900">
            <Droplet size={15} />
            تغيير الزيت
          </h3>
          <p className="text-xs text-zinc-400">
            مبلغ وتاريخ — يُخصم من الربح ضمن مصروفات الشركة
          </p>
        </div>
        <button
          type="button"
          onClick={() => openForm(null)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          <Plus size={15} /> تغيير زيت
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-lg bg-zinc-50 px-3 py-2.5 text-xs text-zinc-500">
          لا توجد عمليات تغيير زيت مسجَّلة لهذا السائق.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-right text-xs text-zinc-500">
                <th className="py-2 font-medium">التاريخ</th>
                <th className="py-2 font-medium">المبلغ</th>
                <th className="py-2 font-medium">ملاحظات</th>
                <th className="py-2 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="py-2 whitespace-nowrap text-zinc-700" dir="ltr">
                    {e.date}
                  </td>
                  <td className="py-2 whitespace-nowrap font-medium text-zinc-900" dir="ltr">
                    {formatCurrency(e.amount, currencySymbol)}
                  </td>
                  <td className="py-2 text-zinc-500">{e.notes || "—"}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openForm(e)}
                        className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(e)}
                        className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-zinc-200 font-bold text-zinc-900">
                <td className="py-2">الإجمالي ({formatNumber(entries.length)})</td>
                <td className="py-2 whitespace-nowrap" dir="ltr">
                  {formatCurrency(total, currencySymbol)}
                </td>
                <td className="py-2" colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "تعديل تغيير الزيت" : "تسجيل تغيير زيت"}
        maxWidth="max-w-sm"
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">التاريخ *</label>
              <input
                type="date"
                dir="ltr"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">المبلغ *</label>
              <input
                type="number"
                step="0.01"
                dir="ltr"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">ملاحظات</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
            />
          </div>

          <p className="text-[11px] text-zinc-400">
            هذا مصروف شركة مباشر — لا يُضاف لمستحقات السائق. أما ما يدفعه من عهدته أو من
            جيبه فيُسجَّل في قسم العهدة ببند «صيانة» ليُحسب له عند التصفية.
          </p>

          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {saving ? "جارٍ الحفظ..." : "حفظ"}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="حذف تغيير الزيت"
        description={`سيُحذف مصروف ${deleting?.date ?? ""} ويعود الربح بقيمته.`}
      />
    </div>
  );
}
