import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  PublicLinksManager,
  type LinkDriver,
} from "@/components/drivers/PublicLinksManager";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

// إدارة روابط السائقين دفعة واحدة — التفعيل والإيقاف والشهر المعروض.
// الحاجة عمليّة: أول كل شهر يتدحرّج الرابط إلى الشهر الجديد وهو شبه فارغ،
// والسائق يريد الشهر الذي انتهى للتوّ. وضبط ذلك سائقاً سائقاً لا ينتهي.

export default async function DriverLinksPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("drivers")
    .select(
      "id, name, employment_type, public_token, public_link_enabled, statement_year, statement_month"
    )
    .eq("status", "active")
    .order("name");

  const drivers: LinkDriver[] = (data ?? []).map((d) => ({
    id: d.id as string,
    name: d.name as string,
    employment_type: (d.employment_type as "internal" | "external") ?? "internal",
    public_token: (d.public_token as string | null) ?? null,
    public_link_enabled: Boolean(d.public_link_enabled),
    statement_year: (d.statement_year as number | null) ?? null,
    statement_month: (d.statement_month as number | null) ?? null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/drivers"
          className="mb-2 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ArrowRight size={15} />
          العودة للسائقين
        </Link>
        <h1 className="text-xl font-bold text-zinc-900">روابط السائقين</h1>
        <p className="text-sm text-zinc-500">
          فعّل الروابط أو أوقفها، واضبط الشهر الذي يراه السائقون — لمجموعة دفعة واحدة.
          الرابط نفسه دائم ولا يتغيّر.
        </p>
      </div>

      <ErrorBanner
        error={error}
        hint="تأكد من تشغيل ملف SQL رقم 0031 (روابط السائقين)."
      />

      <PublicLinksManager drivers={drivers} />
    </div>
  );
}
