"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// إيرادات العملاء الشهرية (0060) — الرقم النهائي المفوتَر لكل عميل في الشهر.
//
// 🔑 لا علاقة لها بمبالغ الرحلات: الرحلة سجلّ تشغيلي والفاتورة سجلّ مالي،
//    والفرق بينهما يُعرض في تقرير المطابقة لا يُخفى بتعديل الرحلات.

export type ActionResult = { error: string | null };

export type CompanyRevenue = {
  id: string;
  company_id: string;
  year: number;
  month: number;
  amount: number;
  notes: string | null;
};

function validate(year: number, month: number, amount: number): string | null {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return "سنة غير صحيحة";
  if (!Number.isInteger(month) || month < 1 || month > 12) return "شهر غير صحيح";
  if (!Number.isFinite(amount) || amount < 0) return "المبلغ يجب ألا يكون سالباً";
  return null;
}

/** يُنشئ أو يُحدِّث — القيد الفريد (عميل، سنة، شهر) يجعل التكرار خطأً لا حالة */
export async function saveCompanyRevenue(input: {
  companyId: string;
  year: number;
  month: number;
  amount: number;
  notes?: string;
}): Promise<ActionResult> {
  if (!input.companyId) return { error: "اختر العميل" };

  const bad = validate(input.year, input.month, Number(input.amount));
  if (bad) return { error: bad };

  const supabase = await createClient();
  const { error } = await supabase.from("company_monthly_revenues").upsert(
    {
      company_id: input.companyId,
      year: input.year,
      month: input.month,
      amount: Number(input.amount),
      notes: input.notes?.trim() || null,
    },
    { onConflict: "company_id,year,month" }
  );

  if (error) {
    if (error.code === "42P01") {
      return { error: "شغّل ملف SQL رقم 0060 (إيرادات العملاء) ثم أعد المحاولة" };
    }
    return { error: "تعذّر حفظ الإيراد" };
  }

  revalidateAll();
  return { error: null };
}

export async function deleteCompanyRevenue(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("company_monthly_revenues").delete().eq("id", id);

  if (error) return { error: "تعذّر حذف الإيراد" };

  revalidateAll();
  return { error: null };
}

function revalidateAll() {
  revalidatePath("/revenues");
  revalidatePath("/reports/income-statement");
}
