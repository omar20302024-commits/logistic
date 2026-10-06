"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Printer, Users } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import { EmptyState } from "@/components/ui/EmptyState";

// كشف السائقين: الاسم والجوال والراتب، للطباعة أو الحفظ PDF.
//
// الطباعة عبر محرك المتصفح لا مكتبة جافاسكربت — وهذا مقصود: jsPDF وأمثالها
// لا تُشكّل العربية فتخرج الحروف مفكّكة ومقلوبة. متصفح المستخدم يُشكّلها صحيحة،
// و«حفظ كـ PDF» من نافذة الطباعة يعطي ملفاً سليماً.

type Row = {
  id: string;
  name: string;
  phone: string | null;
  salary: number;
  status: "active" | "inactive";
};

const TYPE_LABELS: Record<string, string> = {
  internal: "السائقون الداخليون",
  external: "الموردون",
};

export function DriversListTable({
  rows,
  type,
  status,
  orgName,
  orgPhone,
  currencySymbol,
}: {
  rows: Row[];
  type: "internal" | "external";
  status: string;
  orgName: string;
  orgPhone: string | null;
  currencySymbol: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => (v ? params.set(k, v) : params.delete(k)));
    router.push(`${pathname}?${params.toString()}`);
  };

  const totalSalary = rows.reduce((sum, r) => sum + Number(r.salary || 0), 0);
  const printedOn = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-4">
      {/* أدوات الاختيار — لا تظهر في الورق */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm print:hidden">
        <Field label="النوع">
          <select
            value={type}
            onChange={(e) => handleChange({ type: e.target.value })}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          >
            <option value="internal">السائقون الداخليون</option>
            <option value="external">الموردون</option>
          </select>
        </Field>

        <Field label="الحالة">
          <select
            value={status}
            onChange={(e) => handleChange({ status: e.target.value })}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          >
            <option value="active">النشطون فقط</option>
            <option value="all">الكل</option>
            <option value="inactive">غير النشطين</option>
          </select>
        </Field>

        <div className="mr-auto flex items-center gap-2">
          <button
            onClick={() => window.print()}
            type="button"
            className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            <Printer size={15} /> طباعة / حفظ PDF
          </button>
        </div>
      </div>

      <div className="print-keep rounded-2xl border border-zinc-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
        {/* رأس الورقة — يظهر عند الطباعة فقط */}
        <div className="hidden print:block print:mb-4">
          <div className="flex items-start justify-between border-b border-zinc-300 pb-3">
            <div>
              <div className="text-base font-bold text-zinc-900">{orgName}</div>
              {orgPhone && (
                <div dir="ltr" className="text-xs text-zinc-500">
                  {orgPhone}
                </div>
              )}
            </div>
            <div className="text-left">
              <div className="text-sm font-bold text-zinc-900">
                كشف {TYPE_LABELS[type]}
              </div>
              <div dir="ltr" className="text-xs text-zinc-500">
                {printedOn}
              </div>
            </div>
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={Users} title="لا يوجد سائقون بهذا التحديد" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-right text-xs text-zinc-500">
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">الاسم</th>
                  <th className="px-4 py-3 font-medium">رقم الجوال</th>
                  <th className="px-4 py-3 font-medium">الراتب</th>
                  <th className="px-4 py-3 font-medium print:hidden">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className="border-b border-zinc-50">
                    <td className="px-4 py-2.5 text-zinc-400" dir="ltr">
                      {i + 1}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-zinc-900">{r.name}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-zinc-600" dir="ltr">
                      {r.phone || "—"}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-zinc-900" dir="ltr">
                      {formatCurrency(r.salary, currencySymbol)}
                    </td>
                    <td className="px-4 py-2.5 print:hidden">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          r.status === "active"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {r.status === "active" ? "نشط" : "غير نشط"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-zinc-200 bg-zinc-50 font-bold text-zinc-900">
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3">الإجمالي ({formatNumber(rows.length)})</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 whitespace-nowrap" dir="ltr">
                    {formatCurrency(totalSalary, currencySymbol)}
                  </td>
                  <td className="px-4 py-3 print:hidden" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
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
