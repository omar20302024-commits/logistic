import { z } from "zod";

export const settlementSchema = z
  .object({
    from_date: z.string().min(1, "تاريخ بداية الفترة مطلوب"),
    to_date: z.string().min(1, "تاريخ نهاية الفترة مطلوب"),
    settled_on: z.string().min(1, "تاريخ التصفية مطلوب"),
    advance_ids: z.array(z.string().uuid()).default([]),
    deduction_ids: z.array(z.string().uuid()).default([]),
    notes: z.string().trim().optional().or(z.literal("")),
  })
  .refine((v) => v.to_date >= v.from_date, {
    path: ["to_date"],
    message: "تاريخ النهاية لا يمكن أن يسبق تاريخ البداية",
  });

export type SettlementInput = z.input<typeof settlementSchema>;
export type SettlementValues = z.output<typeof settlementSchema>;

export type SettlementPreview = {
  trips_count: number;
  total_trabs: number;
  custody_credits: number;
  custody_debits: number;
  driver_expenses: number;
  total_advances: number;
  total_deductions: number;
  net_amount: number;
};

export type SettlementRecord = {
  id: string;
  settlement_number: string;
  driver_id: string;
  from_date: string;
  to_date: string;
  settled_on: string;
  trips_count: number;
  total_trabs: number;
  custody_credits: number;
  custody_debits: number;
  driver_expenses: number;
  total_advances: number;
  total_deductions: number;
  net_amount: number;
  notes: string | null;
};

export type LedgerCandidate = {
  id: string;
  date: string;
  amount: number;
  description: string | null;
};
