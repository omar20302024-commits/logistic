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
