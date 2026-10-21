import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PrintClientButton } from "@/components/statement/PrintClientButton";
import {
  VendorSettlementVoucher,
  type VendorSettlementDoc,
} from "@/components/vendors/VendorSettlementVoucher";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ReviewedByFooter } from "@/components/ui/ReviewedByFooter";

/**
 * سند صرف لمورّد.
 *
 * 🔒 قاعدة #11: مستند يخرج للمورّد، فلا يُنتقى منه trip_amount ولا
 *    trip_profit — الأعمدة السرّية لا تُطلب من قاعدة البيانات أصلاً، لا
 *    تُخفى في الواجهة.
 *
 * الأرقام من صف التصفية نفسه: مجمَّدة وقت الصرف، فلو عُدّلت رحلة بعده يبقى
 * السند شاهداً على ما صُرف.
 */
export default async function VendorSettlementVoucherPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: settlement, error } = await supabase
    .from("vendor_settlements")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  // 404 العام لا يقول شيئاً. العمود الناقص يعني ملف SQL لم يُشغَّل، والصف
  // المفقود يعني سنداً محذوفاً — ولكلٍّ رسالته.
  if (error || !settlement) {
    return (
      <div className="flex flex-col gap-4">
        <Link
          href="/vendors"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ArrowRight size={15} />
          العودة للموردين
        </Link>
        {error ? (
          <ErrorBanner
            error={error}
            hint="تأكد من تشغيل ملف SQL رقم 0048 (السداد الجزئي)."
          />
        ) : (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            لا يوجد سند صرف بهذا المُعرَّف — ربما أُلغي.
          </div>
        )}
      </div>
    );
  }

  const [{ data: settings }, { data: vendor }, { data: tripRows }, { data: advances }, { data: openingVendor }] =
    await Promise.all([
      supabase.from("settings").select("org_name, org_phone, currency_symbol, reviewed_by").single(),
      supabase.from("vendors").select("name, phone").eq("id", settlement.vendor_id).single(),
      // 🔒 بلا trip_amount ولا trip_profit
      supabase
        .from("trips")
        .select("trip_number, trip_date, from_location, to_location, driver_trip_payment, drivers(name)")
        .eq("vendor_settlement_id", id)
        .order("trip_date"),
      supabase
        .from("vendor_advances")
        .select("date, amount, description")
        .eq("settlement_id", id)
        .order("date"),
      // الرصيد الافتتاحي الذي ابتلعه هذا السند بعينه (0046)
      supabase
        .from("vendors")
        .select("opening_balance, opening_reason")
        .eq("opening_settlement_id", id)
        .maybeSingle(),
    ]);

  const trips = (tripRows ?? []).map((t) => ({
    trip_date: t.trip_date as string,
    trip_number: (t.trip_number as string) ?? "",
    driver_name: (t.drivers as { name?: string } | null)?.name ?? "—",
    from_location: (t.from_location as string) ?? "",
    to_location: (t.to_location as string) ?? "",
    amount: Number(t.driver_trip_payment) || 0,
  }));

  const doc: VendorSettlementDoc = {
    settlement_number: settlement.settlement_number as string,
    from_date: settlement.from_date as string,
    to_date: settlement.to_date as string,
    settled_on: settlement.settled_on as string,
    trips_count: Number(settlement.trips_count) || 0,
    total_vendor_cost: Number(settlement.total_vendor_cost) || 0,
    total_advances: Number(settlement.total_advances) || 0,
    carried_in: Number(settlement.carried_in ?? 0) || 0,
    net_amount: Number(settlement.net_amount) || 0,
    // السندات الأقدم من 0048 بلا عمود: المدفوع هو الصافي ولا متبقٍّ
    paid_amount: Number(settlement.paid_amount ?? settlement.net_amount) || 0,
    carried_amount: Number(settlement.carried_amount ?? 0) || 0,
    notes: (settlement.notes as string | null) ?? null,
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/vendors/${settlement.vendor_id}`}
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ArrowRight size={15} />
          العودة لصفحة المورّد
        </Link>
        <PrintClientButton />
      </div>

      <VendorSettlementVoucher
        orgName={settings?.org_name ?? "—"}
        orgPhone={settings?.org_phone ?? null}
        vendorName={vendor?.name ?? "—"}
        vendorPhone={vendor?.phone ?? null}
        settlement={doc}
        trips={trips}
        advances={advances ?? []}
        openingBalance={Number(openingVendor?.opening_balance ?? 0) || 0}
        openingReason={(openingVendor?.opening_reason as string | null) ?? null}
        currencySymbol={settings?.currency_symbol ?? "ر.س"}
      />

      <ReviewedByFooter name={settings?.reviewed_by} />
    </div>
  );
}
