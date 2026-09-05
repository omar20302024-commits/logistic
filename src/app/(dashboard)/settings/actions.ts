"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { settingsSchema } from "@/lib/validation/settings";

export type ActionResult = { error: string | null };

export async function updateSettings(input: unknown): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update({
      org_name: parsed.data.org_name,
      org_phone: parsed.data.org_phone || null,
      org_address: parsed.data.org_address || null,
      currency_code: parsed.data.currency_code,
      currency_symbol: parsed.data.currency_symbol,
      count_cancelled_trips_in_profit: parsed.data.count_cancelled_trips_in_profit,
    })
    .eq("id", true);

  if (error) return { error: "حدث خطأ أثناء حفظ الإعدادات" };

  revalidatePath("/", "layout");
  return { error: null };
}
