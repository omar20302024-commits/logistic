"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { vendorSchema } from "@/lib/validation/vendor";
import { normalizeArabic } from "@/lib/arabic";

// الموردون (0043/0044): جهة تجمع عدّة سائقين خارجيين.
//
// 🔒 كشف المورّد الذي يُسلَّم له يأتي من fn_vendor_payable_trips التي لا تُرجع
//    سعر العميل ولا الربح أصلاً — الإخفاء بالمصدر لا بالعرض.

export type ActionResult = { error: string | null };

export async function createVendor(input: unknown): Promise<ActionResult> {
  const parsed = vendorSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("vendors").insert({
    name: parsed.data.name,
    phone: parsed.data.phone || null,
    notes: parsed.data.notes || null,
    status: parsed.data.status,
    opening_balance: parsed.data.opening_balance,
    opening_reason: parsed.data.opening_reason || null,
    opening_date: parsed.data.opening_date || null,
  });

  if (error) return { error: "تعذّر إضافة المورّد" };

  revalidatePath("/vendors");
  return { error: null };
}

export async function updateVendor(id: string, input: unknown): Promise<ActionResult> {
  const parsed = vendorSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const supabase = await createClient();

  // الرصيد الافتتاحي بعد تصفيته جزء من سند مصروف — تعديله يغيّر رقماً مجمَّداً
  const { data: current } = await supabase
    .from("vendors")
    .select("opening_settlement_id")
    .eq("id", id)
    .single();
  const vendorHasSettledOpening = !!current?.opening_settlement_id;

  const { error } = await supabase
    .from("vendors")
    .update({
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      notes: parsed.data.notes || null,
      status: parsed.data.status,
      // الافتتاحي المصفّى لا يُمَس: تعديله يغيّر رقماً مجمَّداً في سند مصروف
      ...(vendorHasSettledOpening ? {} : {
        opening_balance: parsed.data.opening_balance,
        opening_reason: parsed.data.opening_reason || null,
        opening_date: parsed.data.opening_date || null,
      }),
    })
    .eq("id", id);

  if (error) return { error: "تعذّر تعديل المورّد" };

  revalidatePath("/vendors");
  revalidatePath(`/vendors/${id}`);
  return { error: null };
}

export async function deleteVendor(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("vendors").delete().eq("id", id);

  if (error) {
    if (error.code === "23503") {
      return {
        error:
          "لا يمكن حذف هذا المورّد لوجود تصفيات مسجَّلة له. غيّر حالته إلى «غير نشط» بدلاً من الحذف.",
      };
    }
    return { error: "تعذّر حذف المورّد" };
  }

  revalidatePath("/vendors");
  return { error: null };
}

/** ربط سائق بمورّد أو فكّه — الحقل يعني شيئاً للخارجيين وحدهم */
export async function setDriverVendor(
  driverId: string,
  vendorId: string | null
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("drivers")
    .update({ vendor_id: vendorId })
    .eq("id", driverId);

  if (error) return { error: "تعذّر ربط السائق بالمورّد" };

  revalidatePath("/vendors");
  revalidatePath(`/drivers/${driverId}`);
  return { error: null };
}

// ----------------------------------------------------------------------------
// السلف
// ----------------------------------------------------------------------------

