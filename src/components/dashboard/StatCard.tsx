import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: "default" | "positive" | "negative" | "warning";
}) {
  const toneClasses: Record<string, string> = {
    default: "bg-zinc-900 text-white",
    positive: "bg-emerald-600 text-white",
    negative: "bg-red-600 text-white",
    warning: "bg-amber-500 text-white",
  };

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${toneClasses[tone]}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs font-medium text-zinc-500">{label}</div>
        <div className="truncate text-lg font-bold text-zinc-900" dir="ltr">
          {value}
        </div>
      </div>
    </div>
  );
}
