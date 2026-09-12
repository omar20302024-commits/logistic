import { z } from "zod";

export const companySchema = z.object({
  name: z.string().trim().min(2, "اسم الشركة مطلوب (حرفان على الأقل)"),
  phone: z.string().trim().optional().or(z.literal("")),
  address: z.string().trim().optional().or(z.literal("")),
  contact_person: z.string().trim().optional().or(z.literal("")),
  // سعر الموقع الإضافي لهذا العميل — منفصل تماماً عن معدَّل السائق (قاعدة #10)
  extra_location_rate: z.coerce.number().min(0, "السعر يجب أن يكون رقماً موجباً"),
  status: z.enum(["active", "inactive"]),
  notes: z.string().trim().optional().or(z.literal("")),
});

export type CompanyFormInput = z.input<typeof companySchema>;
export type CompanyFormValues = z.output<typeof companySchema>;
