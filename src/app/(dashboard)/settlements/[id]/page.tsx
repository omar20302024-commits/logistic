import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PrintClientButton } from "@/components/statement/PrintClientButton";
import { SettlementVoucher } from "@/components/settlements/SettlementVoucher";

/**
 * ملاحظة أمان (قاعدتا #3 و#11): سند التصفية مستند يخرج للسائق، فلا يُنتقى منه
 * إطلاقاً trip_amount ولا trip_profit ولا diesel_amount. الأعمدة السرية دي
 * مش بتتطلب من قاعدة البيانات من الأساس، مش مجرد مخفية في الواجهة.
 */
export default async function SettlementVoucherPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: settlement, error } = await supabase
    .from("driver_settlements")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !settlement) notFound();

  const [{ data: settings }, { data: driver }, { data: trips }, { data: custody }] =
    await Promise.all([
      supabase.from("settings").select("org_name, org_phone, currency_symbol").single(),
      supabase.from("drivers").select("name, phone").eq("id", settlement.driver_id).single(),
      supabase
        .from("trips")
        .select("trip_number, trip_date, from_location, to_location, driver_trip_payment")
        .eq("settlement_id", id)
        .order("trip_date"),
      supabase
        .from("driver_custody_entries")
        .select("date, type, reason, expense_category, amount, description")
        .eq("settlement_id", id)
        .order("date"),
    ]);

  const [{ data: advances }, { data: deductions }] = await Promise.all([
    supabase
      .from("driver_advances")
      .select("date, amount, description")
      .eq("settlement_id", id)
      .order("date"),
    supabase
      .from("driver_deductions")
      .select("date, amount, description")
      .eq("settlement_id", id)
      .order("date"),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/drivers/${settlement.driver_id}`}
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ArrowRight size={15} />
          العودة لصفحة السائق
        </Link>
        <PrintClientButton />
      </div>

      <SettlementVoucher
        orgName={settings?.org_name ?? "—"}
        orgPhone={settings?.org_phone ?? null}
        driverName={driver?.name ?? "—"}
        driverPhone={driver?.phone ?? null}
        settlement={settlement}
        trips={trips ?? []}
        custody={custody ?? []}
        advances={advances ?? []}
        deductions={deductions ?? []}
        currencySymbol={settings?.currency_symbol ?? "ر.س"}
      />
    </div>
  );
}
