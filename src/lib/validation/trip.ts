import { z } from "zod";

export const locationRowSchema = z.object({
  location_name: z.string().trim().min(1, "اسم الموقع مطلوب"),
  // كود الفرع اختياري — النص الحر يظل مقبولاً، والربط بالسجل ميزة إضافية
  branch_code: z.string().trim().optional().or(z.literal("")),
  amount: z.coerce.number().min(0, "المبلغ يجب أن يكون رقماً موجباً"),
});

export const tripSchema = z.object({
  trip_number: z.string().trim().optional().or(z.literal("")),
  driver_id: z.string().min(1, "اختر السائق"),
  company_id: z.string().min(1, "اختر الشركة"),
  trip_date: z.string().min(1, "التاريخ مطلوب"),
  from_location: z.string().trim().min(1, "مكان الانطلاق مطلوب"),
  to_location: z.string().trim().min(1, "مكان الوصول مطلوب"),

  // بنود أجرة العميل — مجموعها هو سعر الرحلة (تريغر trg_sync_trip_amount_from_fares)
  base_fare: z.coerce.number().min(0, "الأجرة الأساسية يجب أن تكون رقماً موجباً"),
  labor_fare: z.coerce.number().min(0, "أجرة العمالة يجب أن تكون رقماً موجباً"),
  extra_location_fare: z.coerce.number().min(0, "أجرة الموقع الإضافي يجب أن تكون رقماً موجباً"),
  overnight_fare: z.coerce.number().min(0, "أجرة المبيت يجب أن تكون رقماً موجباً"),

  // بدل مبيت السائق — اختياري لكل رحلة، يُضاف لتربه
  driver_overnight_payment: z.coerce.number().min(0, "بدل المبيت يجب أن يكون رقماً موجباً"),

  // ترب السائق — منفصل تماماً عن بنود العميل أعلاه (قاعدة #10)
  driver_base_payment: z.coerce.number().min(0, "الترب يجب أن يكون رقماً موجباً"),
  diesel_amount: z.coerce.number().min(0, "الديزل يجب أن يكون رقماً موجباً"),

  requester: z.string().trim().optional().or(z.literal("")),
  vehicle_id: z.string().trim().optional().or(z.literal("")),
  status: z.enum([
    "new",
    "in_progress",
    "completed",
    "completed_invoiced",
    "completed_not_invoiced",
    "suspended",
    "delivered_returned",
    "cancelled",
  ]),
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
  completed_invoiced: "مكتملة — استُلمت الفواتير",
  completed_not_invoiced: "مكتملة — لم تُستلم الفواتير",
  suspended: "معلّقة",
  delivered_returned: "تم التسليم والمرتجع",
  cancelled: "ملغاة",
};
