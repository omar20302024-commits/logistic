import { createClient } from "@/lib/supabase/server";
import { DriversTable } from "@/components/drivers/DriversTable";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

const PAGE_SIZE = 20;

export default async function DriversPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const status = params.status === "active" || params.status === "inactive" ? params.status : "";
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const supabase = await createClient();

  let query = supabase.from("drivers").select("*", { count: "exact" });

  if (q) {
    query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
  }
  if (status) {
    query = query.eq("status", status);
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
      />
    </div>
  );
}
