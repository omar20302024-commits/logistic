import { z } from "zod";

export const rentalContractSchema = z.object({
  driver_id: z.string().min(1, "اختر السائق"),
  company_id: z.string().min(1, "اختر الشركة"),
  city: z.string().trim().optional().or(z.literal("")),
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2000).max(2100),
  monthly_amount: z.coerce.number().min(0, "المبلغ يجب أن يكون رقماً موجباً"),
  housing_unit_id: z.string().trim().optional().or(z.literal("")),
  diesel_amount: z.coerce.number().min(0, "الديزل يجب أن يكون رقماً موجباً"),
  notes: z.string().trim().optional().or(z.literal("")),
});

export type RentalContractInput = z.input<typeof rentalContractSchema>;
export type RentalContractValues = z.output<typeof rentalContractSchema>;
