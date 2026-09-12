"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { branchSchema } from "@/lib/validation/branch";

export type ActionResult = { error: string | null };

function toRow(data: {
  branch_code: string;
  branch_name?: string;
  city?: string;
  address?: string;
  contact?: string;
  phone?: string;
  is_active: boolean;
  notes?: string;
}) {
  return {
    branch_code: data.branch_code,
    branch_name: data.branch_name || null,
    city: data.city || null,
    address: data.address || null,
    contact: data.contact || null,
    phone: data.phone || null,
    is_active: data.is_active,
    notes: data.notes || null,
  };
}

export async function createBranch(companyId: string, input: unknown): Promise<ActionResult> {
  const parsed = branchSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("company_branches")
    .insert({ company_id: companyId, ...toRow(parsed.data) });

  if (error?.code === "23505") {
    return { error: "هذا الكود مستخدم بالفعل لدى هذه الشركة" };
  }
  if (error) return { error: "حدث خطأ أثناء إضافة الفرع" };

  revalidatePath(`/companies/${companyId}`);
  revalidatePath("/trips/new");
  return { error: null };
}

export async function updateBranch(
  companyId: string,
  id: string,
  input: unknown
): Promise<ActionResult> {
  const parsed = branchSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("company_branches")
    .update(toRow(parsed.data))
    .eq("id", id);

  if (error?.code === "23505") {
    return { error: "هذا الكود مستخدم بالفعل لدى هذه الشركة" };
  }
  if (error) return { error: "حدث خطأ أثناء تعديل الفرع" };

  revalidatePath(`/companies/${companyId}`);
  revalidatePath("/trips/new");
  return { error: null };
}

export async function deleteBranch(companyId: string, id: string): Promise<ActionResult> {
  const supabase = await createClient();
  // مواقع الرحلات المرتبطة تفقد الربط (on delete set null) لكنها تحتفظ بالكود
  // النصي — الرحلة تبقى شاهدة على ما نُفِّذ فعلاً حتى لو حُذف الفرع من السجل
  const { error } = await supabase.from("company_branches").delete().eq("id", id);

  if (error) return { error: "حدث خطأ أثناء حذف الفرع" };

  revalidatePath(`/companies/${companyId}`);
  revalidatePath("/trips/new");
  return { error: null };
}
