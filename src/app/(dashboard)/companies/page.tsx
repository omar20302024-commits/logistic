import { createClient } from "@/lib/supabase/server";
import { CompaniesTable } from "@/components/companies/CompaniesTable";

const PAGE_SIZE = 20;

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const status = params.status === "active" || params.status === "inactive" ? params.status : "";
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const supabase = await createClient();

  let query = supabase.from("companies").select("*", { count: "exact" });

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
        <h1 className="text-xl font-bold text-zinc-900">الشركات</h1>
        <p className="text-sm text-zinc-500">إدارة شركات العملاء</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          حدث خطأ أثناء تحميل بيانات الشركات.
        </div>
      )}

      <CompaniesTable
        companies={data ?? []}
        total={count ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        initialQuery={q}
        initialStatus={status}
      />
    </div>
  );
}
