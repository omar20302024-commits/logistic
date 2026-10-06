import { formatCurrency, formatNumber } from "@/lib/format";

// كشف الترب (بدون راتب): يعرض الرحلات والترب + السلف والخصومات والعهدة فقط.
// لا يحتوي إطلاقاً على الراتب الأساسي أو صافي الراتب — ولا على سعر الرحلة/الربح.
//
// التصميم مأخوذ عن سند التصفية (SettlementVoucher) ومطابق لـ DriverStatementView:
// رأس داكن، ثم شبكة بيانات، ثم أقسام معنونة، ثم صندوق ملخص، ثم توقيعات.
// أي تعديل على شكل أحدها يُستحسن أن يُنقل للآخرَين حتى تبقى الثلاثة عائلة واحدة.

type TripRow = {
  trip_date: string;
  trip_number: string;
  company_name: string;
  from_location: string;
  to_location: string;
  branches_count: number;
  driver_base_payment: number;
  driver_trip_payment: number;
};

type Summary = {
  trips_count: number;
  total_driver_payment: number;
  total_advances: number;
  total_deductions: number;
  custody_balance: number;
  driver_paid_expenses: number;
};

// بنود ما صرفه السائق على العمل خلال الفترة (غسيل، إطارات، ...)
export type ExpenseCategoryRow = {
  expense_category: string;
  total: number;
};

