import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PrintClientButton } from "@/components/statement/PrintClientButton";
import { WaybillView } from "@/components/trips/WaybillView";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

/**
 * 🔒 ملاحظة أمان (قاعدتا #3 و#11): البوليصة تخرج مع الشحنة وقد تصل للعميل.
 * لا يُنتقى هنا إطلاقاً trip_amount ولا driver_trip_payment ولا diesel_amount
 * ولا trip_profit — الأعمدة المالية لا تُطلب من قاعدة البيانات من الأساس.
 */
export default async function WaybillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select(
      "id, trip_number, trip_date, from_location, to_location, branches_count, requester, notes, vehicle_type_label, companies(name), drivers(name, phone)"
    )
    .eq("id", id)
    .single();

  if (tripError || !trip) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // يُصدر البوليصة إن لم تكن موجودة، ويُرجع الموجودة إن وُجدت — الرقم ثابت
  const { data: waybillId, error: issueError } = await supabase.rpc("fn_issue_waybill", {
    p_trip_id: id,
    p_issued_by: user?.id ?? null,
  });

  const [{ data: waybill }, { data: settings }] = await Promise.all([
    supabase.from("waybills").select("waybill_no, issued_at").eq("id", waybillId).single(),
    supabase.from("settings").select("org_name, org_phone, org_address").single(),
  ]);

  const one = <T,>(v: T | T[] | null | undefined): T | undefined =>
    Array.isArray(v) ? v[0] : (v ?? undefined);

  const t = trip as unknown as {
    trip_number: string;
    trip_date: string;
    from_location: string;
    to_location: string;
    requester: string | null;
    notes: string | null;
    vehicle_type_label: string | null;
    branches_count: number;
    companies: { name: string } | { name: string }[] | null;
    drivers: { name: string; phone: string | null } | { name: string; phone: string | null }[] | null;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/trips/${id}`}
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ArrowRight size={15} />
          العودة للرحلة
        </Link>
        <PrintClientButton />
      </div>

      <ErrorBanner error={issueError} hint="تأكد من تشغيل ملف SQL رقم 0023 (جدول waybills)." />

      {waybill && (
        <WaybillView
          orgName={settings?.org_name ?? "—"}
          orgPhone={settings?.org_phone ?? null}
          orgAddress={settings?.org_address ?? null}
          waybillNo={waybill.waybill_no}
          issuedAt={waybill.issued_at}
          tripNumber={t.trip_number}
          tripDate={t.trip_date}
          companyName={one(t.companies)?.name ?? "—"}
          driverName={one(t.drivers)?.name ?? "—"}
          driverPhone={one(t.drivers)?.phone ?? null}
          vehicleType={t.vehicle_type_label}
          fromLocation={t.from_location}
          toLocation={t.to_location}
          requester={t.requester}
          branchesCount={t.branches_count}
          notes={t.notes}
        />
      )}
    </div>
  );
}
