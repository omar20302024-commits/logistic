import { z } from "zod";

export const settingsSchema = z.object({
  org_name: z.string().trim().min(1, "اسم المؤسسة مطلوب"),
  org_phone: z.string().trim().optional().or(z.literal("")),
  org_address: z.string().trim().optional().or(z.literal("")),
  currency_code: z.string().trim().min(1),
  currency_symbol: z.string().trim().min(1),
  count_cancelled_trips_in_profit: z.boolean(),
});

export type SettingsFormValues = z.infer<typeof settingsSchema>;
