import { createClient } from "@/lib/supabase/server";
import { ImportWorkflow } from "@/components/trips/import/ImportWorkflow";

export default async function TripsImportPage() {
  const supabase = await createClient();

  const [{ data: drivers }, { data: companies }] = await Promise.all([
    supabase.from("drivers").select("id, name").order("name"),
    supabase.from("companies").select("id, name").order("name"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">استيراد رحلات من Excel</h1>
        <p className="text-sm text-zinc-500">
          ارفع ملف تقرير الرحلات كما تستلمه من العميل — النظام يحلّله ويعرضه للمراجعة قبل الحفظ النهائي
        </p>
      </div>

      <ImportWorkflow drivers={drivers ?? []} companies={companies ?? []} />
    </div>
  );
}
