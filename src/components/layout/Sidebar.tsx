"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navGroups } from "@/lib/nav-items";
import { Truck } from "lucide-react";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col border-l border-zinc-200 bg-white">
      <div className="flex items-center gap-2 border-b border-zinc-200 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 text-white">
          <Truck size={18} />
        </div>
        <div>
          <div className="text-sm font-bold text-zinc-900">نظام الرحلات</div>
          <div className="text-xs text-zinc-400">إدارة السائقين والربحية</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => (
          <div key={group.title} className="mb-5">
            <div className="mb-1.5 px-3 text-xs font-semibold text-zinc-400">
              {group.title}
            </div>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                    }`}
                  >
                    <Icon size={17} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}
