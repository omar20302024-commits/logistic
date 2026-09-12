import { createClient } from "@/lib/supabase/server";
import { VehiclesTable } from "@/components/vehicles/VehiclesTable";
import { VehicleTypesSection } from "@/components/vehicles/VehicleTypesSection";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

export default async function VehiclesPage() {
  const supabase = await createClient();

  const [{ data: vehicles, error }, { data: types }] = await Promise.all([
    supabase.from("vehicles").select("*").order("vehicle_no"),
    supabase.from("vehicle_types").select("*").order("sort_order"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">السيارات</h1>
        <p className="text-sm text-zinc-500">
          سجل سيارات الأسطول وأنواعها — تُربط بالسائق وتُسجَّل على الرحلة
        </p>
      </div>

      <ErrorBanner error={error} hint="تأكد من تشغيل ملف SQL رقم 0022 (جدولا vehicles و vehicle_types)." />

      <VehicleTypesSection types={types ?? []} />
      <VehiclesTable vehicles={vehicles ?? []} types={types ?? []} />
    </div>
  );
}
