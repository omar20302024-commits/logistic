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
import { formatCurrency } from "@/lib/format";

export type RankingItem = {
  name: string;
  operating_profit: number;
  trips_count: number;
};

export function ProfitabilityRankingChart({
  title,
  data,
  currencySymbol,
  emptyLabel,
}: {
  title: string;
  data: RankingItem[];
  currencySymbol: string;
  emptyLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-bold text-zinc-900">{title}</h3>
      {data.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-zinc-400">
          {emptyLabel}
        </div>
      ) : (
        <div dir="ltr" className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 4, left: 10, right: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 12 }}
                width={90}
              />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value), currencySymbol)}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar dataKey="operating_profit" name="الربح" fill="#18181b" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
