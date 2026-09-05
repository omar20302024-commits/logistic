"use client";

import { Menu, LogOut } from "lucide-react";
import { logout } from "@/app/login/actions";

export function Topbar({
  userEmail,
  onMenuClick,
}: {
  userEmail: string | undefined;
  onMenuClick: () => void;
}) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-4 sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 lg:hidden"
        aria-label="فتح القائمة"
      >
        <Menu size={20} />
      </button>

      <div className="hidden lg:block" />

      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-zinc-500 sm:inline" dir="ltr">
          {userEmail}
        </span>
        <form action={logout}>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
          >
            <LogOut size={15} />
            <span>خروج</span>
          </button>
        </form>
      </div>
    </header>
  );
}
