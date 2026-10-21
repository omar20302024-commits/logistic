import { Database, Download } from "lucide-react";
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
            reviewed_by: settings?.reviewed_by ?? "",
            currency_code: settings?.currency_code ?? "SAR",
            currency_symbol: settings?.currency_symbol ?? "ر.س",
            count_cancelled_trips_in_profit: settings?.count_cancelled_trips_in_profit ?? false,
          }}
        />
      </div>

      <div className="max-w-2xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-zinc-900">
          <Database size={15} />
          نسخة احتياطية
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          ملف Excel واحد، كل جدول في ورقة مستقلة، بكل البيانات لا عيّنة منها. احفظه على
          جهازك دورياً.
        </p>
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          هذه نسخة للأرشفة والقراءة — لا تحمل الدوال ولا الصلاحيات ولا الفهارس، فلا
          تُعاد بها قاعدة البيانات بضغطة. للنسخة الكاملة القابلة للاستعادة استعمل
          <span dir="ltr" className="mx-1 font-mono">
            pg_dump
          </span>
          من لوحة Supabase.
        </p>
        <a
          href="/api/backup"
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          <Download size={15} />
          تنزيل نسخة احتياطية (Excel)
        </a>
      </div>
    </div>
  );
}
