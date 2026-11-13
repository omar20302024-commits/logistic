"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Receipt } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  saveCompanyRevenue,
  deleteCompanyRevenue,
  type CompanyRevenue,
} from "@/app/(dashboard)/revenues/actions";

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

type Company = { id: string; name: string };

/**
 * إدخال الإيراد المفوتَر لكل عميل في شهر بعينه.
 *
 * صفّ لكل عميل دائماً — حتى من لم يُسجَّل له إيراد بعد — فالفراغ يُرى
 * ويُملأ، ولا يُنسى عميل لأنه غائب عن الجدول.
 */
export function CompanyRevenuesTable({
  companies,
  revenues,
  year,
  month,
  currencySymbol,
  tripTotals,
}: {
  companies: Company[];
  revenues: CompanyRevenue[];
  year: number;
  month: number;
  currencySymbol: string;
  /** إجمالي رحلات النظام لكل عميل في نفس الشهر — للمقارنة أثناء الإدخال */
  tripTotals: Record<string, number>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const byCompany = new Map(revenues.map((r) => [r.company_id, r]));

  const setParam = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => (v ? params.set(k, v) : params.delete(k)));
    router.push(`${pathname}?${params.toString()}`);
  };

  const valueOf = (companyId: string) =>
    drafts[companyId] ?? String(byCompany.get(companyId)?.amount ?? "");

  const handleSave = async (companyId: string) => {
    const raw = valueOf(companyId);
    if (raw === "") {
      toast.error("اكتب المبلغ أولاً");
      return;
    }

    setSaving(companyId);
    const result = await saveCompanyRevenue({
      companyId,
      year,
      month,
      amount: Number(raw),
    });
    setSaving(null);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("تم حفظ الإيراد");
    setDrafts((d) => {
      const next = { ...d };
      delete next[companyId];
      return next;
    });
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    const result = await deleteCompanyRevenue(id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("تم الحذف");
    router.refresh();
  };

  const total = revenues.reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-500">الشهر</label>
          <select
            value={String(month)}
            onChange={(e) => setParam({ month: e.target.value })}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={String(i + 1)}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-500">السنة</label>
          <input
            type="number"
            dir="ltr"
            value={year}
            onChange={(e) => setParam({ year: e.target.value })}
            className="w-28 rounded-lg border border-zinc-300 px-3 py-2 text-right text-sm outline-none focus:border-zinc-900"
          />
        </div>
        <div className="mr-auto rounded-xl bg-zinc-900 px-4 py-2 text-sm font-bold text-white">
          إجمالي {MONTHS[month - 1]}: <span dir="ltr">{formatCurrency(total, currencySymbol)}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {companies.length === 0 ? (
          <EmptyState icon={Receipt} title="لا يوجد عملاء" description="أضف العملاء أولاً" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-right text-xs text-zinc-500">
                  <th className="px-4 py-3 font-medium">العميل</th>
                  <th className="px-4 py-3 font-medium">رحلات النظام</th>
                  <th className="px-4 py-3 font-medium">الإيراد المفوتَر</th>
                  <th className="px-4 py-3 font-medium">الفرق</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => {
                  const saved = byCompany.get(c.id);
                  const trips = Number(tripTotals[c.id] ?? 0);
                  const invoiced = Number(valueOf(c.id) || 0);
                  const diff = invoiced - trips;
                  const dirty = drafts[c.id] !== undefined;

                  return (
                    <tr key={c.id} className="border-b border-zinc-50">
                      <td className="px-4 py-3 font-medium text-zinc-900">{c.name}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-zinc-500" dir="ltr">
                        {formatCurrency(trips, currencySymbol)}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          dir="ltr"
                          value={valueOf(c.id)}
                          placeholder="0.00"
                          onChange={(e) =>
                            setDrafts((d) => ({ ...d, [c.id]: e.target.value }))
                          }
                          className={`w-36 rounded-lg border px-2.5 py-1.5 text-right text-sm outline-none focus:border-zinc-900 ${
                            dirty ? "border-amber-400 bg-amber-50" : "border-zinc-300"
                          }`}
                        />
                      </td>
                      <td
                        className={`px-4 py-3 whitespace-nowrap font-semibold ${
                          diff === 0
                            ? "text-zinc-400"
                            : diff > 0
                              ? "text-emerald-700"
                              : "text-red-600"
                        }`}
                        dir="ltr"
                      >
                        {valueOf(c.id) === "" ? "—" : formatCurrency(diff, currencySymbol)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSave(c.id)}
                            disabled={saving === c.id}
                            className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                          >
                            {saving === c.id ? "..." : "حفظ"}
                          </button>
                          {saved && (
                            <button
                              type="button"
                              onClick={() => handleDelete(saved.id)}
                              title="حذف"
                              className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
