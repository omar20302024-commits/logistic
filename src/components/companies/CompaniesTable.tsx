"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Search, Plus, Pencil, Trash2, FileText, Building2 } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CompanyFormModal, type CompanyRecord } from "./CompanyFormModal";
import { deleteCompany } from "@/app/(dashboard)/companies/actions";

export function CompaniesTable({
  companies,
  total,
  page,
  pageSize,
  initialQuery,
  initialStatus,
}: {
  companies: CompanyRecord[];
  total: number;
  page: number;
  pageSize: number;
  initialQuery: string;
  initialStatus: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(initialQuery);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyRecord | null>(null);
  const [deletingCompany, setDeletingCompany] = useState<CompanyRecord | null>(null);

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
    if (!deletingCompany) return;
    const result = await deleteCompany(deletingCompany.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("تم حذف الشركة");
      setDeletingCompany(null);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
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
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingCompany(null);
            setFormOpen(true);
          }}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          <Plus size={16} />
          إضافة شركة
        </button>
      </div>

      {companies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="لا توجد شركات بعد"
          description="ابدأ بإضافة أول شركة عميل لديك"
          action={
            <button
              type="button"
              onClick={() => {
                setEditingCompany(null);
                setFormOpen(true);
              }}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              إضافة شركة
            </button>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-right text-xs text-zinc-500">
                <th className="px-4 py-3 font-medium">اسم الشركة</th>
                <th className="px-4 py-3 font-medium">الهاتف</th>
                <th className="px-4 py-3 font-medium">المسؤول</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
                <th className="px-4 py-3 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr key={company.id} className="border-b border-zinc-50 hover:bg-zinc-50/60">
                  <td className="px-4 py-3">
                    <Link
                      href={`/companies/${company.id}`}
                      className="font-medium text-zinc-900 hover:underline"
                    >
                      {company.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-600" dir="ltr">
                    {company.phone || "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{company.contact_person || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        company.status === "active"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {company.status === "active" ? "نشط" : "غير نشط"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/companies/${company.id}`}
                        title="تفاصيل"
                        className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                      >
                        <FileText size={16} />
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCompany(company);
                          setFormOpen(true);
                        }}
                        title="تعديل"
                        className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingCompany(company)}
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

      <CompanyFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        company={editingCompany}
        onSaved={() => router.refresh()}
      />

      <ConfirmDialog
        open={!!deletingCompany}
        onClose={() => setDeletingCompany(null)}
        onConfirm={handleDelete}
        title="حذف الشركة"
        description={`هل أنت متأكد من حذف "${deletingCompany?.name}"؟ لا يمكن التراجع عن هذا الإجراء.`}
      />
    </div>
  );
}
