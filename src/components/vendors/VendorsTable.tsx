"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Printer, Handshake } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { createVendor, updateVendor, deleteVendor } from "@/app/(dashboard)/vendors/actions";
import {
  vendorStatusLabels,
  type VendorRecord,
  type VendorReportRow,
} from "@/lib/validation/vendor";

export function VendorsTable({
  rows,
  vendors,
  from,
  to,
  currencySymbol,
}: {
  rows: VendorReportRow[];
  vendors: VendorRecord[];
  from: string;
  to: string;
  currencySymbol: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<VendorRecord | null>(null);
  const [deleting, setDeleting] = useState<VendorRecord | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");

  const handleChange = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => (v ? params.set(k, v) : params.delete(k)));
    router.push(`${pathname}?${params.toString()}`);
  };

  const openForm = (vendor: VendorRecord | null) => {
    setEditing(vendor);
    setName(vendor?.name ?? "");
    setPhone(vendor?.phone ?? "");
    setStatus(vendor?.status ?? "active");
    setFormOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = { name, phone, status, notes: "" };
    const result = editing ? await updateVendor(editing.id, payload) : await createVendor(payload);
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(editing ? "تم تعديل المورّد" : "تم إضافة المورّد");
    setFormOpen(false);
    router.refresh();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const result = await deleteVendor(deleting.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("تم حذف المورّد");
    setDeleting(null);
    router.refresh();
  };

  const totals = rows.reduce(
    (acc, r) => ({
      trips: acc.trips + r.trips_count,
      client: acc.client + r.total_client_amount,
      cost: acc.cost + r.total_vendor_cost,
      profit: acc.profit + r.total_profit,
      unsettled: acc.unsettled + r.unsettled_cost,
    }),
    { trips: 0, client: 0, cost: 0, profit: 0, unsettled: 0 }
  );

  const vendorById = new Map(vendors.map((v) => [v.id, v]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm print:hidden">
        <Field label="من تاريخ">
          <input
            type="date"
            value={from}
            dir="ltr"
            onChange={(e) => handleChange({ from: e.target.value })}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          />
        </Field>
        <Field label="إلى تاريخ">
          <input
            type="date"
            value={to}
            dir="ltr"
            onChange={(e) => handleChange({ to: e.target.value })}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          />
        </Field>

        <div className="mr-auto flex items-center gap-2">
          <button
            onClick={() => window.print()}
            type="button"
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <Printer size={15} /> طباعة
          </button>
          <button
            type="button"
            onClick={() => openForm(null)}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            <Plus size={15} /> إضافة مورّد
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {rows.length === 0 ? (
          <EmptyState
            icon={Handshake}
            title="لا يوجد موردون"
            description="أضف مورّداً ثم اربط سائقيه الخارجيين به من صفحة السائق"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-right text-xs text-zinc-500">
                  <th className="px-4 py-3 font-medium">المورّد</th>
                  <th className="px-4 py-3 font-medium">سائقوه</th>
                  <th className="px-4 py-3 font-medium">الرحلات</th>
                  <th className="px-4 py-3 font-medium">على العملاء</th>
                  <th className="px-4 py-3 font-medium">للمورّد</th>
                  <th className="px-4 py-3 font-medium">الربح</th>
                  <th className="px-4 py-3 font-medium">غير مصفّى</th>
                  <th className="px-4 py-3 font-medium print:hidden">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.vendor_id} className="border-b border-zinc-50 hover:bg-zinc-50/60">
                    <td className="px-4 py-3">
                      <Link
                        href={`/vendors/${r.vendor_id}?from=${from}&to=${to}`}
                        className="font-medium text-zinc-900 hover:underline"
                      >
                        {r.vendor_name}
                      </Link>
                      {r.vendor_status === "inactive" && (
                        <span className="mr-1.5 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-500">
                          غير نشط
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-600" dir="ltr">
                      {formatNumber(r.drivers_count)}
                    </td>
                    <td className="px-4 py-3 text-zinc-600" dir="ltr">
                      {formatNumber(r.trips_count)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-zinc-700" dir="ltr">
                      {formatCurrency(r.total_client_amount, currencySymbol)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-zinc-700" dir="ltr">
                      {formatCurrency(r.total_vendor_cost, currencySymbol)}
                    </td>
                    <td
                      className="px-4 py-3 whitespace-nowrap font-semibold text-emerald-700"
                      dir="ltr"
                    >
                      {formatCurrency(r.total_profit, currencySymbol)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-semibold text-zinc-900" dir="ltr">
                      {formatCurrency(r.unsettled_cost, currencySymbol)}
                    </td>
                    <td className="px-4 py-3 print:hidden">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openForm(vendorById.get(r.vendor_id) ?? null)}
                          className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(vendorById.get(r.vendor_id) ?? null)}
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
                <tr className="border-t-2 border-zinc-200 bg-zinc-50 font-bold text-zinc-900">
                  <td className="px-4 py-3">الإجمالي</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3" dir="ltr">
                    {formatNumber(totals.trips)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" dir="ltr">
                    {formatCurrency(totals.client, currencySymbol)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" dir="ltr">
                    {formatCurrency(totals.cost, currencySymbol)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-emerald-700" dir="ltr">
                    {formatCurrency(totals.profit, currencySymbol)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" dir="ltr">
                    {formatCurrency(totals.unsettled, currencySymbol)}
                  </td>
                  <td className="px-4 py-3 print:hidden" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-zinc-400 print:hidden">
        هذه الصفحة داخلية وفيها سعر العميل والربح. أما الكشف الذي يُسلَّم للمورّد فيُطبع من
        صفحته، ولا يحتوي سعر العميل ولا الربح إطلاقاً.
      </p>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "تعديل المورّد" : "إضافة مورّد"}
        maxWidth="max-w-sm"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">الاسم *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">الهاتف</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                dir="ltr"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">الحالة</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
              >
                {Object.entries(vendorStatusLabels).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-[11px] text-zinc-400">
            بعد الحفظ، اربط سائقيه الخارجيين به من صفحة كل سائق.
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
        title="حذف المورّد"
        description={`سيُحذف «${deleting?.name ?? ""}». سائقوه ورحلاتهم تبقى كما هي ويفقدون الربط به فقط.`}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-zinc-500">{label}</label>
      {children}
    </div>
  );
}
