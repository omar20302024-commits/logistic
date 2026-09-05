"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatMonthLabel } from "@/lib/format";
import type { MonthlyPoint } from "./MonthlyRevenueChart";

export function TripsCountChart({ data }: { data: MonthlyPoint[] }) {
  const chartData = data.map((d) => ({
    label: formatMonthLabel(d.month_start),
    trips_count: d.trips_count,
  }));

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-bold text-zinc-900">عدد الرحلات شهرياً</h3>
      <div dir="ltr" className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, left: -10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Bar dataKey="trips_count" name="عدد الرحلات" fill="#3f3f46" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
