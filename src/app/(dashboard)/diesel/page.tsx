import { createClient } from "@/lib/supabase/server";
import { MonthlyDieselTable } from "@/components/diesel/MonthlyDieselTable";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

export default async function MonthlyDieselPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;

  const supabase = await createClient();

  const [{ data: records, error }, { data: drivers }, { data: settings }] = await Promise.all([
    supabase
      .from("driver_monthly_diesel")
      .select("id, driver_id, year, month, amount, notes, drivers(name)")
      .eq("year", year)
      .eq("month", month)
      .order("created_at"),
    supabase.from("drivers").select("id, name").eq("status", "active").order("name"),
    supabase.from("settings").select("currency_symbol").single(),
  ]);

  // Supabase قد تُرجع العلاقة ككائن أو كمصفوفة حسب استنتاجها للعلاقة، فنتعامل مع الحالتين
  const rows = (records ?? []).map((row) => {
    const r = row as unknown as {
      id: string;
      driver_id: string;
      year: number;
      month: number;
      amount: number;
      notes: string | null;
      drivers: { name: string } | { name: string }[] | null;
    };
    const driver = Array.isArray(r.drivers) ? r.drivers[0] : r.drivers;
    return {
      id: r.id,
      driver_id: r.driver_id,
      driver_name: driver?.name,
      year: r.year,
      month: r.month,
      amount: r.amount,
      notes: r.notes ?? null,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">الديزل الشهري</h1>
        <p className="text-sm text-zinc-500">
          يُسجَّل مرة واحدة لكل سائق عند تقفيل الشهر، بدل تسجيله على كل رحلة
        </p>
      </div>

      <ErrorBanner error={error} hint="تأكد من تشغيل ملف SQL رقم 0020 (جدول driver_monthly_diesel)." />

      <MonthlyDieselTable
        records={rows}
        drivers={drivers ?? []}
        currencySymbol={settings?.currency_symbol ?? "ر.س"}
        filters={{ year, month }}
      />
    </div>
  );
}
