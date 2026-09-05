"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { companySchema } from "@/lib/validation/company";

export type ActionResult = { error: string | null };

export async function createCompany(input: unknown): Promise<ActionResult> {
  const parsed = companySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("companies").insert({
    name: parsed.data.name,
    phone: parsed.data.phone || null,
    address: parsed.data.address || null,
    contact_person: parsed.data.contact_person || null,
    status: parsed.data.status,
    notes: parsed.data.notes || null,
  });

  if (error) return { error: "حدث خطأ أثناء إضافة الشركة" };

  revalidatePath("/companies");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function updateCompany(id: string, input: unknown): Promise<ActionResult> {
  const parsed = companySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("companies")
    .update({
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      contact_person: parsed.data.contact_person || null,
      status: parsed.data.status,
      notes: parsed.data.notes || null,
    })
    .eq("id", id);

  if (error) return { error: "حدث خطأ أثناء تعديل بيانات الشركة" };

  revalidatePath("/companies");
  revalidatePath(`/companies/${id}`);
  revalidatePath("/dashboard");
  return { error: null };
}

export async function deleteCompany(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("companies").delete().eq("id", id);

  if (error) {
    if (error.code === "23503") {
      return {
        error: "لا يمكن حذف هذه الشركة لوجود رحلات مسجَّلة لها. يمكنك تغيير حالتها إلى (غير نشط) بدلاً من الحذف.",
      };
    }
    return { error: "حدث خطأ أثناء حذف الشركة" };
  }

  revalidatePath("/companies");
  revalidatePath("/dashboard");
  return { error: null };
}
