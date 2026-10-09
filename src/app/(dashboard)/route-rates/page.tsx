import { createClient } from "@/lib/supabase/server";
import { RouteRatesManager } from "@/components/route-rates/RouteRatesManager";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

// خطوط السير العامة (0035): تُكتب مرة وتسري على كل سائقي الشركة.
// الخاصة بسائق بعينه تبقى في صفحته وتظل تغلب العام.

export default async function RouteRatesPage() {
  const supabase = await createClient();

  const [{ data: rates, error }, { data: settings }] = await Promise.all([
    supabase
      .from("route_rates")
      .select("id, from_city, to_city, trab_amount, notes")
      .order("from_city")
      .order("to_city"),
    supabase.from("settings").select("currency_symbol").single(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">خطوط السير العامة</h1>
        <p className="text-sm text-zinc-500">
          ترب كل خط سير يُكتب مرة واحدة ويسري على جميع سائقي الشركة — بما فيهم من يُضاف لاحقاً
        </p>
      </div>

      <ErrorBanner
        error={error}
        hint="تأكد من تشغيل ملف SQL رقم 0035 (جدول route_rates)."
      />

      <RouteRatesManager
        rates={(rates ?? []).map((r) => ({
          id: r.id as string,
          from_city: r.from_city as string,
          to_city: r.to_city as string,
          trab_amount: Number(r.trab_amount) || 0,
          notes: (r.notes as string | null) ?? null,
        }))}
        currencySymbol={settings?.currency_symbol ?? "ر.س"}
      />
    </div>
  );
}
