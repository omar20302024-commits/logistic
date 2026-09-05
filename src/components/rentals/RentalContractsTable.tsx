"use client";

import { useState, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Home } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RentalContractFormModal, type RentalContractRecord } from "./RentalContractFormModal";
import { deleteRentalContract } from "@/app/(dashboard)/rentals/actions";
import { formatCurrency } from "@/lib/format";
import { monthLabels } from "@/lib/validation/salary";

type Option = { id: string; name: string };

type Row = RentalContractRecord & { driver_name: string; company_name: string; housing_unit_name: string | null };

export function RentalContractsTable({
  contracts,
  drivers,
  companies,
  housingUnits,
  currencySymbol,
  filters,
}: {
  contracts: Row[];
  drivers: Option[];
  companies: Option[];
  housingUnits: Option[];
  currencySymbol: string;
  filters: { month: string; year: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [formOpen, setFormOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<RentalContractRecord | null>(null);
  const [deletingContract, setDeletingContract] = useState<Row | null>(null);

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([k, v]) => (v ? params.set(k, v) : params.delete(k)));
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const handleDelete = async () => {
    if (!deletingContract) return;
    const result = await deleteRentalContract(deletingContract.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("تم حذف عقد الإيجار");
      setDeletingContract(null);
      router.refresh();
    }
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-zinc-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <select value={filters.month} onChange={(e) => updateParams({ month: e.target.value })} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900">
            <option value="">كل الأشهر</option>
            {monthLabels.map((label, i) => <option key={i + 1} value={i + 1}>{label}</option>)}
          </select>
          <select value={filters.year} onChange={(e) => updateParams({ year: e.target.value })} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900">
            <option value="">كل السنوات</option>
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button
          type="button"
          onClick={() => { setEditingContract(null); setFormOpen(true); }}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          <Plus size={16} /> إضافة عقد إيجار
        </button>
      </div>

      {contracts.length === 0 ? (
        <EmptyState icon={Home} title="لا توجد عقود إيجار مسجَّلة" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-right text-xs text-zinc-500">
                <th className="px-4 py-3 font-medium">السائق</th>
                <th className="px-4 py-3 font-medium">الشركة</th>
                <th className="px-4 py-3 font-medium">المدينة</th>
                <th className="px-4 py-3 font-medium">الشهر/السنة</th>
                <th className="px-4 py-3 font-medium">الإيجار</th>
                <th className="px-4 py-3 font-medium">السكن</th>
                <th className="px-4 py-3 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id} className="border-b border-zinc-50 hover:bg-zinc-50/60">
                  <td className="px-4 py-3 font-medium text-zinc-900">{c.driver_name}</td>
                  <td className="px-4 py-3 text-zinc-600">{c.company_name}</td>
                  <td className="px-4 py-3 text-zinc-600">{c.city || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-600">{monthLabels[c.month - 1]} {c.year}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-700" dir="ltr">{formatCurrency(c.monthly_amount, currencySymbol)}</td>
                  <td className="px-4 py-3 text-zinc-600">{c.housing_unit_name || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => { setEditingContract(c); setFormOpen(true); }} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900">
                        <Pencil size={16} />
                      </button>
                      <button type="button" onClick={() => setDeletingContract(c)} className="rounded-lg p-1.5 text-zinc-500 hover:bg-red-50 hover:text-red-600">
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

      <RentalContractFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        contract={editingContract}
        drivers={drivers}
        companies={companies}
        housingUnits={housingUnits}
        onSaved={() => router.refresh()}
      />

      <ConfirmDialog
        open={!!deletingContract}
        onClose={() => setDeletingContract(null)}
        onConfirm={handleDelete}
        title="حذف عقد الإيجار"
        description={`هل أنت متأكد من حذف عقد "${deletingContract?.driver_name}" لشهر ${deletingContract ? monthLabels[deletingContract.month - 1] : ""} ${deletingContract?.year}؟`}
      />
    </div>
  );
}
