import { z } from "zod";

export const ledgerEntrySchema = z.object({
  date: z.string().min(1, "التاريخ مطلوب"),
  amount: z.coerce.number().positive("المبلغ يجب أن يكون أكبر من صفر"),
  description: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
});

export type LedgerEntryInput = z.input<typeof ledgerEntrySchema>;
export type LedgerEntryValues = z.output<typeof ledgerEntrySchema>;
