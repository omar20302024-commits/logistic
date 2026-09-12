import { z } from "zod";

export const branchSchema = z.object({
  branch_code: z.string().trim().min(1, "كود الفرع مطلوب"),
  branch_name: z.string().trim().optional().or(z.literal("")),
  city: z.string().trim().optional().or(z.literal("")),
  address: z.string().trim().optional().or(z.literal("")),
  contact: z.string().trim().optional().or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
  is_active: z.boolean(),
  notes: z.string().trim().optional().or(z.literal("")),
});

export type BranchFormInput = z.input<typeof branchSchema>;
export type BranchFormValues = z.output<typeof branchSchema>;

export type BranchRecord = {
  id: string;
  company_id: string;
  branch_code: string;
  branch_name: string | null;
  city: string | null;
  address: string | null;
  contact: string | null;
  phone: string | null;
  is_active: boolean;
  notes: string | null;
};
