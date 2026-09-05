import { createClient } from "@/lib/supabase/server";
import { ExpensesTable } from "@/components/expenses/ExpensesTable";

const PAGE_SIZE = 20;

function firstDayOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; page?: string }>;
}) {
  const params = await searchParams;
  const from = params.from || firstDayOfMonth();
  const to = params.to || today();
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const supabase = await createClient();

  const rangeFrom = (page - 1) * PAGE_SIZE;
  const rangeTo = rangeFrom + PAGE_SIZE - 1;

  const [{ data, count, error }, { data: settings }] = await Promise.all([
    supabase
      .from("expenses")
      .select("*", { count: "exact" })
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: false })
      .range(rangeFrom, rangeTo),
    supabase.from("settings").select("currency_symbol").single(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">المصروفات الأخرى</h1>
        <p className="text-sm text-zinc-500">مصروفات إدارية عامة تُخصم من الربح التشغيلي في التقرير المالي</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          حدث خطأ أثناء تحميل المصروفات.
        </div>
      )}

      <ExpensesTable
        expenses={data ?? []}
        total={count ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        currencySymbol={settings?.currency_symbol ?? "ر.س"}
        filters={{ from, to }}
      />
    </div>
  );
}
