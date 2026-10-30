"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, PlusCircle } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import {
  createSalaryAddition,
  updateSalaryAddition,
  deleteSalaryAddition,
  type SalaryAddition,
} from "@/app/(dashboard)/drivers/salary-addition-actions";

const MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

/**
 * إضافات على الراتب — ما يزيده، مقابل السلف والخصومات التي تنقصه.
 *
 * أشهر حالاتها: أيام عمل من شهر سابق لم تُصرف. فيُحسب المبلغ من
 * (الراتب الأساسي × الأيام ÷ 30) ويُعرض ليراجعه المستخدم قبل الحفظ —
 * ويبقى له أن يكتب مبلغاً مختلفاً.
 *
 * نفس النموذج يُنشئ ويعدّل: حقول الإضافة قليلة، ونموذجان بنفس الحقول
 * يفترقان مع الوقت.
 */
export function SalaryAdditionsSection({
  driverId,
  basicSalary,
  entries,
  currencySymbol,
}: {
  driverId: string;
  /** الراتب الأساسي للسائق — لحساب قيمة الأيام */
  basicSalary: number;
  entries: SalaryAddition[];
  currencySymbol: string;
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(today);
  const [days, setDays] = useState("");
  const [amount, setAmount] = useState("");
  const [forMonth, setForMonth] = useState(String(prev.getMonth() + 1));
  const [forYear, setForYear] = useState(String(prev.getFullYear()));
  const [reason, setReason] = useState("");

  // قيمة الأيام بنفس قاعدة النظام: الأساسي ÷ 30 × الأيام
  const dayValue = basicSalary / 30;
  const computed = days === "" ? 0 : Math.round(Number(days) * dayValue * 100) / 100;
  const effective = amount !== "" ? Number(amount) : computed;

  const total = entries.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const resetForm = () => {
    setEditingId(null);
    setDate(today);
    setDays("");
    setAmount("");
    setForMonth(String(prev.getMonth() + 1));
    setForYear(String(prev.getFullYear()));
    setReason("");
  };

  const startEdit = (e: SalaryAddition) => {
    setEditingId(e.id);
    setDate(e.date);
    setDays(e.days === null ? "" : String(e.days));
    // المبلغ يُملأ دائماً عند التعديل: المحفوظ هو المرجع، لا ما تحسبه الأيام
    setAmount(String(e.amount));
    setForMonth(e.for_month ? String(e.for_month) : String(prev.getMonth() + 1));
    setForYear(e.for_year ? String(e.for_year) : String(prev.getFullYear()));
    setReason(e.reason ?? "");
    setOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      date,
      amount: effective,
      reason,
      forMonth: Number(forMonth) || null,
      forYear: Number(forYear) || null,
      days: days === "" ? null : Number(days),
    };

    setSaving(true);
    const result = editingId
      ? await updateSalaryAddition(driverId, editingId, payload)
      : await createSalaryAddition(driverId, payload);
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(editingId ? "تم حفظ التعديل" : "تمت إضافة المستحق إلى راتب هذا الشهر");
    setOpen(false);
    resetForm();
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    const result = await deleteSalaryAddition(driverId, id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("تم حذف الإضافة");
    if (editingId === id) {
      setOpen(false);
      resetForm();
    }
    router.refresh();
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-zinc-900">
            <PlusCircle size={15} />
            إضافات على الراتب
            {total > 0 && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                {formatCurrency(total, currencySymbol)}
              </span>
            )}
          </h3>
          <p className="text-xs text-zinc-500">
            مستحقات تُضاف إلى الراتب — أيام عمل من شهر سابق لم تُصرف مثلاً. تدخل مسيّر
            الشهر الذي يقع فيه تاريخها، والسبب يظهر بين قوسين في كشف الحساب.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (open) {
              setOpen(false);
              resetForm();
            } else {
              resetForm();
              setOpen(true);
            }
          }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
        >
          <Plus size={14} />
          {open ? "إغلاق" : "إضافة"}
        </button>
      </div>

      {open && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3">
          {editingId && (
            <p className="text-[11px] font-medium text-amber-700">
              تعديل إضافة قائمة — اضغط «إلغاء التعديل» للرجوع إلى إضافة جديدة.
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-zinc-500">تاريخ الصرف (الشهر الذي تدخله)</label>
              <input
                type="date"
                dir="ltr"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs outline-none focus:border-zinc-900"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-zinc-500">عن شهر</label>
              <select
                value={forMonth}
                onChange={(e) => setForMonth(e.target.value)}
                className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs outline-none focus:border-zinc-900"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={String(i + 1)}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-zinc-500">سنة</label>
              <input
                type="number"
                dir="ltr"
                value={forYear}
                onChange={(e) => setForYear(e.target.value)}
                className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-right text-xs outline-none focus:border-zinc-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-zinc-500">عدد الأيام</label>
              <input
                type="number"
                step="0.5"
                min="0"
                dir="ltr"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                placeholder="مثال: 8"
                className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-right text-xs outline-none focus:border-zinc-900"
              />
              {days !== "" && (
                <span className="text-[11px] text-zinc-500">
                  {formatNumber(Number(days))} يوماً ×{" "}
                  {formatCurrency(dayValue, currencySymbol)} ={" "}
                  <strong>{formatCurrency(computed, currencySymbol)}</strong>
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-zinc-500">المبلغ (اتركه ليُحسب من الأيام)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                dir="ltr"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={computed > 0 ? String(computed) : "0.00"}
                className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-right text-xs outline-none focus:border-zinc-900"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-zinc-500">السبب (يظهر في الكشف)</label>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="أيام عمل متبقية"
                className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs outline-none focus:border-zinc-900"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-zinc-600">
              {editingId ? "سيصير" : "سيُضاف"}:{" "}
              <strong dir="ltr">{formatCurrency(effective || 0, currencySymbol)}</strong>
            </span>
            <div className="flex items-center gap-2">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  إلغاء التعديل
                </button>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !(effective > 0)}
                className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {saving ? "جارٍ الحفظ..." : editingId ? "حفظ التعديل" : "حفظ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <p className="py-3 text-center text-xs text-zinc-400">لا توجد إضافات.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-right text-xs text-zinc-500">
                <th className="px-3 py-2 font-medium">تاريخ الصرف</th>
                <th className="px-3 py-2 font-medium">عن</th>
                <th className="px-3 py-2 font-medium">الأيام</th>
                <th className="px-3 py-2 font-medium">السبب</th>
                <th className="px-3 py-2 font-medium">المبلغ</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {entries.map((e) => (
                <tr key={e.id} className={editingId === e.id ? "bg-amber-50" : undefined}>
                  <td className="px-3 py-2 whitespace-nowrap text-zinc-600" dir="ltr">
                    {e.date}
                  </td>
                  <td className="px-3 py-2 text-zinc-700">
                    {e.for_month ? `${MONTHS[e.for_month - 1]} ${e.for_year ?? ""}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-zinc-600" dir="ltr">
                    {e.days !== null ? formatNumber(Number(e.days)) : "—"}
                  </td>
                  <td className="px-3 py-2 text-zinc-700">{e.reason ?? "—"}</td>
                  <td
                    className="px-3 py-2 whitespace-nowrap font-semibold text-emerald-700"
                    dir="ltr"
                  >
                    +{formatCurrency(e.amount, currencySymbol)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(e)}
                        title="تعديل"
                        className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(e.id)}
                        title="حذف"
                        className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
