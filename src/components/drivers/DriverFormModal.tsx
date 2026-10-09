"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { driverSchema, type DriverFormInput, type DriverFormValues } from "@/lib/validation/driver";
import { createDriver, updateDriver } from "@/app/(dashboard)/drivers/actions";

export type DriverRecord = {
  id: string;
  name: string;
  phone: string | null;
  salary: number;
  default_trip_payment: number;
  extra_stop_rate: number;
  hire_date: string | null;
  vehicle_id: string | null;
  status: "active" | "inactive";
  employment_type: "internal" | "external";
  notes: string | null;
};

const emptyValues: DriverFormInput = {
  name: "",
  phone: "",
  salary: 0,
  default_trip_payment: 0,
  extra_stop_rate: 0,
  hire_date: "",
  vehicle_id: "",
  status: "active",
  employment_type: "internal",
  notes: "",
};

export function DriverFormModal({
  open,
  onClose,
  driver,
  vehicles,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  driver?: DriverRecord | null;
  vehicles: { id: string; vehicle_no: string; holder_id: string | null; holder_name: string | null }[];
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<DriverFormInput, unknown, DriverFormValues>({
    resolver: zodResolver(driverSchema),
    defaultValues: emptyValues,
  });

  // تحويل مطلوب فقط حين تكون السيارة المختارة عند سائق آخر
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [transferReason, setTransferReason] = useState("");

  const selectedVehicleId = watch("vehicle_id");
  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);
  const needsTransfer =
    !!selectedVehicle?.holder_id && selectedVehicle.holder_id !== driver?.id;

  useEffect(() => {
    if (!open) return;
    reset(
      driver
        ? {
            name: driver.name,
            phone: driver.phone ?? "",
            salary: driver.salary,
            default_trip_payment: driver.default_trip_payment,
            extra_stop_rate: driver.extra_stop_rate,
            hire_date: driver.hire_date ?? "",
            vehicle_id: driver.vehicle_id ?? "",
            status: driver.status,
            employment_type: driver.employment_type,
            notes: driver.notes ?? "",
          }
        : emptyValues
    );
  }, [open, driver, reset]);

  const onSubmit = async (values: DriverFormValues) => {
    if (needsTransfer && !transferReason.trim()) {
      toast.error("سبب التحويل مطلوب — السيارة مرتبطة بسائق آخر");
      return;
    }

    const transfer = needsTransfer
      ? { date: transferDate, reason: transferReason.trim() }
      : undefined;

    const result = driver
      ? await updateDriver(driver.id, values, transfer)
      : await createDriver(values, transfer);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(driver ? "تم تعديل بيانات السائق" : "تم إضافة السائق بنجاح");
    onSaved();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={driver ? "تعديل بيانات السائق" : "إضافة سائق جديد"}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700">الاسم *</label>
          <input
            {...register("name")}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            placeholder="اسم السائق"
          />
          {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">رقم الهاتف</label>
            <input
              {...register("phone")}
              dir="ltr"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
              placeholder="05xxxxxxxx"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">الراتب الشهري *</label>
            <input
              {...register("salary")}
              type="number"
              step="0.01"
              dir="ltr"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
              placeholder="0.00"
            />
            {errors.salary && <p className="text-xs text-red-600">{errors.salary.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">الترب الافتراضي العام</label>
            <input
              {...register("default_trip_payment")}
              type="number"
              step="0.01"
              dir="ltr"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
            {errors.default_trip_payment && (
              <p className="text-xs text-red-600">{errors.default_trip_payment.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">ترب الموقع الإضافي</label>
            <input
              {...register("extra_stop_rate")}
              type="number"
              step="0.01"
              dir="ltr"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
            {errors.extra_stop_rate && (
              <p className="text-xs text-red-600">{errors.extra_stop_rate.message}</p>
            )}
          </div>
        </div>
        <p className="-mt-2 text-[11px] text-zinc-400">
          الترب العام يُستخدم لو مفيش خط سير محدَّد لنفس المدينتين (أضِف خطوط السير من صفحة السائق بعد الحفظ).
          ترب الموقع الإضافي يُملأ تلقائياً لأي موقع تنزيل زيادة عن الأول.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">السيارة</label>
            <select
              {...register("vehicle_id")}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            >
              <option value="">— بدون —</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vehicle_no}
                  {v.holder_id && v.holder_id !== driver?.id ? ` — مع ${v.holder_name}` : ""}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-zinc-400">السيارة ترتبط بسائق واحد فقط</p>
          </div>

          {/* يظهر فقط حين تكون السيارة عند سائق آخر — عندها التحويل إجباري */}
          {needsTransfer && (
            <div className="col-span-2 flex flex-col gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs text-amber-900">
                السيارة <strong>{selectedVehicle?.vehicle_no}</strong> مرتبطة حالياً بالسائق{" "}
                <strong>{selectedVehicle?.holder_name}</strong>. الحفظ سيحوّلها إليه ويفكّها عن
                السائق السابق، ويُسجَّل ذلك في سجل تحويلات السيارة.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-amber-900">تاريخ التحويل *</label>
                  <input
                    type="date"
                    dir="ltr"
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-right outline-none focus:border-amber-500"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-amber-900">سبب التحويل *</label>
                  <input
                    value={transferReason}
                    onChange={(e) => setTransferReason(e.target.value)}
                    placeholder="مثال: السائق السابق في إجازة"
                    className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">تاريخ التعيين</label>
            <input
              {...register("hire_date")}
              type="date"
              dir="ltr"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">الحالة</label>
            <select
              {...register("status")}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            >
              <option value="active">نشط</option>
              <option value="inactive">غير نشط</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700">نوع السائق</label>
          <select
            {...register("employment_type")}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
          >
            <option value="internal">موظف داخلي (له راتب شهري)</option>
            <option value="external">مورد خارجي (بدون راتب، بالرحلة)</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700">ملاحظات</label>
          <textarea
            {...register("notes")}
            rows={2}
            className="resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
          />
        </div>

        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {isSubmitting ? "جارٍ الحفظ..." : "حفظ"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
