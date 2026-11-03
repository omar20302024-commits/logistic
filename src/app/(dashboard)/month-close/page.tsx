import { createClient } from "@/lib/supabase/server";
import { MonthCloseWorkflow } from "@/components/salaries/MonthCloseWorkflow";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

// إقفال الشهر (0057): تصفية تربات وعهدة وتسجيل الراتب مدفوعاً، لمجموعة
// سائقين دفعة واحدة بدل فتح صفحة كل سائق.

export default async function MonthClosePage() {
  const supabase = await createClient();

  const [{ data, error }, { data: settings }] = await Promise.all([
    supabase
      .from("drivers")
      .select("id, name, employment_type")
      .eq("status", "active")
      .order("name"),
    supabase.from("settings").select("currency_symbol").single(),
  ]);

  const currencySymbol = settings?.currency_symbol ?? "ر.س";

  const drivers = (data ?? []).map((d) => ({
    id: d.id as string,
    name: d.name as string,
    employment_type: (d.employment_type as "internal" | "external") ?? "internal",
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">إقفال الشهر</h1>
        <p className="text-sm text-zinc-500">
          صفّ تربات السائقين وعهدتهم وسجّل رواتبهم مدفوعة — دفعة واحدة بعد مراجعة
          الأرقام
        </p>
      </div>

      <ErrorBanner error={error} hint="تأكد من تشغيل ملف SQL رقم 0001 (جدول drivers)." />

      <MonthCloseWorkflow drivers={drivers} currencySymbol={currencySymbol} />
    </div>
  );
}