export async function createVendorAdvance(
  vendorId: string,
  input: { date: string; amount: number; description?: string }
): Promise<ActionResult> {
  if (!input.date) return { error: "التاريخ مطلوب" };
  if (!Number.isFinite(Number(input.amount)) || Number(input.amount) <= 0) {
    return { error: "المبلغ يجب أن يكون أكبر من صفر" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("vendor_advances").insert({
    vendor_id: vendorId,
    date: input.date,
    amount: Number(input.amount),
    description: input.description?.trim() || null,
  });

  if (error) return { error: "تعذّر تسجيل السلفة" };

  revalidatePath(`/vendors/${vendorId}`);
  return { error: null };
}

export async function deleteVendorAdvance(
  vendorId: string,
  id: string
): Promise<ActionResult> {
  const supabase = await createClient();

  // السلفة المصفّاة جزء من سند مصروف — حذفها يغيّر رقماً مجمّداً
  const { data: row } = await supabase
    .from("vendor_advances")
    .select("settlement_id")
    .eq("id", id)
    .single();

  if (row?.settlement_id) {
    return { error: "هذه السلفة ضمن تصفية مصروفة — لا يمكن حذفها" };
  }

  const { error } = await supabase.from("vendor_advances").delete().eq("id", id);
  if (error) return { error: "تعذّر حذف السلفة" };

  revalidatePath(`/vendors/${vendorId}`);
  return { error: null };
}

// ----------------------------------------------------------------------------
// التصفية
// ----------------------------------------------------------------------------

/**
 * تصفية المورّد — إنشاء السند ووسم رحلاته وسلفه في عملية واحدة.
 * المنطق كله في fn_settle_vendor: لو فُصلت الخطوات لوقعت حالة وسطى.
 */
export async function settleVendor(
  vendorId: string,
  input: { from: string; to: string; settledOn: string; notes?: string }
): Promise<{ error: string | null; settlementId?: string }> {
  if (!input.from || !input.to) return { error: "الفترة مطلوبة" };
  if (input.to < input.from) return { error: "تاريخ النهاية قبل البداية" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_settle_vendor", {
    p_vendor_id: vendorId,
    p_from: input.from,
    p_to: input.to,
    p_settled_on: input.settledOn || new Date().toISOString().slice(0, 10),
    p_notes: input.notes?.trim() || null,
  });

  if (error) {
    // رسالة الدالة عربية ومفهومة، فنمرّرها كما هي
    if (error.message?.includes("لا توجد رحلات")) return { error: error.message };
    return { error: "تعذّر تنفيذ التصفية" };
  }

  revalidatePath(`/vendors/${vendorId}`);
  revalidatePath("/vendors");
  revalidatePath("/trips");
  return { error: null, settlementId: data as string };
}

// ----------------------------------------------------------------------------
// تسعيرة المورّد (0047): سعر خط السير له هو ولكل سائقيه
// ----------------------------------------------------------------------------

export type VendorRouteRate = {
  id: string;
  from_city: string;
  to_city: string;
  trab_amount: number;
};

export async function createVendorRouteRate(
  vendorId: string,
  input: { from_city: string; to_city: string; trab_amount: number }
): Promise<ActionResult> {
  if (!input.from_city.trim()) return { error: "مدينة التحميل مطلوبة" };
  if (!input.to_city.trim()) return { error: "مدينة التنزيل مطلوبة" };
  if (!Number.isFinite(Number(input.trab_amount)) || Number(input.trab_amount) < 0) {
    return { error: "السعر يجب أن يكون رقماً موجباً" };
  }

  const supabase = await createClient();

  // منع التكرار المطبَّع: الفريد في قاعدة البيانات على النص الحرفي، فـ«جده»
  // و«جدة» يمرّان كصفّين ويفوز أحدهما عشوائياً وقت المطابقة
  const { data: existing } = await supabase
    .from("vendor_route_rates")
    .select("id, from_city, to_city")
    .eq("vendor_id", vendorId);

  const from = normalizeArabic(input.from_city);
  const to = normalizeArabic(input.to_city);
  const clash = (existing ?? []).find(
    (r) =>
      normalizeArabic(r.from_city as string) === from &&
      normalizeArabic(r.to_city as string) === to
  );
  if (clash) {
    return {
      error: `يوجد خط سير بنفس المدينتين بإملاء مختلف: «${clash.from_city} ← ${clash.to_city}»`,
    };
  }

  const { error } = await supabase.from("vendor_route_rates").insert({
    vendor_id: vendorId,
    from_city: input.from_city.trim(),
    to_city: input.to_city.trim(),
    trab_amount: Number(input.trab_amount),
  });

  if (error) return { error: "تعذّر إضافة خط السير" };

  revalidatePath(`/vendors/${vendorId}`);
  return { error: null };
}

export async function deleteVendorRouteRate(
  vendorId: string,
  id: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("vendor_route_rates").delete().eq("id", id);
  if (error) return { error: "تعذّر حذف خط السير" };

  revalidatePath(`/vendors/${vendorId}`);
  return { error: null };
}
