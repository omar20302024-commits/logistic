import { formatCurrency, formatNumber } from "@/lib/format";
import { custodyReasonLabels } from "@/lib/validation/custody";
import type { SettlementRecord } from "@/lib/validation/settlement";

// سند تصفية التربات — مستند يخرج للسائق.
// لا يحتوي ولا يستقبل إطلاقاً: سعر الرحلة، ربح الرحلة، الديزل (قاعدتا #3 و#11).
// الأرقام هنا هي المجمّدة وقت التصفية، مش محسوبة من جديد — عشان لو رحلة اتعدّلت
// بعد الصرف، السند يفضل شاهداً على المبلغ اللي اتصرف فعلاً.

type TripRow = {
  trip_number: string;
  trip_date: string;
  from_location: string;
  to_location: string;
  driver_trip_payment: number;
};

type CustodyRow = {
  date: string;
  type: "credit" | "debit";
  reason: string | null;
  expense_category: string | null;
  amount: number;
  description: string | null;
};

type LedgerRow = {
  date: string;
  amount: number;
  description: string | null;
};

export function SettlementVoucher({
  orgName,
  orgPhone,
  driverName,
  driverPhone,
  settlement,
  trips,
  custody,
  advances,
  deductions,
  currencySymbol,
}: {
  orgName: string;
  orgPhone: string | null;
  driverName: string;
  driverPhone: string | null;
  settlement: SettlementRecord;
  trips: TripRow[];
  custody: CustodyRow[];
  advances: LedgerRow[];
  deductions: LedgerRow[];
  currencySymbol: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
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
            <div className="text-xs text-zinc-400">سند تصفية تربات</div>
            <div className="text-base font-bold" dir="ltr">
              {settlement.settlement_number}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 border-b border-zinc-200 px-6 py-4 sm:grid-cols-4">
        <Info label="السائق" value={driverName} />
        <Info label="الهاتف" value={driverPhone ?? "—"} ltr />
        <Info label="الفترة" value={`${settlement.from_date} ← ${settlement.to_date}`} ltr />
        <Info label="تاريخ الصرف" value={settlement.settled_on} ltr />
      </div>

      <div className="px-6 py-5">
        <Section title={`الرحلات (${formatNumber(settlement.trips_count)})`}>
          {trips.length === 0 ? (
            <Empty>لا توجد رحلات في هذا السند</Empty>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs text-zinc-500">
                  <Th>التاريخ</Th>
                  <Th>رقم الرحلة</Th>
                  <Th>خط السير</Th>
                  <Th align="left">الترب</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {trips.map((t) => (
                  <tr key={t.trip_number}>
                    <Td ltr>{t.trip_date}</Td>
                    <Td ltr>{t.trip_number}</Td>
                    <Td>
                      {t.from_location} ← {t.to_location}
                    </Td>
                    <Td align="left" ltr>
                      {formatCurrency(t.driver_trip_payment, currencySymbol)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {custody.length > 0 && (
          <Section title="حركات العهدة والمصروفات">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs text-zinc-500">
                  <Th>التاريخ</Th>
                  <Th>البيان</Th>
                  <Th align="left">المبلغ</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {custody.map((c, i) => (
                  <tr key={i}>
                    <Td ltr>{c.date}</Td>
                    <Td>
                      {c.reason && c.reason !== "unspecified"
                        ? custodyReasonLabels[c.reason]
                        : "حركة عهدة"}
                      {c.expense_category ? ` — ${c.expense_category}` : ""}
                      {c.description ? ` (${c.description})` : ""}
                    </Td>
                    <Td align="left" ltr>
                      {c.type === "debit" ? "+" : "−"}
                      {formatCurrency(c.amount, currencySymbol)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {advances.length > 0 && (
          <LedgerTable
            title="سلف مخصومة من التربات"
            rows={advances}
            currencySymbol={currencySymbol}
          />
        )}

        {deductions.length > 0 && (
          <LedgerTable
            title="خصومات مخصومة من التربات"
            rows={deductions}
            currencySymbol={currencySymbol}
          />
        )}

        <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <SummaryRow
            label="إجمالي التربات"
            value={settlement.total_trabs}
            currencySymbol={currencySymbol}
          />
          <SummaryRow
            label="ما صرفه أو أرجعه"
            value={settlement.custody_debits}
            currencySymbol={currencySymbol}
            sign="plus"
          />
          <SummaryRow
            label="ما استلمه"
            value={settlement.custody_credits}
            currencySymbol={currencySymbol}
            sign="minus"
          />
          <SummaryRow
            label="سلف"
            value={settlement.total_advances}
            currencySymbol={currencySymbol}
            sign="minus"
          />
          <SummaryRow
            label="خصومات"
            value={settlement.total_deductions}
            currencySymbol={currencySymbol}
            sign="minus"
          />

          <div className="mt-2 flex items-center justify-between border-t border-zinc-300 pt-3">
            <span className="text-sm font-bold text-zinc-900">الصافي المستلَم</span>
            <span className="text-lg font-bold text-zinc-900" dir="ltr">
              {formatCurrency(settlement.net_amount, currencySymbol)}
            </span>
          </div>
        </div>

        <p className="mt-3 text-[11px] text-zinc-400">
          هذا السند خاص بالتربات ومصروفات السائق فقط. الراتب الشهري مستقل تماماً ولا يدخل في هذه
          التصفية.
        </p>

        {settlement.notes && (
          <p className="mt-2 text-xs text-zinc-600">
            <span className="font-medium text-zinc-900">ملاحظات: </span>
            {settlement.notes}
          </p>
        )}

        <div className="mt-8 grid grid-cols-2 gap-8 text-center text-xs text-zinc-500">
          <div>
            <div className="mb-8">توقيع المستلِم</div>
            <div className="border-t border-zinc-300 pt-1">{driverName}</div>
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

function LedgerTable({
  title,
  rows,
  currencySymbol,
}: {
  title: string;
  rows: LedgerRow[];
  currencySymbol: string;
}) {
  return (
    <Section title={title}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-xs text-zinc-500">
            <Th>التاريخ</Th>
            <Th>البيان</Th>
            <Th align="left">المبلغ</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((r, i) => (
            <tr key={i}>
              <Td ltr>{r.date}</Td>
              <Td>{r.description ?? "—"}</Td>
              <Td align="left" ltr>
                {formatCurrency(r.amount, currencySymbol)}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="mb-2 text-sm font-bold text-zinc-900">{title}</h3>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-3 text-center text-xs text-zinc-400">{children}</p>;
}

function Info({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div>
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="text-sm font-medium text-zinc-900" dir={ltr ? "ltr" : undefined}>
        {value}
      </div>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "left" }) {
  return <th className={`py-2 font-medium ${align === "left" ? "text-left" : "text-right"}`}>{children}</th>;
}

function Td({
  children,
  align,
  ltr,
}: {
  children: React.ReactNode;
  align?: "left";
  ltr?: boolean;
}) {
  return (
    <td
      className={`py-2 text-zinc-700 ${align === "left" ? "text-left" : "text-right"}`}
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
