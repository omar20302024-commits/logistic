import { formatCurrency, formatNumber } from "@/lib/format";

// تحذير معماري مهم: هذا المكوّن مخصص حصرياً لكشف حساب السائق القابل للمشاركة.
// أنواع الـ props هنا لا تحتوي إطلاقاً على سعر الرحلة أو الديزل أو الربح —
// حتى لو حاول أحد لاحقاً تمرير هذه البيانات، فلن تتوافق مع الأنواع المعرَّفة هنا.
// لا تُضف أي حقل مالي سري لهذا الملف مهما كان السبب.

type PublicTripRow = {
  trip_date: string;
  trip_number: string;
  company_name: string;
  from_location: string;
  to_location: string;
  loading_count: number;
  unloading_count: number;
  driver_trip_payment: number;
};

type PublicSummary = {
  trips_count: number;
  total_driver_payment: number;
  total_advances: number;
  total_deductions: number;
  salary_basic: number;
  net_salary: number;
  total_due_to_driver: number;
};

export function DriverStatementView({
  orgName,
  orgPhone,
  driverName,
  driverPhone,
  from,
  to,
  trips,
  summary,
  currencySymbol,
}: {
  orgName: string;
  orgPhone: string | null;
  driverName: string;
  driverPhone: string | null;
  from: string;
  to: string;
  trips: PublicTripRow[];
  summary: PublicSummary;
  currencySymbol: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm print:rounded-none print:border-0 print:shadow-none">
      {/* رأس الكشف */}
      <div className="mb-6 flex items-start justify-between border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-lg font-bold text-zinc-900">{orgName}</h1>
          {orgPhone && (
            <p dir="ltr" className="text-sm text-zinc-500">
              {orgPhone}
            </p>
          )}
        </div>
        <div className="text-left">
          <p className="text-sm font-semibold text-zinc-700">كشف حساب السائق</p>
          <p className="text-xs text-zinc-500">
            من {from} إلى {to}
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm text-zinc-500">اسم السائق</div>
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
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-300 text-right text-zinc-500">
              <th className="px-2 py-2 font-medium">التاريخ</th>
              <th className="px-2 py-2 font-medium">رقم الرحلة</th>
              <th className="px-2 py-2 font-medium">الشركة</th>
              <th className="px-2 py-2 font-medium">من</th>
              <th className="px-2 py-2 font-medium">إلى</th>
              <th className="px-2 py-2 font-medium">تحميل</th>
              <th className="px-2 py-2 font-medium">تنزيل</th>
              <th className="px-2 py-2 font-medium">التربة</th>
            </tr>
          </thead>
          <tbody>
            {trips.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-zinc-400">
                  لا توجد رحلات في هذه الفترة
                </td>
              </tr>
            ) : (
              trips.map((t, i) => (
                <tr key={i} className="border-b border-zinc-100">
                  <td className="px-2 py-2 whitespace-nowrap" dir="ltr">
                    {t.trip_date}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">{t.trip_number}</td>
                  <td className="px-2 py-2">{t.company_name}</td>
                  <td className="px-2 py-2">{t.from_location}</td>
                  <td className="px-2 py-2">{t.to_location}</td>
                  <td className="px-2 py-2 text-center">{t.loading_count}</td>
                  <td className="px-2 py-2 text-center">{t.unloading_count}</td>
                  <td className="px-2 py-2 whitespace-nowrap font-semibold text-zinc-900" dir="ltr">
                    {formatCurrency(t.driver_trip_payment, currencySymbol)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* الإجماليات */}
      <div className="mt-6 flex flex-col divide-y divide-zinc-100 border-t border-zinc-200 pt-2 text-sm sm:mx-auto sm:w-80">
        <SummaryRow label="عدد الرحلات" value={formatNumber(summary.trips_count)} />
        <SummaryRow label="إجمالي التربات" value={formatCurrency(summary.total_driver_payment, currencySymbol)} />
        <SummaryRow label="الراتب الأساسي" value={formatCurrency(summary.salary_basic, currencySymbol)} />
        <SummaryRow label="الخصومات" value={formatCurrency(summary.total_deductions, currencySymbol)} />
        <SummaryRow label="السلف" value={formatCurrency(summary.total_advances, currencySymbol)} />
        <SummaryRow label="صافي الراتب" value={formatCurrency(summary.net_salary, currencySymbol)} bold />
        <div className="flex items-center justify-between rounded-lg bg-zinc-900 px-3 py-3 text-white mt-2">
          <span className="text-sm font-bold">إجمالي المستحق للسائق</span>
          <span className="font-mono text-base font-bold" dir="ltr">
            {formatCurrency(summary.total_due_to_driver, currencySymbol)}
          </span>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-zinc-400">
        هذا الكشف يوضح مستحقات السائق فقط.
      </p>
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
