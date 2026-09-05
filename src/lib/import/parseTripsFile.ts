import * as cheerio from "cheerio";

export type ParsedTripRow = {
  rowIndex: number;
  date: string; // YYYY-MM-DD
  fromLocation: string;
  toLocation: string;
  driverName: string;
  baseFare: number;
  extraFee: number;
  returnFee: number;
  totalPrice: number;
  vendorCost: number; // تكلفة المورد -> تربة السائق
  statusRaw: string;
  statusMapped: "new" | "in_progress" | "completed" | "cancelled";
  needsReview: boolean; // الصف فيه عدد خلايا أقل من المتوقع (احتمال خانة ناقصة)
};

export type ParseResult =
  | { ok: true; companyNameGuess: string | null; rows: ParsedTripRow[]; driverNames: string[] }
  | { ok: false; error: string };

// أسماء الأعمدة المتوقعة في ملف تقرير الرحلات (بديلان محتملان للاسم نفسه)
const HEADER_ALIASES: Record<string, string[]> = {
  date: ["التاريخ"],
  from: ["نقطة التحميل"],
  to: ["نقطة التنزيل"],
  driver: ["السائق"],
  baseFare: ["الأجرة الأساسية"],
  extraFee: ["موقع إضافي"],
  returnFee: ["أجرة المرتجع"],
  totalPrice: ["سعر الرحلة الكاملة"],
  vendorCost: ["تكلفة المورد"],
  status: ["الحالة"],
};

function parseAmount(text: string): number {
  const cleaned = text.replace(/[^\d.]/g, "");
  if (!cleaned) return 0;
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? 0 : n;
}

function parseDate(text: string): string {
  const m = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return "";
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function mapStatus(text: string): ParsedTripRow["statusMapped"] {
  const t = text.trim();
  if (t.startsWith("ملغ")) return "cancelled";
  if (t.startsWith("قيد") || t.includes("جارية")) return "in_progress";
  if (t.startsWith("جديد")) return "new";
  return "completed";
}

/**
 * يحلّل ملف تقرير رحلات مُصدَّر كـ HTML (بامتداد .xls أو .htm) — وهو الشكل الشائع
 * لتصدير "Excel" من أنظمة الويب. لا يدعم ملفات Excel الثنائية الحقيقية (.xlsx) هنا؛
 * تلك تُعالَج بمكتبة xlsx بشكل منفصل عند الحاجة.
 */
export function parseTripsFile(content: string): ParseResult {
  if (/<frameset/i.test(content) || /\bshLink\b/.test(content)) {
    return {
      ok: false,
      error:
        "هذا الملف حاوية (Frameset) والبيانات الفعلية موجودة في ملف منفصل داخل مجلد مرفق بنفس اسم الملف مع لاحقة \"_files\" (عادة اسمه sheet001.htm). افتح ذلك المجلد وارفع الملف الداخلي بدلاً من هذا الملف.",
      };
  }

  const $ = cheerio.load(content);

  let headerMap: Record<string, number> | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dataRows: any[] = [];
  let totalColumns = 0;

  const tables = $("table").toArray();
  for (const table of tables) {
    if (headerMap) break;
    const rows = $(table).find("tr").toArray();
    for (let i = 0; i < rows.length; i++) {
      const cells = $(rows[i]).find("td, th").toArray();
      const texts = cells.map((c) => $(c).text().trim());
      const map: Record<string, number> = {};
      let colIndex = 0;
      cells.forEach((cell, cellIdx) => {
        const text = texts[cellIdx];
        const colspan = parseInt($(cell).attr("colspan") || "1", 10);
        for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
          if (aliases.includes(text)) map[key] = colIndex;
        }
        colIndex += colspan;
      });
      if (map.date !== undefined && map.driver !== undefined && map.totalPrice !== undefined) {
        headerMap = map;
        totalColumns = colIndex;
        dataRows = rows.slice(i + 1);
        break;
      }
    }
  }

  if (!headerMap) {
    return {
      ok: false,
      error: "لم يتم التعرف على أعمدة الملف. تأكد أن الملف بنفس تنسيق تقرير الرحلات المعتاد.",
    };
  }

  let companyNameGuess: string | null = null;
  $("td, div, span").each((_, el) => {
    if (companyNameGuess) return;
    const text = $(el).text().trim();
    const m = text.match(/تقرير رحلات العميل\s*[—-]\s*(.+)/);
    if (m) companyNameGuess = m[1].trim();
  });

  const rows: ParsedTripRow[] = [];
  const driverNamesSet = new Set<string>();

  dataRows.forEach((tr: any, idx: number) => {
    const cells = $(tr).find("td, th").toArray();
    if (cells.length === 0) return;

    const expanded: string[] = [];
    for (const cell of cells) {
      const text = $(cell).text().trim();
      const colspan = parseInt($(cell).attr("colspan") || "1", 10);
      for (let k = 0; k < colspan; k++) expanded.push(k === 0 ? text : "");
    }

    const needsReview = expanded.length < totalColumns;

    const get = (key: string) => {
      const i = headerMap![key];
      return i !== undefined ? (expanded[i] ?? "") : "";
    };

    const driverName = get("driver").trim();
    const dateText = get("date").trim();
    if (!driverName || !dateText) return;

    const date = parseDate(dateText);
    if (!date) return;

    const statusRaw = get("status").trim();

    rows.push({
      rowIndex: idx,
      date,
      fromLocation: get("from").trim() || "غير محدد",
      toLocation: get("to").trim() || "غير محدد",
      driverName,
      baseFare: parseAmount(get("baseFare")),
      extraFee: parseAmount(get("extraFee")),
      returnFee: parseAmount(get("returnFee")),
      totalPrice: parseAmount(get("totalPrice")),
      vendorCost: parseAmount(get("vendorCost")),
      statusRaw,
      statusMapped: mapStatus(statusRaw),
      needsReview,
    });

    driverNamesSet.add(driverName);
  });

  return { ok: true, companyNameGuess, rows, driverNames: Array.from(driverNamesSet) };
}
