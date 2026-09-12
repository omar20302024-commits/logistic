"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import {
  vehicleSchema,
  vehicleStatusLabels,
  type VehicleFormInput,
  type VehicleFormValues,
  type VehicleRecord,
  type VehicleTypeRecord,
} from "@/lib/validation/vehicle";
import { createVehicle, updateVehicle } from "@/app/(dashboard)/vehicles/actions";

const emptyValues: VehicleFormInput = {
  vehicle_no: "",
  plate_no: "",
  type_slug: "",
  status: "active",
  notes: "",
};

export function VehicleFormModal({
  open,
  onClose,
  vehicle,
  types,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  vehicle?: VehicleRecord | null;
  types: VehicleTypeRecord[];
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VehicleFormInput, unknown, VehicleFormValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (!open) return;
    reset(
      vehicle
        ? {
            vehicle_no: vehicle.vehicle_no,
            plate_no: vehicle.plate_no ?? "",
            type_slug: vehicle.type_slug ?? "",
            status: vehicle.status,
            notes: vehicle.notes ?? "",
          }
        : emptyValues
    );
  }, [open, vehicle, reset]);

  const onSubmit = async (values: VehicleFormValues) => {
    const result = vehicle ? await updateVehicle(vehicle.id, values) : await createVehicle(values);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(vehicle ? "تم تعديل السيارة" : "تم إضافة السيارة");
    onSaved();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={vehicle ? "تعديل السيارة" : "إضافة سيارة"}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">رقم السيارة *</label>
            <input
              {...register("vehicle_no")}
              dir="ltr"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
            {errors.vehicle_no && (
              <p className="text-xs text-red-600">{errors.vehicle_no.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">رقم اللوحة</label>
            <input
              {...register("plate_no")}
              dir="ltr"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">النوع</label>
            <select
              {...register("type_slug")}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            >
              <option value="">— بدون —</option>
              {types.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name_ar}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">الحالة</label>
            <select
              {...register("status")}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            >
              {Object.entries(vehicleStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
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
