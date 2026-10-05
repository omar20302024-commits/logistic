"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Link2, Copy, Check, RefreshCw, ShieldAlert } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  setPublicLinkEnabled,
  regeneratePublicToken,
  setStatementMonth,
} from "@/app/(dashboard)/drivers/public-link-actions";

const MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export function PublicLinkSection({
  driverId,
  token,
  enabled,
  statementYear,
  statementMonth,
}: {
  driverId: string;
  token: string | null;
  enabled: boolean;
  statementYear: number | null;
  statementMonth: number | null;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [origin, setOrigin] = useState("");

  // الرابط يُبنى في المتصفح لأن الخادم لا يعرف النطاق الذي فُتح منه الموقع
  // (قد يكون نطاقاً مخصصاً أو vercel.app أو localhost).
  useEffect(() => setOrigin(window.location.origin), []);

  const url = token ? `${origin}/s/${token}` : "";
  const pinned = statementYear !== null && statementMonth !== null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("تعذّر النسخ — انسخ الرابط يدوياً");
    }
  };

  const handleToggle = async () => {
    setBusy(true);
    const result = await setPublicLinkEnabled(driverId, !enabled);
    setBusy(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(!enabled ? "تم تفعيل الرابط" : "تم إيقاف الرابط");
    router.refresh();
  };

  const handleRegenerate = async () => {
    const result = await regeneratePublicToken(driverId);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("تم تجديد الرابط — كل نسخة قديمة بطلت");
    setConfirmRegen(false);
    router.refresh();
  };

  const handleMonthChange = async (value: string) => {
    setBusy(true);
    const result =
      value === "auto"
        ? await setStatementMonth(driverId, null, null)
        : await setStatementMonth(
            driverId,
            Number(value.split("-")[0]),
            Number(value.split("-")[1])
          );
    setBusy(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  };

  // آخر 18 شهراً — يغطي التصفيات المتأخرة دون قائمة لا تنتهي
  const now = new Date();
  const monthOptions = Array.from({ length: 18 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-zinc-900">
            <Link2 size={15} />
            رابط كشف السائق
          </h3>
          <p className="text-xs text-zinc-400">
            الرحلات والترب والراتب — قراءة فقط بدون تسجيل دخول، ولا يحتوي سعر رحلة ولا ربحاً
          </p>
        </div>

        <button
          type="button"
          onClick={handleToggle}
          disabled={busy}
          className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
            enabled
              ? "bg-emerald-600 text-white hover:bg-emerald-700"
              : "border border-zinc-300 text-zinc-600 hover:bg-zinc-50"
          }`}
        >
          {enabled ? "مُفعّل" : "موقوف"}
        </button>
      </div>

      {enabled ? (
        <>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={url}
              dir="ltr"
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 outline-none"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "تم النسخ" : "نسخ"}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="text-xs text-zinc-500">الشهر المعروض</label>
            <select
              disabled={busy}
              value={pinned ? `${statementYear}-${statementMonth}` : "auto"}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs outline-none focus:border-zinc-900"
            >
              <option value="auto">الشهر الحالي تلقائياً</option>
              {monthOptions.map((o) => (
                <option key={`${o.year}-${o.month}`} value={`${o.year}-${o.month}`}>
                  {MONTHS[o.month - 1]} {o.year}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setConfirmRegen(true)}
              className="mr-auto inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              <RefreshCw size={13} />
              تجديد الرابط
            </button>
          </div>

          {!pinned && (
            <p className="mt-2 text-[11px] text-zinc-400">
              الرابط يعرض الشهر الجاري ويتحدّث وحده مع بداية كل شهر.
            </p>
          )}

          <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-[11px] text-amber-800">
            <ShieldAlert size={14} className="mt-px shrink-0" />
            <span>
              من يملك الرابط يرى الكشف. الإيقاف يوقفه مؤقتاً لكن إعادة التفعيل تُشغّل
              نفس الرابط — فلو تسرّب، <strong>جدّد الرابط</strong> ليبطل نهائياً.
            </span>
          </div>
        </>
      ) : (
        <p className="rounded-lg bg-zinc-50 px-3 py-2.5 text-xs text-zinc-500">
          الرابط موقوف — لا يعمل مع أحد. فعّله ليظهر الرابط ويمكنك إرساله للسائق.
        </p>
      )}

      <ConfirmDialog
        open={confirmRegen}
        onClose={() => setConfirmRegen(false)}
        onConfirm={handleRegenerate}
        title="تجديد الرابط"
        description="سيتوقف الرابط الحالي نهائياً ولن يعمل مع أي شخص أرسلته له من قبل، وستحصل على رابط جديد ترسله للسائق."
        confirmLabel="تجديد الرابط"
      />
    </div>
  );
}
