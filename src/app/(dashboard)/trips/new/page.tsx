import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TripForm } from "@/components/trips/TripForm";

export default async function NewTripPage() {
  const supabase = await createClient();

  const [{ data: drivers }, { data: companies }, { data: settings }] = await Promise.all([
    supabase
      .from("drivers")
      .select("id, name, default_trip_payment")
      .eq("status", "active")
      .order("name"),
    supabase.from("companies").select("id, name").eq("status", "active").order("name"),
    supabase.from("settings").select("currency_symbol").single(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/trips"
          className="mb-2 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ArrowRight size={15} />
          العودة للرحلات
        </Link>
        <h1 className="text-xl font-bold text-zinc-900">إضافة رحلة جديدة</h1>
      </div>

      <TripForm
        drivers={drivers ?? []}
        companies={companies ?? []}
        currencySymbol={settings?.currency_symbol ?? "ر.س"}
      />
    </div>
  );
}
