import { createClient } from "@/lib/supabase/server";
import { TripsTable } from "@/components/trips/TripsTable";

const PAGE_SIZE = 20;

export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    driver?: string;
    company?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const status = params.status ?? "";
  const driverId = params.driver ?? "";
  const companyId = params.company ?? "";
  const from = params.from ?? "";
  const to = params.to ?? "";
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const supabase = await createClient();

  let query = supabase.from("v_trips_full").select("*", { count: "exact" });

  if (q) {
    query = query.or(
      `trip_number.ilike.%${q}%,from_location.ilike.%${q}%,to_location.ilike.%${q}%`
    );
  }
  if (status) query = query.eq("status", status);
  if (driverId) query = query.eq("driver_id", driverId);
  if (companyId) query = query.eq("company_id", companyId);
  if (from) query = query.gte("trip_date", from);
  if (to) query = query.lte("trip_date", to);

  const rangeFrom = (page - 1) * PAGE_SIZE;
  const rangeTo = rangeFrom + PAGE_SIZE - 1;

  const [{ data, count, error }, { data: drivers }, { data: companies }] = await Promise.all([
    query.order("trip_date", { ascending: false }).range(rangeFrom, rangeTo),
    supabase.from("drivers").select("id, name").order("name"),
    supabase.from("companies").select("id, name").order("name"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">الرحلات</h1>
        <p className="text-sm text-zinc-500">إدارة رحلات السائقين وربحيتها</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          حدث خطأ أثناء تحميل الرحلات. تأكد من تشغيل كل ملفات SQL.
        </div>
      )}

      <TripsTable
        trips={data ?? []}
        total={count ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        drivers={drivers ?? []}
        companies={companies ?? []}
        filters={{ q, status, driverId, companyId, from, to }}
      />
    </div>
  );
}
