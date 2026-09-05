export function formatCurrency(value: number | null | undefined, symbol = "ر.س") {
  const n = Number(value ?? 0);
  const formatted = new Intl.NumberFormat("ar-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  return `${formatted} ${symbol}`;
}

export function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("ar-SA").format(Number(value ?? 0));
}

const monthNamesAr = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export function formatMonthLabel(dateStr: string) {
  const d = new Date(dateStr);
  return `${monthNamesAr[d.getMonth()]} ${d.getFullYear()}`;
}