export function TrabAdjustmentsStatementView({
  orgName,
  orgPhone,
  driverName,
  driverPhone,
  from,
  to,
  trips,
  summary,
  expenses,
  currencySymbol,
}: {
  orgName: string;
  orgPhone: string | null;
  driverName: string;
  driverPhone: string | null;
  from: string;
  to: string;
  trips: TripRow[];
  summary: Summary;
  expenses: ExpenseCategoryRow[];
  currencySymbol: string;
}) {
  const totalDue =
    summary.total_driver_payment - summary.total_deductions - summary.total_advances - summary.custody_balance;

  // رصيد العهدة رقم **صافي** يجمع أربع حركات مختلفة: استلام من الشركة، تحصيل من
  // عميل، صرف على العمل، وإرجاع مبلغ. فلا يصح وضع أسماء البنود عليه — الوصف
  // والرقم هيتناقضوا. بنفصل المصروف بمبلغه الحقيقي، والباقي يظل سطراً مستقلاً.
  //
  // ⚠️ ملاحظة زمنية: custody_balance تراكمي حتى نهاية الفترة (كل التاريخ)، بينما
  // driver_paid_expenses للفترة وحدها. فمصروفات أقدم من الفترة تقع ضمن سطر
  // «باقي حركات العهدة». الإجمالي صحيح في كل الحالات لأن السطرين معاً = −custody_balance.
  const workExpenses = summary.driver_paid_expenses;
  const otherCustody = summary.custody_balance + workExpenses;

  return (
    <div className="print-statement overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
      {/* رأس الكشف */}
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
            <div className="text-xs text-zinc-400">كشف الترب</div>
            <div className="text-base font-bold">{driverName}</div>
          </div>
        </div>
      </div>

      {/* شبكة البيانات */}
      <div className="grid grid-cols-2 gap-4 border-b border-zinc-200 px-6 py-4 sm:grid-cols-4">
        <Info label="السائق" value={driverName} />
        <Info label="الهاتف" value={driverPhone ?? "—"} ltr />
        <Info label="الفترة" value={`${from} ← ${to}`} ltr />
        <Info label="عدد الرحلات" value={formatNumber(summary.trips_count)} ltr />
      </div>

      <div className="px-6 py-5">
        <Section title={`الرحلات (${formatNumber(summary.trips_count)})`}>
          {trips.length === 0 ? (
            <Empty>لا توجد رحلات في هذه الفترة</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs text-zinc-500">
                    <Th>التاريخ</Th>
                    <Th>رقم الرحلة</Th>
                    <Th>الشركة</Th>
                    <Th>خط السير</Th>
                    <Th>المواقع</Th>
                    <Th>ترب الرحلة</Th>
                    <Th>مواقع إضافية</Th>
                    <Th>الإجمالي</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {trips.map((t, i) => {
                    const extra = t.driver_trip_payment - t.driver_base_payment;
                    return (
                      <tr key={i}>
                        <Td ltr>{t.trip_date}</Td>
                        <Td ltr>{t.trip_number}</Td>
                        <Td>{t.company_name}</Td>
                        <Td>
                          {t.from_location} ← {t.to_location}
                        </Td>
                        <Td>{formatNumber(t.branches_count)}</Td>
                        <Td ltr>{formatCurrency(t.driver_base_payment, currencySymbol)}</Td>
                        <Td ltr>{extra > 0 ? formatCurrency(extra, currencySymbol) : "—"}</Td>
                        <Td ltr strong>
                          {formatCurrency(t.driver_trip_payment, currencySymbol)}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* بنود ما صرفه على العمل — قسم مستقل مثل جدول العهدة في السند */}
        {workExpenses > 0 && expenses.length > 0 && (
          <Section title="ما صرفه على العمل">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs text-zinc-500">
                  <Th>البند</Th>
                  <Th>المبلغ</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {expenses.map((e) => (
                  <tr key={e.expense_category}>
                    <Td>{e.expense_category}</Td>
                    <Td ltr>
                      {formatCurrency(e.total, currencySymbol)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {/* الملخص — print-keep يمنع انقسامه بين صفحتين */}
        <div className="print-keep mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <SummaryRow
            label="إجمالي الترب"
            value={summary.total_driver_payment}
            currencySymbol={currencySymbol}
          />
          {workExpenses > 0 && (
            <SummaryRow
              label="ما صرفه على العمل"
              value={workExpenses}
              currencySymbol={currencySymbol}
              sign="plus"
            />
          )}
          {summary.total_advances > 0 && (
            <SummaryRow
              label="السلف"
              value={summary.total_advances}
              currencySymbol={currencySymbol}
              sign="minus"
            />
          )}
          {summary.total_deductions > 0 && (
            <SummaryRow
              label="الخصومات"
              value={summary.total_deductions}
              currencySymbol={currencySymbol}
              sign="minus"
            />
          )}
          {otherCustody !== 0 && (
            <SummaryRow
              label={otherCustody > 0 ? "عهدة مستحقة عليك" : "عهدة مستحقة لك"}
              value={Math.abs(otherCustody)}
              currencySymbol={currencySymbol}
              sign={otherCustody > 0 ? "minus" : "plus"}
            />
          )}

          <div className="mt-2 flex items-center justify-between border-t border-zinc-300 pt-3">
            <span className="text-sm font-bold text-zinc-900">إجمالي المستحق</span>
            <span className="text-lg font-bold text-zinc-900" dir="ltr">
              {formatCurrency(totalDue, currencySymbol)}
            </span>
          </div>
        </div>

        <p className="mt-3 text-[11px] text-zinc-400">
          هذا الكشف يوضح الترب والسلف والخصومات والعهدة فقط. الراتب الشهري مستقل تماماً
          ولا يدخل في هذا الكشف.
        </p>

        <div className="print-keep mt-8 grid grid-cols-2 gap-8 text-center text-xs text-zinc-500">
          <div>
            <div className="mb-8">توقيع السائق</div>
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

// كل الأعمدة لليمين: القاعدة العامة في globals.css تجعل [dir="ltr"] محاذى لليمين
// حتى تتطابق خلايا الأرقام مع رؤوسها العربية. فمحاولة محاذاة عمود لليسار لا
// تنفّذ أصلاً — تُلغى بتلك القاعدة فينفصل الرأس عن قيمته بصرياً.
function Th({ children }: { children: React.ReactNode }) {
  return <th className="py-2 text-right font-medium">{children}</th>;
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
      className={`py-2 text-right ${strong ? "font-semibold text-zinc-900" : "text-zinc-700"}`}
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
      <span className="text-xs text-zinc-600">
        {sign === "minus" ? "− " : sign === "plus" ? "+ " : ""}
        {label}
      </span>
      <span className="text-sm text-zinc-900" dir="ltr">
        {formatCurrency(value, currencySymbol)}
      </span>
    </div>
  );
}
