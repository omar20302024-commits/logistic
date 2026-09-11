import { z } from "zod";

export const leaveSchema = z
  .object({
    from_date: z.string().min(1, "تاريخ بداية الإجازة مطلوب"),
    // فاضي = إجازة مفتوحة، لسه ما اتحددش تاريخ الرجوع
    to_date: z.string().trim().optional().or(z.literal("")),
    notes: z.string().trim().optional().or(z.literal("")),
  })
  .refine((v) => !v.to_date || v.to_date >= v.from_date, {
    path: ["to_date"],
    message: "تاريخ الرجوع لا يمكن أن يسبق تاريخ بداية الإجازة",
  });

export type LeaveInput = z.input<typeof leaveSchema>;
export type LeaveValues = z.output<typeof leaveSchema>;

export type LeaveRecord = {
  id: string;
  from_date: string;
  to_date: string | null;
  notes: string | null;
};

/** عدد أيام التقويم بين تاريخين شاملاً الطرفين — للعرض في الواجهة فقط */
export function leaveDayCount(from: string, to: string | null): number | null {
  if (!to) return null;
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Math.floor(ms / 86_400_000) + 1;
}
