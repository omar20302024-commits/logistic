import { formatCurrency, formatNumber } from "@/lib/format";

// سند صرف لمورّد — مستند يخرج له.
//
// 🔒 لا سعر عميل ولا ربح إطلاقاً (قاعدة #11): المورّد يرى ما له فقط. الأرقام
//    هنا هي المجمَّدة وقت التصفية لا محسوبة من جديد — فلو عُدّلت رحلة بعد
//    الصرف يبقى السند شاهداً على ما صُرف فعلاً.
//
// التصميم من عائلة SettlementVoucher: رأس داكن، شبكة بيانات، أقسام، ملخص،
// توقيعات.

type TripRow = {
  trip_date: string;
  trip_number: string;
  driver_name: string;
  from_location: string;
  to_location: string;
  amount: number;
};

type AdvanceRow = {
  date: string;
  amount: number;
  description: string | null;
};

export type VendorSettlementDoc = {
  settlement_number: string;
  from_date: string;
  to_date: string;
  settled_on: string;
  trips_count: number;
  total_vendor_cost: number;
  total_advances: number;
  carried_in: number;
  net_amount: number;
  paid_amount: number;
  carried_amount: number;
  notes: string | null;
};

export function VendorSettlementVoucher({
  orgName,
  orgPhone,
  vendorName,
  vendorPhone,
  settlement,
  trips,
  advances,
  openingBalance,
  openingReason,
  currencySymbol,
}: {
  orgName: string;
  orgPhone: string | null;
  vendorName: string;
  vendorPhone: string | null;
  settlement: VendorSettlementDoc;
  trips: TripRow[];
  advances: AdvanceRow[];
  /** رصيد افتتاحي ابتلعه هذا السند (0046) — صفر إن لم يكن */
  openingBalance: number;
  openingReason: string | null;
  currencySymbol: string;
}) {
  const paid = Number(settlement.paid_amount ?? settlement.net_amount) || 0;
  const remaining = Number(settlement.carried_amount ?? 0) || 0;
  const fullyPaid = remaining <= 0;

  // آخر رحلة دخلت هذا السند — ما يسأل عنه المورّد: «إلى أين وصلنا؟»
  const lastTrip = trips.reduce<TripRow | null>(
    (acc, t) => (acc === null || t.trip_date > acc.trip_date ? t : acc),
    null
  );

  // تكلفة الرحلات وحدها: المخزَّن يضمّ الرصيد الافتتاحي، ففصلُه يجعل
  // الملخص يُجمع أمام القارئ بلا فجوة
  const tripsCost = Number(settlement.total_vendor_cost || 0) - (openingBalance || 0);

  return (
    <div className="print-statement overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
      <div className="bg-zinc-900 px-6 py-5 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold">{orgName}</h1>
            {orgPhone && (
              <p dir="ltr" className="text-sm text-zinc-300">
                {orgPhone}
              </p>
            )}
          </div>
          <div className="text-left">
            <div className="text-xs text-zinc-400">سند صرف لمورّد</div>
            <div className="text-base font-bold" dir="ltr">
              {settlement.settlement_number}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 border-b border-zinc-200 px-6 py-4 sm:grid-cols-4">
        <Info label="المورّد" value={vendorName} />
        <Info label="الهاتف" value={vendorPhone ?? "—"} ltr />
        <Info label="الفترة" value={`${settlement.from_date} ← ${settlement.to_date}`} ltr />
        <Info label="تاريخ الصرف" value={settlement.settled_on} ltr />
      </div>

      {/* الخلاصة بالكلمات قبل الأرقام — هذا ما يُقرأ أولاً */}
      <div
        className={`print-keep mx-6 mt-5 rounded-xl border px-4 py-3 text-sm ${
          fullyPaid
            ? "border-emerald-300 bg-emerald-50 text-emerald-900"
            : "border-amber-300 bg-amber-50 text-amber-900"
        }`}
      >
        {fullyPaid ? (
          <p>
            <strong>تمت تصفية الحساب بالكامل</strong> حتى تاريخ{" "}
            <strong dir="ltr">{settlement.to_date}</strong>
            {lastTrip && (
              <>
                ، وآخر رحلة مصفّاة هي رحلة رقم{" "}
                <strong dir="ltr">{lastTrip.trip_number}</strong> بتاريخ{" "}
                <strong dir="ltr">{lastTrip.trip_date}</strong>
              </>
            )}
            . لا يوجد متبقٍّ.
          </p>
        ) : (
          <p>
            <strong>سداد جزئي.</strong> صُرف{" "}
            <strong dir="ltr">{formatCurrency(paid, currencySymbol)}</strong> من إجمالي{" "}
            <strong dir="ltr">{formatCurrency(settlement.net_amount, currencySymbol)}</strong>،
            ويبقى <strong dir="ltr">{formatCurrency(remaining, currencySymbol)}</strong> ديناً
            يُضاف إلى مستحق المورّد القادم. والرحلات حتى تاريخ{" "}
            <strong dir="ltr">{settlement.to_date}</strong> كلها داخلة في هذا السند
            {lastTrip && (
              <>
                ، وآخرها رحلة رقم <strong dir="ltr">{lastTrip.trip_number}</strong> بتاريخ{" "}
                <strong dir="ltr">{lastTrip.trip_date}</strong>
              </>
            )}
            .
          </p>
        )}
      </div>

      <div className="px-6 py-5">
        <Section title={`الرحلات (${formatNumber(settlement.trips_count)})`}>
          {trips.length === 0 ? (
            <Empty>لا توجد رحلات في هذا السند</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs text-zinc-500">
                    <Th>التاريخ</Th>
                    <Th>رقم الرحلة</Th>
                    <Th>السائق</Th>
                    <Th>خط السير</Th>
                    <Th>المستحق</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {trips.map((t, i) => (
                    <tr key={i}>
                      <Td ltr>{t.trip_date}</Td>
                      <Td ltr>{t.trip_number}</Td>
                      <Td>{t.driver_name}</Td>
                      <Td>
                        {t.from_location} ← {t.to_location}
                      </Td>
                      <Td ltr strong>
                        {formatCurrency(t.amount, currencySymbol)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {advances.length > 0 && (
          <Section title="سلف مخصومة">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs text-zinc-500">
                  <Th>التاريخ</Th>
                  <Th>البيان</Th>
                  <Th>المبلغ</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {advances.map((a, i) => (
                  <tr key={i}>
                    <Td ltr>{a.date}</Td>
                    <Td>{a.description ?? "—"}</Td>
                    <Td ltr>{formatCurrency(a.amount, currencySymbol)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        <div className="print-keep mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <SummaryRow label="إجمالي الرحلات" value={tripsCost} currencySymbol={currencySymbol} />
          {openingBalance > 0 && (
            <SummaryRow
              label={`رصيد سابق${openingReason ? ` — ${openingReason}` : ""}`}
              value={openingBalance}
              currencySymbol={currencySymbol}
            />
          )}
          {Number(settlement.carried_in ?? 0) > 0 && (
            <SummaryRow
              label="متبقٍّ من تصفية سابقة"
              value={Number(settlement.carried_in)}
              currencySymbol={currencySymbol}
            />
          )}
          {Number(settlement.total_advances ?? 0) > 0 && (
            <SummaryRow
              label="السلف"
              value={Number(settlement.total_advances)}
              currencySymbol={currencySymbol}
              sign="minus"
            />
          )}

          <div className="mt-2 flex items-center justify-between border-t border-zinc-300 pt-3">
            <span className="text-sm font-bold text-zinc-900">إجمالي المستحق</span>
            <span className="text-base font-bold text-zinc-900" dir="ltr">
              {formatCurrency(settlement.net_amount, currencySymbol)}
            </span>
          </div>

          <div className="mt-1 flex items-center justify-between">
            <span className="text-sm font-bold text-zinc-900">المدفوع في هذا السند</span>
            <span className="text-lg font-bold text-emerald-700" dir="ltr">
              {formatCurrency(paid, currencySymbol)}
            </span>
          </div>

          {remaining > 0 && (
            <div className="mt-1 flex items-center justify-between rounded-lg bg-amber-100 px-2.5 py-1.5">
              <span className="text-sm font-bold text-amber-900">المتبقي للمورّد</span>
              <span className="text-base font-bold text-amber-900" dir="ltr">
                {formatCurrency(remaining, currencySymbol)}
              </span>
            </div>
          )}
        </div>

        {settlement.notes && (
          <p className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
            {settlement.notes}
          </p>
        )}

        <p className="mt-3 text-[11px] text-zinc-400">
          الأرقام في هذا السند مجمَّدة وقت الصرف. والرحلات المذكورة فيه لا تدخل تصفية أخرى.
        </p>

        <div className="print-keep mt-8 grid grid-cols-2 gap-8 text-center text-xs text-zinc-500">
          <div>
            <div className="mb-8">توقيع المورّد</div>
            <div className="border-t border-zinc-300 pt-1">{vendorName}</div>
          </div>
          <div>
            <div className="mb-8">توقيع المسؤول</div>
            <div className="border-t border-zinc-300 pt-1">{orgName}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 first:mt-0">
      <h2 className="mb-2 text-sm font-bold text-zinc-900">{title}</h2>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-center text-xs text-zinc-400">{children}</p>;
}

function Info({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div>
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div className="text-sm font-medium text-zinc-900" dir={ltr ? "ltr" : undefined}>
        {value}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-2 py-2 text-right font-medium">{children}</th>;
}

function Td({
  children,
  ltr,
  strong,
}: {
  children: React.ReactNode;
  ltr?: boolean;
  strong?: boolean;
}) {
  return (
    <td
      className={`px-2 py-2 ${strong ? "font-semibold text-zinc-900" : "text-zinc-700"}`}
      dir={ltr ? "ltr" : undefined}
    >
      {children}
    </td>
  );
}

function SummaryRow({
  label,
  value,
  currencySymbol,
  sign,
}: {
  label: string;
  value: number;
  currencySymbol: string;
  sign?: "plus" | "minus";
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-zinc-600">{label}</span>
      <span className="text-sm text-zinc-900" dir="ltr">
        {sign === "minus" ? "−" : sign === "plus" ? "+" : ""}
        {formatCurrency(value, currencySymbol)}
      </span>
    </div>
  );
}
