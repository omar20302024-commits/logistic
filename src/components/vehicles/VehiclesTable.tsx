"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Truck } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { VehicleFormModal } from "./VehicleFormModal";
import { deleteVehicle } from "@/app/(dashboard)/vehicles/actions";
import {
  vehicleStatusLabels,
  type VehicleRecord,
  type VehicleTypeRecord,
} from "@/lib/validation/vehicle";

const statusColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  inactive: "bg-zinc-100 text-zinc-500",
  maintenance: "bg-amber-100 text-amber-700",
};

export function VehiclesTable({
  vehicles,
  types,
}: {
  vehicles: VehicleRecord[];
  types: VehicleTypeRecord[];
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<VehicleRecord | null>(null);
  const [deleting, setDeleting] = useState<VehicleRecord | null>(null);

  const typeName = (slug: string | null) =>
    slug ? (types.find((t) => t.slug === slug)?.name_ar ?? slug) : "—";

  const handleDelete = async () => {
    if (!deleting) return;
    const result = await deleteVehicle(deleting.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("تم حذف السيارة");
    setDeleting(null);
    router.refresh();
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-100 p-4">
        <h3 className="text-sm font-bold text-zinc-900">السيارات</h3>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          <Plus size={16} />
          إضافة سيارة
        </button>
      </div>

      {vehicles.length === 0 ? (
        <EmptyState icon={Truck} title="لا توجد سيارات مسجَّلة" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-right text-xs text-zinc-500">
                <th className="px-4 py-3 font-medium">رقم السيارة</th>
                <th className="px-4 py-3 font-medium">اللوحة</th>
                <th className="px-4 py-3 font-medium">النوع</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
                <th className="px-4 py-3 font-medium">ملاحظات</th>
                <th className="px-4 py-3 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id} className="border-b border-zinc-50 hover:bg-zinc-50/60">
                  <td className="px-4 py-3 font-medium text-zinc-900" dir="ltr">
                    {v.vehicle_no}
                  </td>
                  <td className="px-4 py-3 text-zinc-600" dir="ltr">
                    {v.plate_no ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{typeName(v.type_slug)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColors[v.status]}`}
                    >
                      {vehicleStatusLabels[v.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{v.notes ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(v);
                          setFormOpen(true);
                        }}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(v)}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <VehicleFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        vehicle={editing}
        types={types}
        onSaved={() => router.refresh()}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="حذف السيارة"
        description={`ستُحذف السيارة ${deleting?.vehicle_no ?? ""}. الرحلات والسائقون المرتبطون بها يفقدون الربط فقط، وتحتفظ الرحلات بنوع السيارة المسجَّل عليها وقت تنفيذها.`}
      />
    </div>
  );
}
