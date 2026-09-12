import ExcelJS from "exceljs";

/**
 * تصدير Excel منسَّق (.xlsx) — بديل CSV الخام.
 *
 * يُستخدم exceljs لا مكتبة xlsx الموجودة في المشروع، لأن النسخة المجانية من
 * الأخيرة لا تدعم تنسيق الخلايا إطلاقاً (الألوان والخطوط والحدود ميزة مدفوعة).
 *
 * كل شيء هنا يعمل في المتصفح: الملف يُبنى في الذاكرة ويُنزَّل مباشرةً بلا خادم.
 */

export type ExcelColumn = {
  header: string;
  key: string;
  width?: number;
  /** عمود مبالغ: محاذاة يسار + تنسيق رقمي بفاصلة ومنزلتين */
  money?: boolean;
  /** عمود أرقام/تواريخ تُقرأ من اليسار لليمين */
  ltr?: boolean;
};

export type ExcelExportOptions = {
  fileName: string;
  sheetName: string;
  /** عنوان كبير أعلى الورقة */
  title: string;
  /** سطر تحت العنوان: الفترة أو الفلاتر المطبَّقة */
  subtitle?: string;
  columns: ExcelColumn[];
  rows: Record<string, string | number | null>[];
  /** صف إجماليات يُثبَّت أسفل الجدول بخلفية داكنة */
  totals?: Record<string, string | number | null>;
  /** يظهر أسفل الورقة — اسم المراجِع مثلاً */
  footer?: string;
};

const BRAND = "FF18181B"; // zinc-900 — نفس لون رأس الكشوفات في الواجهة
const HEADER_TEXT = "FFFFFFFF";
const STRIPE = "FFF8F8F8";
const BORDER = "FFE4E4E7";

export async function exportToExcel(options: ExcelExportOptions) {
  const { fileName, sheetName, title, subtitle, columns, rows, totals, footer } = options;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = title;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ rightToLeft: true, state: "frozen", ySplit: subtitle ? 4 : 3 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  sheet.columns = columns.map((c) => ({ key: c.key, width: c.width ?? 16 }));

  const lastCol = columns.length;
  const colLetter = (n: number) => sheet.getColumn(n).letter;
  const span = (row: number) => `A${row}:${colLetter(lastCol)}${row}`;

  // العنوان
  const titleRow = sheet.addRow([]);
  sheet.mergeCells(span(titleRow.number));
  const titleCell = sheet.getCell(`A${titleRow.number}`);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 16, color: { argb: BRAND } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleRow.height = 28;

  if (subtitle) {
    const subRow = sheet.addRow([]);
    sheet.mergeCells(span(subRow.number));
    const subCell = sheet.getCell(`A${subRow.number}`);
    subCell.value = subtitle;
    subCell.font = { size: 11, color: { argb: "FF71717A" } };
    subCell.alignment = { horizontal: "center", vertical: "middle" };
    subRow.height = 18;
  }

  sheet.addRow([]); // فاصل

  // رأس الجدول
  const headerRow = sheet.addRow(columns.map((c) => c.header));
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 11, color: { argb: HEADER_TEXT } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: BRAND } },
      bottom: { style: "thin", color: { argb: BRAND } },
      left: { style: "thin", color: { argb: BRAND } },
      right: { style: "thin", color: { argb: BRAND } },
    };
  });

  const firstDataRow = headerRow.number + 1;

  // الصفوف
  rows.forEach((r, i) => {
    const row = sheet.addRow(columns.map((c) => r[c.key] ?? ""));
    row.height = 20;
    row.eachCell((cell, colNumber) => {
      const col = columns[colNumber - 1];
      cell.alignment = {
        horizontal: col?.money ? "left" : col?.ltr ? "left" : "right",
        vertical: "middle",
      };
      if (col?.money) cell.numFmt = "#,##0.00";
      cell.border = {
        bottom: { style: "hair", color: { argb: BORDER } },
      };
      if (i % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: STRIPE } };
      }
    });
  });

  // الإجماليات
  if (totals) {
    const row = sheet.addRow(columns.map((c) => totals[c.key] ?? ""));
    row.height = 24;
    row.eachCell((cell, colNumber) => {
      const col = columns[colNumber - 1];
      cell.font = { bold: true, size: 11, color: { argb: HEADER_TEXT } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
      cell.alignment = {
        horizontal: col?.money ? "left" : col?.ltr ? "left" : "right",
        vertical: "middle",
      };
      if (col?.money) cell.numFmt = "#,##0.00";
    });
  }

  // فلترة تلقائية على رأس الجدول — تخلي الملف قابل للفرز والتصفية فوراً
  if (rows.length > 0) {
    sheet.autoFilter = {
      from: { row: headerRow.number, column: 1 },
      to: { row: firstDataRow + rows.length - 1, column: lastCol },
    };
  }

  if (footer) {
    sheet.addRow([]);
    const fRow = sheet.addRow([]);
    sheet.mergeCells(span(fRow.number));
    const fCell = sheet.getCell(`A${fRow.number}`);
    fCell.value = footer;
    fCell.font = { size: 10, italic: true, color: { argb: "FF71717A" } };
    fCell.alignment = { horizontal: "center" };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
