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
