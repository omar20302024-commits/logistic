"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function DashboardShell({
  userEmail,
  children,
}: {
  userEmail: string | undefined;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-zinc-50 print:block print:h-auto print:overflow-visible print:bg-white">
      {/* Sidebar - ثابت في الشاشات الكبيرة */}
      <div className="hidden lg:block print:hidden">
        <Sidebar />
      </div>

      {/* Sidebar - قائمة منسدلة في الجوال */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden print:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 right-0">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden print:block print:overflow-visible">
        <div className="print:hidden">
          <Topbar userEmail={userEmail} onMenuClick={() => setMobileOpen(true)} />
        </div>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 print:overflow-visible print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
