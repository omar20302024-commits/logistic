"use client";

import { ChevronRight, ChevronLeft } from "lucide-react";

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 text-sm">
      <span className="text-zinc-500">
        عرض {from}-{to} من {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30"
          aria-label="السابق"
        >
          <ChevronRight size={16} />
        </button>
        <span className="px-2 text-xs text-zinc-500">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30"
          aria-label="التالي"
        >
          <ChevronLeft size={16} />
        </button>
      </div>
    </div>
  );
}
