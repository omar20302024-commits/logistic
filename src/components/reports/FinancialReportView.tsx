"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Printer, Receipt } from "lucide-react";
import { formatCurrency } from "@/lib/format";

type Summary = {
  total_revenue: number;
  total_driver_payments: number;
  total_diesel: number;
  operating_profit: number;
  total_salaries: number;
  total_driver_expenses: number;
  total_other_expenses: number;
  net_profit: number;
};

export function FinancialReportView({
  from,
  to,
  summary,
  currencySymbol,
}: {
  from: string;
  to: string;
  summary: Summary;
  currencySymbol: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => (v ? params.set(k, v) : params.delete(k)));
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm print:hidden">
        <Field label="من تاريخ">
          <input type="date" value={from} dir="ltr" onChange={(e) => handleChange({ from: e.target.value })} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900" />
        </Field>
        <Field label="إلى تاريخ">
          <input type="date" value={to} dir="ltr" onChange={(e) => handleChange({ to: e.target.value })} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900" />
        </Field>
        <div className="mr-auto flex items-center gap-2">
          <Link href="/expenses" className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
            <Receipt size={15} /> إدارة المصروفات الأخرى
          </Link>
          <button onClick={() => window.print()} type="button" className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800">
            <Printer size={15} /> طباعة
          </button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm print:border-0 print:shadow-none">
        <h2 className="mb-1 text-center text-lg font-bold text-zinc-900">التقرير المالي الشامل</h2>
        <p className="mb-6 text-center text-xs text-zinc-400">
          من {from} إلى {to}
        </p>

        <Section title="الإيرادات">
          <Row label="إجمالي قيمة الرحلات" value={summary.total_revenue} currencySymbol={currencySymbol} />
        </Section>

        <Section title="المصروفات المباشرة">
          <Row label="الترب" value={summary.total_driver_payments} currencySymbol={currencySymbol} sign="minus" />
          <Row label="الديزل" value={summary.total_diesel} currencySymbol={currencySymbol} sign="minus" />
        </Section>

        <TotalRow label="الربح التشغيلي" value={summary.operating_profit} currencySymbol={currencySymbol} />

        <Section title="المصروفات الإضافية">
          <Row label="الرواتب (حسب أيام العمل)" value={summary.total_salaries} currencySymbol={currencySymbol} sign="minus" />
          <Row
            label="مصروفات دفعها السائقون"
            value={summary.total_driver_expenses}
            currencySymbol={currencySymbol}
            sign="minus"
          />
          <Row label="مصروفات أخرى" value={summary.total_other_expenses} currencySymbol={currencySymbol} sign="minus" />
        </Section>

        <TotalRow label="صافي الربح" value={summary.net_profit} currencySymbol={currencySymbol} highlight />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="mb-1 text-xs font-semibold text-zinc-400">{title}</div>
      <div className="divide-y divide-zinc-100">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  currencySymbol,
  sign,
}: {
  label: string;
  value: number;
  currencySymbol: string;
  sign?: "minus";
}) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-zinc-600">
        {sign === "minus" ? "− " : ""}
        {label}
      </span>
      <span className="text-zinc-700" dir="ltr">
        {formatCurrency(value, currencySymbol)}
      </span>
    </div>
  );
}

function TotalRow({
  label,
  value,
  currencySymbol,
  highlight,
}: {
  label: string;
  value: number;
  currencySymbol: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`my-3 flex items-center justify-between rounded-lg px-4 py-3 ${
        highlight ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-900"
      }`}
    >
      <span className="text-sm font-bold">{label}</span>
      <span className="text-base font-bold" dir="ltr">
        {formatCurrency(value, currencySymbol)}
      </span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-zinc-500">{label}</label>
      {children}
    </div>
  );
}
