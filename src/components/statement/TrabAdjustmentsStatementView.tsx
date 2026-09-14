import { formatCurrency, formatNumber } from "@/lib/format";

// كشف الترب (بدون راتب): يعرض الرحلات والترب + السلف والخصومات والعهدة فقط.
// لا يحتوي إطلاقاً على الراتب الأساسي أو صافي الراتب — ولا على سعر الرحلة/الربح.

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
      <div className="bg-zinc-900 px-6 py-5 text-white">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold">{orgName}</h1>
            {orgPhone && (
              <p dir="ltr" className="text-sm text-zinc-300">
                {orgPhone}
              </p>
            )}
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold">كشف الترب</p>
            <p className="text-xs text-zinc-400">
              من {from} إلى {to}
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 pt-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-zinc-50 px-4 py-3">
          <div>
            <div className="text-xs text-zinc-500">اسم السائق</div>
            <div className="text-lg font-bold text-zinc-900">{driverName}</div>
          </div>
          {driverPhone && (
            <div dir="ltr" className="text-sm text-zinc-500">
              {driverPhone}
            </div>
          )}
        </div>

        <div className="overflow-x-auto rounded-xl border border-zinc-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-zinc-100 text-right text-zinc-600">
                <th className="px-3 py-2.5 font-medium">التاريخ</th>
                <th className="px-3 py-2.5 font-medium">رقم الرحلة</th>
                <th className="px-3 py-2.5 font-medium">الشركة</th>
                <th className="px-3 py-2.5 font-medium">من</th>
                <th className="px-3 py-2.5 font-medium">إلى</th>
                <th className="px-3 py-2.5 font-medium">عدد المواقع</th>
                <th className="px-3 py-2.5 font-medium">الترب</th>
              </tr>
            </thead>
            <tbody>
              {trips.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-400">
                    لا توجد رحلات في هذه الفترة
                  </td>
                </tr>
              ) : (
                trips.map((t, i) => (
                  <tr key={i} className={i % 2 === 1 ? "bg-zinc-50/60" : ""}>
                    <td className="border-t border-zinc-100 px-3 py-2 whitespace-nowrap" dir="ltr">
                      {t.trip_date}
                    </td>
                    <td className="border-t border-zinc-100 px-3 py-2 whitespace-nowrap">{t.trip_number}</td>
                    <td className="border-t border-zinc-100 px-3 py-2">{t.company_name}</td>
                    <td className="border-t border-zinc-100 px-3 py-2">{t.from_location}</td>
                    <td className="border-t border-zinc-100 px-3 py-2">{t.to_location}</td>
                      <td className="border-t border-zinc-100 px-3 py-2 text-center">{t.branches_count}</td>
                    <td className="border-t border-zinc-100 px-3 py-2 whitespace-nowrap font-semibold text-zinc-900" dir="ltr">
                      {formatCurrency(t.driver_trip_payment, currencySymbol)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="print-keep my-6 flex flex-col divide-y divide-zinc-100 rounded-xl border border-zinc-200 p-4 text-sm sm:mx-auto sm:w-[26rem]">
          <SummaryRow label="عدد الرحلات" value={formatNumber(summary.trips_count)} />
          <SummaryRow label="إجمالي الترب" value={formatCurrency(summary.total_driver_payment, currencySymbol)} />
          {summary.total_advances > 0 && (
            <SummaryRow label="السلف" value={formatCurrency(summary.total_advances, currencySymbol)} sign="minus" />
          )}
          {summary.total_deductions > 0 && (
            <SummaryRow label="الخصومات" value={formatCurrency(summary.total_deductions, currencySymbol)} sign="minus" />
          )}
          {workExpenses > 0 && (
            <div className="py-2">
              <div className="flex items-center justify-between">
                <span className="text-zinc-600">+ ما صرفه على العمل</span>
                <span className="text-zinc-700" dir="ltr">
                  {formatCurrency(workExpenses, currencySymbol)}
                </span>
              </div>
              {expenses.length > 0 && (
                <div className="mt-1.5 flex flex-col gap-0.5 border-r-2 border-zinc-200 pr-3">
                  {expenses.map((e) => (
                    <div key={e.expense_category} className="flex items-center justify-between text-xs text-zinc-500">
                      <span>{e.expense_category}</span>
                      <span dir="ltr">{formatCurrency(e.total, currencySymbol)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {otherCustody !== 0 && (
            <SummaryRow
              label={otherCustody > 0 ? "عهدة مستحقة عليك" : "عهدة مستحقة لك"}
              value={formatCurrency(Math.abs(otherCustody), currencySymbol)}
              sign={otherCustody > 0 ? "minus" : "plus"}
            />
          )}
          <div className="mt-3 flex items-center justify-between rounded-xl bg-zinc-900 px-4 py-3.5 text-white">
            <span className="text-sm font-bold">إجمالي المستحق</span>
            <span className="text-base font-bold" dir="ltr">
              {formatCurrency(totalDue, currencySymbol)}
            </span>
          </div>
        </div>
      </div>

      <p className="border-t border-zinc-100 bg-zinc-50 px-6 py-3 text-center text-xs text-zinc-400">
        هذا الكشف يوضح الترب والسلف والخصومات والعهدة فقط.
      </p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  sign,
}: {
  label: string;
  value: string;
  sign?: "minus" | "plus";
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-zinc-600">
        {sign === "minus" ? "− " : sign === "plus" ? "+ " : ""}
        {label}
      </span>
      <span className="text-zinc-700" dir="ltr">
        {value}
      </span>
    </div>
  );
}
