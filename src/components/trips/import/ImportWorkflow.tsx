"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, AlertTriangle, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { statusLabels } from "@/lib/validation/trip";
import {
  parseImportFile,
  confirmImport,
  type ImportRowInput,
} from "@/app/(dashboard)/trips/import/actions";
import type { ParsedTripRow } from "@/lib/import/parseTripsFile";

type Option = { id: string; name: string };

type EditableRow = ParsedTripRow & {
  driverId: string; // "" يعني سيتم إنشاء سائق جديد باسم driverName
  include: boolean;
};

export function ImportWorkflow({ drivers, companies }: { drivers: Option[]; companies: Option[] }) {
  const router = useRouter();

  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [newCompanyName, setNewCompanyName] = useState("");

  const newDriversCount = useMemo(
    () => new Set(rows.filter((r) => r.include && !r.driverId).map((r) => r.driverName)).size,
    [rows]
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const result = await parseImportFile(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.rows.length === 0) {
        toast.error("لم يتم العثور على أي رحلات في الملف");
        return;
      }

      const editable: EditableRow[] = result.rows.map((r) => {
        const existing = drivers.find(
          (d) => d.name.trim().toLowerCase() === r.driverName.trim().toLowerCase()
        );
        return { ...r, driverId: existing?.id ?? "", include: true };
      });
      setRows(editable);

      if (result.companyNameGuess) {
        const existingCompany = companies.find(
          (c) => c.name.trim().toLowerCase() === result.companyNameGuess!.trim().toLowerCase()
        );
        if (existingCompany) setCompanyId(existingCompany.id);
        else setNewCompanyName(result.companyNameGuess);
      }

      setStep("preview");
    } finally {
      setParsing(false);
      e.target.value = "";
    }
  };

  const updateRow = (index: number, patch: Partial<EditableRow>) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const handleConfirm = async () => {
    const included = rows.filter((r) => r.include);
    if (included.length === 0) {
      toast.error("اختر صفاً واحداً على الأقل للاستيراد");
      return;
    }
    if (!companyId && !newCompanyName.trim()) {
      toast.error("اختر شركة موجودة أو أدخل اسم شركة جديدة");
      return;
    }

    setSubmitting(true);
    const payload: ImportRowInput[] = included.map((r) => ({
      date: r.date,
      fromLocation: r.fromLocation,
      toLocation: r.toLocation,
      driverId: r.driverId,
      newDriverName: r.driverId ? "" : r.driverName,
      baseFare: r.baseFare,
      extraAmount: r.extraFee + r.returnFee,
      driverTripPayment: r.vendorCost,
      status: r.statusMapped,
      notes: r.statusRaw,
    }));

    const result = await confirmImport(companyId, newCompanyName, payload);
    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(
      `تم استيراد ${result.createdTrips} رحلة${result.createdDrivers ? ` وإنشاء ${result.createdDrivers} سائق جديد` : ""}`
    );
    router.push("/trips");
  };

  if (step === "upload") {
    return (
      <div className="rounded-2xl border-2 border-dashed border-zinc-300 bg-white p-12 text-center">
        <Upload className="mx-auto mb-3 text-zinc-400" size={32} />
        <p className="mb-4 text-sm text-zinc-500">
          اختر ملف تقرير الرحلات (.xls / .htm) المستلَم من العميل
        </p>
        <label className="mx-auto inline-flex cursor-pointer items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800">
          {parsing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {parsing ? "جارٍ التحليل..." : "اختيار ملف"}
          <input type="file" accept=".xls,.xlsx,.htm,.html" onChange={handleFileChange} disabled={parsing} className="hidden" />
        </label>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-500">الشركة (العميل)</label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="min-w-[200px] rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
            >
              <option value="">-- شركة جديدة (اكتب اسمها) --</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {!companyId && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-500">اسم الشركة الجديدة</label>
              <input
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
              />
            </div>
          )}
          <div className="mr-auto text-sm text-zinc-500">
            {rows.filter((r) => r.include).length} رحلة محددة
            {newDriversCount > 0 && ` — ${newDriversCount} سائق جديد سيُنشأ`}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-right text-xs text-zinc-500">
                <th className="px-3 py-3 font-medium"></th>
                <th className="px-3 py-3 font-medium">التاريخ</th>
                <th className="px-3 py-3 font-medium">من</th>
                <th className="px-3 py-3 font-medium">إلى</th>
                <th className="px-3 py-3 font-medium">السائق</th>
                <th className="px-3 py-3 font-medium">الترب</th>
                <th className="px-3 py-3 font-medium">السعر الكلي</th>
                <th className="px-3 py-3 font-medium">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const computedTotal = r.baseFare + r.extraFee + r.returnFee;
                const mismatch = Math.abs(computedTotal - r.totalPrice) > 0.01;
                return (
                  <tr
                    key={i}
                    className={`border-b border-zinc-50 ${!r.include ? "opacity-40" : ""} ${
                      r.needsReview || mismatch ? "bg-amber-50" : ""
                    }`}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={r.include}
                        onChange={(e) => updateRow(i, { include: e.target.checked })}
                        className="h-4 w-4 rounded border-zinc-300"
                      />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap" dir="ltr">
                      <input
                        type="date"
                        value={r.date}
                        onChange={(e) => updateRow(i, { date: e.target.value })}
                        className="w-32 rounded border border-zinc-200 px-1.5 py-1 text-xs"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={r.fromLocation}
                        onChange={(e) => updateRow(i, { fromLocation: e.target.value })}
                        className="w-28 rounded border border-zinc-200 px-1.5 py-1 text-xs"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={r.toLocation}
                        onChange={(e) => updateRow(i, { toLocation: e.target.value })}
                        className="w-28 rounded border border-zinc-200 px-1.5 py-1 text-xs"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={r.driverId}
                        onChange={(e) => updateRow(i, { driverId: e.target.value })}
                        className="rounded border border-zinc-200 px-1.5 py-1 text-xs"
                      >
                        <option value="">جديد: {r.driverName}</option>
                        {drivers.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        dir="ltr"
                        value={r.vendorCost}
                        onChange={(e) => updateRow(i, { vendorCost: Number(e.target.value) })}
                        className="w-20 rounded border border-zinc-200 px-1.5 py-1 text-xs text-right"
                      />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap" dir="ltr">
                      {formatCurrency(computedTotal)}
                      {mismatch && (
                        <span title={`الملف يقول ${formatCurrency(r.totalPrice)}`}>
                          <AlertTriangle size={12} className="mr-1 inline text-amber-600" />
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={r.statusMapped}
                        onChange={(e) =>
                          updateRow(i, { statusMapped: e.target.value as EditableRow["statusMapped"] })
                        }
                        className="rounded border border-zinc-200 px-1.5 py-1 text-xs"
                      >
                        {Object.entries(statusLabels).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-zinc-400">
        الصفوف الملوّنة تحتاج مراجعة (عدد خانات غير متوقع أو السعر الكلي غير متطابق مع الملف الأصلي).
      </p>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setStep("upload")}
          className="rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          رفع ملف آخر
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          className="rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {submitting ? "جارٍ الاستيراد..." : "تأكيد الاستيراد"}
        </button>
      </div>
    </div>
  );
}
