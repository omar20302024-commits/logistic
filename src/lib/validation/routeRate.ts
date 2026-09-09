import { z } from "zod";

export const routeRateSchema = z.object({
  from_city: z.string().trim().min(1, "مدينة التحميل مطلوبة"),
  to_city: z.string().trim().min(1, "مدينة التنزيل مطلوبة"),
  trab_amount: z.coerce.number().min(0, "الترب يجب أن يكون رقماً موجباً"),
  notes: z.string().trim().optional().or(z.literal("")),
});

export type RouteRateInput = z.input<typeof routeRateSchema>;
export type RouteRateValues = z.output<typeof routeRateSchema>;
