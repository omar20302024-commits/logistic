"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Fuel, AlertTriangle } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MonthlyDieselFormModal } from "./MonthlyDieselFormModal";
import { deleteMonthlyDiesel, getDieselOverlaps } from "@/app/(dashboard)/diesel/actions";
import { formatCurrency } from "@/lib/format";
import { monthLabels } from "@/lib/validation/salary";
import type { DieselOverlap, MonthlyDieselRecord } from "@/lib/validation/monthlyDiesel";

type DriverOption = { id: string; name: string };

export function MonthlyDieselTable({
  records,
  drivers,
  currencySymbol,
  filters,
}: {
  records: MonthlyDieselRecord[];
  drivers: DriverOption[];
  currencySymbol: string;
  filters: { year: number; month: number };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MonthlyDieselRecord | null>(null);
  const [deleting, setDeleting] = useState<MonthlyDieselRecord | null>(null);
  const [overlaps, setOverlaps] = useState<DieselOverlap[]>([]);

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([k, v]) => (v ? params.set(k, v) : params.delete(k)));
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  // فحص الازدواج مع كل تغيير في الشهر المعروض
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getDieselOverlaps(filters.year, filters.month);
      if (cancelled) return;
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setOverlaps(res.overlaps);
    })();
    return () => {
      cancelled = true;
    };
  }, [filters.year, filters.month, records]);

  const handleDelete = async () => {
    if (!deleting) return;
    const result = await deleteMonthlyDiesel(deleting.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("تم حذف السجل");
    setDeleting(null);
    router.refresh();
  };

  const total = records.reduce((sum, r) => sum + Number(r.amount), 0);
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-zinc-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filters.month}
            onChange={(e) => updateParams({ month: e.target.value })}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          >
            {monthLabels.map((label, i) => (
              <option key={i + 1} value={i + 1}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={filters.year}
            onChange={(e) => updateParams({ year: e.target.value })}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          <Plus size={16} />
          تسجيل ديزل
        </button>
      </div>

      {overlaps.length > 0 && (
        <div className="border-b border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-2 text-sm text-amber-800">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">تنبيه: الديزل قد يُحتسب مرتين</p>
              <p className="mt-1 text-xs">
                هؤلاء السائقون لهم ديزل مسجَّل على رحلاتهم في هذا الشهر، ولهم كذلك سجل ديزل شهري.
                راجع أيهما الصحيح — الاثنان يُخصمان من الربح.
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-xs">
                {overlaps.map((o) => (
                  <li key={o.driver_id} className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{o.driver_name}</span>
                    <span dir="ltr">
                      رحلات: {formatCurrency(o.trips_diesel, currencySymbol)} · شهري:{" "}
                      {formatCurrency(o.monthly_diesel, currencySymbol)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {records.length === 0 ? (
        <EmptyState icon={Fuel} title="لا يوجد ديزل مسجَّل لهذا الشهر" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-right text-xs text-zinc-500">
                <th className="px-4 py-3 font-medium">السائق</th>
                <th className="px-4 py-3 font-medium">المبلغ</th>
                <th className="px-4 py-3 font-medium">ملاحظات</th>
                <th className="px-4 py-3 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-zinc-50 hover:bg-zinc-50/60">
                  <td className="px-4 py-3 font-medium text-zinc-900">{r.driver_name ?? "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-700" dir="ltr">
                    {formatCurrency(r.amount, currencySymbol)}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{r.notes ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(r);
                          setFormOpen(true);
                        }}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(r)}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              <tr className="bg-zinc-50 font-semibold text-zinc-900">
                <td className="px-4 py-3">الإجمالي</td>
                <td className="px-4 py-3 whitespace-nowrap" dir="ltr">
                  {formatCurrency(total, currencySymbol)}
                </td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <MonthlyDieselFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        record={editing}
        drivers={drivers}
        defaultYear={filters.year}
        defaultMonth={filters.month}
        onSaved={() => router.refresh()}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="حذف سجل الديزل"
        description={`سيُحذف ديزل ${deleting?.driver_name ?? ""} لهذا الشهر. هل تريد المتابعة؟`}
      />
    </div>
  );
}
