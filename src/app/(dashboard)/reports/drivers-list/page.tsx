import { createClient } from "@/lib/supabase/server";
import { DriversListTable } from "@/components/reports/DriversListTable";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ReviewedByFooter } from "@/components/ui/ReviewedByFooter";

// كشف السائقين: الاسم والجوال والراتب، داخليين أو موردين، للطباعة أو PDF.
// قراءة فقط من جدول drivers — لا يمس أي حساب قائم.

export default async function DriversListPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string }>;
}) {
  const params = await searchParams;
  const type = params.type === "external" ? "external" : "internal";
  // النشطون فقط افتراضياً — كشف رواتب فيه سائقون تركوا العمل مُربك عند الصرف
  const status =
    params.status === "all" || params.status === "inactive" ? params.status : "active";

  const supabase = await createClient();

  let query = supabase
    .from("drivers")
    .select("id, name, phone, salary, status")
    .eq("employment_type", type);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const [{ data: rows, error }, { data: settings }] = await Promise.all([
    query.order("name"),
    supabase.from("settings").select("org_name, org_phone, currency_symbol, reviewed_by").single(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <h1 className="text-xl font-bold text-zinc-900">كشف السائقين</h1>
        <p className="text-sm text-zinc-500">الأسماء وأرقام الجوال والرواتب — للطباعة أو الحفظ PDF</p>
      </div>

      <ErrorBanner error={error} hint="تأكد من تشغيل ملف SQL رقم 0001 (جدول drivers)." />

      <DriversListTable
        rows={rows ?? []}
        type={type}
        status={status}
        orgName={settings?.org_name ?? "مؤسستي"}
        orgPhone={settings?.org_phone ?? null}
        currencySymbol={settings?.currency_symbol ?? "ر.س"}
      />

      <ReviewedByFooter name={settings?.reviewed_by} />
    </div>
  );
}
