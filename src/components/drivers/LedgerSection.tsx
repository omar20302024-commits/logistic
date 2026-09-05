"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LedgerFormModal, type LedgerRecord } from "./LedgerFormModal";
import { deleteLedgerEntry, type LedgerType } from "@/app/(dashboard)/drivers/ledger-actions";
import { formatCurrency } from "@/lib/format";

export function LedgerSection({
  type,
  driverId,
  entries,
  currencySymbol,
}: {
  type: LedgerType;
  driverId: string;
  entries: LedgerRecord[];
  currencySymbol: string;
}) {
  const router = useRouter();
  const title = type === "advance" ? "السلف" : "الخصومات";
  const singular = type === "advance" ? "سلفة" : "خصم";

  const [formOpen, setFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LedgerRecord | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<LedgerRecord | null>(null);

  const total = entries.reduce((sum, e) => sum + Number(e.amount), 0);

  const handleDelete = async () => {
    if (!deletingEntry) return;
    const result = await deleteLedgerEntry(type, driverId, deletingEntry.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`تم حذف ${singular}`);
      setDeletingEntry(null);
      router.refresh();
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-zinc-900">{title}</h3>
          <p className="text-xs text-zinc-400">الإجمالي: {formatCurrency(total, currencySymbol)}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingEntry(null);
            setFormOpen(true);
          }}
          className="flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          <Plus size={14} />
          إضافة {singular}
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="py-4 text-center text-xs text-zinc-400">لا توجد سجلات</p>
      ) : (
        <div className="flex flex-col divide-y divide-zinc-100">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between py-2.5">
              <div>
                <div className="text-sm text-zinc-800" dir="ltr">
                  {entry.date}
                </div>
                {entry.description && (
                  <div className="text-xs text-zinc-400">{entry.description}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold text-zinc-900" dir="ltr">
                  {formatCurrency(entry.amount, currencySymbol)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingEntry(entry);
                    setFormOpen(true);
                  }}
                  className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingEntry(entry)}
                  className="rounded-lg p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <LedgerFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        type={type}
        driverId={driverId}
        entry={editingEntry}
        onSaved={() => router.refresh()}
      />

      <ConfirmDialog
        open={!!deletingEntry}
        onClose={() => setDeletingEntry(null)}
        onConfirm={handleDelete}
        title={`حذف ${singular}`}
        description={`هل أنت متأكد من حذف هذا الـ${singular}؟`}
      />
    </div>
  );
}
