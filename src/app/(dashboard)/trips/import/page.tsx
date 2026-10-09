import { createClient } from "@/lib/supabase/server";
import { ImportWorkflow } from "@/components/trips/import/ImportWorkflow";

export default async function TripsImportPage() {
  const supabase = await createClient();

  // نجلب معدَّلات السائقين وخطوط سيرهم حتى تعرض المعاينة الترب الحقيقي قبل
  // التأكيد، بدل أن يُملأ على الخادم وقت الحفظ فلا يراه المستخدم.
  const [{ data: drivers }, { data: companies }, { data: routeRates }, { data: globalRouteRates }] =
    await Promise.all([
      supabase
        .from("drivers")
        .select("id, name, default_trip_payment, extra_stop_rate, employment_type")
        .order("name"),
      supabase.from("companies").select("id, name").order("name"),
      supabase.from("driver_route_rates").select("driver_id, from_city, to_city, trab_amount"),
      // خطوط السير العامة (0035) — لسائقي الشركة فقط
      supabase.from("route_rates").select("from_city, to_city, trab_amount"),
    ]);

  const ratesByDriver = new Map<string, { from_city: string; to_city: string; trab_amount: number }[]>();
  for (const r of routeRates ?? []) {
    const list = ratesByDriver.get(r.driver_id as string) ?? [];
    list.push({
      from_city: r.from_city as string,
      to_city: r.to_city as string,
      trab_amount: Number(r.trab_amount) || 0,
    });
    ratesByDriver.set(r.driver_id as string, list);
  }

  const driverOptions = (drivers ?? []).map((d) => ({
    id: d.id as string,
    name: d.name as string,
    default_trip_payment: Number(d.default_trip_payment) || 0,
    extra_stop_rate: Number(d.extra_stop_rate) || 0,
    employment_type: d.employment_type as "internal" | "external",
    route_rates: ratesByDriver.get(d.id as string) ?? [],
  }));

  const globalRates = (globalRouteRates ?? []).map((r) => ({
    from_city: r.from_city as string,
    to_city: r.to_city as string,
    trab_amount: Number(r.trab_amount) || 0,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">استيراد رحلات من Excel</h1>
        <p className="text-sm text-zinc-500">
          ارفع ملف تقرير الرحلات كما تستلمه من العميل — النظام يحلّله ويعرضه للمراجعة قبل الحفظ النهائي
        </p>
      </div>

      <ImportWorkflow
        drivers={driverOptions}
        companies={companies ?? []}
        globalRouteRates={globalRates}
      />
    </div>
  );
}
