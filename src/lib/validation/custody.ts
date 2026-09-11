import { z } from "zod";

/**
 * أسباب حركة العهدة. السبب لازم يكون متسقاً مع نوع الحركة:
 * credit → from_company | collected_for_company
 * debit  → work_expense | returned_to_company
 *
 * الفصل ده مش شكلي: 'work_expense' هو الوحيد اللي بيتخصم من ربح الشركة.
 * من غيره كان 'debit' بيخلط "صرف على عمل" بـ "أرجع فلوس" وهما مختلفان تماماً.
 */
export const CREDIT_REASONS = ["from_company", "collected_for_company"] as const;
export const DEBIT_REASONS = ["work_expense", "returned_to_company"] as const;

export const custodyReasonLabels: Record<string, string> = {
  unspecified: "غير مصنّف",
  from_company: "استلم مبلغاً من الشركة",
  collected_for_company: "حصّل مبلغاً من عميل",
  work_expense: "مصروف عمل دفعه السائق",
  returned_to_company: "أرجع مبلغاً للشركة",
};

export const EXPENSE_CATEGORIES = [
  "ديزل",
  "صيانة",
  "إطارات",
  "مخالفات",
  "رسوم طريق",
  "أخرى",
] as const;

export const custodyEntrySchema = z
  .object({
    date: z.string().min(1, "التاريخ مطلوب"),
    type: z.enum(["credit", "debit"]),
    reason: z.enum([
      "unspecified",
      "from_company",
      "collected_for_company",
      "work_expense",
      "returned_to_company",
    ]),
    expense_category: z.string().trim().optional().or(z.literal("")),
    trip_id: z.string().trim().optional().or(z.literal("")),
    amount: z.coerce.number().positive("المبلغ يجب أن يكون أكبر من صفر"),
    description: z.string().trim().optional().or(z.literal("")),
    notes: z.string().trim().optional().or(z.literal("")),
  })
  .superRefine((v, ctx) => {
    if (v.reason === "unspecified") return;

    const allowed: readonly string[] =
      v.type === "credit" ? CREDIT_REASONS : DEBIT_REASONS;

    if (!allowed.includes(v.reason)) {
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "السبب لا يتوافق مع نوع الحركة المختار",
      });
    }

    // بند المصروف إلزامي لمصروف العمل — بدونه التقرير بيبقى "غير محدد" بلا فائدة
    if (v.reason === "work_expense" && !v.expense_category) {
      ctx.addIssue({
        code: "custom",
        path: ["expense_category"],
        message: "بند المصروف مطلوب",
      });
    }

    // ومحظور في غيره — القيد نفسه مفروض على مستوى قاعدة البيانات
    if (v.reason !== "work_expense" && v.expense_category) {
      ctx.addIssue({
        code: "custom",
        path: ["expense_category"],
        message: "بند المصروف يُستخدم مع مصروف العمل فقط",
      });
    }
  });

export type CustodyEntryInput = z.input<typeof custodyEntrySchema>;
export type CustodyEntryValues = z.output<typeof custodyEntrySchema>;
