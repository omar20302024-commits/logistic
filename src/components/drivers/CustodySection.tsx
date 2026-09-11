"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  CustodyFormModal,
  type CustodyRecord,
  type CustodyTripOption,
} from "./CustodyFormModal";
import { deleteCustodyEntry } from "@/app/(dashboard)/drivers/custody-actions";
import { custodyReasonLabels } from "@/lib/validation/custody";
import { formatCurrency } from "@/lib/format";

export function CustodySection({
  driverId,
  entries,
  balance,
  trips,
  currencySymbol,
}: {
  driverId: string;
  entries: CustodyRecord[];
  balance: number;
  trips: CustodyTripOption[];
  currencySymbol: string;
}) {
  const router = useRouter();

  const [formOpen, setFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CustodyRecord | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<CustodyRecord | null>(null);

  const handleDelete = async () => {
    if (!deletingEntry) return;
    const result = await deleteCustodyEntry(driverId, deletingEntry.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("تم حذف الحركة");
      setDeletingEntry(null);
      router.refresh();
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-zinc-900">العهدة</h3>
          <p className={`text-xs ${balance > 0 ? "text-amber-600" : balance < 0 ? "text-red-600" : "text-zinc-400"}`}>
            {balance > 0
              ? `الرصيد الحالي: ${formatCurrency(balance, currencySymbol)} (مستحق على السائق)`
              : balance < 0
                ? `الرصيد الحالي: ${formatCurrency(Math.abs(balance), currencySymbol)} (مستحق للسائق)`
                : "الرصيد صفر"}
          </p>
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
          إضافة حركة
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="py-4 text-center text-xs text-zinc-400">لا توجد حركات عهدة</p>
      ) : (
        <div className="flex flex-col divide-y divide-zinc-100">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-2">
                {entry.type === "credit" ? (
                  <ArrowDownCircle size={16} className="text-emerald-600" />
                ) : (
                  <ArrowUpCircle size={16} className="text-red-500" />
                )}
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm text-zinc-800" dir="ltr">
                      {entry.date}
                    </span>
                    {entry.expense_category && (
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
                        {entry.expense_category}
                      </span>
                    )}
                    {entry.settlement_id && (
                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                        مُصفّى
                      </span>
                    )}
                    {entry.reason === "unspecified" && (
                      <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                        غير مصنّف
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-400">
                    {entry.reason && entry.reason !== "unspecified"
                      ? custodyReasonLabels[entry.reason]
                      : null}
                    {entry.description ? ` — ${entry.description}` : ""}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-semibold ${
                    entry.type === "credit" ? "text-emerald-700" : "text-red-600"
                  }`}
                  dir="ltr"
                >
                  {entry.type === "credit" ? "+" : "−"}
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

      <CustodyFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        driverId={driverId}
        entry={editingEntry}
        trips={trips}
        currencySymbol={currencySymbol}
        onSaved={() => router.refresh()}
      />

      <ConfirmDialog
        open={!!deletingEntry}
        onClose={() => setDeletingEntry(null)}
        onConfirm={handleDelete}
        title="حذف حركة العهدة"
        description="هل أنت متأكد من حذف هذه الحركة؟"
      />
    </div>
  );
}
