import { z } from "zod";

export const salarySchema = z.object({
  driver_id: z.string().min(1, "اختر السائق"),
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2000).max(2100),
  basic_salary: z.coerce.number().min(0, "الراتب يجب أن يكون رقماً موجباً"),
  paid_amount: z.coerce.number().min(0, "المبلغ المدفوع يجب أن يكون رقماً موجباً"),
  payment_date: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
});

export type SalaryFormInput = z.input<typeof salarySchema>;
export type SalaryFormValues = z.output<typeof salarySchema>;

export const monthLabels = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];
