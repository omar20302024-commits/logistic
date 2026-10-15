"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, Loader2, Save, CheckCircle2 } from "lucide-react";
import { statusLabels } from "@/lib/validation/trip";
import {
  fetchSheetPreview,
  applySheetSync,
  saveSheetUrl,
  type SyncPreviewRow,
  type SyncApplyRow,
} from "@/app/(dashboard)/trips/sync/actions";

type EditableRow = SyncPreviewRow & {
  include: boolean;
  employmentType: "internal" | "external";
};

export function SheetSyncWorkflow({ initialUrl }: { initialUrl: string }) {
  const router = useRouter();

  const [url, setUrl] = useState(initialUrl);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [rows, setRows] = useState<EditableRow[] | null>(null);
  const [existingCount, setExistingCount] = useState(0);

  const handleFetch = async () => {
    setLoading(true);
    const result = await fetchSheetPreview(url);
    setLoading(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    // المستورد سابقاً لا يُحدَّد — المزامنة تُدخل الجديد فقط
    setRows(
      result.rows.map((r) => ({
        ...r,
        include: !r.alreadyImported && !r.needsReview,
        employmentType: r.looksExternal ? "external" : "internal",
      }))
    );
    setExistingCount(result.existingCount);

    if (result.newCount === 0) {
      toast.info("لا توجد رحلات جديدة — كل ما في الشيت مستورد بالفعل");
    } else {
      toast.success(`${result.newCount} رحلة جديدة جاهزة للمراجعة`);
    }
  };

  const handleSaveUrl = async () => {
    const result = await saveSheetUrl(url);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("تم حفظ الرابط");
    router.refresh();
  };

  const updateRow = (index: number, patch: Partial<EditableRow>) => {
    setRows((prev) => (prev ? prev.map((r, i) => (i === index ? { ...r, ...patch } : r)) : prev));
  };

  const handleApply = async () => {
    if (!rows) return;
    const selected = rows.filter((r) => r.include);
    if (selected.length === 0) {
      toast.error("اختر رحلة واحدة على الأقل");
      return;
    }

    const payload: SyncApplyRow[] = selected.map((r) => ({
      sourceKey: r.sourceKey,
      clientName: r.clientName,
      date: r.date,
      fromLocation: r.fromLocation,
      toLocation: r.toLocation,
      driverName: r.driverName,
      plateNo: r.plateNo,
      vehicleTypeName: r.vehicleTypeName,
      baseFare: r.baseFare,
      branchesCount: r.branchesCount,
      extraFee: r.extraFee,
      returnFee: r.returnFee,
      totalPrice: r.totalPrice,
      statusMapped: r.statusMapped,
      requester: r.requester,
      notes: r.notes,
      employmentType: r.employmentType,
    }));

    setApplying(true);
    const result = await applySheetSync(payload);
    setApplying(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    const extras = [
      result.createdDrivers ? `${result.createdDrivers} سائق جديد` : "",
      result.createdCompanies ? `${result.createdCompanies} عميل جديد` : "",
    ].filter(Boolean);

    toast.success(
      `تمت مزامنة ${result.createdTrips} رحلة${extras.length ? ` — وأُنشئ ${extras.join(" و")}` : ""}`
    );
    await handleFetch();
    router.refresh();
  };

  const selectedCount = rows?.filter((r) => r.include).length ?? 0;
  const newRows = rows?.filter((r) => !r.alreadyImported).length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <label className="text-xs font-medium text-zinc-500">رابط جوجل شيت</label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            dir="ltr"
            placeholder="https://docs.google.com/spreadsheets/d/..."
            className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-xs outline-none focus:border-zinc-900"
          />
          <button
            type="button"
            onClick={handleSaveUrl}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-300 px-3.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <Save size={15} /> حفظ
          </button>
          <button
            type="button"
            onClick={handleFetch}
            disabled={loading || !url.trim()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            {loading ? "جارٍ القراءة..." : "مزامنة الآن"}
          </button>
        </div>
        <p className="text-[11px] text-zinc-400">
          يجب أن تكون مشاركة الشيت «أي شخص لديه الرابط يمكنه الاطّلاع». المزامنة تُدخل
          الجديد فقط — لا تحذف رحلة ولا تعدّل رحلة مسجَّلة، وحذف صف من الشيت لا يمسّ النظام.
        </p>
      </div>

      {rows && (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm">
            <span className="font-medium text-zinc-900">{newRows} رحلة جديدة</span>
            {existingCount > 0 && (
              <span className="inline-flex items-center gap-1 text-zinc-500">
                <CheckCircle2 size={14} className="text-emerald-600" />
                {existingCount} مستوردة سابقاً — لن تتكرّر
              </span>
            )}
            <button
              type="button"
              onClick={handleApply}
              disabled={applying || selectedCount === 0}
              className="mr-auto rounded-lg bg-zinc-900 px-5 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {applying ? "جارٍ الاستيراد..." : `استيراد ${selectedCount} رحلة`}
            </button>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-right text-xs text-zinc-500">
                    <th className="px-3 py-3 font-medium"></th>
                    <th className="px-3 py-3 font-medium">#</th>
                    <th className="px-3 py-3 font-medium">التاريخ</th>
                    <th className="px-3 py-3 font-medium">العميل</th>
                    <th className="px-3 py-3 font-medium">من</th>
                    <th className="px-3 py-3 font-medium">إلى</th>
                    <th className="px-3 py-3 font-medium">الفروع</th>
                    <th className="px-3 py-3 font-medium">السائق</th>
                    <th className="px-3 py-3 font-medium">النوع</th>
                    <th className="px-3 py-3 font-medium">الإجمالي</th>
                    <th className="px-3 py-3 font-medium">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr
                      key={r.sourceKey}
                      className={`border-b border-zinc-50 ${
                        r.alreadyImported ? "opacity-40" : ""
                      } ${r.needsReview ? "bg-amber-50" : ""}`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={r.include}
                          disabled={r.alreadyImported}
                          onChange={(e) => updateRow(i, { include: e.target.checked })}
                          className="h-4 w-4 rounded border-zinc-300"
                        />
                      </td>
                      <td className="px-3 py-2 text-zinc-400" dir="ltr">
                        {r.serial}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap" dir="ltr">
                        {r.date || <span className="text-red-600">—</span>}
                      </td>
                      <td className="px-3 py-2">{r.clientName}</td>
                      <td className="px-3 py-2">{r.fromLocation}</td>
                      <td className="px-3 py-2">{r.toLocation}</td>
                      <td className="px-3 py-2 text-center" dir="ltr">
                        {r.branchesCount || "—"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col">
                          <span>{r.driverName}</span>
                          {r.looksExternal && (
                            <span className="text-[10px] text-amber-700">
                              الملاحظات تذكر «خارجي»
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={r.employmentType}
                          disabled={r.alreadyImported}
                          onChange={(e) =>
                            updateRow(i, {
                              employmentType: e.target.value as "internal" | "external",
                            })
                          }
                          className="rounded border border-zinc-200 px-1.5 py-1 text-xs"
                        >
                          <option value="internal">سائق شركة</option>
                          <option value="external">مورّد</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap" dir="ltr">
                        {r.totalPrice.toFixed(2)}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={r.statusMapped}
                          disabled={r.alreadyImported}
                          onChange={(e) =>
                            updateRow(i, {
                              statusMapped: e.target.value as EditableRow["statusMapped"],
                            })
                          }
                          className="rounded border border-zinc-200 px-1.5 py-1 text-xs"
                        >
                          {Object.entries(statusLabels).map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                        {r.statusRaw && (
                          <div className="text-[10px] text-zinc-400">{r.statusRaw}</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-zinc-400">
            «نوع السائق» يُقترَح من عمود الملاحظات ويُطبَّق فقط عند إنشاء سائق جديد — السائق
            الموجود يبقى على نوعه. ورقم اللوحة يُحفظ في ملاحظات الرحلة ولا يُربط بسيارة، لأن
            ربط السيارة حصري لسائق واحد وربطه تلقائياً قد ينزعها من غيره. الصفوف الملوّنة
            تحتاج مراجعة.
          </p>
        </>
      )}
    </div>
  );
}
