"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Printer, Plus, Trash2, FileCheck2 } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { VendorPayableStatement } from "./VendorPayableStatement";
import {
  createVendorAdvance,
  deleteVendorAdvance,
  settleVendor,
  createVendorRouteRate,
  deleteVendorRouteRate,
  type VendorRouteRate,
} from "@/app/(dashboard)/vendors/actions";
import type {
  VendorTripRow,
  VendorPayableTripRow,
  VendorAdvanceRecord,
  VendorSettlementRecord,
} from "@/lib/validation/vendor";
import { TripPaymentsEditor } from "@/components/trips/TripPaymentsEditor";
import type { TripPaymentRow } from "@/app/(dashboard)/drivers/pricing-actions";
import { PaymentAmountField } from "@/components/ui/PaymentAmountField";

/**
 * تبويبان مفصولان عمداً:
 *   «داخلي»  → سعر العميل والربح
 *   «كشف المورّد» → ما له فقط، ومصدره دالة لا تُرجع السرّي أصلاً
 *
 * والطباعة تطبع **التبويب المعروض وحده** — فلا يخرج الداخلي مع كشف المورّد.
 */
type Tab = "internal" | "payable" | "pricing";

export function VendorDetailTabs({
  vendorId,
  vendorName,
  vendorPhone,
  from,
  to,
  trips,
  payableTrips,
  pricingTrips,
  advances,
  settlements,
  drivers,
  routeRates,
  openingBalance = 0,
  openingReason = null,
  netDue,
  orgName,
  orgPhone,
  currencySymbol,
}: {
  vendorId: string;
  vendorName: string;
  vendorPhone: string | null;
  /** رصيد قديم غير مصفّى — يدخل مستحق المورّد مرة واحدة (0046) */
  openingBalance?: number;
  openingReason?: string | null;
  /** المستحق الآن شاملاً الافتتاحي والمحمول من تصفية ناقصة سابقة */
  netDue: number;
  from: string;
  to: string;
  trips: VendorTripRow[];
  payableTrips: VendorPayableTripRow[];
  /** رحلات الفترة لتحرير سعر المورّد لكل منها */
  pricingTrips: TripPaymentRow[];
  advances: VendorAdvanceRecord[];
  settlements: VendorSettlementRecord[];
  drivers: { id: string; name: string; status: string }[];
  routeRates: VendorRouteRate[];
  orgName: string;
  orgPhone: string | null;
  currencySymbol: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<Tab>("internal");
  const [advOpen, setAdvOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  // فارغ = المستحق كاملاً
  const [paidInput, setPaidInput] = useState("");
  const [deleting, setDeleting] = useState<VendorAdvanceRecord | null>(null);
  const [saving, setSaving] = useState(false);

  const [advDate, setAdvDate] = useState(new Date().toISOString().slice(0, 10));
  const [advAmount, setAdvAmount] = useState("");
  const [advDesc, setAdvDesc] = useState("");
  const [settledOn, setSettledOn] = useState(new Date().toISOString().slice(0, 10));

  const [rateFrom, setRateFrom] = useState("");
  const [rateTo, setRateTo] = useState("");
  const [rateAmount, setRateAmount] = useState("");

  const handleAddRate = async () => {
    const result = await createVendorRouteRate(vendorId, {
      from_city: rateFrom,
      to_city: rateTo,
      trab_amount: Number(rateAmount) || 0,
    });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("تمت إضافة خط السير");
    setRateFrom("");
    setRateTo("");
    setRateAmount("");
    router.refresh();
  };

  const handleDeleteRate = async (id: string) => {
    const result = await deleteVendorRouteRate(vendorId, id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("تم حذف خط السير");
    router.refresh();
  };

  const setParam = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => (v ? params.set(k, v) : params.delete(k)));
    router.push(`${pathname}?${params.toString()}`);
  };

  const totals = trips.reduce(
    (acc, t) => ({
      client: acc.client + t.client_amount,
      cost: acc.cost + t.vendor_cost,
      profit: acc.profit + t.profit,
    }),
    { client: 0, cost: 0, profit: 0 }
  );

  const openAdvances = advances.filter((a) => !a.settlement_id);

  const handleAddAdvance = async () => {
    setSaving(true);
    const result = await createVendorAdvance(vendorId, {
      date: advDate,
      amount: Number(advAmount) || 0,
      description: advDesc,
    });
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("تم تسجيل السلفة");
    setAdvOpen(false);
    setAdvAmount("");
    setAdvDesc("");
    router.refresh();
  };

  const handleDeleteAdvance = async () => {
    if (!deleting) return;
    const result = await deleteVendorAdvance(vendorId, deleting.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("تم حذف السلفة");
    setDeleting(null);
    router.refresh();
  };

  const handleSettle = async () => {
    setSaving(true);
    const result = await settleVendor(vendorId, {
      from,
      to,
      settledOn,
      paidAmount: paidInput === "" ? undefined : Number(paidInput),
    });
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    const paid = paidInput === "" ? netDue : Number(paidInput);
    toast.success(
      paid < netDue
        ? `تمت التصفية — وبقي ${formatCurrency(netDue - paid, currencySymbol)} ديناً للمورّد`
        : "تمت التصفية — وُسمت الرحلات والسلف بسند الصرف"
    );
    setSettleOpen(false);
    setPaidInput("");
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm print:hidden">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-500">من تاريخ</label>
          <input
            type="date"
            value={from}
            dir="ltr"
            onChange={(e) => setParam({ from: e.target.value })}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-500">إلى تاريخ</label>
          <input
            type="date"
            value={to}
            dir="ltr"
            onChange={(e) => setParam({ to: e.target.value })}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          />
        </div>

        <div className="flex rounded-lg border border-zinc-300 p-0.5">
          <button
            type="button"
            onClick={() => setTab("internal")}
            className={`rounded px-3 py-1.5 text-xs font-medium ${
              tab === "internal" ? "bg-zinc-900 text-white" : "text-zinc-600"
            }`}
          >
            داخلي (بالربح)
          </button>
          <button
            type="button"
            onClick={() => setTab("payable")}
            className={`rounded px-3 py-1.5 text-xs font-medium ${
              tab === "payable" ? "bg-zinc-900 text-white" : "text-zinc-600"
            }`}
          >
            كشف المورّد
          </button>
          <button
            type="button"
            onClick={() => setTab("pricing")}
            className={`rounded px-3 py-1.5 text-xs font-medium ${
              tab === "pricing" ? "bg-zinc-900 text-white" : "text-zinc-600"
            }`}
          >
            الأسعار
          </button>
        </div>

        <div className="mr-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAdvOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <Plus size={15} /> سلفة
          </button>
          <button
            type="button"
            onClick={() => setSettleOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <FileCheck2 size={15} /> تصفية
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            <Printer size={15} /> طباعة
          </button>
        </div>
      </div>

      {tab === "payable" ? (
        <VendorPayableStatement
          orgName={orgName}
          orgPhone={orgPhone}
          vendorName={vendorName}
          vendorPhone={vendorPhone}
          from={from}
          to={to}
          trips={payableTrips}
          advances={openAdvances.map((a) => ({
            date: a.date,
            amount: a.amount,
            description: a.description,
          }))}
          openingBalance={openingBalance}
          openingReason={openingReason}
          currencySymbol={currencySymbol}
        />
      ) : tab === "pricing" ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-3">
            <h3 className="text-sm font-bold text-zinc-900">سعر المورّد لكل رحلة</h3>
            <p className="text-xs text-zinc-500">
              يُكتب وقت تسجيل الرحلة في «الترب الأساسي»، ويُعدَّل من هنا بعدها — لكل سائقي
              هذا المورّد. سعر الحملة على العميل لا يتغيّر.
            </p>
          </div>
          <TripPaymentsEditor
            scope={{ kind: "vendor", id: vendorId }}
            rows={pricingTrips}
            currencySymbol={currencySymbol}
            showDriver
          />
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-right text-xs text-zinc-500">
                    <th className="px-3 py-3 font-medium">التاريخ</th>
                    <th className="px-3 py-3 font-medium">رقم الرحلة</th>
                    <th className="px-3 py-3 font-medium">السائق</th>
                    <th className="px-3 py-3 font-medium">العميل</th>
                    <th className="px-3 py-3 font-medium">خط السير</th>
                    <th className="px-3 py-3 font-medium">على العميل</th>
                    <th className="px-3 py-3 font-medium">للمورّد</th>
                    <th className="px-3 py-3 font-medium">الربح</th>
                    <th className="px-3 py-3 font-medium">مصفّاة</th>
                  </tr>
                </thead>
                <tbody>
                  {trips.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-zinc-400">
                        لا توجد رحلات لهذا المورّد في الفترة
                      </td>
                    </tr>
                  ) : (
                    trips.map((t) => (
                      <tr key={t.trip_id} className="border-b border-zinc-50">
                        <td className="px-3 py-2 whitespace-nowrap" dir="ltr">
                          {t.trip_date}
                        </td>
                        <td className="px-3 py-2" dir="ltr">
                          {t.trip_number}
                        </td>
                        <td className="px-3 py-2">{t.driver_name}</td>
                        <td className="px-3 py-2">{t.company_name}</td>
                        <td className="px-3 py-2">
                          {t.from_location} ← {t.to_location}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap" dir="ltr">
                          {formatCurrency(t.client_amount, currencySymbol)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap" dir="ltr">
                          {formatCurrency(t.vendor_cost, currencySymbol)}
                        </td>
                        <td
                          className="px-3 py-2 whitespace-nowrap font-semibold text-emerald-700"
                          dir="ltr"
                        >
                          {formatCurrency(t.profit, currencySymbol)}
                        </td>
                        <td className="px-3 py-2">
                          {t.settled ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">
                              مصروفة
                            </span>
                          ) : (
                            <span className="text-zinc-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-zinc-200 bg-zinc-50 font-bold text-zinc-900">
                    <td className="px-3 py-3" colSpan={5}>
                      الإجمالي ({formatNumber(trips.length)})
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap" dir="ltr">
                      {formatCurrency(totals.client, currencySymbol)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap" dir="ltr">
                      {formatCurrency(totals.cost, currencySymbol)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-emerald-700" dir="ltr">
                      {formatCurrency(totals.profit, currencySymbol)}
                    </td>
                    <td className="px-3 py-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3 print:hidden">
            <Panel title={`سائقو المورّد (${formatNumber(drivers.length)})`}>
              {drivers.length === 0 ? (
                <Hint>لا سائقين مرتبطين — اربطهم من صفحة كل سائق.</Hint>
              ) : (
                <ul className="flex flex-col gap-1 text-sm">
                  {drivers.map((d) => (
                    <li key={d.id} className="flex items-center justify-between">
                      <span className="text-zinc-700">{d.name}</span>
                      {d.status !== "active" && (
                        <span className="text-[10px] text-zinc-400">غير نشط</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title={`سلف غير مخصومة (${formatNumber(openAdvances.length)})`}>
              {openAdvances.length === 0 ? (
                <Hint>لا سلف معلّقة.</Hint>
              ) : (
                <ul className="flex flex-col gap-1 text-sm">
                  {openAdvances.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2">
                      <span className="text-zinc-600" dir="ltr">
                        {a.date}
                      </span>
                      <span className="text-zinc-900" dir="ltr">
                        {formatCurrency(a.amount, currencySymbol)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDeleting(a)}
                        className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title={`تسعيرة المورّد (${formatNumber(routeRates.length)})`}>
              <p className="mb-2 text-[11px] text-zinc-400">
                سعر خط السير له — يسري على <strong>كل سائقيه</strong>، ويغلبه خط سير خاص
                بسائق بعينه إن وُجد.
              </p>
              <div className="mb-2 grid grid-cols-3 gap-1.5">
                <input
                  value={rateFrom}
                  onChange={(e) => setRateFrom(e.target.value)}
                  placeholder="من"
                  className="rounded border border-zinc-200 px-2 py-1 text-xs"
                />
                <input
                  value={rateTo}
                  onChange={(e) => setRateTo(e.target.value)}
                  placeholder="إلى"
                  className="rounded border border-zinc-200 px-2 py-1 text-xs"
                />
                <div className="flex gap-1">
                  <input
                    type="number"
                    step="0.01"
                    dir="ltr"
                    value={rateAmount}
                    onChange={(e) => setRateAmount(e.target.value)}
                    placeholder="السعر"
                    className="min-w-0 flex-1 rounded border border-zinc-200 px-2 py-1 text-right text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddRate}
                    className="shrink-0 rounded bg-zinc-900 px-2 text-xs text-white hover:bg-zinc-800"
                  >
                    +
                  </button>
                </div>
              </div>
              {routeRates.length === 0 ? (
                <Hint>لا تسعيرة — أضف خط سير أعلاه.</Hint>
              ) : (
                <ul className="flex flex-col gap-1 text-sm">
                  {routeRates.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2">
                      <span className="text-zinc-700">
                        {r.from_city} ← {r.to_city}
                      </span>
                      <span className="text-zinc-900" dir="ltr">
                        {formatCurrency(r.trab_amount, currencySymbol)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteRate(r.id)}
                        className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title={`التصفيات (${formatNumber(settlements.length)})`}>
              {settlements.length === 0 ? (
                <Hint>لا تصفيات بعد.</Hint>
              ) : (
                <ul className="flex flex-col gap-1 text-sm">
                  {settlements.map((st) => (
                    <li key={st.id} className="flex items-center justify-between gap-2">
                      <span className="text-zinc-600" dir="ltr">
                        {st.settlement_number}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="text-zinc-900" dir="ltr">
                          {formatCurrency(
                            Number(st.paid_amount ?? st.net_amount),
                            currencySymbol
                          )}
                        </span>
                        {Number(st.carried_amount ?? 0) > 0 && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800">
                            متبقٍّ {formatCurrency(Number(st.carried_amount), currencySymbol)}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}

      <p className="text-xs text-zinc-400 print:hidden">
        تبويب «كشف المورّد» مصدره دالة لا تُرجع سعر العميل ولا الربح إطلاقاً — فالطباعة منه
        آمنة للتسليم. وتبويب «داخلي» لك وحدك.
      </p>

      {/* سلفة */}
      <Modal open={advOpen} onClose={() => setAdvOpen(false)} title="تسجيل سلفة" maxWidth="max-w-sm">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">التاريخ *</label>
              <input
                type="date"
                dir="ltr"
                value={advDate}
                onChange={(e) => setAdvDate(e.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">المبلغ *</label>
              <input
                type="number"
                step="0.01"
                dir="ltr"
                value={advAmount}
                onChange={(e) => setAdvAmount(e.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">البيان</label>
            <input
              value={advDesc}
              onChange={(e) => setAdvDesc(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
            />
          </div>
          <p className="text-[11px] text-zinc-400">
            السلفة تُخصم من حساب رحلات المورّد — ليست عهدة ولا تدخل حسابات السائقين.
          </p>
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={() => setAdvOpen(false)}
              className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleAddAdvance}
              disabled={saving}
              className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {saving ? "جارٍ الحفظ..." : "حفظ"}
            </button>
          </div>
        </div>
      </Modal>

      {/* تصفية */}
      <Modal
        open={settleOpen}
        onClose={() => setSettleOpen(false)}
        title="تصفية حساب المورّد"
        maxWidth="max-w-sm"
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs text-zinc-600">
            ستُصفّى رحلات <strong>{vendorName}</strong> غير المصروفة بين{" "}
            <strong dir="ltr">{from}</strong> و <strong dir="ltr">{to}</strong>، وتُخصم سلفه
            المعلّقة في نفس الفترة.
          </p>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">تاريخ الصرف</label>
            <input
              type="date"
              dir="ltr"
              value={settledOn}
              onChange={(e) => setSettledOn(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900"
            />
          </div>

          <PaymentAmountField
            due={netDue}
            value={paidInput}
            onChange={setPaidInput}
            currencySymbol={currencySymbol}
          />

          <p className="text-[11px] text-amber-700">
            الأرقام تُجمَّد في السند وقت الصرف — فلو عُدّلت رحلة بعده يبقى السند شاهداً على ما
            صُرف فعلاً. والرحلات المصروفة لا تدخل تصفية ثانية.
          </p>
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={() => setSettleOpen(false)}
              className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSettle}
              disabled={saving}
              className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {saving ? "جارٍ التصفية..." : "تنفيذ التصفية"}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDeleteAdvance}
        title="حذف السلفة"
        description={`ستُحذف سلفة ${deleting?.date ?? ""} ويزيد المستحق للمورّد بقيمتها.`}
      />
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-bold text-zinc-900">{title}</h3>
      {children}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-zinc-400">{children}</p>;
}
