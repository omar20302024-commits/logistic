"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Copy, Check, Link2, CalendarClock } from "lucide-react";
import { formatNumber } from "@/lib/format";
import {
  setPublicLinkEnabledBulk,
  setStatementMonthBulk,
} from "@/app/(dashboard)/drivers/public-link-actions";

const MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

export type LinkDriver = {
  id: string;
  name: string;
  employment_type: "internal" | "external";
  public_token: string | null;
  public_link_enabled: boolean;
  statement_year: number | null;
  statement_month: number | null;
};

/**
 * إدارة روابط السائقين دفعة واحدة.
 *
 * الحاجة: الرابط يعرض الشهر الجاري ويتدحرّج أول كل شهر. فأول يوم أو
 * يومين من الشهر الجديد يفتح السائق رابطه فيجد شهراً شبه فارغ، وهو يريد
 * الشهر الذي انتهى للتوّ. وضبط ذلك سائقاً سائقاً عملٌ لا ينتهي.
 *
 * ⚠️ التثبيت يوقف التدحرُج: الشهر المثبَّت يبقى معروضاً إلى أن تغيّره.
 * فالصفحة تنبّه إلى من هو مثبَّت، ليعود المسؤول ويطلقهم.
 */
export function PublicLinksManager({ drivers }: { drivers: LinkDriver[] }) {
  const router = useRouter();
  // نفس أسلوب PublicLinkSection: الأصل من المتصفح، فلا يحتاج إعداداً
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [kind, setKind] = useState<"internal" | "external" | "all">("internal");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [monthValue, setMonthValue] = useState("auto");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const visible = drivers.filter((d) =>
    kind === "all" ? true : d.employment_type === kind
  );

  const selectedIds = visible.filter((d) => selected[d.id]).map((d) => d.id);
  const allSelected = visible.length > 0 && selectedIds.length === visible.length;

  const pinnedCount = drivers.filter(
    (d) => d.statement_year !== null && d.statement_month !== null
  ).length;

  const toggleAll = () =>
    setSelected(allSelected ? {} : Object.fromEntries(visible.map((d) => [d.id, true])));

  // آخر 18 شهراً تكفي: الحاجة للشهر الماضي غالباً، ولا أحد يثبّت سنتين للخلف
  const monthOptions = Array.from({ length: 18 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });

  const guard = () => {
    if (selectedIds.length === 0) {
      toast.error("حدّد سائقاً واحداً على الأقل");
      return false;
    }
    return true;
  };

  const applyMonth = async (value: string) => {
    if (!guard()) return;
    const [y, m] = value === "auto" ? [null, null] : value.split("-").map(Number);

    setBusy(true);
    const result = await setStatementMonthBulk(selectedIds, y ?? null, m ?? null);
    setBusy(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(
      value === "auto"
        ? `${formatNumber(result.updated ?? 0)} سائق — عاد رابطهم للشهر الحالي تلقائياً`
        : `${formatNumber(result.updated ?? 0)} سائق — رابطهم يعرض ${MONTHS[(m as number) - 1]} ${y}`
    );
    router.refresh();
  };

  const applyEnabled = async (enabled: boolean) => {
    if (!guard()) return;

    setBusy(true);
    const result = await setPublicLinkEnabledBulk(selectedIds, enabled);
    setBusy(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(
      `${formatNumber(result.updated ?? 0)} رابط ${enabled ? "مُفعَّل" : "موقوف"}`
    );
    router.refresh();
  };

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(origin + "/s/" + token);
      setCopied(token);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("تعذّر النسخ — انسخ الرابط يدوياً");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {pinnedCount > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-medium">
            {formatNumber(pinnedCount)} رابطاً مثبَّتاً على شهر بعينه.
          </span>{" "}
          المثبَّت لا يتدحرّج مع الشهور — أعِدهم إلى «الشهر الحالي تلقائياً» حين تنتهي
          حاجتهم للشهر القديم.
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-500">الفئة</label>
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as typeof kind);
              setSelected({});
            }}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          >
            <option value="internal">سائقو الشركة (داخلي)</option>
            <option value="external">الخارجيون والموردون</option>
            <option value="all">الكل</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-500">الشهر المعروض</label>
          <select
            value={monthValue}
            onChange={(e) => setMonthValue(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          >
            <option value="auto">الشهر الحالي تلقائياً</option>
            {monthOptions.map((o) => (
              <option key={`${o.year}-${o.month}`} value={`${o.year}-${o.month}`}>
                {MONTHS[o.month - 1]} {o.year}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => applyMonth(monthValue)}
          disabled={busy || selectedIds.length === 0}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          طبّق على المحدَّد ({formatNumber(selectedIds.length)})
        </button>

        {/* الحالة الأكثر طلباً: أول الشهر، أرِهم الشهر الذي انتهى */}
        <button
          type="button"
          onClick={() => {
            const v = `${prev.getFullYear()}-${prev.getMonth() + 1}`;
            setMonthValue(v);
            void applyMonth(v);
          }}
          disabled={busy || selectedIds.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          <CalendarClock size={15} />
          ثبّت على {MONTHS[prev.getMonth()]} {prev.getFullYear()}
        </button>

        <div className="mr-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => applyEnabled(true)}
            disabled={busy || selectedIds.length === 0}
            className="rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
          >
            تفعيل
          </button>
          <button
            type="button"
            onClick={() => applyEnabled(false)}
            disabled={busy || selectedIds.length === 0}
            className="rounded-lg border border-zinc-300 px-3.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            إيقاف
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-right text-xs text-zinc-500">
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="size-4 rounded border-zinc-300 align-middle accent-zinc-900"
                />
              </th>
              <th className="px-4 py-3 font-medium">السائق</th>
              <th className="px-4 py-3 font-medium">الفئة</th>
              <th className="px-4 py-3 font-medium">الرابط</th>
              <th className="px-4 py-3 font-medium">الشهر المعروض</th>
              <th className="px-4 py-3 font-medium">نسخ</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-zinc-400">
                  لا يوجد سائقون في هذه الفئة
                </td>
              </tr>
            ) : (
              visible.map((d) => {
                const pinned = d.statement_year !== null && d.statement_month !== null;
                return (
                  <tr
                    key={d.id}
                    className={`border-b border-zinc-50 ${
                      selected[d.id] ? "bg-amber-50/60" : "hover:bg-zinc-50/60"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={!!selected[d.id]}
                        onChange={(e) =>
                          setSelected((p) => ({ ...p, [d.id]: e.target.checked }))
                        }
                        className="size-4 rounded border-zinc-300 align-middle accent-zinc-900"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/drivers/${d.id}`}
                        className="font-medium text-zinc-900 hover:underline"
                      >
                        {d.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {d.employment_type === "external" ? "خارجي" : "داخلي"}
                    </td>
                    <td className="px-4 py-3">
                      {d.public_link_enabled ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                          مُفعَّل
                        </span>
                      ) : (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500">
                          موقوف
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {pinned ? (
                        <span className="font-medium text-amber-700">
                          {MONTHS[(d.statement_month as number) - 1]} {d.statement_year}
                          <span className="mr-1 text-[10px] text-amber-600">(مثبَّت)</span>
                        </span>
                      ) : (
                        <span className="text-zinc-500">الشهر الحالي تلقائياً</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {d.public_token ? (
                        <button
                          type="button"
                          onClick={() => copy(d.public_token as string)}
                          title="نسخ الرابط"
                          className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-2 py-1 text-[11px] text-zinc-600 hover:bg-zinc-50"
                        >
                          {copied === d.public_token ? (
                            <Check size={12} />
                          ) : (
                            <Copy size={12} />
                          )}
                          {copied === d.public_token ? "تم" : "نسخ"}
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400">
                          <Link2 size={12} />
                          لا رمز
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
