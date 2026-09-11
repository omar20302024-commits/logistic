"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Search, Plus, Pencil, Trash2, Truck } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { deleteTrip } from "@/app/(dashboard)/trips/actions";
import { formatCurrency } from "@/lib/format";
import { statusLabels } from "@/lib/validation/trip";

type Option = { id: string; name: string };

type TripRow = {
  id: string;
  trip_number: string;
  trip_date: string;
  driver_name: string;
  company_name: string;
  from_location: string;
  to_location: string;
  trip_amount: number;
  driver_trip_payment: number;
  diesel_amount: number;
  trip_profit: number;
  status: "new" | "in_progress" | "completed" | "cancelled";
  settlement_id: string | null;
  settlement_number: string | null;
};

const statusColors: Record<string, string> = {
  new: "bg-zinc-100 text-zinc-600",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-600",
};

export function TripsTable({
  trips,
  total,
  page,
  pageSize,
  drivers,
  companies,
  filters,
}: {
  trips: TripRow[];
  total: number;
  page: number;
  pageSize: number;
  drivers: Option[];
  companies: Option[];
  filters: { q: string; status: string; driverId: string; companyId: string; from: string; to: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(filters.q);
  const [deletingTrip, setDeletingTrip] = useState<TripRow | null>(null);

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
      if (search !== filters.q) updateParams({ q: search, page: "1" });
    }, 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleDelete = async () => {
    if (!deletingTrip) return;
    const result = await deleteTrip(deletingTrip.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("تم حذف الرحلة");
      setDeletingTrip(null);
      router.refresh();
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      {/* شريط الفلاتر */}
      <div className="flex flex-col gap-3 border-b border-zinc-100 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:max-w-[220px]">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث برقم الرحلة أو المكان..."
              className="w-full rounded-lg border border-zinc-300 py-2 pr-9 pl-3 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
          </div>
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
            value={filters.companyId}
            onChange={(e) => updateParams({ company: e.target.value, page: "1" })}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          >
            <option value="">كل الشركات</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={(e) => updateParams({ status: e.target.value, page: "1" })}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          >
            <option value="">كل الحالات</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => updateParams({ from: e.target.value, page: "1" })}
            dir="ltr"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          />
          <span className="text-xs text-zinc-400">إلى</span>
          <input
            type="date"
            value={filters.to}
            onChange={(e) => updateParams({ to: e.target.value, page: "1" })}
            dir="ltr"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          />
          <Link
            href="/trips/new"
            className="mr-auto flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            <Plus size={16} />
            إضافة رحلة
          </Link>
        </div>
      </div>

      {trips.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="لا توجد رحلات بعد"
          description="ابدأ بتسجيل أول رحلة"
          action={
            <Link
              href="/trips/new"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              إضافة رحلة
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-right text-xs text-zinc-500">
                <th className="px-4 py-3 font-medium">التاريخ</th>
                <th className="px-4 py-3 font-medium">رقم الرحلة</th>
                <th className="px-4 py-3 font-medium">السائق</th>
                <th className="px-4 py-3 font-medium">الشركة</th>
                <th className="px-4 py-3 font-medium">من → إلى</th>
                <th className="px-4 py-3 font-medium">سعر الرحلة</th>
                <th className="px-4 py-3 font-medium">الترب</th>
                <th className="px-4 py-3 font-medium">الديزل</th>
                <th className="px-4 py-3 font-medium">الربح</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
                <th className="px-4 py-3 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {trips.map((trip) => (
                <tr key={trip.id} className="border-b border-zinc-50 hover:bg-zinc-50/60">
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-600" dir="ltr">
                    {trip.trip_date}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <Link
                        href={`/trips/${trip.id}`}
                        className="font-medium text-zinc-900 hover:underline"
                      >
                        {trip.trip_number}
                      </Link>
                      {trip.settlement_id ? (
                        <Link
                          href={`/settlements/${trip.settlement_id}`}
                          className="w-fit rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 hover:bg-emerald-100"
                          title="عرض سند التصفية"
                        >
                          تم تصفية الترب{trip.settlement_number ? ` · ${trip.settlement_number}` : ""}
                        </Link>
                      ) : (
                        <span className="w-fit rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                          الترب غير مُصفّى
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{trip.driver_name}</td>
                  <td className="px-4 py-3 text-zinc-600">{trip.company_name}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-600">
                    {trip.from_location} ← {trip.to_location}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-700" dir="ltr">
                    {formatCurrency(trip.trip_amount)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-700" dir="ltr">
                    {formatCurrency(trip.driver_trip_payment)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-700" dir="ltr">
                    {formatCurrency(trip.diesel_amount)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-semibold text-emerald-700" dir="ltr">
                    {formatCurrency(trip.trip_profit)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusColors[trip.status]}`}>
                      {statusLabels[trip.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/trips/${trip.id}`}
                        title="تعديل"
                        className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                      >
                        <Pencil size={16} />
                      </Link>
                      <button
                        type="button"
                        onClick={() => setDeletingTrip(trip)}
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

      <ConfirmDialog
        open={!!deletingTrip}
        onClose={() => setDeletingTrip(null)}
        onConfirm={handleDelete}
        title="حذف الرحلة"
        description={`هل أنت متأكد من حذف الرحلة "${deletingTrip?.trip_number}"؟ سيتم حذف مواقعها أيضاً. لا يمكن التراجع.`}
      />
    </div>
  );
}
