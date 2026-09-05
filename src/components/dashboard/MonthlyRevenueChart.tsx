"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatMonthLabel, formatCurrency } from "@/lib/format";

export type MonthlyPoint = {
  month_start: string;
  trips_count: number;
  total_trip_amount: number;
  total_driver_payments: number;
  total_diesel: number;
  operating_profit: number;
};

export function MonthlyRevenueChart({
  data,
  currencySymbol,
}: {
  data: MonthlyPoint[];
  currencySymbol: string;
}) {
  const chartData = data.map((d) => ({
    ...d,
    label: formatMonthLabel(d.month_start),
  }));

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-bold text-zinc-900">الإيرادات والربح الشهري</h3>
      <div dir="ltr" className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 4, left: -10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value) => formatCurrency(Number(value), currencySymbol)}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="total_trip_amount" name="الإيرادات" fill="#a1a1aa" radius={[4, 4, 0, 0]} />
            <Bar dataKey="total_driver_payments" name="التربات" fill="#fbbf24" radius={[4, 4, 0, 0]} />
            <Bar dataKey="total_diesel" name="الديزل" fill="#f87171" radius={[4, 4, 0, 0]} />
            <Line
              type="monotone"
              dataKey="operating_profit"
              name="الربح التشغيلي"
              stroke="#16a34a"
              strokeWidth={2.5}
              dot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
