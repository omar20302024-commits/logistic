import { formatCurrency, formatNumber } from "@/lib/format";

// كشف الترب فقط: الرحلات وترب كل واحدة — بدون أي ذكر لراتب أو سلف أو خصومات أو عهدة،
// وبدون عمود مواقع التنزيل (طلب المستخدم صراحةً).
// أبسط كشف ممكن إرساله للسائق.

type TripRow = {
  trip_date: string;
  trip_number: string;
  company_name: string;
  from_location: string;
  to_location: string;
  unloading_count: number;
  driver_trip_payment: number;
};

export function TrabOnlyStatementView({
  orgName,
  orgPhone,
  driverName,
  driverPhone,
  from,
  to,
  trips,
  currencySymbol,
}: {
  orgName: string;
  orgPhone: string | null;
  driverName: string;
  driverPhone: string | null;
  from: string;
  to: string;
  trips: TripRow[];
  currencySymbol: string;
}) {
  const tripsCount = trips.length;
  const totalTrab = trips.reduce((sum, t) => sum + Number(t.driver_trip_payment), 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
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
            <p className="text-sm font-semibold">كشف الترب فقط</p>
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
                <th className="px-3 py-2.5 font-medium">الترب</th>
              </tr>
            </thead>
            <tbody>
              {trips.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-400">
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
                    <td className="border-t border-zinc-100 px-3 py-2 whitespace-nowrap font-semibold text-zinc-900" dir="ltr">
                      {formatCurrency(t.driver_trip_payment, currencySymbol)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="my-6 flex flex-col divide-y divide-zinc-100 text-sm sm:mx-auto sm:w-80">
          <div className="flex items-center justify-between py-2">
            <span className="text-zinc-600">عدد الرحلات</span>
            <span className="text-zinc-700" dir="ltr">
              {formatNumber(tripsCount)}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-zinc-900 px-4 py-3.5 text-white">
            <span className="text-sm font-bold">إجمالي الترب</span>
            <span className="text-base font-bold" dir="ltr">
              {formatCurrency(totalTrab, currencySymbol)}
            </span>
          </div>
        </div>
      </div>

      <p className="border-t border-zinc-100 bg-zinc-50 px-6 py-3 text-center text-xs text-zinc-400">
        هذا الكشف يوضح الترب فقط.
      </p>
    </div>
  );
}
