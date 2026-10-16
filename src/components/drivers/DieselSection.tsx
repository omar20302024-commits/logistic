"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Fuel } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  createDieselEntry,
  updateDieselEntry,
  deleteDieselEntry,
  zeroTripDieselForMonth,
  type DieselEntryRecord,
  type DieselOverlap,
} from "@/app/(dashboard)/drivers/diesel-actions";

const MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export function DieselSection({
  driverId,
  entries,
  overlaps,
  currencySymbol,
}: {
  driverId: string;
  entries: DieselEntryRecord[];
  /**
   * شهور اجتمع فيها ديزل رحلات قديم وديزل شهري — ازدواج حقيقي يُخصم مرتين.
   *
   * قياسٌ شهرٌ بشهر لا على الإجمالي: النسخة الأولى كانت تنذر لأي سائق عليه
   * رقم قديم حتى بلا ازدواج، وكانت تطلب تصفيره من نموذج الرحلة — وهو لا يحوي
   * حقل ديزل أصلاً، فكانت نصيحة لا تُنفَّذ. الزر هنا هو السبيل الوحيد.
   */
  overlaps: DieselOverlap[];
  currencySymbol: string;
}) {
  const router = useRouter();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DieselEntryRecord | null>(null);
  const [deleting, setDeleting] = useState<DieselEntryRecord | null>(null);
  const [saving, setSaving] = useState(false);

  const [date, setDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [zeroing, setZeroing] = useState<DieselOverlap | null>(null);

  const handleZero = async () => {
    if (!zeroing) return;
    const result = await zeroTripDieselForMonth(driverId, zeroing.year, zeroing.month);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("تم تصفير ديزل الرحلات لذلك الشهر");
    setZeroing(null);
    router.refresh();
  };

  const total = entries.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const openForm = (entry: DieselEntryRecord | null) => {
    setEditing(entry);
    setDate(entry?.date ?? new Date().toISOString().slice(0, 10));
    setToDate(entry?.to_date ?? "");
    setAmount(entry ? String(entry.amount) : "");
    setReference(entry?.reference ?? "");
    setFormOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = { date, toDate: toDate || null, amount: Number(amount) || 0, reference };
    const result = editing
      ? await updateDieselEntry(driverId, editing.id, payload)
      : await createDieselEntry(driverId, payload);
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(editing ? "تم تعديل التفويلة" : "تم تسجيل التفويلة");
    setFormOpen(false);
    router.refresh();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const result = await deleteDieselEntry(driverId, deleting.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("تم حذف التفويلة");
    setDeleting(null);
    router.refresh();
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-zinc-900">
            <Fuel size={15} />
            الديزل
          </h3>
          <p className="text-xs text-zinc-400">
            كل تفويلة بتاريخها ومبلغها — والمجموع الشهري يُحسب منها تلقائياً
          </p>
        </div>
        <button
          type="button"
          onClick={() => openForm(null)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          <Plus size={15} /> تفويلة
        </button>
      </div>

      {overlaps.length > 0 && (
        <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="mb-2">
            <strong>ازدواج ديزل:</strong> الشهور التالية فيها ديزل مسجَّل على الرحلات
            <strong> و</strong> ديزل شهري معاً — والربح يخصم الاثنين. لو كانا لنفس الوقود،
            صفّر ديزل الرحلات القديمة.
          </p>
          <div className="flex flex-col gap-1.5">
            {overlaps.map((o) => (
              <div
                key={`${o.year}-${o.month}`}
                className="flex flex-wrap items-center gap-2 rounded bg-white/70 px-2.5 py-1.5"
              >
                <span className="font-medium">
                  {MONTHS[o.month - 1]} {o.year}
                </span>
                <span dir="ltr">
                  الرحلات {formatCurrency(o.trips_diesel, currencySymbol)} · الشهري{" "}
                  {formatCurrency(o.monthly_diesel, currencySymbol)}
                </span>
                <button
                  type="button"
                  onClick={() => setZeroing(o)}
                  className="mr-auto rounded border border-amber-400 px-2 py-1 text-[11px] font-medium hover:bg-amber-100"
                >
                  صفّر ديزل الرحلات
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <p className="rounded-lg bg-zinc-50 px-3 py-2.5 text-xs text-zinc-500">
          لا توجد تفويلات مسجَّلة لهذا السائق في الفترة المعروضة.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-right text-xs text-zinc-500">
                <th className="py-2 font-medium">التاريخ</th>
                <th className="py-2 font-medium">المبلغ</th>
                <th className="py-2 font-medium">المرجع</th>
                <th className="py-2 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="py-2 whitespace-nowrap text-zinc-700" dir="ltr">
                    {e.to_date ? `${e.date} ← ${e.to_date}` : e.date}
                  </td>
                  <td className="py-2 whitespace-nowrap font-medium text-zinc-900" dir="ltr">
                    {formatCurrency(e.amount, currencySymbol)}
                  </td>
                  <td className="py-2 text-zinc-500">{e.reference || "—"}</td>
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
        title={editing ? "تعديل التفويلة" : "تسجيل تفويلة"}
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
            <label className="text-sm font-medium text-zinc-700">إلى تاريخ (اختياري)</label>
            <input
              type="date"
              dir="ltr"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900"
            />
            <p className="text-[11px] text-zinc-400">
              اتركه فارغاً لتفويلة بتاريخ واحد، أو املأه لاستهلاك فترة — مثل 1‏/10 إلى
              15‏/10 بمبلغ واحد. ويجب أن تكون الفترة داخل شهر واحد.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">المرجع</label>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="رقم العملية إن وُجد"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
            />
          </div>

          <p className="text-[11px] text-zinc-400">
            الديزل مصروف شركة محسوب على السائق — لا يُضاف لمستحقاته ولا يُطالَب به،
            بخلاف ما يدفعه من جيبه فيُسجَّل في العهدة.
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
        title="حذف التفويلة"
        description={`ستُحذف تفويلة ${deleting?.date ?? ""} ويُعاد حساب مجموع الشهر تلقائياً.`}
      />

      <ConfirmDialog
        open={!!zeroing}
        onClose={() => setZeroing(null)}
        onConfirm={handleZero}
        title="تصفير ديزل الرحلات"
        description={
          zeroing
            ? `سيُصفَّر حقل الديزل على كل رحلات هذا السائق في ${MONTHS[zeroing.month - 1]} ${zeroing.year} — ${formatCurrency(zeroing.trips_diesel, currencySymbol)}. يبقى الديزل الشهري كما هو، ولا تتأثر أي بيانات أخرى في الرحلة.`
            : ""
        }
        confirmLabel="تصفير"
      />
    </div>
  );
}
