"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Download, Printer, Route, Loader2 } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import { EmptyState } from "@/components/ui/EmptyState";

export type DriverRouteTrabRow = {
  driver_id: string;
  driver_name: string;
  employment_type: "internal" | "external";
  vendor_name: string | null;
  from_location: string;
  to_location: string;
  base_payment: number;
  trips_count: number;
  total_trabs: number;
};

/**
 * ترب خطوط السير من الرحلات الفعلية — كشف يُقدَّم للإدارة.
 *
 * 🔑 المصدر هو جدول الرحلات نفسه، كما في كشف حساب السائق — لا جداول
 * التسعيرة. فما يُعرض هو ما صُرف، لا ما اتُّفق عليه.
 *
 * والصفّ لكل (سائق، خط، ترب): فلو تغيّر الترب على نفس الخط بين رحلة وأخرى
 * ظهر كل مبلغ في صفّه. متوسّطٌ هنا كان سيُخفي الاختلاف.
 *
 * 📌 أربعة أعمدة لا غير بطلب المستخدم: السائق، من، إلى، ترب الرحلة.
 *    الأعداد والإجماليات لها تقاريرها، وهذا كشف مرجعي يُقرأ في لمحة.
 */
export function DriverRatesTable({
  rows,
  from,
  to,
  orgName,
  currencySymbol,
}: {
  rows: DriverRouteTrabRow[];
  from: string;
  to: string;
  orgName: string;
  currencySymbol: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [kind, setKind] = useState<"all" | "internal" | "external">("all");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  const setParam = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => (v ? params.set(k, v) : params.delete(k)));
    router.push(`${pathname}?${params.toString()}`);
  };

  const visible = rows.filter((r) => {
    if (kind !== "all" && r.employment_type !== kind) return false;
    if (!search.trim()) return true;
    const q = search.trim();
    return (
      r.driver_name.includes(q) ||
      r.from_location.includes(q) ||
      r.to_location.includes(q) ||
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
        fileName: `ترب-خطوط-السير-${from}-${to}`,
        sheetName: "ترب خطوط السير",
        title: "ترب خطوط السير من الرحلات",
        subtitle: `${orgName}  ·  من ${from} إلى ${to}  ·  ${formatNumber(driversCount)} سائقاً`,
        columns: [
          { header: "السائق", key: "driver", width: 26 },
          { header: "من", key: "from", width: 22 },
          { header: "إلى", key: "to", width: 22 },
          { header: "ترب الرحلة", key: "base", width: 16, money: true },
        ],
        rows: visible.map((r) => ({
          driver: r.driver_name,
          from: r.from_location,
          to: r.to_location,
          base: r.base_payment,
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
          <label className="text-xs font-medium text-zinc-500">من تاريخ</label>
          <input
            type="date"
            dir="ltr"
            value={from}
            onChange={(e) => setParam({ from: e.target.value })}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-500">إلى تاريخ</label>
          <input
            type="date"
            dir="ltr"
            value={to}
            onChange={(e) => setParam({ to: e.target.value })}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          />
        </div>
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
            className="w-48 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
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
          <p className="text-sm text-zinc-500">
            ترب خطوط السير من الرحلات — من {from} إلى {to}
          </p>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={Route}
            title="لا توجد رحلات في هذه الفترة"
            description="وسّع الفترة أو غيّر الفئة"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-right text-xs text-zinc-500">
                  <th className="px-4 py-3 font-medium">السائق</th>
                  <th className="px-4 py-3 font-medium">من</th>
                  <th className="px-4 py-3 font-medium">إلى</th>
                  <th className="px-4 py-3 font-medium">ترب الرحلة</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r, i) => {
                  // اسم السائق مرة واحدة لكل مجموعة — الكشف يُقرأ بالعين
                  const firstOfDriver = i === 0 || visible[i - 1].driver_id !== r.driver_id;
                  return (
                    <tr
                      key={`${r.driver_id}-${r.from_location}-${r.to_location}-${r.base_payment}`}
                      className={`border-b border-zinc-50 ${
                        firstOfDriver ? "border-t-2 border-t-zinc-200" : ""
                      }`}
                    >
                      <td className="px-4 py-2.5 font-medium text-zinc-900">
                        {firstOfDriver ? r.driver_name : ""}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-700">{r.from_location}</td>
                      <td className="px-4 py-2.5 text-zinc-700">{r.to_location}</td>
                      <td
                        className="px-4 py-2.5 whitespace-nowrap font-semibold text-zinc-900"
                        dir="ltr"
                      >
                        {formatCurrency(r.base_payment, currencySymbol)}
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
        المصدر رحلات النظام نفسها، كما في كشف حساب السائق. و«ترب الرحلة» هو الأساسي على
        الخط — بلا المواقع الإضافية ولا المبيت. وظهور الخط نفسه بمبلغين يعني أن الترب
        اختلف بين رحلة وأخرى.
      </p>
    </div>
  );
}
