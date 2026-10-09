import { z } from "zod";

// رقم السيارة هو نفسه رقم اللوحة، فخانة واحدة تكفي. عمود plate_no باقٍ في
// قاعدة البيانات ومعه بياناته القديمة — لم يعد يُكتب إليه ولا يُعرض فقط.
export const vehicleSchema = z.object({
  vehicle_no: z.string().trim().min(1, "رقم السيارة مطلوب"),
  type_slug: z.string().trim().optional().or(z.literal("")),
  status: z.enum(["active", "inactive", "maintenance"]),
  notes: z.string().trim().optional().or(z.literal("")),
});

/** النوع الافتراضي لأي سيارة جديدة */
export const DEFAULT_VEHICLE_TYPE = "diana";

export type VehicleFormInput = z.input<typeof vehicleSchema>;
export type VehicleFormValues = z.output<typeof vehicleSchema>;

export type VehicleRecord = {
  id: string;
  vehicle_no: string;
  plate_no: string | null;
  type_slug: string | null;
  status: "active" | "inactive" | "maintenance";
  notes: string | null;
};

export type VehicleTypeRecord = {
  id: string;
  slug: string;
  name_ar: string;
  sort_order: number;
  is_active: boolean;
};

export const vehicleStatusLabels: Record<string, string> = {
  active: "نشطة",
  inactive: "غير نشطة",
  maintenance: "في الصيانة",
};

export const vehicleTypeSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, "المعرّف مطلوب")
    .regex(/^[a-z0-9_-]+$/, "المعرّف بحروف إنجليزية صغيرة وأرقام وشرطات فقط"),
  name_ar: z.string().trim().min(1, "الاسم العربي مطلوب"),
  sort_order: z.coerce.number().int().min(0),
  is_active: z.boolean(),
});

export type VehicleTypeInput = z.input<typeof vehicleTypeSchema>;
export type VehicleTypeValues = z.output<typeof vehicleTypeSchema>;
