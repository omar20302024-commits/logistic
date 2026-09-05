import { z } from "zod";

export const custodyEntrySchema = z.object({
  date: z.string().min(1, "التاريخ مطلوب"),
  type: z.enum(["credit", "debit"]),
  amount: z.coerce.number().positive("المبلغ يجب أن يكون أكبر من صفر"),
  description: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
});

export type CustodyEntryInput = z.input<typeof custodyEntrySchema>;
export type CustodyEntryValues = z.output<typeof custodyEntrySchema>;
