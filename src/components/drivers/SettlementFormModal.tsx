"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/format";
import {
  createSettlement,
  getSettlementCandidates,
  getSettlementPreview,
} from "@/app/(dashboard)/drivers/settlement-actions";
import type { LedgerCandidate, SettlementPreview } from "@/lib/validation/settlement";

function firstOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function SettlementFormModal({
  open,
  onClose,
  driverId,
  currencySymbol,
}: {
  open: boolean;
  onClose: () => void;
  driverId: string;
  currencySymbol: string;
}) {
  const router = useRouter();

  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(today);
  const [settledOn, setSettledOn] = useState(today);
  const [notes, setNotes] = useState("");

  const [advances, setAdvances] = useState<LedgerCandidate[]>([]);
  const [deductions, setDeductions] = useState<LedgerCandidate[]>([]);
  const [pickedAdvances, setPickedAdvances] = useState<string[]>([]);
  const [pickedDeductions, setPickedDeductions] = useState<string[]>([]);

  const [preview, setPreview] = useState<SettlementPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const periodValid = toDate >= fromDate;

  useEffect(() => {
    if (!open) return;
    setFromDate(firstOfMonth());
    setToDate(today());
    setSettledOn(today());
    setNotes("");
    setPickedAdvances([]);
    setPickedDeductions([]);
    setPreview(null);
  }, [open]);

  // تغيير الفترة يبطّل الاختيارات السابقة — عنصر من فترة قديمة مش موجود في الجديدة
  useEffect(() => {
    if (!open || !periodValid) return;
    let cancelled = false;

    (async () => {
      const res = await getSettlementCandidates(driverId, fromDate, toDate);
      if (cancelled) return;
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setAdvances(res.advances);
      setDeductions(res.deductions);
      setPickedAdvances([]);
      setPickedDeductions([]);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, driverId, fromDate, toDate, periodValid]);

  const refreshPreview = useCallback(async () => {
    if (!periodValid) return;
    setLoading(true);
    const res = await getSettlementPreview(
      driverId,
      fromDate,
      toDate,
      pickedAdvances,
      pickedDeductions
    );
    setLoading(false);
    if (res.error) {
      toast.error(res.error);
      setPreview(null);
      return;
    }
    setPreview(res.preview);
  }, [driverId, fromDate, toDate, pickedAdvances, pickedDeductions, periodValid]);

  useEffect(() => {
    if (!open) return;
    void refreshPreview();
  }, [open, refreshPreview]);

  const toggle = (list: string[], setList: (v: string[]) => void, id: string) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const result = await createSettlement(driverId, {
      from_date: fromDate,
      to_date: toDate,
      settled_on: settledOn,
      advance_ids: pickedAdvances,
      deduction_ids: pickedDeductions,
      notes,
    });
    setSubmitting(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("تمت التصفية بنجاح");
    onClose();
    router.refresh();
    if (result.settlementId) router.push(`/settlements/${result.settlementId}`);
  };

  const nothingToSettle =
    preview !== null &&
    preview.trips_count === 0 &&
    preview.custody_credits === 0 &&
    preview.custody_debits === 0 &&
    preview.total_advances === 0 &&
    preview.total_deductions === 0;

  return (
    <Modal open={open} onClose={onClose} title="تصفية تربات" maxWidth="max-w-2xl">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="من تاريخ *">
            <input
              type="date"
              dir="ltr"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
          </Field>
          <Field label="إلى تاريخ *">
            <input
              type="date"
              dir="ltr"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
          </Field>
          <Field label="تاريخ التصفية *">
            <input
              type="date"
              dir="ltr"
              value={settledOn}
              onChange={(e) => setSettledOn(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
          </Field>
        </div>

        {!periodValid && (
          <p className="text-xs text-red-600">تاريخ النهاية لا يمكن أن يسبق تاريخ البداية</p>
        )}

        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] text-zinc-600">
          الرحلات وحركات العهدة غير المُصفّاة في هذه الفترة تدخل تلقائياً. أما السلف والخصومات
          فاختَر منها ما تريد تحميله على التربات — وما تتركه يبقى محمّلاً على الراتب كما هو.
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CandidateList
            title="سلف تُخصم من التربات"
            empty="لا توجد سلف غير مُصفّاة في الفترة"
            items={advances}
            picked={pickedAdvances}
            onToggle={(id) => toggle(pickedAdvances, setPickedAdvances, id)}
            currencySymbol={currencySymbol}
          />
          <CandidateList
            title="خصومات تُخصم من التربات"
            empty="لا توجد خصومات غير مُصفّاة في الفترة"
            items={deductions}
            picked={pickedDeductions}
            onToggle={(id) => toggle(pickedDeductions, setPickedDeductions, id)}
            currencySymbol={currencySymbol}
          />
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-bold text-zinc-900">المعاينة</h4>
            {loading && <Loader2 size={14} className="animate-spin text-zinc-400" />}
          </div>

          {preview ? (
            <div className="flex flex-col divide-y divide-zinc-100 text-sm">
              <PreviewRow
                label={`تربات ${preview.trips_count} رحلة`}
                value={preview.total_trabs}
                currencySymbol={currencySymbol}
              />
              <div className="py-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-600">ما صرفه أو أرجعه (عهدة مدينة)</span>
                  <span className="text-sm text-zinc-900" dir="ltr">
                    +{formatCurrency(preview.custody_debits, currencySymbol)}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between ps-3">
                  <span className="text-[11px] text-zinc-400">
                    منها مصروفات عمل دفعها السائق
                  </span>
                  <span className="text-[11px] text-zinc-400" dir="ltr">
                    {formatCurrency(preview.driver_expenses, currencySymbol)}
                  </span>
                </div>
              </div>
              <PreviewRow
                label="ما استلمه (عهدة / تحصيل)"
                value={preview.custody_credits}
                currencySymbol={currencySymbol}
                sign="minus"
              />
              <PreviewRow
                label="سلف محمّلة على التربات"
                value={preview.total_advances}
                currencySymbol={currencySymbol}
                sign="minus"
              />
              <PreviewRow
                label="خصومات محمّلة على التربات"
                value={preview.total_deductions}
                currencySymbol={currencySymbol}
                sign="minus"
              />
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm font-bold text-zinc-900">الصافي المستحق للسائق</span>
                <span
                  className={`text-base font-bold ${
                    preview.net_amount < 0 ? "text-red-600" : "text-emerald-700"
                  }`}
                  dir="ltr"
                >
                  {formatCurrency(preview.net_amount, currencySymbol)}
                </span>
              </div>
              {preview.net_amount < 0 && (
                <p className="pt-2 text-[11px] text-red-600">
                  الصافي سالب — أي أن المستحق على السائق للشركة، وليس له.
                </p>
              )}
            </div>
          ) : (
            <p className="py-3 text-center text-xs text-zinc-400">
              {periodValid ? "جارٍ الحساب..." : "حدّد فترة صحيحة"}
            </p>
          )}
        </div>

        {nothingToSettle && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>لا يوجد ما يُصفّى في هذه الفترة — كل العناصر مُصفّاة بالفعل أو لا توجد حركات.</span>
          </div>
        )}

        <Field label="ملاحظات">
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
          />
        </Field>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || loading || !periodValid || nothingToSettle || !preview}
            className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {submitting ? "جارٍ التصفية..." : "تأكيد التصفية"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-zinc-700">{label}</label>
      {children}
    </div>
  );
}

function CandidateList({
  title,
  empty,
  items,
  picked,
  onToggle,
  currencySymbol,
}: {
  title: string;
  empty: string;
  items: LedgerCandidate[];
  picked: string[];
  onToggle: (id: string) => void;
  currencySymbol: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 p-3">
      <h4 className="mb-2 text-xs font-bold text-zinc-700">{title}</h4>
      {items.length === 0 ? (
        <p className="py-2 text-center text-[11px] text-zinc-400">{empty}</p>
      ) : (
        <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
          {items.map((item) => (
            <label
              key={item.id}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50"
            >
              <input
                type="checkbox"
                checked={picked.includes(item.id)}
                onChange={() => onToggle(item.id)}
                className="size-4 shrink-0 accent-zinc-900"
              />
              <span className="flex-1 text-xs text-zinc-700">
                <span dir="ltr">{item.date}</span>
                {item.description ? ` — ${item.description}` : ""}
              </span>
              <span className="text-xs font-semibold text-zinc-900" dir="ltr">
                {formatCurrency(item.amount, currencySymbol)}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function PreviewRow({
  label,
  value,
  currencySymbol,
  sign,
  hint,
}: {
  label: string;
  value: number;
  currencySymbol: string;
  sign?: "plus" | "minus";
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-zinc-600">
        {label}
        {hint && <span className="text-zinc-400"> ({hint})</span>}
      </span>
      <span className="text-sm text-zinc-900" dir="ltr">
        {sign === "minus" ? "−" : sign === "plus" ? "+" : ""}
        {formatCurrency(value, currencySymbol)}
      </span>
    </div>
  );
}
