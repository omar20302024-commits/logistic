import { createClient } from "@/lib/supabase/server";
import { VendorsTable } from "@/components/vendors/VendorsTable";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ReviewedByFooter } from "@/components/ui/ReviewedByFooter";
import type { VendorReportRow, VendorRecord } from "@/lib/validation/vendor";

// الموردون (0043): جهة تجمع عدّة سائقين خارجيين بأسماء وسيارات مختلفة.
// هذه الصفحة داخلية — فيها سعر العميل والربح.

function firstDayOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const from = params.from || firstDayOfMonth();
  const to = params.to || today();

  const supabase = await createClient();

  const [{ data: rows, error }, { data: vendors }, { data: settings }] = await Promise.all([
    supabase.rpc("fn_vendors_report", { p_from: from, p_to: to }),
    supabase
      .from("vendors")
      .select(
        "id, name, phone, notes, status, opening_balance, opening_reason, opening_date, opening_settlement_id"
      )
      .order("name"),
    supabase.from("settings").select("currency_symbol, reviewed_by").single(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <h1 className="text-xl font-bold text-zinc-900">الموردون</h1>
        <p className="text-sm text-zinc-500">
          سيارات وسائقون من خارج الشركة — كل مورّد قد يشغّل أكثر من سائق تحت اسمه
        </p>
      </div>

      <ErrorBanner
        error={error}
        hint="تأكد من تشغيل ملفَّي SQL رقم 0043 و 0044 (الموردون وكشوفاتهم)."
      />

      <VendorsTable
        rows={(rows ?? []) as VendorReportRow[]}
        vendors={(vendors ?? []) as VendorRecord[]}
        from={from}
        to={to}
        currencySymbol={settings?.currency_symbol ?? "ر.س"}
      />

      <ReviewedByFooter name={settings?.reviewed_by} />
    </div>
  );
}
