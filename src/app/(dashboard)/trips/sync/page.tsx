import { createClient } from "@/lib/supabase/server";
import { SheetSyncWorkflow } from "@/components/trips/sync/SheetSyncWorkflow";

// مزامنة رحلات من جوجل شيت (0037) — مستقلة عن استيراد Excel، وكلاهما يعمل.

export default async function TripsSyncPage() {
  const supabase = await createClient();

  // نفس ما تجلبه شاشة استيراد Excel: المعاينة تحتاج معدَّلات السائقين وخطوط
  // سيرهم لتعرض الترب الحقيقي قبل الاستيراد، وقائمة السواقين لمطابقة الأسماء
  // المختلفة بين الشيت والنظام.
  const [
    { data: settings },
    { data: drivers },
    { data: companies },
    { data: vendors },
    { data: routeRates },
    { data: globalRouteRates },
  ] = await Promise.all([
    supabase.from("settings").select("trips_sheet_url").single(),
    supabase
      .from("drivers")
      .select("id, name, default_trip_payment, extra_stop_rate, employment_type, vendor_id")
      .order("name"),
    supabase.from("companies").select("id, name").order("name"),
    supabase.from("vendors").select("id, name").eq("status", "active").order("name"),
    supabase.from("v_driver_effective_rates").select("driver_id, from_city, to_city, trab_amount"),
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

  // اسم المورّد بجانب السائق في القائمة — الأسماء الخارجية تتشابه، والمورّد
  // هو ما يميّزها عند المطابقة
  const vendorNameById = new Map(
    (vendors ?? []).map((v) => [v.id as string, v.name as string])
  );

  const driverOptions = (drivers ?? []).map((d) => ({
    id: d.id as string,
    name: d.name as string,
    default_trip_payment: Number(d.default_trip_payment) || 0,
    extra_stop_rate: Number(d.extra_stop_rate) || 0,
    employment_type: d.employment_type as "internal" | "external",
    vendor_name: d.vendor_id ? (vendorNameById.get(d.vendor_id as string) ?? null) : null,
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
        <h1 className="text-xl font-bold text-zinc-900">مزامنة رحلات من جوجل شيت</h1>
        <p className="text-sm text-zinc-500">
          اقرأ شيت الرحلات الذي ترسله الشركة — النظام يعرض الجديد للمراجعة قبل الاستيراد،
          ولا يكرّر ما استُورد سابقاً
        </p>
      </div>

      <SheetSyncWorkflow
        initialUrl={(settings?.trips_sheet_url as string | null) ?? ""}
        drivers={driverOptions}
        companies={(companies ?? []).map((c) => ({ id: c.id as string, name: c.name as string }))}
        vendors={(vendors ?? []).map((v) => ({ id: v.id as string, name: v.name as string }))}
        globalRouteRates={globalRates}
      />
    </div>
  );
}
