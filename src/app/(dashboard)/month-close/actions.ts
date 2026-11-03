"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// إقفال الشهر (0057): تصفية تربات وعهدة، وتسجيل الراتب مدفوعاً، لمجموعة
// سائقين دفعة واحدة.
//
// المنطق كله في قاعدة البيانات: الإقفال يستدعي fn_create_driver_settlement
// نفسها التي يستدعيها الزرّ الفردي، فلا يوجد مسار تصفية ثانٍ يفترق عنه.

export type MonthClosePreviewRow = {
  driver_id: string;
  driver_name: string;
  employment_type: "internal" | "external";
  trips_count: number;
  total_trabs: number;
  custody_balance: number;
  open_advances: number;
  open_deductions: number;
  trab_net: number;
  salary_net: number;
  salary_paid: number;
  has_salary_row: boolean;
};

export type MonthCloseResultRow = {
  driver_id: string;
  driver_name: string;
  settlement_id: string | null;
  trab_amount: number;
  salary_amount: number;
  trab_note: string | null;
  salary_note: string | null;
};

const MISSING = "شغّل ملف SQL رقم 0057 (إقفال الشهر) ثم أعد المحاولة";

export async function getMonthClosePreview(
  driverIds: string[],
  from: string,
  to: string
): Promise<{ rows: MonthClosePreviewRow[]; error: string | null }> {
  if (driverIds.length === 0) return { rows: [], error: null };
  if (!from || !to) return { rows: [], error: "الفترة مطلوبة" };
  if (to < from) return { rows: [], error: "تاريخ النهاية قبل البداية" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_month_close_preview", {
    p_driver_ids: driverIds,
    p_from: from,
    p_to: to,
  });

  if (error) {
    return { rows: [], error: error.code === "PGRST202" ? MISSING : "تعذّر حساب المعاينة" };
  }

  return { rows: (data ?? []) as MonthClosePreviewRow[], error: null };
}

export async function applyMonthClose(
  driverIds: string[],
  input: {
    from: string;
    to: string;
    settledOn: string;
    settleTrabs: boolean;
    paySalary: boolean;
    notes?: string;
  }
): Promise<{ rows: MonthCloseResultRow[]; error: string | null }> {
  if (driverIds.length === 0) return { rows: [], error: "لم تحدّد أي سائق" };
  if (!input.from || !input.to) return { rows: [], error: "الفترة مطلوبة" };
  if (input.to < input.from) return { rows: [], error: "تاريخ النهاية قبل البداية" };
  if (!input.settleTrabs && !input.paySalary) {
    return { rows: [], error: "اختر التربات أو الراتب — أو كليهما" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_month_close_apply", {
    p_driver_ids: driverIds,
    p_from: input.from,
    p_to: input.to,
    p_settled_on: input.settledOn || new Date().toISOString().slice(0, 10),
    p_settle_trabs: input.settleTrabs,
    p_pay_salary: input.paySalary,
    p_notes: input.notes?.trim() || null,
  });

  if (error) {
    if (error.code === "PGRST202") return { rows: [], error: MISSING };
    // رسائل الدالة عربية ومفهومة
    return { rows: [], error: error.message || "تعذّر تنفيذ الإقفال" };
  }

  revalidatePath("/drivers");
  revalidatePath("/salaries");
  revalidatePath("/trips");
  revalidatePath("/dashboard");
  revalidatePath("/month-close");

  return { rows: (data ?? []) as MonthCloseResultRow[], error: null };
}
