import { z } from "zod";

export const expenseSchema = z.object({
  date: z.string().min(1, "التاريخ مطلوب"),
  category: z.string().trim().min(1, "التصنيف مطلوب"),
  description: z.string().trim().optional().or(z.literal("")),
  amount: z.coerce.number().min(0, "المبلغ يجب أن يكون رقماً موجباً"),
  notes: z.string().trim().optional().or(z.literal("")),
});

export type ExpenseFormInput = z.input<typeof expenseSchema>;
export type ExpenseFormValues = z.output<typeof expenseSchema>;
