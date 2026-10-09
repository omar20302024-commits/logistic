import { createClient } from "@/lib/supabase/server";
import { DriversTable } from "@/components/drivers/DriversTable";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

const PAGE_SIZE = 20;

export default async function DriversPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; type?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const status = params.status === "active" || params.status === "inactive" ? params.status : "";
  const type = params.type === "internal" || params.type === "external" ? params.type : "";
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const supabase = await createClient();

  // من v_vehicle_current_driver لا من vehicles: نحتاج أن نعرف من يحمل كل سيارة
  // الآن، حتى يظهر ذلك في القائمة ويُطلَب تحويل عند اختيار سيارة مشغولة (0034).
  const { data: vehicleRows } = await supabase
    .from("v_vehicle_current_driver")
    .select("vehicle_id, vehicle_no, driver_id, driver_name")
    .eq("status", "active")
    .order("vehicle_no");

  const vehicles = (vehicleRows ?? []).map((v) => ({
    id: v.vehicle_id as string,
    vehicle_no: v.vehicle_no as string,
    holder_id: (v.driver_id as string | null) ?? null,
    holder_name: (v.driver_name as string | null) ?? null,
  }));

  let query = supabase.from("drivers").select("*", { count: "exact" });

  if (q) {
    query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
  }
  if (status) {
    query = query.eq("status", status);
  }
  if (type) {
    query = query.eq("employment_type", type);
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">السائقون</h1>
        <p className="text-sm text-zinc-500">إدارة بيانات السائقين وحالاتهم</p>
      </div>

      <ErrorBanner error={error} hint="تأكد من تشغيل ملف SQL رقم 0001 (جدول drivers)." />

      <DriversTable
        drivers={data ?? []}
        total={count ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        initialQuery={q}
        initialStatus={status}
        initialType={type}
        vehicles={vehicles ?? []}
      />
    </div>
  );
}
