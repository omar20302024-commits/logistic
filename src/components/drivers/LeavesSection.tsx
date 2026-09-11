"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, CalendarOff } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LeaveFormModal } from "./LeaveFormModal";
import { deleteLeave } from "@/app/(dashboard)/drivers/leave-actions";
import { leaveDayCount, type LeaveRecord } from "@/lib/validation/leave";

export function LeavesSection({
  driverId,
  leaves,
}: {
  driverId: string;
  leaves: LeaveRecord[];
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveRecord | null>(null);
  const [deleting, setDeleting] = useState<LeaveRecord | null>(null);

  const openLeave = leaves.find((l) => !l.to_date);

  const handleDelete = async () => {
    if (!deleting) return;
    const result = await deleteLeave(driverId, deleting.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("تم حذف الإجازة");
    setDeleting(null);
    router.refresh();
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-zinc-900">الإجازات</h3>
          <p className="text-xs text-zinc-400">
            كل يوم إجازة يُخصم من الراتب — الشهر 30 يوماً دائماً
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
          تسجيل إجازة
        </button>
      </div>

      {openLeave && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <CalendarOff size={14} className="mt-0.5 shrink-0" />
          <span>
            <span className="font-semibold">السائق في إجازة مفتوحة</span> منذ{" "}
            <span dir="ltr">{openLeave.from_date}</span> — رواتب كل الأشهر من هذا التاريخ ستكون
            صفراً حتى تحدّد تاريخ رجوعه.
          </span>
        </div>
      )}

      {leaves.length === 0 ? (
        <p className="py-4 text-center text-xs text-zinc-400">لا توجد إجازات مسجَّلة</p>
      ) : (
        <div className="flex flex-col divide-y divide-zinc-100">
          {leaves.map((leave) => {
            const days = leaveDayCount(leave.from_date, leave.to_date);
            return (
              <div key={leave.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm text-zinc-800" dir="ltr">
                    {leave.from_date} ← {leave.to_date ?? "مفتوحة"}
                  </div>
                  <div className="text-xs text-zinc-400">
                    {days !== null ? `${days} يوماً` : "بلا تاريخ رجوع"}
                    {leave.notes ? ` — ${leave.notes}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(leave);
                      setFormOpen(true);
                    }}
                    className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(leave)}
                    className="rounded-lg p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <LeaveFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        driverId={driverId}
        leave={editing}
        onSaved={() => router.refresh()}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="حذف الإجازة"
        description="سيُعاد احتساب رواتب الأشهر التي كانت تغطيها هذه الإجازة بالكامل. هل تريد المتابعة؟"
      />
    </div>
  );
}
