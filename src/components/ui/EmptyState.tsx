import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
        <Icon size={22} />
      </div>
      <div className="text-sm font-semibold text-zinc-700">{title}</div>
      {description && <div className="max-w-xs text-xs text-zinc-400">{description}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
