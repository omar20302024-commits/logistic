"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// إجراءات رابط كشف السائق العام.
// كلها تعمل داخل لوحة التحكم فقط — RLS على drivers تسمح للـ admin وحده،
// فلا حاجة لفحص صلاحية هنا: قاعدة البيانات ترفض أي محاولة من غير المسؤول.

export type ActionResult = { error: string | null };

/** تفعيل الرابط أو إيقافه. الإيقاف قابل للعكس بنفس الرمز. */
export async function setPublicLinkEnabled(
  driverId: string,
  enabled: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("drivers")
    .update({ public_link_enabled: enabled })
    .eq("id", driverId);

  if (error) return { error: "تعذّر تغيير حالة الرابط" };

  revalidatePath(`/drivers/${driverId}`);
  return { error: null };
}

/**
 * تفعيل أو إيقاف روابط مجموعة سائقين دفعة واحدة.
 *
 * الحاجة: أول الشهر يريد المسؤول ضبط كل سائقي الشركة معاً، وفتح صفحة كل
 * سائق على حدة ليضغط زرّين عملٌ لا ينتهي.
 */
export async function setPublicLinkEnabledBulk(
  driverIds: string[],
  enabled: boolean
): Promise<ActionResult & { updated?: number }> {
  const ids = driverIds.filter(Boolean);
  if (ids.length === 0) return { error: "لم تحدّد أي سائق" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("drivers")
    .update({ public_link_enabled: enabled })
    .in("id", ids);

  if (error) return { error: "تعذّر تغيير حالة الروابط" };

  revalidatePath("/drivers");
  revalidatePath("/drivers/links");
  for (const id of ids) revalidatePath(`/drivers/${id}`);
  return { error: null, updated: ids.length };
}

/**
 * الشهر المعروض لمجموعة سائقين دفعة واحدة.
 * null = الشهر الحالي تلقائياً (يتدحرّج وحده).
 */
export async function setStatementMonthBulk(
  driverIds: string[],
  year: number | null,
  month: number | null
): Promise<ActionResult & { updated?: number }> {
  const ids = driverIds.filter(Boolean);
  if (ids.length === 0) return { error: "لم تحدّد أي سائق" };

  // الاثنان معاً أو لا شيء: سنة بلا شهر تترك الرابط في حالة نصفية
  const pinned = year !== null && month !== null;
  if ((year === null) !== (month === null)) {
    return { error: "حدّد الشهر والسنة معاً، أو اختر التلقائي" };
  }
  if (pinned) {
    if (!Number.isInteger(year) || year! < 2000 || year! > 2100) {
      return { error: "سنة غير صحيحة" };
    }
    if (!Number.isInteger(month) || month! < 1 || month! > 12) {
      return { error: "شهر غير صحيح" };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("drivers")
    .update({ statement_year: year, statement_month: month })
    .in("id", ids);

  if (error) return { error: "تعذّر تغيير الشهر" };

  revalidatePath("/drivers");
  revalidatePath("/drivers/links");
  for (const id of ids) revalidatePath(`/drivers/${id}`);
  return { error: null, updated: ids.length };
}

/**
 * توليد رمز جديد — يبطل كل نسخة قديمة من الرابط نهائياً.
 * هذا هو العلاج الوحيد للتسريب؛ الإيقاف وحده لا يكفي لأن إعادة التفعيل
 * تُشغّل نفس الرمز القديم من جديد.
 */
export async function regeneratePublicToken(driverId: string): Promise<ActionResult> {
  const supabase = await createClient();

  // التوليد في قاعدة البيانات لا في جافاسكربت — gen_random_bytes مصدر عشوائية
  // معتمد تشفيرياً، وMath.random ليس كذلك إطلاقاً.
  const { data: token, error: genError } = await supabase.rpc("fn_generate_public_token");
  if (genError || !token) return { error: "تعذّر توليد رمز جديد" };

  const { error } = await supabase
    .from("drivers")
    .update({ public_token: token })
    .eq("id", driverId);

  if (error) return { error: "تعذّر تجديد الرابط" };

  revalidatePath(`/drivers/${driverId}`);
  return { error: null };
}

/**
 * الشهر المعروض في الرابط.
 * null = الشهر الحالي تلقائياً (يتدحرّج وحده كل شهر دون تدخّل).
 */
export async function setStatementMonth(
  driverId: string,
  year: number | null,
  month: number | null
): Promise<ActionResult> {
  if (year !== null && month !== null) {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return { error: "سنة غير صحيحة" };
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return { error: "شهر غير صحيح" };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("drivers")
    .update({ statement_year: year, statement_month: month })
    .eq("id", driverId);

  if (error) return { error: "تعذّر تغيير الشهر" };

  revalidatePath(`/drivers/${driverId}`);
  return { error: null };
}
