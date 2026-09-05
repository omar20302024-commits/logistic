import { createClient } from "@/lib/supabase/server";
import { SalariesTable } from "@/components/salaries/SalariesTable";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

const PAGE_SIZE = 20;

export default async function SalariesPage({
  searchParams,
}: {
  searchParams: Promise<{ driver?: string; month?: string; year?: string; page?: string }>;
}) {
  const params = await searchParams;
  const driverId = params.driver ?? "";
  const month = params.month ?? "";
  const year = params.year ?? "";
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const supabase = await createClient();

  let query = supabase.from("v_salary_statements").select("*", { count: "exact" });
  if (driverId) query = query.eq("driver_id", driverId);
  if (month) query = query.eq("month", Number(month));
  if (year) query = query.eq("year", Number(year));

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const [{ data, count, error }, { data: drivers }, { data: settings }] = await Promise.all([
    query.order("year", { ascending: false }).order("month", { ascending: false }).range(from, to),
    supabase.from("drivers").select("id, name, salary").order("name"),
    supabase.from("settings").select("currency_symbol").single(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">الرواتب</h1>
        <p className="text-sm text-zinc-500">تسجيل ومتابعة رواتب السائقين الشهرية</p>
      </div>

      <ErrorBanner error={error} hint="تأكد من تشغيل ملف SQL رقم 0005 (v_salary_statements)." />

      <SalariesTable
        salaries={data ?? []}
        total={count ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        drivers={drivers ?? []}
        currencySymbol={settings?.currency_symbol ?? "ر.س"}
        filters={{ driverId, month, year }}
      />
    </div>
  );
}
