"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Printer, FileText } from "lucide-react";

type Option = { id: string; name: string };

export function StatementFilters({
  drivers,
  driverId,
  from,
  to,
  hasSelection,
}: {
  drivers: Option[];
  driverId: string;
  from: string;
  to: string;
  hasSelection: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm print:hidden">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-zinc-500">السائق</label>
        <select
          value={driverId}
          onChange={(e) => handleChange({ driver: e.target.value })}
          className="min-w-[180px] rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
        >
          <option value="">اختر السائق</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-zinc-500">من تاريخ</label>
        <input
          type="date"
          value={from}
          onChange={(e) => handleChange({ from: e.target.value })}
          dir="ltr"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-zinc-500">إلى تاريخ</label>
        <input
          type="date"
          value={to}
          onChange={(e) => handleChange({ to: e.target.value })}
          dir="ltr"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
        />
      </div>
      {hasSelection && (
        <div className="mr-auto flex flex-wrap items-center gap-2">
          <Link
            href={`/statement/public?driver=${driverId}&from=${from}&to=${to}`}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            <FileText size={15} />
            كشف حساب للسائق
          </Link>
          <Link
            href={`/statement/trab?driver=${driverId}&from=${from}&to=${to}`}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            <FileText size={15} />
            كشف الترب
          </Link>
          <Link
            href={`/statement/trab-only?driver=${driverId}&from=${from}&to=${to}`}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            <FileText size={15} />
            كشف الترب فقط
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            <Printer size={15} />
            طباعة الكشف الداخلي
          </button>
        </div>
      )}
    </div>
  );
}
