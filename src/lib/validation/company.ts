import { z } from "zod";

export const companySchema = z.object({
  name: z.string().trim().min(2, "اسم الشركة مطلوب (حرفان على الأقل)"),
  phone: z.string().trim().optional().or(z.literal("")),
  address: z.string().trim().optional().or(z.literal("")),
  contact_person: z.string().trim().optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]),
  notes: z.string().trim().optional().or(z.literal("")),
});

export type CompanyFormValues = z.output<typeof companySchema>;
