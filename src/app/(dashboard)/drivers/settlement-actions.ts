"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  settlementSchema,
  type LedgerCandidate,
  type SettlementPreview,
} from "@/lib/validation/settlement";

export type ActionResult = { error: string | null };

function revalidateSettlement(driverId: string) {
  revalidatePath(`/drivers/${driverId}`);
  revalidatePath("/trips");
  revalidatePath("/statement");
  revalidatePath("/statement/public");
  revalidatePath("/statement/trab");
  revalidatePath("/statement/trab-only");
  revalidatePath("/salaries");
}

/**
 * السلف والخصومات المرشَّحة للتحميل على التربات في هذه الفترة.
 *
 * الشرط `settlement_id is null` هو الحارس ضد الخصم المزدوج: أي عنصر دخل سنداً
 * قبل كده ما بيظهرش هنا تاني. اللي مش بيتختار بيفضل محمّلاً على الراتب.
 */
export async function getSettlementCandidates(
  driverId: string,
  from: string,
  to: string
): Promise<{
  advances: LedgerCandidate[];
  deductions: LedgerCandidate[];
  error: string | null;
}> {
  const supabase = await createClient();

  const [{ data: advances, error: advError }, { data: deductions, error: dedError }] =
    await Promise.all([
      supabase
        .from("driver_advances")
        .select("id, date, amount, description")
        .eq("driver_id", driverId)
        .is("settlement_id", null)
        .gte("date", from)
        .lte("date", to)
        .order("date"),
      supabase
        .from("driver_deductions")
        .select("id, date, amount, description")
        .eq("driver_id", driverId)
        .is("settlement_id", null)
        .gte("date", from)
        .lte("date", to)
        .order("date"),
    ]);

  if (advError || dedError) {
    return { advances: [], deductions: [], error: "تعذّر تحميل السلف والخصومات" };
  }

  return { advances: advances ?? [], deductions: deductions ?? [], error: null };
}

/** المعاينة تُحسب في قاعدة البيانات بنفس شروط التنفيذ بالحرف — لا حساب في الواجهة */
export async function getSettlementPreview(
  driverId: string,
  from: string,
  to: string,
  advanceIds: string[],
  deductionIds: string[]
): Promise<{ preview: SettlementPreview | null; error: string | null }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc("fn_driver_settlement_preview", {
      p_driver_id: driverId,
      p_from: from,
      p_to: to,
      p_advance_ids: advanceIds,
      p_deduction_ids: deductionIds,
    })
    .single();

  if (error) {
    return { preview: null, error: "تعذّر حساب المعاينة — تأكد من تشغيل ملف SQL رقم 0013" };
  }

  return { preview: data as SettlementPreview, error: null };
}

export async function createSettlement(
  driverId: string,
  input: unknown
): Promise<ActionResult & { settlementId?: string }> {
  const parsed = settlementSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_create_driver_settlement", {
    p_driver_id: driverId,
    p_from: parsed.data.from_date,
    p_to: parsed.data.to_date,
    p_settled_on: parsed.data.settled_on,
    p_advance_ids: parsed.data.advance_ids,
    p_deduction_ids: parsed.data.deduction_ids,
    p_notes: parsed.data.notes || null,
  });

  // رسالة قاعدة البيانات هنا مفيدة للمستخدم (مثلاً: لا يوجد ما يُصفّى)، فنعرضها
  if (error) return { error: error.message || "حدث خطأ أثناء إنشاء التصفية" };

  revalidateSettlement(driverId);
  return { error: null, settlementId: data as string };
}

export async function deleteSettlement(
  driverId: string,
  settlementId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_delete_driver_settlement", {
    p_settlement_id: settlementId,
  });

  if (error) return { error: "حدث خطأ أثناء إلغاء التصفية" };

  revalidateSettlement(driverId);
  return { error: null };
}
