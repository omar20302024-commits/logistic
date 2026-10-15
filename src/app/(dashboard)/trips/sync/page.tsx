import { createClient } from "@/lib/supabase/server";
import { SheetSyncWorkflow } from "@/components/trips/sync/SheetSyncWorkflow";

// مزامنة رحلات من جوجل شيت (0037) — مستقلة عن استيراد Excel، وكلاهما يعمل.

export default async function TripsSyncPage() {
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("settings")
    .select("trips_sheet_url")
    .single();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">مزامنة رحلات من جوجل شيت</h1>
        <p className="text-sm text-zinc-500">
          اقرأ شيت الرحلات الذي ترسله الشركة — النظام يعرض الجديد للمراجعة قبل الاستيراد،
          ولا يكرّر ما استُورد سابقاً
        </p>
      </div>

      <SheetSyncWorkflow initialUrl={(settings?.trips_sheet_url as string | null) ?? ""} />
    </div>
  );
}
