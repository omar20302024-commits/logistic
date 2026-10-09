"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Route, Wand2, Loader2 } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  createRouteRate,
  updateRouteRate,
  deleteRouteRate,
  suggestRouteRates,
  applyRouteSuggestions,
  type RouteRateRecord,
  type RouteSuggestion,
} from "@/app/(dashboard)/route-rates/actions";

export function RouteRatesManager({
  rates,
  currencySymbol,
}: {
  rates: RouteRateRecord[];
  currencySymbol: string;
}) {
  const router = useRouter();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RouteRateRecord | null>(null);
  const [deleting, setDeleting] = useState<RouteRateRecord | null>(null);
  const [saving, setSaving] = useState(false);

  const [fromCity, setFromCity] = useState("");
  const [toCity, setToCity] = useState("");
  const [trab, setTrab] = useState("");

  const [suggestOpen, setSuggestOpen] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<RouteSuggestion[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const openForm = (rate: RouteRateRecord | null) => {
    setEditing(rate);
    setFromCity(rate?.from_city ?? "");
    setToCity(rate?.to_city ?? "");
    setTrab(rate ? String(rate.trab_amount) : "");
    setFormOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      from_city: fromCity,
      to_city: toCity,
      trab_amount: Number(trab) || 0,
    };
    const result = editing
      ? await updateRouteRate(editing.id, payload)
      : await createRouteRate(payload);
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(editing ? "تم تعديل خط السير" : "تم إضافة خط السير");
    setFormOpen(false);
    router.refresh();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const result = await deleteRouteRate(deleting.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("تم حذف خط السير");
    setDeleting(null);
    router.refresh();
  };

  const openSuggestions = async () => {
    setSuggestOpen(true);
    setLoadingSuggestions(true);
    const result = await suggestRouteRates();
    setLoadingSuggestions(false);

    if (!result.ok) {
      toast.error(result.error);
      setSuggestOpen(false);
      return;
    }
    setSuggestions(result.rows);
    // المسجَّل عاماً بالفعل لا يُحدَّد — لا نريد الكتابة فوق قرار سابق بلا طلب
    setPicked(
      new Set(
        result.rows.filter((r) => !r.already_global).map((r) => `${r.from_city}|${r.to_city}`)
      )
    );
  };

  const toggle = (key: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleApply = async () => {
    const rows = suggestions
      .filter((s) => picked.has(`${s.from_city}|${s.to_city}`))
      .map((s) => ({
        from_city: s.from_city,
        to_city: s.to_city,
        trab_amount: s.suggested_trab,
      }));

    setSaving(true);
    const result = await applyRouteSuggestions(rows);
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`تم اعتماد ${rows.length} خط سير`);
    setSuggestOpen(false);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-xs text-zinc-500">
          {formatNumber(rates.length)} خط سير عام — يسري على كل سائقي الشركة، ويرثه السائق
          الجديد تلقائياً
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openSuggestions}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <Wand2 size={15} /> اقترح من خطوط سير السواقين
          </button>
          <button
            type="button"
            onClick={() => openForm(null)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            <Plus size={15} /> إضافة خط سير
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {rates.length === 0 ? (
          <EmptyState
            icon={Route}
            title="لا توجد خطوط سير عامة"
            description="أضف خط سير واحداً يسري على كل السواقين، أو اضغط «اقترح من خطوط سير السواقين» لبنائها من المسجَّل فعلاً"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-right text-xs text-zinc-500">
                  <th className="px-4 py-3 font-medium">من</th>
                  <th className="px-4 py-3 font-medium">إلى</th>
                  <th className="px-4 py-3 font-medium">الترب</th>
                  <th className="px-4 py-3 font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {rates.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-50 hover:bg-zinc-50/60">
                    <td className="px-4 py-3 font-medium text-zinc-900">{r.from_city}</td>
                    <td className="px-4 py-3 text-zinc-700">{r.to_city}</td>
                    <td className="px-4 py-3 whitespace-nowrap" dir="ltr">
                      {formatCurrency(r.trab_amount, currencySymbol)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openForm(r)}
                          className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(r)}
                          className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-zinc-400">
        أولوية الترب: خط سير خاص بالسائق ← خط السير العام ← تربه الافتراضي العام. والموردون
        لا يرثون العام — تربهم باتفاق خاص. وتعديل السعر هنا لا يمسّ أي رحلة مسجَّلة، فالرحلة
        تجمّد تربها وقت إنشائها.
      </p>

      {/* نموذج الإضافة والتعديل */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "تعديل خط السير" : "إضافة خط سير عام"}
        maxWidth="max-w-md"
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">من *</label>
              <input
                value={fromCity}
                onChange={(e) => setFromCity(e.target.value)}
                placeholder="جدة"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">إلى *</label>
              <input
                value={toCity}
                onChange={(e) => setToCity(e.target.value)}
                placeholder="الرياض"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">ترب الرحلة *</label>
            <input
              type="number"
              step="0.01"
              dir="ltr"
              value={trab}
              onChange={(e) => setTrab(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900"
            />
            <p className="text-[11px] text-zinc-400">
              الترب الأساسي للرحلة. المواقع الإضافية تُحسب فوقه بمعدَّل كل سائق.
            </p>
          </div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {saving ? "جارٍ الحفظ..." : "حفظ"}
            </button>
          </div>
        </div>
      </Modal>

      {/* الاقتراحات */}
      <Modal
        open={suggestOpen}
        onClose={() => setSuggestOpen(false)}
        title="اقتراح خطوط سير عامة"
        maxWidth="max-w-2xl"
      >
        {loadingSuggestions ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-zinc-500">
            <Loader2 size={16} className="animate-spin" /> جارٍ القراءة...
          </div>
        ) : suggestions.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">
            لا توجد خطوط سير مسجَّلة لسائقي الشركة لنبني منها.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-zinc-500">
              السعر المقترح هو الأكثر تكراراً بين سائقي الشركة لكل خط سير. راجعه وعدّله بعد
              الاعتماد إن لزم. خطوط السير الخاصة بالسواقين تبقى كما هي وتظل تغلب العام.
            </p>

            <div className="max-h-80 overflow-y-auto rounded-xl border border-zinc-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-zinc-50">
                  <tr className="border-b border-zinc-200 text-right text-xs text-zinc-500">
                    <th className="px-3 py-2 font-medium"></th>
                    <th className="px-3 py-2 font-medium">من</th>
                    <th className="px-3 py-2 font-medium">إلى</th>
                    <th className="px-3 py-2 font-medium">المقترح</th>
                    <th className="px-3 py-2 font-medium">سواقين</th>
                    <th className="px-3 py-2 font-medium">يختلفون</th>
                  </tr>
                </thead>
                <tbody>
                  {suggestions.map((s) => {
                    const key = `${s.from_city}|${s.to_city}`;
                    return (
                      <tr key={key} className="border-b border-zinc-50">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={picked.has(key)}
                            onChange={() => toggle(key)}
                            className="h-4 w-4 rounded border-zinc-300"
                          />
                        </td>
                        <td className="px-3 py-2">{s.from_city}</td>
                        <td className="px-3 py-2">{s.to_city}</td>
                        <td className="px-3 py-2 whitespace-nowrap" dir="ltr">
                          {formatCurrency(s.suggested_trab, currencySymbol)}
                        </td>
                        <td className="px-3 py-2 text-zinc-500" dir="ltr">
                          {formatNumber(s.drivers_count)}
                        </td>
                        <td className="px-3 py-2">
                          {s.differing > 0 ? (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">
                              {formatNumber(s.differing)} بسعر آخر
                            </span>
                          ) : (
                            <span className="text-zinc-300">—</span>
                          )}
                          {s.already_global && (
                            <span className="mr-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-500">
                              مسجَّل عاماً
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSuggestOpen(false)}
                className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={saving || picked.size === 0}
                className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {saving ? "جارٍ الاعتماد..." : `اعتماد ${formatNumber(picked.size)} خط سير`}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="حذف خط السير"
        description={`سيُحذف «${deleting?.from_city ?? ""} ← ${deleting?.to_city ?? ""}» من خطوط السير العامة. الرحلات المسجَّلة لا تتأثر، والرحلات الجديدة ترجع للترب الافتراضي للسائق.`}
      />
    </div>
  );
}
