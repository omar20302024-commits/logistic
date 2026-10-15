import { normalizeArabic } from "@/lib/arabic";

/**
 * تحليل تبويب رحلات جوجل شيت المُصدَّر كـ CSV.
 *
 * بنية الشيت كما ترسله الشركة:
 *   الصف 1-5  مقدّمة (اسم الشركة، عنوان الشهر، الفترة)
 *   الصف 6    رؤوس الأعمدة
 *   الصف 7+   البيانات، وبعدها صفوف مُرقّمة فارغة سلفاً
 *
 * ⚠️ لا نعتمد على سطر «الفترة من/إلى» في الصف الرابع: وُجد في الشيت الحقيقي
 *    معنوناً «أكتوبر» بينما الفترة بداخله «أغسطس» — بقية من شهر سابق. نقرأ
 *    تواريخ الصفوف نفسها.
 *
 * ⚠️ ولا نتوقف عند أول صف فارغ: الشيت فيه مئات الصفوف المُرقّمة مسبقاً بلا
 *    بيانات. نتخطّى كل صف بلا تاريخ ولا سائق.
 */

export type SheetTripRow = {
  /** الرقم التسلسلي في العمود # — جزء من مفتاح المصدر */
  serial: string;
  clientName: string;
  date: string; // ISO أو "" لو تعذّرت القراءة
  fromLocation: string;
  toLocation: string;
  driverName: string;
  plateNo: string;
  vehicleTypeName: string;
  baseFare: number;
  branchesCount: number;
  extraFee: number;
  returnFee: number;
  totalPrice: number;
  statusRaw: string;
  statusMapped: "new" | "in_progress" | "completed" | "cancelled";
  requester: string;
  notes: string;
  /** الملاحظات تذكر «سائق خارجي» — إشارة لا قرار */
  looksExternal: boolean;
  needsReview: boolean;
  reviewReason: string;
};

export type SheetParseResult =
  | { ok: true; rows: SheetTripRow[] }
  | { ok: false; error: string };

/**
 * محلّل CSV يحترم الاقتباس: الشيت فيه خلايا مثل
 *   "مستودع الصيانة ""الأصول"""
 * والتقسيم الساذج بالفاصلة يكسرها ويزيح كل الأعمدة بعدها.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];

    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/** "2,200.00 ريال" ← 2200 · "" ← 0 */
