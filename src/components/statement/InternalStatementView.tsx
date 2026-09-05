import { formatCurrency, formatNumber } from "@/lib/format";

type TripRow = {
  id: string;
  trip_date: string;
  trip_number: string;
  company_name: string;
  from_location: string;
  to_location: string;
  loading_count: number;
  loading_total: number;
  unloading_count: number;
  unloading_total: number;
  trip_amount: number;
  driver_trip_payment: number;
  diesel_amount: number;
  trip_profit: number;
  has_temporary_amounts: boolean;
};

type Summary = {
  trips_count: number;
  total_trip_amount: number;
  total_driver_payment: number;
  total_diesel: number;
  operating_profit: number;
  total_advances: number;
  total_deductions: number;
  salary_basic: number;
  net_salary: number;
  total_due_to_driver: number;
};

export function InternalStatementView({
  orgName,
  driverName,
  driverPhone,
  from,
  to,
  trips,
  summary,
  currencySymbol,
}: {
  orgName: string;
  driverName: string;
  driverPhone: string | null;
  from: string;
  to: string;
  trips: TripRow[];
  summary: Summary;
  currencySymbol: string;
}) {
  const netProfitFromDriver = summary.operating_profit - summary.salary_basic;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm print:rounded-none print:border-0 print:shadow-none">
      {/* رأس الكشف */}
      <div className="mb-6 flex items-start justify-between border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-lg font-bold text-zinc-900">{orgName}</h1>
          <p className="text-sm font-semibold text-red-600">كشف حساب داخلي — سري، للإدارة فقط</p>
        </div>
        <div className="text-left text-sm text-zinc-500">
          <div>
            من {from} إلى {to}
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm text-zinc-500">السائق</div>
          <div className="text-lg font-bold text-zinc-900">{driverName}</div>
        </div>
        {driverPhone && (
          <div dir="ltr" className="text-sm text-zinc-500">
            {driverPhone}
          </div>
        )}
      </div>

      {/* جدول الرحلات */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-zinc-300 text-right text-zinc-500">
              <th className="px-2 py-2 font-medium">التاريخ</th>
              <th className="px-2 py-2 font-medium">رقم الرحلة</th>
              <th className="px-2 py-2 font-medium">الشركة</th>
              <th className="px-2 py-2 font-medium">من</th>
              <th className="px-2 py-2 font-medium">إلى</th>
              <th className="px-2 py-2 font-medium">تحميل</th>
              <th className="px-2 py-2 font-medium">تنزيل</th>
              <th className="px-2 py-2 font-medium">سعر الرحلة</th>
              <th className="px-2 py-2 font-medium">التربة</th>
              <th className="px-2 py-2 font-medium">الديزل</th>
              <th className="px-2 py-2 font-medium">ربح الرحلة</th>
            </tr>
          </thead>
          <tbody>
            {trips.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-8 text-center text-zinc-400">
                  لا توجد رحلات في هذه الفترة
                </td>
              </tr>
            ) : (
              trips.map((t) => (
                <tr key={t.id} className="border-b border-zinc-100">
                  <td className="px-2 py-2 whitespace-nowrap" dir="ltr">
                    {t.trip_date}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {t.trip_number}
                    {t.has_temporary_amounts && (
                      <span className="mr-1 text-[10px] text-amber-600">(مؤقت)</span>
                    )}
                  </td>
                  <td className="px-2 py-2">{t.company_name}</td>
                  <td className="px-2 py-2">{t.from_location}</td>
                  <td className="px-2 py-2">{t.to_location}</td>
                  <td className="px-2 py-2 whitespace-nowrap" dir="ltr">
                    {t.loading_count} ({formatCurrency(t.loading_total, currencySymbol)})
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap" dir="ltr">
                    {t.unloading_count} ({formatCurrency(t.unloading_total, currencySymbol)})
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap" dir="ltr">
                    {formatCurrency(t.trip_amount, currencySymbol)}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap" dir="ltr">
                    {formatCurrency(t.driver_trip_payment, currencySymbol)}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap" dir="ltr">
                    {formatCurrency(t.diesel_amount, currencySymbol)}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap font-semibold text-emerald-700" dir="ltr">
                    {formatCurrency(t.trip_profit, currencySymbol)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* الإجماليات */}
      <div className="mt-6 grid grid-cols-1 gap-6 border-t border-zinc-200 pt-4 sm:grid-cols-2">
        <div className="flex flex-col divide-y divide-zinc-100 text-sm">
          <SummaryRow label="عدد الرحلات" value={formatNumber(summary.trips_count)} />
          <SummaryRow label="إجمالي قيمة الرحلات" value={formatCurrency(summary.total_trip_amount, currencySymbol)} />
          <SummaryRow label="إجمالي التربات" value={formatCurrency(summary.total_driver_payment, currencySymbol)} />
          <SummaryRow label="إجمالي الديزل" value={formatCurrency(summary.total_diesel, currencySymbol)} />
          <SummaryRow
            label="إجمالي الربح التشغيلي"
            value={formatCurrency(summary.operating_profit, currencySymbol)}
            bold
          />
        </div>
        <div className="flex flex-col divide-y divide-zinc-100 text-sm">
          <SummaryRow label="الراتب الأساسي (الفترة)" value={formatCurrency(summary.salary_basic, currencySymbol)} />
          <SummaryRow label="إجمالي الخصومات" value={formatCurrency(summary.total_deductions, currencySymbol)} />
          <SummaryRow label="إجمالي السلف" value={formatCurrency(summary.total_advances, currencySymbol)} />
          <SummaryRow label="صافي الراتب" value={formatCurrency(summary.net_salary, currencySymbol)} />
          <SummaryRow
            label="صافي المستحق للسائق"
            value={formatCurrency(summary.total_due_to_driver, currencySymbol)}
            bold
          />
          <SummaryRow
            label="صافي الربح من هذا السائق"
            value={formatCurrency(netProfitFromDriver, currencySymbol)}
            bold
          />
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className={bold ? "font-bold text-zinc-900" : "text-zinc-600"}>{label}</span>
      <span className={`font-mono ${bold ? "font-bold text-zinc-900" : "text-zinc-700"}`} dir="ltr">
        {value}
      </span>
    </div>
  );
}
