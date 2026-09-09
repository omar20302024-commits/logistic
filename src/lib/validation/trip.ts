import { z } from "zod";

export const locationRowSchema = z.object({
  location_name: z.string().trim().min(1, "اسم الموقع مطلوب"),
  amount: z.coerce.number().min(0, "المبلغ يجب أن يكون رقماً موجباً"),
});

export const tripSchema = z.object({
  trip_number: z.string().trim().optional().or(z.literal("")),
  driver_id: z.string().min(1, "اختر السائق"),
  company_id: z.string().min(1, "اختر الشركة"),
  trip_date: z.string().min(1, "التاريخ مطلوب"),
  from_location: z.string().trim().min(1, "مكان الانطلاق مطلوب"),
  to_location: z.string().trim().min(1, "مكان الوصول مطلوب"),
  driver_base_payment: z.coerce.number().min(0, "التربة يجب أن تكون رقماً موجباً"),
  diesel_amount: z.coerce.number().min(0, "الديزل يجب أن يكون رقماً موجباً"),
  status: z.enum(["new", "in_progress", "completed", "cancelled"]),
  notes: z.string().trim().optional().or(z.literal("")),
  loading_locations: z.array(locationRowSchema),
  unloading_locations: z.array(locationRowSchema),
});

export type LocationRowInput = z.input<typeof locationRowSchema>;
export type LocationRowValues = z.output<typeof locationRowSchema>;
export type TripFormInput = z.input<typeof tripSchema>;
export type TripFormValues = z.output<typeof tripSchema>;

export const statusLabels: Record<string, string> = {
  new: "جديدة",
  in_progress: "قيد التنفيذ",
  completed: "مكتملة",
  cancelled: "ملغاة",
};
