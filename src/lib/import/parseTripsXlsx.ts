import * as XLSX from "xlsx";
import { normalizeArabic } from "@/lib/arabic";

/**
 * قارئ ملف رحلات بصيغة .xlsx بالتنسيق الذي يصدّره المستخدم:
 *
 *   الصف 1: اسم المؤسسة       (يُتجاهَل)
 *   الصف 2: اسم العميل         ← منه تُستنتج الشركة
 *   الصف 3: فارغ
 *   الصف 4: عناوين الأعمدة
 *   الصف 5 فما بعد: البيانات
 *
 * العناوين تُطابَق بالاسم لا بالموضع، فترتيب الأعمدة لو اتغيّر الملف يفضل شغّال.
 * والمطابقة بـ normalizeArabic فتتجاهل الفروق الإملائية (الأجرة/الاجرة).
 */

import type { ParsedTripRow, ParseResult } from "./parseTripsFile";

export type ParseXlsxResult = ParseResult & {
  vehicleTypeNames?: string[];
};

/** أسماء الأعمدة المتوقَّعة — البدائل المحتملة لكل عمود */
const HEADERS: Record<keyof typeof FIELD, string[]> = {
  date: ["التاريخ"],
  from: ["نقطة التحميل", "من"],
  to: ["نقطة التنزيل", "إلى"],
  vehicleType: ["نوع السيارة", "النوع"],
  driver: ["السائق", "اسم السائق"],
  baseFare: ["الأجرة الأساسية", "الاجرة الاساسية"],
  branches: ["الفروع", "عدد الفروع"],
  extra: ["موقع إضافي", "الموقع الإضافي", "أجرة الموقع الإضافي"],
  returnFee: ["أجرة المرتجع", "المرتجع", "اجرة المرتجع"],
  total: ["سعر الرحلة الكاملة", "سعر الرحلة", "الإجمالي"],
  requester: ["صاحب الطلب"],
};

const FIELD = {
  date: 0,
  from: 0,
  to: 0,
  vehicleType: 0,
  driver: 0,
  baseFare: 0,
  branches: 0,
  extra: 0,
  returnFee: 0,
  total: 0,
  requester: 0,
};

/** "2,200.00 ريال" → 2200 · "—" → 0 */
function parseMoney(raw: string): number {
  const cleaned = String(raw ?? "")
    .replace(/[^\d.,-]/g, "")
    .replace(/,/g, "");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** "—" أو فراغ → 0 */
function parseCount(raw: string): number {
  const n = Number.parseInt(String(raw ?? "").replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * "5/9/26" → "2026-09-05" (يوم/شهر/سنة).
 * الترتيب يوم-أولاً مقصود: هذا ما يصدّره الملف، ولو قرأناه شهراً-أولاً لانقلب
 * 5 سبتمبر إلى 9 مايو بصمت.
 */
function parseDate(raw: string): string | null {
  const s = String(raw ?? "").trim();

  // رقم تسلسلي من Excel
  if (/^\d{5}$/.test(s)) {
    const parsed = XLSX.SSF.parse_date_code(Number(s));
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }

  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (!m) return null;

  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = Number(m[3]);
  if (year < 100) year += 2000;

  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseTripsXlsx(buffer: ArrayBuffer): ParseXlsxResult {
  let rows: string[][];
  try {
    const wb = XLSX.read(buffer, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return { ok: false, error: "الملف لا يحتوي على أي ورقة بيانات" };
    rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });
  } catch {
    return { ok: false, error: "تعذّرت قراءة الملف — تأكد أنه ملف Excel بصيغة .xlsx" };
  }

  // البحث عن صف العناوين: أول صف فيه "التاريخ" وعمود آخر معروف
  const headerRowIndex = rows.findIndex((r) => {
    const cells = r.map((c) => normalizeArabic(String(c)));
    return cells.includes(normalizeArabic("التاريخ")) && cells.some((c) => c.includes(normalizeArabic("السائق")));
  });

  if (headerRowIndex === -1) {
    return {
      ok: false,
      error: "لم يُعثر على صف العناوين — المتوقع صف فيه «التاريخ» و«السائق»",
    };
  }

  const headerCells = rows[headerRowIndex].map((c) => normalizeArabic(String(c)));
  const findCol = (names: string[]) =>
    headerCells.findIndex((cell) => names.some((n) => cell === normalizeArabic(n)));

  const col = {
    date: findCol(HEADERS.date),
    from: findCol(HEADERS.from),
    to: findCol(HEADERS.to),
    vehicleType: findCol(HEADERS.vehicleType),
    driver: findCol(HEADERS.driver),
    baseFare: findCol(HEADERS.baseFare),
    branches: findCol(HEADERS.branches),
    extra: findCol(HEADERS.extra),
    returnFee: findCol(HEADERS.returnFee),
    total: findCol(HEADERS.total),
    requester: findCol(HEADERS.requester),
  };

  const missing = (["date", "from", "to", "driver", "baseFare"] as const).filter(
    (k) => col[k] === -1
  );
  if (missing.length > 0) {
    return {
      ok: false,
      error: `أعمدة مفقودة في الملف: ${missing
        .map((k) => HEADERS[k][0])
        .join("، ")} — تأكد أنك رفعت ملف تقرير الرحلات الصحيح`,
    };
  }

  // اسم العميل في الصفوف التي قبل العناوين — آخر صف غير فارغ منها
  let companyNameGuess: string | null = null;
  for (let i = headerRowIndex - 1; i >= 0; i--) {
    const first = String(rows[i]?.[0] ?? "").trim();
    if (first) {
      companyNameGuess = first;
      break;
    }
  }

  const cell = (r: string[], i: number) => (i === -1 ? "" : String(r[i] ?? "").trim());

  const parsed: ParsedTripRow[] = [];
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((c) => !String(c ?? "").trim())) continue;

    const dateRaw = cell(r, col.date);
    const driverName = cell(r, col.driver);
    if (!dateRaw && !driverName) continue;

    const date = parseDate(dateRaw);
    const reasons: string[] = [];
    if (!date) reasons.push("تاريخ غير مقروء");
    if (!driverName) reasons.push("اسم السائق فارغ");

    parsed.push({
      rowIndex: i + 1,
      date: date ?? "",
      fromLocation: cell(r, col.from),
      toLocation: cell(r, col.to),
      driverName,
      baseFare: parseMoney(cell(r, col.baseFare)),
      extraFee: parseMoney(cell(r, col.extra)),
      // المرتجع يُستورد في خانة "أجرة المبيت/مرتجع" — بند واحد يحمل الاثنين
      returnFee: parseMoney(cell(r, col.returnFee)),
      totalPrice: parseMoney(cell(r, col.total)),
      // الملف لا يحتوي ترب السائق — يُملأ من الترب الافتراضي للسائق وقت الحفظ
      vendorCost: 0,
      statusRaw: "",
      statusMapped: "completed",
      branchesCount: parseCount(cell(r, col.branches)),
      vehicleTypeName: cell(r, col.vehicleType),
      requester: cell(r, col.requester),
      needsReview: reasons.length > 0,
      reviewReason: reasons.join("، "),
    });
  }

  if (parsed.length === 0) {
    return { ok: false, error: "لم يُعثر على أي صف بيانات بعد صف العناوين" };
  }

  const driverNames = [...new Set(parsed.map((p) => p.driverName).filter(Boolean))];
  const vehicleTypeNames = [
    ...new Set(parsed.map((p) => p.vehicleTypeName).filter((v): v is string => !!v)),
  ];

  return { ok: true, companyNameGuess, rows: parsed, driverNames, vehicleTypeNames };
}
