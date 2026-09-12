import { z } from "zod";

export const monthlyDieselSchema = z.object({
  driver_id: z.string().min(1, "اختر السائق"),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  amount: z.coerce.number().min(0, "المبلغ يجب أن يكون رقماً موجباً"),
  notes: z.string().trim().optional().or(z.literal("")),
});

export type MonthlyDieselInput = z.input<typeof monthlyDieselSchema>;
export type MonthlyDieselValues = z.output<typeof monthlyDieselSchema>;

export type MonthlyDieselRecord = {
  id: string;
  driver_id: string;
  driver_name?: string;
  year: number;
  month: number;
  amount: number;
  notes: string | null;
};

/** سائق سُجِّل له ديزل شهري وله كذلك ديزل على رحلاته في نفس الشهر */
export type DieselOverlap = {
  driver_id: string;
  driver_name: string;
  trips_diesel: number;
  monthly_diesel: number;
};
