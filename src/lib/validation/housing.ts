import { z } from "zod";

export const housingUnitSchema = z.object({
  name: z.string().trim().min(1, "اسم وحدة السكن مطلوب"),
  city: z.string().trim().optional().or(z.literal("")),
  monthly_rent: z.coerce.number().min(0, "الإيجار يجب أن يكون رقماً موجباً"),
  notes: z.string().trim().optional().or(z.literal("")),
});

export type HousingUnitInput = z.input<typeof housingUnitSchema>;
export type HousingUnitValues = z.output<typeof housingUnitSchema>;
