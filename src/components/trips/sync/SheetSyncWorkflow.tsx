"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, Loader2, Save, CheckCircle2 } from "lucide-react";
import { statusLabels } from "@/lib/validation/trip";
import { normalizeArabic } from "@/lib/arabic";
import { driverExtraStops, resolveBasePayment, routeUnmatched, type RouteRate } from "@/lib/trip-calc";
import {
  fetchSheetPreview,
  applySheetSync,
  saveSheetUrl,
  type SyncPreviewRow,
  type SyncApplyRow,
} from "@/app/(dashboard)/trips/sync/actions";

type DriverOption = {
  id: string;
  name: string;
  default_trip_payment: number;
  extra_stop_rate: number;
  employment_type: "internal" | "external";
  route_rates: RouteRate[];
};

type CompanyOption = { id: string; name: string };

type EditableRow = SyncPreviewRow & {
  include: boolean;
  employmentType: "internal" | "external";
  /** سائق موجود في النظام، أو "" لإنشاء جديد باسم الشيت */
  driverId: string;
  /** عميل موجود في النظام، أو "" لإنشاء جديد باسم الشيت */
  companyId: string;
  /** الترب الأساسي بعد أن يلمسه المستخدم — null يعني «احسبه من خط السير» */
  basePaymentOverride: number | null;
};

