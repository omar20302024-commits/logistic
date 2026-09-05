import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Building2,
  Truck,
  Wallet,
  FileText,
  BarChart3,
  Banknote,
  Fuel,
  Receipt,
  PieChart,
  Settings,
  Home,
  UserCog,
  Upload,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    title: "الرئيسية",
    items: [{ label: "لوحة التحكم", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    title: "الإدارة",
    items: [
      { label: "السائقون", href: "/drivers", icon: Users },
      { label: "الشركات", href: "/companies", icon: Building2 },
      { label: "الرحلات", href: "/trips", icon: Truck },
      { label: "استيراد رحلات (Excel)", href: "/trips/import", icon: Upload },
      { label: "الرواتب", href: "/salaries", icon: Wallet },
      { label: "عقود الإيجار الشهري", href: "/rentals", icon: Home },
      { label: "وحدات السكن", href: "/rentals/housing", icon: Home },
    ],
  },
  {
    title: "الكشوفات",
    items: [
      { label: "كشف حساب السائق", href: "/statement", icon: FileText },
      { label: "كشف حساب الموردين", href: "/reports/external-drivers", icon: UserCog },
    ],
  },
  {
    title: "التقارير",
    items: [
      { label: "تقرير السائقين", href: "/reports/drivers", icon: BarChart3 },
      { label: "تقرير الشركات", href: "/reports/companies", icon: BarChart3 },
      { label: "ربحية الرحلات", href: "/reports/profitability", icon: BarChart3 },
      { label: "تقرير التربات", href: "/reports/driver-payments", icon: Banknote },
      { label: "تقرير الديزل", href: "/reports/diesel", icon: Fuel },
      { label: "ربحية عقود الإيجار", href: "/rentals/report", icon: PieChart },
      { label: "التقرير المالي", href: "/reports/financial", icon: PieChart },
    ],
  },
  {
    title: "النظام",
    items: [
      { label: "المصروفات", href: "/expenses", icon: Receipt },
      { label: "الإعدادات", href: "/settings", icon: Settings },
    ],
  },
];
