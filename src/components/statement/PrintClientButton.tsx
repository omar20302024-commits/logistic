"use client";

import { Printer } from "lucide-react";

export function PrintClientButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
    >
      <Printer size={15} />
      طباعة / حفظ PDF
    </button>
  );
}
