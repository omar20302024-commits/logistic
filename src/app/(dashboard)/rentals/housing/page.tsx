import { createClient } from "@/lib/supabase/server";
import { HousingTable } from "@/components/rentals/HousingTable";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

export default async function HousingUnitsPage() {
  const supabase = await createClient();

  const [{ data: units, error }, { data: settings }] = await Promise.all([
    supabase.from("housing_units").select("*").order("name"),
    supabase.from("settings").select("currency_symbol").single(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">وحدات السكن</h1>
        <p className="text-sm text-zinc-500">أماكن سكن السائقين المؤجَّرين — تُستخدم لتقسيم تكلفة الإيجار تلقائياً</p>
      </div>

      <ErrorBanner error={error} hint="تأكد من تشغيل ملف SQL رقم 0008 (جدول housing_units)." />

      <HousingTable units={units ?? []} currencySymbol={settings?.currency_symbol ?? "ر.س"} />
    </div>
  );
}
