"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, FileText, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SettlementFormModal } from "./SettlementFormModal";
import { deleteSettlement } from "@/app/(dashboard)/drivers/settlement-actions";
import { formatCurrency } from "@/lib/format";
import type { SettlementRecord } from "@/lib/validation/settlement";

export function SettlementsSection({
  driverId,
  driverName,
  settlements,
  currencySymbol,
}: {
  driverId: string;
  driverName: string;
  settlements: SettlementRecord[];
  currencySymbol: string;
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<SettlementRecord | null>(null);

  const handleDelete = async () => {
    if (!deleting) return;
    const result = await deleteSettlement(driverId, deleting.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("تم إلغاء التصفية وإرجاع عناصرها");
    setDeleting(null);
    router.refresh();
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-zinc-900">تصفيات التربات</h3>
          <p className="text-xs text-zinc-400">
            سندات التصفية بأرقام مجمّدة وقت الصرف — الراتب يبقى مستقلاً عنها
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-1 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"
        >
          <Plus size={14} />
          تصفية جديدة
        </button>
      </div>

      {settlements.length === 0 ? (
        <p className="py-4 text-center text-xs text-zinc-400">لا توجد تصفيات سابقة</p>
      ) : (
        <div className="flex flex-col divide-y divide-zinc-100">
          {settlements.map((st) => (
            <div key={st.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-900" dir="ltr">
                    {st.settlement_number}
                  </span>
                  <span className="text-xs text-zinc-400" dir="ltr">
                    {st.from_date} ← {st.to_date}
                  </span>
                </div>
                <div className="text-xs text-zinc-500">
                  {st.trips_count} رحلة · صُرف في <span dir="ltr">{st.settled_on}</span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`text-sm font-bold ${
                    st.net_amount < 0 ? "text-red-600" : "text-emerald-700"
                  }`}
                  dir="ltr"
                >
                  {formatCurrency(st.net_amount, currencySymbol)}
                </span>
                <Link
                  href={`/settlements/${st.id}`}
                  className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
                  title="عرض السند"
                >
                  <FileText size={14} />
                </Link>
                <button
                  type="button"
                  onClick={() => setDeleting(st)}
                  className="rounded-lg p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                  title="إلغاء التصفية"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <SettlementFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        driverId={driverId}
        currencySymbol={currencySymbol}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="إلغاء التصفية"
        description={`سيُحذف سند ${deleting?.settlement_number ?? ""} الخاص بـ${driverName}، وترجع رحلاته وحركات عهدته قابلة للتصفية مرة أخرى، وتعود سلفه وخصوماته للخصم من الراتب. هل تريد المتابعة؟`}
      />
    </div>
  );
}
