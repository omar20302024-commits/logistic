import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
});

export const metadata: Metadata = {
  title: "نظام إدارة السائقين والرحلات",
  description: "نظام إدارة وتشغيل السائقين والرحلات وحساب الربحية",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <Toaster position="top-center" dir="rtl" richColors />
      </body>
    </html>
  );
}