function parseMoney(raw: string): number {
  const cleaned = String(raw ?? "")
    .replace(/[^\d.,-]/g, "")
    .replace(/,/g, "");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseCount(raw: string): number {
  const n = Number.parseInt(String(raw ?? "").replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * التاريخ في الشيت يوم/شهر/سنة — 14/10/2026 هو الرابع عشر من أكتوبر لا العاشر
 * من الرابع عشر. نفس قاعدة محلّل Excel.
 */
function parseDate(raw: string): string {
  const t = String(raw ?? "").trim();
  if (!t) return "";

  const m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!m) return "";

  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = Number(m[3]);
  if (year < 100) year += 2000;

  if (day < 1 || day > 31 || month < 1 || month > 12) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * حالات الشيت أربع، وحالات النظام أربع — لكنها ليست نفسها.
 * «تم التنزيل» وحدها اكتمال؛ وما عداها الرحلة ما زالت جارية.
 */
function mapStatus(raw: string): SheetTripRow["statusMapped"] {
  const t = normalizeArabic(raw);
  if (!t) return "in_progress";
  if (t.startsWith(normalizeArabic("ملغ"))) return "cancelled";
  if (t === normalizeArabic("تم التنزيل")) return "completed";
  return "in_progress";
}

// رؤوس الصف السادس كما ترسلها الشركة، ولكلٍّ مرادفات لأن الصياغة تتغيّر
const HEADERS = {
  serial: ["#", "م", "رقم"],
  client: ["اسم العميل", "العميل"],
  date: ["التاريخ"],
  from: ["نقطة التحميل", "التحميل", "من"],
  to: ["نقطة التنزيل", "التنزيل", "إلى"],
  driver: ["اسم السائق", "السائق"],
  plate: ["اللوحة", "رقم السيارة", "رقم اللوحة"],
  vehicleType: ["نوع السيارة", "النوع"],
  baseFare: ["الأجرة الأساسية", "الاجرة الاساسية"],
  branches: ["عدد الفروع المخدومة", "عدد الفروع", "الفروع", "المواقع"],
  extra: ["أجرة المواقع", "أجرة المواقع الاضافية", "أجرة الموقع الإضافي", "موقع إضافي"],
  returnFee: ["أجرة المرتجع", "اجرة المرتجع", "المرتجع"],
  total: ["سعر الرحلة الكاملة", "إجمالي سعر الرحلة", "سعر الرحلة", "الإجمالي"],
  status: ["الحالة"],
  requester: ["صاحب الطلب"],
  notes: ["ملاحظات", "ملاحظة"],
} as const;

export function parseSheetCsv(csv: string): SheetParseResult {
  const rows = parseCsv(csv);
  if (rows.length === 0) return { ok: false, error: "الشيت فارغ أو تعذّرت قراءته" };

  // نبحث عن صف الرؤوس بدل افتراض رقمه — الشركة قد تضيف سطراً في المقدّمة
  const headerIndex = rows.findIndex((r) =>
    r.some((c) => normalizeArabic(c) === normalizeArabic("اسم السائق")) &&
    r.some((c) => normalizeArabic(c) === normalizeArabic("التاريخ"))
  );

  if (headerIndex === -1) {
    return {
      ok: false,
      error: "لم يُعثر على صف الرؤوس — يجب أن يحتوي على «التاريخ» و«اسم السائق»",
    };
  }

  const headerCells = rows[headerIndex].map((c) => normalizeArabic(c));
  const findCol = (names: readonly string[]) =>
    headerCells.findIndex((cell) => names.some((n) => cell === normalizeArabic(n)));

  const col = {
    serial: findCol(HEADERS.serial),
    client: findCol(HEADERS.client),
    date: findCol(HEADERS.date),
    from: findCol(HEADERS.from),
    to: findCol(HEADERS.to),
    driver: findCol(HEADERS.driver),
    plate: findCol(HEADERS.plate),
    vehicleType: findCol(HEADERS.vehicleType),
    baseFare: findCol(HEADERS.baseFare),
    branches: findCol(HEADERS.branches),
    extra: findCol(HEADERS.extra),
    returnFee: findCol(HEADERS.returnFee),
    total: findCol(HEADERS.total),
    status: findCol(HEADERS.status),
    requester: findCol(HEADERS.requester),
    notes: findCol(HEADERS.notes),
  };

  const required: (keyof typeof col)[] = ["date", "from", "to", "driver", "client"];
  const missing = required.filter((k) => col[k] === -1);
  if (missing.length > 0) {
    return {
      ok: false,
      error: `أعمدة مفقودة في صف الرؤوس: ${missing.join("، ")}`,
    };
  }

  const cell = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");

  const parsed: SheetTripRow[] = [];

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const r = rows[i];
    const dateRaw = cell(r, col.date);
    const driverName = cell(r, col.driver);

    // صفوف مُرقّمة سلفاً بلا بيانات — نتخطّاها بلا ضجيج
    if (!dateRaw && !driverName) continue;

    const date = parseDate(dateRaw);
    const reasons: string[] = [];
    if (!date) reasons.push("تاريخ غير مقروء");
    if (!driverName) reasons.push("اسم السائق فارغ");
    if (!cell(r, col.client)) reasons.push("اسم العميل فارغ");

    const notes = cell(r, col.notes);
    const statusRaw = cell(r, col.status);

    parsed.push({
      serial: cell(r, col.serial) || String(i + 1),
      clientName: cell(r, col.client),
      date,
      fromLocation: cell(r, col.from),
      toLocation: cell(r, col.to),
      driverName,
      plateNo: cell(r, col.plate),
      vehicleTypeName: cell(r, col.vehicleType),
      baseFare: parseMoney(cell(r, col.baseFare)),
      branchesCount: parseCount(cell(r, col.branches)),
      extraFee: parseMoney(cell(r, col.extra)),
      returnFee: parseMoney(cell(r, col.returnFee)),
      totalPrice: parseMoney(cell(r, col.total)),
      statusRaw,
      statusMapped: mapStatus(statusRaw),
      requester: cell(r, col.requester),
      notes,
      looksExternal: normalizeArabic(notes).includes(normalizeArabic("خارجي")),
      needsReview: reasons.length > 0,
      reviewReason: reasons.join("، "),
    });
  }

  if (parsed.length === 0) {
    return { ok: false, error: "لم يُعثر على أي صف بيانات بعد صف الرؤوس" };
  }

  return { ok: true, rows: parsed };
}

/** معرّف الشيت و gid من رابط جوجل، أو null لو الرابط غير صالح */
export function parseSheetUrl(url: string): { id: string; gid: string } | null {
  const idMatch = String(url ?? "").match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!idMatch) return null;
  const gidMatch = String(url ?? "").match(/[#&?]gid=(\d+)/);
  return { id: idMatch[1], gid: gidMatch ? gidMatch[1] : "0" };
}

/** رابط التصدير CSV للتبويب المطلوب */
export function sheetCsvUrl(id: string, gid: string): string {
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}
