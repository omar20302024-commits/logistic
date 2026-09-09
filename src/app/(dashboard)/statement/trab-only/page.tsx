import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TrabOnlyStatementView } from "@/components/statement/TrabOnlyStatementView";
import { PrintClientButton } from "@/components/statement/PrintClientButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { FileText } from "lucide-react";

function firstDayOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

// كشف الترب فقط: أبسط كشف ممكن — رحلات ومواقع وترب، بدون راتب أو سلف أو خصومات
// أو عهدة أو أي بيانات أخرى. يستخدم فقط fn_driver_public_trips الآمنة.
export default async function TrabOnlyStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ driver?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const driverId = params.driver ?? "";
  const from = params.from || firstDayOfMonth();
  const to = params.to || today();

  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("settings")
    .select("currency_symbol, org_name, org_phone")
    .single();
  const currencySymbol = settings?.currency_symbol ?? "ر.س";
  const orgName = settings?.org_name ?? "مؤسستي";
  const orgPhone = settings?.org_phone ?? null;

  if (!driverId) {
    return (
      <div className="flex flex-col gap-6">
        <Link href="/statement" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900">
          <ArrowRight size={15} />
          العودة للكشف الداخلي
        </Link>
        <EmptyState icon={FileText} title="لم يتم تحديد سائق" description="ارجع لكشف الحساب الداخلي واختر سائقاً أولاً" />
      </div>
    );
  }

  const [{ data: driver }, { data: trips, error: tripsError }] = await Promise.all([
    supabase.from("drivers").select("id, name, phone").eq("id", driverId).single(),
    supabase.rpc("fn_driver_public_trips", { p_driver_id: driverId, p_from: from, p_to: to }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <Link
            href={`/statement?driver=${driverId}&from=${from}&to=${to}`}
            className="mb-2 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
          >
            <ArrowRight size={15} />
            العودة للكشف الداخلي
          </Link>
          <h1 className="text-xl font-bold text-zinc-900">كشف الترب فقط</h1>
          <p className="text-sm text-zinc-500">الرحلات ومواقعها والترب — بدون أي بيانات أخرى</p>
        </div>
        <PrintClientButton />
      </div>

      <ErrorBanner error={tripsError} hint="تأكد من تشغيل ملف SQL رقم 0006 (دالة fn_driver_public_trips)." />

      <TrabOnlyStatementView
        orgName={orgName}
        orgPhone={orgPhone}
        driverName={driver?.name ?? ""}
        driverPhone={driver?.phone ?? null}
        from={from}
        to={to}
        trips={trips ?? []}
        currencySymbol={currencySymbol}
      />
    </div>
  );
}
