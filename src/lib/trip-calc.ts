import { normalizeArabic } from "./arabic";

/**
 * حساب الفروع المحاسَب عليها — نسخة الواجهة من fn_chargeable_stops في SQL.
 *
 * لازم تطابق دالة SQL بالحرف: الواجهة بتقترح أجرة الموقع الإضافي للعميل،
 * وقاعدة البيانات بتحسب ترب المواقع الإضافية للسائق. لو افترقتا يظهر للمستخدم
 * رقم مقترح لا يوافق ما يُحفظ فعلاً.
 *
 * القاعدة: أول فرع في كل مدينة تنزيل لا يُحتسب لأنه ضمن الأجرة الأساسية.
 *   السلي → الطائف             · 11 فرعاً → 10 محاسَب عليها
 *   الرياض → الطائف+المدينة+جدة · 13 فرعاً → 10 محاسَب عليها
 */

/** عدد مدن التنزيل داخل نص "إلى" — مفصولة بـ + مع تجاهل المسافات */
export function destinationCount(toLocation: string): number {
  const parts = (toLocation ?? "")
    .split("+")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return Math.max(1, parts.length);
}

/** الفروع المحاسَب عليها = إجمالي الفروع − عدد مدن التنزيل */
export function chargeableStops(branchesCount: number, toLocation: string): number {
  return Math.max(0, (Number(branchesCount) || 0) - destinationCount(toLocation));
}

/** عدد نقاط التحميل داخل نص "من" — مفصولة بـ + مع تجاهل المسافات */
export function loadingCount(fromLocation: string): number {
  const parts = (fromLocation ?? "")
    .split("+")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return Math.max(1, parts.length);
}

/** نقاط التحميل الإضافية = عدد نقاط التحميل − 1 (الأولى ضمن الأجرة الأساسية) */
export function extraLoadingPoints(fromLocation: string): number {
  return Math.max(0, loadingCount(fromLocation) - 1);
}

/**
 * مواقع السائق الإضافية — نسخة الواجهة من fn_driver_extra_stops في SQL.
 *
 * **التنزيل وحده.** مدن التحميل لا تُحسب للسائق ترب موقع إضافي (0036):
 *   التحميل من «الكتشن الجديد + القديم» موقعان، والسائق لا يُحاسَب عليهما،
 *   بينما العميل يُحاسَب على الموقع الزائد كما هو (extraLoadingPoints باقية
 *   لحساب جانب العميل).
 *
 * ⚠️ هذه الدالة والمشغّل sync_driver_trip_payment_on_base_change يحسبان نفس
 *    الرقم — أي تعديل في أحدهما يجب أن يطال الآخر، وإلا عرضت الواجهة رقماً
 *    مخالفاً لما يُحفظ فعلاً.
 */
export function driverExtraStops(
  branchesCount: number,
  _fromLocation: string,
  toLocation: string
): number {
  // fromLocation يبقى في التوقيع ليطابق دالة SQL وإن لم يُستخدم
  return chargeableStops(branchesCount, toLocation);
}

/**
 * ترب الرحلة كاملاً — نسخة الواجهة من المشغّل:
 *
 *   driver_trip_payment = driver_base_payment
 *                       + extra_stop_rate × fn_driver_extra_stops(...)
 *                       + driver_overnight_payment
 */
export function driverTripPayment(opts: {
  basePayment: number;
  extraStopRate: number;
  branchesCount: number;
  fromLocation: string;
  toLocation: string;
  overnightPayment?: number;
}): number {
  const stops = driverExtraStops(opts.branchesCount, opts.fromLocation, opts.toLocation);
  return (
    (Number(opts.basePayment) || 0) +
    (Number(opts.extraStopRate) || 0) * stops +
    (Number(opts.overnightPayment) || 0)
  );
}

/** خط سير محفوظ للسائق */
export type RouteRate = { from_city: string; to_city: string; trab_amount: number };

/**
 * خط السير المطابق لـ "من/إلى" — بالمطابقة بعد التطبيع العربي، فلا تكسرها
 * فروق الهمزة والتاء المربوطة والمسافات.
 */
export function matchRouteRate(
  rates: RouteRate[],
  fromLocation: string,
  toLocation: string
): RouteRate | undefined {
  const from = normalizeArabic(fromLocation ?? "");
  const to = normalizeArabic(toLocation ?? "");
  if (!from || !to) return undefined;
  return rates.find(
    (r) => normalizeArabic(r.from_city) === from && normalizeArabic(r.to_city) === to
  );
}

/**
 * الترب الأساسي للسائق في رحلة — ثلاث درجات بالترتيب (0035):
 *
 *   1) خط سير خاص بهذا السائق   ← الاستثناء لمن اتُّفق معه على غير المعتاد
 *   2) خط سير عام               ← لسائقي الشركة فقط، يرثه الجديد تلقائياً
 *   3) تربه الافتراضي العام     ← آخر احتياط
 *
 * ⚠️ الموردون (external) لا يرثون العام إطلاقاً — تربهم باتفاق خاص. لكن من له
 *    خط سير خاص مسجَّل يبقى يعمل، فأحدهم أدخله عن قصد.
 *
 * نفس الأولوية في نموذج الرحلة والاستيراد — فالاستيراد يعطي ما يعطيه الإدخال اليدوي.
 */
export function resolveBasePayment(
  driverRates: RouteRate[],
  globalRates: RouteRate[],
  defaultTripPayment: number,
  fromLocation: string,
  toLocation: string,
  employmentType: "internal" | "external" = "internal"
): number {
  const own = matchRouteRate(driverRates, fromLocation, toLocation);
  if (own) return Number(own.trab_amount) || 0;

  if (employmentType === "internal") {
    const global = matchRouteRate(globalRates, fromLocation, toLocation);
    if (global) return Number(global.trab_amount) || 0;
  }

  return Number(defaultTripPayment) || 0;
}

/**
 * للسائق خطوط سير محفوظة و"من/إلى" مكتوبتان، ومع ذلك لم يتطابق شيء.
 * بدون تمييز هذه الحالة لا يفرّق المستخدم بين «لا يوجد خط سير لهذه الوجهة»
 * و«يوجد لكن الإملاء مختلف» — وكلاهما يعطي الترب الافتراضي بصمت.
 */
export function routeUnmatched(
  driverRates: RouteRate[],
  globalRates: RouteRate[],
  fromLocation: string,
  toLocation: string
): boolean {
  if (driverRates.length === 0 && globalRates.length === 0) return false;
  if (!normalizeArabic(fromLocation ?? "") || !normalizeArabic(toLocation ?? "")) return false;
  return (
    !matchRouteRate(driverRates, fromLocation, toLocation) &&
    !matchRouteRate(globalRates, fromLocation, toLocation)
  );
}
