import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/settings/SettingsForm";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: settings } = await supabase.from("settings").select("*").single();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">الإعدادات</h1>
        <p className="text-sm text-zinc-500">إعدادات عامة للنظام</p>
      </div>

      <div className="max-w-2xl">
        <SettingsForm
          initial={{
            org_name: settings?.org_name ?? "",
            org_phone: settings?.org_phone ?? "",
            org_address: settings?.org_address ?? "",
            currency_code: settings?.currency_code ?? "SAR",
            currency_symbol: settings?.currency_symbol ?? "ر.س",
            count_cancelled_trips_in_profit: settings?.count_cancelled_trips_in_profit ?? false,
          }}
        />
      </div>
    </div>
  );
}
