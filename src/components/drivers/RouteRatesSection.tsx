"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Route } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RouteRateFormModal, type RouteRateRecord } from "./RouteRateFormModal";
import { deleteRouteRate } from "@/app/(dashboard)/drivers/route-rates-actions";
import { formatCurrency } from "@/lib/format";

export function RouteRatesSection({
  driverId,
  rates,
  currencySymbol,
}: {
  driverId: string;
  rates: RouteRateRecord[];
  currencySymbol: string;
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<RouteRateRecord | null>(null);
  const [deletingRate, setDeletingRate] = useState<RouteRateRecord | null>(null);

  const handleDelete = async () => {
    if (!deletingRate) return;
    const result = await deleteRouteRate(driverId, deletingRate.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("تم حذف خط السير");
      setDeletingRate(null);
      router.refresh();
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-zinc-900">ترب خطوط السير</h3>
          <p className="text-xs text-zinc-400">
            عند اختيار السائق وكتابة نفس مدينتي التحميل والتنزيل في رحلة جديدة، يُملأ الترب تلقائياً
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingRate(null);
            setFormOpen(true);
          }}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          <Plus size={14} />
          إضافة خط سير
        </button>
      </div>

      {rates.length === 0 ? (
        <div className="flex flex-col items-center gap-1 py-6 text-center">
          <Route size={20} className="text-zinc-300" />
          <p className="text-xs text-zinc-400">لا توجد خطوط سير محدَّدة بعد</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-zinc-100">
          {rates.map((r) => (
            <div key={r.id} className="flex items-center justify-between py-2.5">
              <div className="text-sm text-zinc-800">
                {r.from_city} <span className="text-zinc-400">←</span> {r.to_city}
                {r.notes && <span className="mr-2 text-xs text-zinc-400">({r.notes})</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-zinc-900" dir="ltr">
                  {formatCurrency(r.trab_amount, currencySymbol)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingRate(r);
                    setFormOpen(true);
                  }}
                  className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingRate(r)}
                  className="rounded-lg p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <RouteRateFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        driverId={driverId}
        rate={editingRate}
        onSaved={() => router.refresh()}
      />

      <ConfirmDialog
        open={!!deletingRate}
        onClose={() => setDeletingRate(null)}
        onConfirm={handleDelete}
        title="حذف خط السير"
        description={`هل أنت متأكد من حذف خط السير "${deletingRate?.from_city} ← ${deletingRate?.to_city}"؟`}
      />
    </div>
  );
}
