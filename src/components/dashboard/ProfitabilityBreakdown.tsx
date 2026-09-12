import { formatCurrency } from "@/lib/format";

type Props = {
  totalTripAmount: number;
  totalDriverPayments: number;
  totalDiesel: number;
  totalRentalRevenue: number;
  totalRentalDiesel: number;
  operatingProfit: number;
  totalSalaries: number;
  totalDriverExpenses: number;
  totalMonthlyDiesel: number;
  totalHousingCost: number;
  totalOtherExpenses: number;
  netProfit: number;
  currencySymbol: string;
};

function Row({
  label,
  value,
  currencySymbol,
  sign,
  bold,
}: {
  label: string;
  value: number;
  currencySymbol: string;
  sign?: "minus" | "plus";
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className={`text-sm ${bold ? "font-bold text-zinc-900" : "text-zinc-600"}`}>
        {sign === "minus" ? "− " : sign === "plus" ? "+ " : ""}
        {label}
      </span>
      <span
        className={`text-sm ${bold ? "font-bold text-zinc-900" : "text-zinc-700"}`}
        dir="ltr"
      >
        {formatCurrency(value, currencySymbol)}
      </span>
    </div>
  );
}

export function ProfitabilityBreakdown(props: Props) {
  const {
    totalTripAmount,
    totalDriverPayments,
    totalDiesel,
    totalRentalRevenue,
    totalRentalDiesel,
    operatingProfit,
    totalSalaries,
    totalDriverExpenses,
    totalMonthlyDiesel,
    totalHousingCost,
    totalOtherExpenses,
    netProfit,
    currencySymbol,
  } = props;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="mb-1 text-sm font-bold text-zinc-900">الربحية</h3>
      <p className="mb-2 text-xs text-zinc-400">بيانات سرية — للإدارة فقط</p>

      <div className="divide-y divide-zinc-100">
        <Row label="إجمالي قيمة الرحلات" value={totalTripAmount} currencySymbol={currencySymbol} />
        <Row label="عقود الإيجار الشهري" value={totalRentalRevenue} currencySymbol={currencySymbol} />
        <Row label="إجمالي الترب" value={totalDriverPayments} currencySymbol={currencySymbol} sign="minus" />
        <Row label="الديزل (الرحلات)" value={totalDiesel} currencySymbol={currencySymbol} sign="minus" />
        <Row label="الديزل (عقود الإيجار)" value={totalRentalDiesel} currencySymbol={currencySymbol} sign="minus" />
        <Row
          label="الربح التشغيلي"
          value={operatingProfit}
          currencySymbol={currencySymbol}
          bold
        />
      </div>

      <div className="my-3 border-t border-dashed border-zinc-300" />

      <div className="divide-y divide-zinc-100">
        <Row label="الربح التشغيلي" value={operatingProfit} currencySymbol={currencySymbol} />
        <Row label="الرواتب (حسب أيام العمل)" value={totalSalaries} currencySymbol={currencySymbol} sign="minus" />
        <Row label="مصروفات دفعها السائقون" value={totalDriverExpenses} currencySymbol={currencySymbol} sign="minus" />
        <Row label="الديزل الشهري للسائقين" value={totalMonthlyDiesel} currencySymbol={currencySymbol} sign="minus" />
        <Row label="إيجار السكن" value={totalHousingCost} currencySymbol={currencySymbol} sign="minus" />
        <Row label="مصروفات أخرى" value={totalOtherExpenses} currencySymbol={currencySymbol} sign="minus" />
        <Row
          label="صافي الربح"
          value={netProfit}
          currencySymbol={currencySymbol}
          bold
        />
      </div>
    </div>
  );
}
