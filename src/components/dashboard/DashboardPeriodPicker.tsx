"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

const MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

/**
 * اختيار شهر للوحة التحكم.
 *
 * الافتراضي «كل الفترات» — نفس ما كانت تعرضه اللوحة دائماً، فلا تتبدّل الأرقام
 * التي اعتادها المستخدم بمجرّد التحديث.
 *
 * ملاحظة: الرسوم البيانية أسفل الصفحة تبقى على آخر اثني عشر شهراً مهما اخترت،
 * فغرضها إظهار الاتجاه لا لقطة شهر.
 */
export function DashboardPeriodPicker({ month }: { month: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const now = new Date();
  const options = Array.from({ length: 18 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { value, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` };
  });

  const change = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("month", value);
    else params.delete("month");
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2 print:hidden">
      <label className="text-xs font-medium text-zinc-500">الفترة</label>
      <select
        value={month}
        onChange={(e) => change(e.target.value)}
        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-zinc-900"
      >
        <option value="">كل الفترات</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
