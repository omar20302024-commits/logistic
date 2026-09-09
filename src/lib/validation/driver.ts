import { z } from "zod";

export const driverSchema = z.object({
  name: z.string().trim().min(2, "الاسم مطلوب (حرفان على الأقل)"),
  phone: z.string().trim().optional().or(z.literal("")),
  salary: z.coerce.number().min(0, "الراتب يجب أن يكون رقماً موجباً"),
  default_trip_payment: z.coerce.number().min(0, "التربة الافتراضية يجب أن تكون رقماً موجباً"),
  hire_date: z.string().trim().optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]),
  employment_type: z.enum(["internal", "external"]),
  notes: z.string().trim().optional().or(z.literal("")),
});

// النموذج (react-hook-form) يتعامل مع القيم قبل التحويل (مثلاً salary كنص من input)،
// بينما القيم بعد zodResolver تكون محوَّلة (salary كرقم). نفرّق بين النوعين لإرضاء TypeScript.
export type DriverFormInput = z.input<typeof driverSchema>;
export type DriverFormValues = z.output<typeof driverSchema>;
