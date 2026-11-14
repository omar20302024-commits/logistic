"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, Printer, Route, Loader2 } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import { EmptyState } from "@/components/ui/EmptyState";

export type DriverRateRow = {
  driver_id: string;
  driver_name: string;
  employment_type: "internal" | "external";
  vendor_name: string | null;
  from_city: string;
  to_city: string;
  trab_amount: number;
  source: string;
  default_payment: number;
};

/**
 * ترب خطوط السير لكل سائق — كشف يُقدَّم للإدارة.
 *
 * ⚠️ يعرض **ما يُطبَّق فعلاً**: الترب الخاص بالسائق يحجب ترب مورّده، وهذا
 * يحجب العام. فلو عُرضت الطبقات متجاورة لقرأت الإدارة رقماً لا يُصرف.
 * وعمود «المصدر» يقول من أين جاء الرقم.
 */
export function DriverRatesTable({
  rows,
  orgName,
  currencySymbol,
}: {
  rows: DriverRateRow[];
  orgName: string;
  currencySymbol: string;
}) {
  const [kind, setKind] = useState<"all" | "internal" | "external">("all");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  const visible = rows.filter((r) => {
    if (kind !== "all" && r.employment_type !== kind) return false;
    if (!search.trim()) return true;
    const q = search.trim();
    return (
      r.driver_name.includes(q) ||
      r.from_city.includes(q) ||
      r.to_city.includes(q) ||
      (r.vendor_name ?? "").includes(q)
    );
  });

  // عدد السائقين لا عدد الصفوف: الإدارة تسأل «كم سائقاً» لا «كم خط سير»
  const driversCount = new Set(visible.map((r) => r.driver_id)).size;

  const handleExport = async () => {
    setExporting(true);
    try {
      const { exportToExcel } = await import("@/lib/excel");
      await exportToExcel({
        fileName: `ترب-خطوط-السير-${new Date().toISOString().slice(0, 10)}`,
        sheetName: "ترب خطوط السير",
        title: "ترب خطوط السير لكل سائق",
        subtitle: `${orgName}  ·  ${formatNumber(driversCount)} سائقاً  ·  ${formatNumber(
          visible.length
        )} خط سير`,
        columns: [
          { header: "السائق", key: "driver", width: 24 },
          { header: "الفئة", key: "kind", width: 12 },
          { header: "المورّد", key: "vendor", width: 20 },
          { header: "من", key: "from", width: 20 },
          { header: "إلى", key: "to", width: 20 },
          { header: "الترب", key: "trab", width: 14, money: true },
          { header: "المصدر", key: "source", width: 14 },
          { header: "الترب الافتراضي", key: "fallback", width: 16, money: true },
        ],
        rows: visible.map((r) => ({
          driver: r.driver_name,
          kind: r.employment_type === "external" ? "خارجي" : "داخلي",
          vendor: r.vendor_name ?? "—",
          from: r.from_city,
          to: r.to_city,
          trab: r.trab_amount,
          source: r.source,
          fallback: r.default_payment,
        })),
      });
    } catch {
      toast.error("تعذّر إنشاء ملف Excel");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm print:hidden">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-500">الفئة</label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          >
            <option value="all">الكل</option>
            <option value="internal">سائقو الشركة</option>
            <option value="external">الخارجيون والموردون</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-500">بحث</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="اسم سائق أو مدينة"
            className="w-56 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          />
        </div>

        <div className="mr-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || visible.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            تصدير Excel
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            <Printer size={15} /> طباعة
          </button>
        </div>
      </div>

      <div className="print-statement rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="hidden border-b border-zinc-200 px-6 py-4 print:block">
          <h1 className="text-lg font-bold text-zinc-900">{orgName}</h1>
          <p className="text-sm text-zinc-500">ترب خطوط السير لكل سائق</p>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={Route}
            title="لا توجد خطوط سير"
            description="أضف خطوط السير من صفحة السائق أو من «خطوط السير العامة»"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-right text-xs text-zinc-500">
                  <th className="px-4 py-3 font-medium">السائق</th>
                  <th className="px-4 py-3 font-medium">الفئة</th>
                  <th className="px-4 py-3 font-medium">المورّد</th>
                  <th className="px-4 py-3 font-medium">من</th>
                  <th className="px-4 py-3 font-medium">إلى</th>
                  <th className="px-4 py-3 font-medium">الترب</th>
                  <th className="px-4 py-3 font-medium">المصدر</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r, i) => {
                  // اسم السائق مرة واحدة لكل مجموعة — الكشف يُقرأ بالعين
                  const firstOfDriver = i === 0 || visible[i - 1].driver_id !== r.driver_id;
                  return (
                    <tr
                      key={`${r.driver_id}-${r.from_city}-${r.to_city}`}
                      className={`border-b border-zinc-50 ${
                        firstOfDriver ? "border-t-2 border-t-zinc-200" : ""
                      }`}
                    >
                      <td className="px-4 py-2.5 font-medium text-zinc-900">
                        {firstOfDriver ? r.driver_name : ""}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-zinc-500">
                        {firstOfDriver
                          ? r.employment_type === "external"
                            ? "خارجي"
                            : "داخلي"
                          : ""}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-zinc-600">
                        {firstOfDriver ? (r.vendor_name ?? "—") : ""}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-700">{r.from_city}</td>
                      <td className="px-4 py-2.5 text-zinc-700">{r.to_city}</td>
                      <td
                        className="px-4 py-2.5 whitespace-nowrap font-semibold text-zinc-900"
                        dir="ltr"
                      >
                        {formatCurrency(r.trab_amount, currencySymbol)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            r.source === "خاص بالسائق"
                              ? "bg-emerald-100 text-emerald-800"
                              : r.source === "المورّد"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-zinc-100 text-zinc-600"
                          }`}
                        >
                          {r.source}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11px] text-zinc-500 print:text-zinc-600">
        الترب المعروض هو <strong>ما يُطبَّق فعلاً</strong>: خط السير الخاص بالسائق يحجب ترب
        مورّده، وهذا يحجب العام. وما لا خط سير له يأخذ «الترب الافتراضي» المسجَّل في بيانات
        السائق.
      </p>
    </div>
  );
}
