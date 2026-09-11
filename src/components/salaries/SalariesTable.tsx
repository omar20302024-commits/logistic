"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Wallet, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SalaryFormModal, type SalaryRecord } from "./SalaryFormModal";
import { deleteSalary, generateMonthSalaries } from "@/app/(dashboard)/salaries/actions";
import { formatCurrency } from "@/lib/format";
import { monthLabels } from "@/lib/validation/salary";

type DriverOption = { id: string; name: string; salary: number };

type SalaryRow = SalaryRecord & {
  driver_name: string;
  pre_hire_days: number;
  leave_days: number;
  worked_days: number;
  earned_salary: number;
  deductions_total: number;
  advances_total: number;
  net_salary: number;
  remaining_amount: number;
};

export function SalariesTable({
  salaries,
  total,
  page,
  pageSize,
  drivers,
  currencySymbol,
  filters,
}: {
  salaries: SalaryRow[];
  total: number;
  page: number;
  pageSize: number;
  drivers: DriverOption[];
  currencySymbol: string;
  filters: { driverId: string; month: string; year: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [formOpen, setFormOpen] = useState(false);
  const [editingSalary, setEditingSalary] = useState<SalaryRecord | null>(null);
  const [deletingSalary, setDeletingSalary] = useState<SalaryRow | null>(null);
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [generating, setGenerating] = useState(false);

  // الشهر المستهدَف: اللي في الفلتر، وإلا الشهر الحالي
  const now = new Date();
  const targetYear = filters.year ? Number(filters.year) : now.getFullYear();
  const targetMonth = filters.month ? Number(filters.month) : now.getMonth() + 1;

  const handleGenerate = () => setConfirmGenerate(true);

  const runGenerate = async () => {
    setGenerating(true);
    const result = await generateMonthSalaries(targetYear, targetMonth);
    setGenerating(false);
    setConfirmGenerate(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(
      result.created
        ? `تم إنشاء ${result.created} سجل راتب لشهر ${monthLabels[targetMonth - 1]} ${targetYear}`
        : `كل السائقين لديهم سجل راتب بالفعل في ${monthLabels[targetMonth - 1]} ${targetYear}`
    );
    router.refresh();
  };

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value) params.set(key, value);
        else params.delete(key);
      });
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const handleDelete = async () => {
    if (!deletingSalary) return;
    const result = await deleteSalary(deletingSalary.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("تم حذف سجل الراتب");
      setDeletingSalary(null);
      router.refresh();
    }
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-zinc-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filters.driverId}
            onChange={(e) => updateParams({ driver: e.target.value, page: "1" })}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          >
            <option value="">كل السائقين</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            value={filters.month}
            onChange={(e) => updateParams({ month: e.target.value, page: "1" })}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          >
            <option value="">كل الأشهر</option>
            {monthLabels.map((label, i) => (
              <option key={i + 1} value={i + 1}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={filters.year}
            onChange={(e) => updateParams({ year: e.target.value, page: "1" })}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          >
            <option value="">كل السنوات</option>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            title="ينشئ سجل راتب لكل سائق داخلي نشط لم يُسجَّل له راتب في الشهر المحدد"
            className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            <Sparkles size={16} />
            {generating ? "جارٍ التوليد..." : "توليد رواتب الشهر"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingSalary(null);
              setFormOpen(true);
            }}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            <Plus size={16} />
            تسجيل راتب
          </button>
        </div>
      </div>

      {salaries.length === 0 ? (
        <EmptyState icon={Wallet} title="لا توجد رواتب مسجَّلة بعد" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-right text-xs text-zinc-500">
                <th className="px-4 py-3 font-medium">السائق</th>
                <th className="px-4 py-3 font-medium">الشهر/السنة</th>
                <th className="px-4 py-3 font-medium">الراتب الأساسي</th>
                <th className="px-4 py-3 font-medium">أيام العمل</th>
                <th className="px-4 py-3 font-medium">المستحق</th>
                <th className="px-4 py-3 font-medium">الخصومات</th>
                <th className="px-4 py-3 font-medium">السلف</th>
                <th className="px-4 py-3 font-medium">صافي الراتب</th>
                <th className="px-4 py-3 font-medium">المدفوع</th>
                <th className="px-4 py-3 font-medium">المتبقي</th>
                <th className="px-4 py-3 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {salaries.map((s) => (
                <tr key={s.id} className="border-b border-zinc-50 hover:bg-zinc-50/60">
                  <td className="px-4 py-3 font-medium text-zinc-900">{s.driver_name}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-600">
                    {monthLabels[s.month - 1]} {s.year}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-700" dir="ltr">
                    {formatCurrency(s.basic_salary, currencySymbol)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" dir="ltr">
                    <span
                      className={
                        s.worked_days < 30 ? "font-semibold text-amber-600" : "text-zinc-500"
                      }
                    >
                      {s.worked_days} / 30
                    </span>
                    {(s.leave_days > 0 || s.pre_hire_days > 0) && (
                      <span className="text-[11px] text-zinc-400">
                        {" ("}
                        {[
                          s.leave_days > 0 ? `إجازة ${s.leave_days}` : null,
                          s.pre_hire_days > 0 ? `قبل التعيين ${s.pre_hire_days}` : null,
                        ]
                          .filter(Boolean)
                          .join(" + ")}
                        {")"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-900" dir="ltr">
                    {formatCurrency(s.earned_salary, currencySymbol)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-red-600" dir="ltr">
                    {formatCurrency(s.deductions_total, currencySymbol)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-amber-600" dir="ltr">
                    {formatCurrency(s.advances_total, currencySymbol)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-semibold text-zinc-900" dir="ltr">
                    {formatCurrency(s.net_salary, currencySymbol)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-700" dir="ltr">
                    {formatCurrency(s.paid_amount, currencySymbol)}
                  </td>
                  <td
                    className={`px-4 py-3 whitespace-nowrap font-semibold ${
                      s.remaining_amount > 0 ? "text-red-600" : "text-emerald-600"
                    }`}
                    dir="ltr"
                  >
                    {formatCurrency(s.remaining_amount, currencySymbol)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSalary(s);
                          setFormOpen(true);
                        }}
                        title="تعديل"
                        className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingSalary(s)}
                        title="حذف"
                        className="rounded-lg p-1.5 text-zinc-500 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={(p) => updateParams({ page: String(p) })}
      />

      <SalaryFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        salary={editingSalary}
        drivers={drivers}
        onSaved={() => router.refresh()}
      />

      <ConfirmDialog
        open={confirmGenerate}
        onClose={() => setConfirmGenerate(false)}
        onConfirm={runGenerate}
        title={`توليد رواتب ${monthLabels[targetMonth - 1]} ${targetYear}`}
        description={`سيُنشأ سجل راتب لكل سائق داخلي نشط معيَّن قبل نهاية الشهر — حتى من ليس له أي رحلة، لأن الراتب مستقل عن الرحلات. المبلغ يُؤخذ من الراتب التعاقدي لكل سائق، ويُخصم منه تلقائياً أيام الإجازة وما قبل التعيين. من له سجل بالفعل يُترك كما هو، فالتكرار آمن. الموردون الخارجيون مستثنون.${
          filters.month || filters.year
            ? ""
            : " (لم تحدّد شهراً في الفلتر، فسيُستخدم الشهر الحالي.)"
        }`}
      />

      <ConfirmDialog
        open={!!deletingSalary}
        onClose={() => setDeletingSalary(null)}
        onConfirm={handleDelete}
        title="حذف سجل الراتب"
        description={`هل أنت متأكد من حذف راتب "${deletingSalary?.driver_name}" لشهر ${
          deletingSalary ? monthLabels[deletingSalary.month - 1] : ""
        } ${deletingSalary?.year}؟`}
      />
    </div>
  );
}
