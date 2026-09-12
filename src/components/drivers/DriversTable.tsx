"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Search, Plus, Pencil, Trash2, FileText, Users } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DriverFormModal, type DriverRecord } from "./DriverFormModal";
import { deleteDriver } from "@/app/(dashboard)/drivers/actions";
import { formatCurrency } from "@/lib/format";

export function DriversTable({
  drivers,
  total,
  page,
  pageSize,
  initialQuery,
  initialStatus,
  initialType,
  vehicles,
}: {
  drivers: DriverRecord[];
  total: number;
  page: number;
  pageSize: number;
  initialQuery: string;
  initialStatus: string;
  initialType: string;
  vehicles: { id: string; vehicle_no: string; plate_no: string | null }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(initialQuery);
  const [formOpen, setFormOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<DriverRecord | null>(null);
  const [deletingDriver, setDeletingDriver] = useState<DriverRecord | null>(null);

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

  // بحث مع تأخير بسيط (debounce)
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (search !== initialQuery) {
        updateParams({ q: search, page: "1" });
      }
    }, 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleDelete = async () => {
    if (!deletingDriver) return;
    const result = await deleteDriver(deletingDriver.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("تم حذف السائق");
      setDeletingDriver(null);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      {/* شريط الأدوات */}
      <div className="flex flex-col gap-3 border-b border-zinc-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <div className="relative flex-1 sm:max-w-xs">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو الهاتف..."
              className="w-full rounded-lg border border-zinc-300 py-2 pr-9 pl-3 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
          </div>
          <select
            value={initialStatus}
            onChange={(e) => updateParams({ status: e.target.value, page: "1" })}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
          >
            <option value="">كل الحالات</option>
            <option value="active">نشط</option>
            <option value="inactive">غير نشط</option>
          </select>
          <select
            value={initialType}
            onChange={(e) => updateParams({ type: e.target.value, page: "1" })}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
          >
            <option value="">كل الأنواع</option>
            <option value="internal">موظف داخلي</option>
            <option value="external">مورد خارجي</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingDriver(null);
            setFormOpen(true);
          }}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          <Plus size={16} />
          إضافة سائق
        </button>
      </div>

      {/* الجدول */}
      {drivers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="لا يوجد سائقون بعد"
          description="ابدأ بإضافة أول سائق لديك لتتمكن من تسجيل الرحلات"
          action={
            <button
              type="button"
              onClick={() => {
                setEditingDriver(null);
                setFormOpen(true);
              }}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              إضافة سائق
            </button>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-right text-xs text-zinc-500">
                <th className="px-4 py-3 font-medium">الاسم</th>
                <th className="px-4 py-3 font-medium">النوع</th>
                <th className="px-4 py-3 font-medium">الهاتف</th>
                <th className="px-4 py-3 font-medium">الراتب الشهري</th>
                <th className="px-4 py-3 font-medium">تاريخ التعيين</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
                <th className="px-4 py-3 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver) => (
                <tr key={driver.id} className="border-b border-zinc-50 hover:bg-zinc-50/60">
                  <td className="px-4 py-3">
                    <Link
                      href={`/drivers/${driver.id}`}
                      className="font-medium text-zinc-900 hover:underline"
                    >
                      {driver.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        driver.employment_type === "external"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {driver.employment_type === "external" ? "مورد خارجي" : "موظف داخلي"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600" dir="ltr">
                    {driver.phone || "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600" dir="ltr">
                    {formatCurrency(driver.salary)}
                  </td>
                  <td className="px-4 py-3 text-zinc-600" dir="ltr">
                    {driver.hire_date || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        driver.status === "active"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {driver.status === "active" ? "نشط" : "غير نشط"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/drivers/${driver.id}`}
                        title="كشف حساب / تفاصيل"
                        className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                      >
                        <FileText size={16} />
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDriver(driver);
                          setFormOpen(true);
                        }}
                        title="تعديل"
                        className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingDriver(driver)}
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

      <DriverFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        driver={editingDriver}
        vehicles={vehicles}
        onSaved={() => router.refresh()}
      />

      <ConfirmDialog
        open={!!deletingDriver}
        onClose={() => setDeletingDriver(null)}
        onConfirm={handleDelete}
        title="حذف السائق"
        description={`هل أنت متأكد من حذف السائق "${deletingDriver?.name}"؟ لا يمكن التراجع عن هذا الإجراء.`}
      />
    </div>
  );
}
