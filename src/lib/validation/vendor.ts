import { z } from "zod";

export const vendorSchema = z.object({
  name: z.string().trim().min(2, "اسم المورّد مطلوب (حرفان على الأقل)"),
  phone: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]),
});

export type VendorFormInput = z.input<typeof vendorSchema>;
export type VendorFormValues = z.output<typeof vendorSchema>;

export type VendorRecord = {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  status: "active" | "inactive";
};

/** صف في تقرير الموردين — داخلي، فيه سعر العميل والربح */
export type VendorReportRow = {
  vendor_id: string;
  vendor_name: string;
  vendor_status: "active" | "inactive";
  drivers_count: number;
  trips_count: number;
  total_client_amount: number;
  total_vendor_cost: number;
  total_profit: number;
  unsettled_cost: number;
};

/** رحلة في الكشف الداخلي */
export type VendorTripRow = {
  trip_id: string;
  trip_date: string;
  trip_number: string;
  driver_name: string;
  company_name: string;
  from_location: string;
  to_location: string;
  branches_count: number;
  client_amount: number;
  vendor_cost: number;
  profit: number;
  settled: boolean;
};

/**
 * رحلة في الكشف الذي يُسلَّم للمورّد.
 *
 * 🔒 لا سعر عميل ولا ربح — لا في هذا النوع ولا في الدالة التي تملؤه
 * (fn_vendor_payable_trips). فحتى لو حاول أحد عرضهما مستقبلاً، لا مصدر لهما.
 */
export type VendorPayableTripRow = {
  trip_date: string;
  trip_number: string;
  driver_name: string;
  from_location: string;
  to_location: string;
  branches_count: number;
  amount: number;
};

export type VendorSummary = {
  trips_count: number;
  drivers_count: number;
  total_client_amount: number;
  total_vendor_cost: number;
  total_profit: number;
  total_advances: number;
  settled_cost: number;
  unsettled_cost: number;
  net_due: number;
};

export type VendorSettlementRecord = {
  id: string;
  settlement_number: string;
  from_date: string;
  to_date: string;
  settled_on: string;
  trips_count: number;
  total_vendor_cost: number;
  total_advances: number;
  net_amount: number;
  notes: string | null;
};

export type VendorAdvanceRecord = {
  id: string;
  date: string;
  amount: number;
  description: string | null;
  settlement_id: string | null;
};

export const vendorStatusLabels: Record<string, string> = {
  active: "نشط",
  inactive: "غير نشط",
};