export function SheetSyncWorkflow({
  initialUrl,
  drivers,
  companies,
  globalRouteRates = [],
}: {
  initialUrl: string;
  drivers: DriverOption[];
  companies: CompanyOption[];
  globalRouteRates?: RouteRate[];
}) {
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

    // المستورد سابقاً لا يُحدَّد — المزامنة تُدخل الجديد فقط.
    // ونطابق اسم الشيت بسائق موجود بالتطبيع العربي، والمستخدم يصحّح ما أخطأ.
    setRows(
      result.rows.map((r) => {
        const matchedDriver = drivers.find(
          (d) => normalizeArabic(d.name) === normalizeArabic(r.driverName)
        );
        const matchedCompany = companies.find(
          (c) => normalizeArabic(c.name) === normalizeArabic(r.clientName)
        );
        return {
          ...r,
          include: !r.alreadyImported && !r.needsReview,
          employmentType: r.looksExternal ? "external" : "internal",
          driverId: matchedDriver?.id ?? "",
          companyId: matchedCompany?.id ?? "",
          basePaymentOverride: null,
        };
      })
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

  /**
   * ترب الصف كما سيُحفظ — نفس حساب شاشة استيراد Excel:
   *   الأساسي  = ما كتبه المستخدم، وإلا خط السير (خاص ثم عام)، وإلا الافتراضي
   *   الإجمالي = الأساسي + (المواقع الإضافية × معدَّل السائق)
   * والمواقع تخصم موقعاً عن كل مدينة تنزيل، ومدن التحميل لا تُحسب للسائق.
   */
  const calcRow = (r: EditableRow) => {
    const driver = drivers.find((d) => d.id === r.driverId);
    const rates = driver?.route_rates ?? [];
    const applicableGlobal = driver?.employment_type === "external" ? [] : globalRouteRates;

    const base =
      r.basePaymentOverride ??
      (driver
        ? resolveBasePayment(
            rates,
            applicableGlobal,
            driver.default_trip_payment,
            r.fromLocation,
            r.toLocation,
            driver.employment_type
          )
        : 0);

    const stops = driverExtraStops(r.branchesCount ?? 0, r.fromLocation, r.toLocation);
    const extra = stops * (driver?.extra_stop_rate ?? 0);

    return {
      base,
      stops,
      total: base + extra,
      unmatched: driver
        ? routeUnmatched(rates, applicableGlobal, r.fromLocation, r.toLocation)
        : false,
    };
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
      companyId: r.companyId,
      clientName: r.clientName,
      date: r.date,
      fromLocation: r.fromLocation,
      toLocation: r.toLocation,
      driverId: r.driverId,
      driverName: r.driverName,
      // صفر يعني «حلّه من خط السير على الخادم»
      basePayment: r.basePaymentOverride ?? 0,
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
                    <th className="px-3 py-3 font-medium">ترب الرحلة</th>
                    <th className="px-3 py-3 font-medium">إجمالي الترب</th>
                    <th className="px-3 py-3 font-medium">سعر الرحلة</th>
                    <th className="px-3 py-3 font-medium">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const calc = calcRow(r);
                    return (
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
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-1">
                          <select
                            value={r.companyId}
                            disabled={r.alreadyImported}
                            onChange={(e) => updateRow(i, { companyId: e.target.value })}
                            className="min-w-[130px] rounded border border-zinc-200 px-1.5 py-1 text-xs"
                          >
                            <option value="">جديد: {r.clientName}</option>
                            {companies.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                          <span className="text-[10px] text-zinc-400">
                            في الشيت: {r.clientName || "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">{r.fromLocation}</td>
                      <td className="px-3 py-2">{r.toLocation}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          dir="ltr"
                          value={r.branchesCount}
                          disabled={r.alreadyImported}
                          onChange={(e) =>
                            updateRow(i, { branchesCount: Number(e.target.value) || 0 })
                          }
                          className="w-14 rounded border border-zinc-200 px-1.5 py-1 text-right text-xs"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-1">
                          <select
                            value={r.driverId}
                            disabled={r.alreadyImported}
                            onChange={(e) => updateRow(i, { driverId: e.target.value })}
                            className="min-w-[140px] rounded border border-zinc-200 px-1.5 py-1 text-xs"
                          >
                            <option value="">جديد: {r.driverName}</option>
                            {drivers.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name}
                              </option>
                            ))}
                          </select>

                          <span className="text-[10px] text-zinc-400">
                            في الشيت: {r.driverName || "—"}
                          </span>

                          {/* نوع السائق يُسأل فقط عند الإنشاء — الموجود يبقى على نوعه */}
                          {!r.driverId && (
                            <select
                              value={r.employmentType}
                              disabled={r.alreadyImported}
                              onChange={(e) =>
                                updateRow(i, {
                                  employmentType: e.target.value as "internal" | "external",
                                })
                              }
                              className={`rounded border px-1.5 py-1 text-[10px] ${
                                r.looksExternal
                                  ? "border-amber-300 bg-amber-50"
                                  : "border-zinc-200"
                              }`}
                            >
                              <option value="internal">يُنشأ: سائق شركة</option>
                              <option value="external">يُنشأ: مورّد</option>
                            </select>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          dir="ltr"
                          value={calc.base}
                          disabled={r.alreadyImported}
                          onChange={(e) =>
                            updateRow(i, { basePaymentOverride: Number(e.target.value) || 0 })
                          }
                          className={`w-20 rounded border px-1.5 py-1 text-right text-xs ${
                            calc.unmatched ? "border-amber-400 bg-amber-50" : "border-zinc-200"
                          }`}
                          title={
                            calc.unmatched
                              ? "لم يتطابق أي خط سير — هذا هو الترب الافتراضي"
                              : undefined
                          }
                        />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap" dir="ltr">
                        <span className="font-semibold text-zinc-900">
                          {calc.total.toFixed(2)}
                        </span>
                        {calc.stops > 0 && (
                          <span className="mr-1 text-[10px] text-zinc-400">
                            (+{calc.stops} موقع)
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-zinc-500" dir="ltr">
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-zinc-400">
            اسم العميل واسم السائق في الشيت يُطابَقان تلقائياً بما في النظام، وتقدر تغيّر
            أيّهما — ولن يُنشأ عميل أو سائق جديد إلا لو تركت الخيار على «جديد». و«نوع
            السائق» يُقترَح من عمود الملاحظات ويُطبَّق عند الإنشاء فقط؛ الموجود يبقى على نوعه.
            والحالة «مكتملة» تلقائياً — غيّرها من القائمة متى شئت، ونص الحالة في الشيت
            معروض تحتها.
          </p>
          <p className="text-xs text-zinc-400">
            ترب الرحلة يُملأ من خط سير السائق (الخاص ثم العام) وإلا من تربه الافتراضي، وتقدر
            تكتبه يدوياً. وإجمالي الترب يضيف المواقع الإضافية بمعدَّل السائق بعد خصم موقع عن
            كل مدينة تنزيل — ومدن التحميل لا تُحسب للسائق. ورقم اللوحة يُحفظ في ملاحظات
            الرحلة ولا يُربط بسيارة، لأن ربط السيارة حصري لسائق واحد وربطه تلقائياً قد ينزعها
            من غيره. الصفوف الملوّنة تحتاج مراجعة.
          </p>
        </>
      )}
    </div>
  );
}
