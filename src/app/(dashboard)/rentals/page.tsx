import { createClient } from "@/lib/supabase/server";
import { RentalContractsTable } from "@/components/rentals/RentalContractsTable";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

export default async function RentalsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const params = await searchParams;
  const month = params.month ?? "";
  const year = params.year ?? "";

  const supabase = await createClient();

  let query = supabase
    .from("rental_contracts")
    .select(
      "*, driver:drivers(name), company:companies(name), housing_unit:housing_units(name)"
    );
  if (month) query = query.eq("month", Number(month));
  if (year) query = query.eq("year", Number(year));

  const [{ data, error }, { data: drivers }, { data: companies }, { data: housingUnits }, { data: settings }] =
    await Promise.all([
      query.order("year", { ascending: false }).order("month", { ascending: false }),
      supabase.from("drivers").select("id, name").order("name"),
      supabase.from("companies").select("id, name").order("name"),
      supabase.from("housing_units").select("id, name").order("name"),
      supabase.from("settings").select("currency_symbol").single(),
    ]);

  type Raw = {
    id: string;
    driver_id: string;
    company_id: string;
    city: string | null;
    month: number;
    year: number;
    monthly_amount: number;
    housing_unit_id: string | null;
    diesel_amount: number;
    notes: string | null;
    driver: { name: string } | null;
    company: { name: string } | null;
    housing_unit: { name: string } | null;
  };

  const rows = ((data ?? []) as unknown as Raw[]).map((r) => ({
    id: r.id,
    driver_id: r.driver_id,
    company_id: r.company_id,
    city: r.city,
    month: r.month,
    year: r.year,
    monthly_amount: r.monthly_amount,
    housing_unit_id: r.housing_unit_id,
    diesel_amount: r.diesel_amount,
    notes: r.notes,
    driver_name: r.driver?.name ?? "—",
    company_name: r.company?.name ?? "—",
    housing_unit_name: r.housing_unit?.name ?? null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">عقود الإيجار الشهري</h1>
        <p className="text-sm text-zinc-500">السائقون المؤجَّرون شهرياً لعملاء بدون رحلات (أو مع رحلات أحياناً)</p>
      </div>

      <ErrorBanner error={error} hint="تأكد من تشغيل ملف SQL رقم 0008 (جدول rental_contracts)." />

      <RentalContractsTable
        contracts={rows}
        drivers={drivers ?? []}
        companies={companies ?? []}
        housingUnits={housingUnits ?? []}
        currencySymbol={settings?.currency_symbol ?? "ر.س"}
        filters={{ month, year }}
      />
    </div>
  );
}
