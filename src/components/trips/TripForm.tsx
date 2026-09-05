"use client";

import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import {
  tripSchema,
  statusLabels,
  type TripFormInput,
  type TripFormValues,
} from "@/lib/validation/trip";
import { createTrip, updateTrip } from "@/app/(dashboard)/trips/actions";
import { formatCurrency } from "@/lib/format";

type Option = { id: string; name: string };

export type TripInitialData = {
  id: string;
  trip_number: string;
  driver_id: string;
  company_id: string;
  trip_date: string;
  from_location: string;
  to_location: string;
  driver_trip_payment: number;
  diesel_amount: number;
  status: "new" | "in_progress" | "completed" | "cancelled";
  notes: string | null;
  loading_locations: { location_name: string; amount: number; amount_status: "temporary" | "confirmed" }[];
  unloading_locations: { location_name: string; amount: number; amount_status: "temporary" | "confirmed" }[];
};

const emptyValues: TripFormInput = {
  trip_number: "",
  driver_id: "",
  company_id: "",
  trip_date: new Date().toISOString().slice(0, 10),
  from_location: "",
  to_location: "",
  driver_trip_payment: 0,
  diesel_amount: 0,
  status: "completed",
  notes: "",
  loading_locations: [],
  unloading_locations: [],
};

export function TripForm({
  drivers,
  companies,
  initialData,
  currencySymbol,
}: {
  drivers: Option[];
  companies: Option[];
  initialData?: TripInitialData;
  currencySymbol: string;
}) {
  const router = useRouter();

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TripFormInput, unknown, TripFormValues>({
    resolver: zodResolver(tripSchema),
    defaultValues: initialData
      ? {
          trip_number: initialData.trip_number,
          driver_id: initialData.driver_id,
          company_id: initialData.company_id,
          trip_date: initialData.trip_date,
          from_location: initialData.from_location,
          to_location: initialData.to_location,
          driver_trip_payment: initialData.driver_trip_payment,
          diesel_amount: initialData.diesel_amount,
          status: initialData.status,
          notes: initialData.notes ?? "",
          loading_locations: initialData.loading_locations,
          unloading_locations: initialData.unloading_locations,
        }
      : emptyValues,
  });

  const loadingArray = useFieldArray({ control, name: "loading_locations" });
  const unloadingArray = useFieldArray({ control, name: "unloading_locations" });

  const watchedLoading = watch("loading_locations");
  const watchedUnloading = watch("unloading_locations");
  const watchedPayment = watch("driver_trip_payment");
  const watchedDiesel = watch("diesel_amount");

  const totalTripAmount =
    (watchedLoading ?? []).reduce((sum, l) => sum + (Number(l.amount) || 0), 0) +
    (watchedUnloading ?? []).reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  const estimatedProfit =
    totalTripAmount - (Number(watchedPayment) || 0) - (Number(watchedDiesel) || 0);

  const onSubmit = async (values: TripFormValues) => {
    const result = initialData
      ? await updateTrip(initialData.id, values)
      : await createTrip(values);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(initialData ? "تم تعديل الرحلة بنجاح" : "تم إضافة الرحلة بنجاح");
    router.push("/trips");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      {/* بيانات الرحلة الأساسية */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-bold text-zinc-900">بيانات الرحلة</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">رقم الرحلة</label>
            <input
              {...register("trip_number")}
              dir="ltr"
              placeholder="توليد تلقائي إن تُرك فارغاً"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">تاريخ الرحلة *</label>
            <input
              {...register("trip_date")}
              type="date"
              dir="ltr"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
            {errors.trip_date && <p className="text-xs text-red-600">{errors.trip_date.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">الحالة</label>
            <select
              {...register("status")}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            >
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">السائق *</label>
            <select
              {...register("driver_id")}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            >
              <option value="">اختر السائق</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            {errors.driver_id && <p className="text-xs text-red-600">{errors.driver_id.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">الشركة *</label>
            <select
              {...register("company_id")}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            >
              <option value="">اختر الشركة</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.company_id && <p className="text-xs text-red-600">{errors.company_id.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">من *</label>
            <input
              {...register("from_location")}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
            {errors.from_location && (
              <p className="text-xs text-red-600">{errors.from_location.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">إلى *</label>
            <input
              {...register("to_location")}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
            {errors.to_location && <p className="text-xs text-red-600">{errors.to_location.message}</p>}
          </div>
        </div>
      </div>

      {/* المبالغ المالية */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="mb-1 text-sm font-bold text-zinc-900">المبالغ المالية</h3>
        <p className="mb-4 text-xs text-zinc-400">بيانات سرية — للإدارة فقط</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">سعر الرحلة (تلقائي)</label>
            <div
              dir="ltr"
              className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-700"
            >
              {formatCurrency(totalTripAmount, currencySymbol)}
            </div>
            <p className="text-[11px] text-zinc-400">= مجموع مبالغ مواقع التحميل والتنزيل أدناه</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">تربة السائق *</label>
            <input
              {...register("driver_trip_payment")}
              type="number"
              step="0.01"
              dir="ltr"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
            {errors.driver_trip_payment && (
              <p className="text-xs text-red-600">{errors.driver_trip_payment.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">مصروف الديزل *</label>
            <input
              {...register("diesel_amount")}
              type="number"
              step="0.01"
              dir="ltr"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
            {errors.diesel_amount && (
              <p className="text-xs text-red-600">{errors.diesel_amount.message}</p>
            )}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-lg bg-zinc-900 px-4 py-3 text-white">
          <span className="text-sm font-medium">ربح الرحلة المتوقع</span>
          <span className="font-mono text-sm font-bold" dir="ltr">
            {formatCurrency(estimatedProfit, currencySymbol)}
          </span>
        </div>
      </div>

      {/* مواقع التحميل */}
      <LocationsEditor
        title="مواقع التحميل"
        fieldArray={loadingArray}
        register={register}
        errors={errors.loading_locations}
        namePrefix="loading_locations"
      />

      {/* مواقع التنزيل */}
      <LocationsEditor
        title="مواقع التنزيل"
        fieldArray={unloadingArray}
        register={register}
        errors={errors.unloading_locations}
        namePrefix="unloading_locations"
      />

      {/* ملاحظات */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <label className="mb-1.5 block text-sm font-medium text-zinc-700">ملاحظات</label>
        <textarea
          {...register("notes")}
          rows={3}
          className="w-full resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
        />
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.push("/trips")}
          className="rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          إلغاء
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {isSubmitting ? "جارٍ الحفظ..." : "حفظ الرحلة"}
        </button>
      </div>
    </form>
  );
}

function LocationsEditor({
  title,
  fieldArray,
  register,
  namePrefix,
}: {
  title: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fieldArray: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors: any;
  namePrefix: "loading_locations" | "unloading_locations";
}) {
  const { fields, append, remove } = fieldArray;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold text-zinc-900">{title}</h3>
        <button
          type="button"
          onClick={() => append({ location_name: "", amount: 0, amount_status: "temporary" })}
          className="flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          <Plus size={14} />
          إضافة موقع
        </button>
      </div>

      {fields.length === 0 ? (
        <p className="py-4 text-center text-xs text-zinc-400">لا توجد مواقع مضافة</p>
      ) : (
        <div className="flex flex-col gap-2">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {fields.map((field: any, index: number) => (
            <div key={field.id} className="flex flex-wrap items-end gap-2 rounded-lg bg-zinc-50 p-3">
              <div className="flex min-w-[160px] flex-1 flex-col gap-1">
                <label className="text-xs text-zinc-500">اسم/وصف الموقع</label>
                <input
                  {...register(`${namePrefix}.${index}.location_name` as const)}
                  className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-zinc-900"
                />
              </div>
              <div className="flex w-32 flex-col gap-1">
                <label className="text-xs text-zinc-500">المبلغ</label>
                <input
                  {...register(`${namePrefix}.${index}.amount` as const)}
                  type="number"
                  step="0.01"
                  dir="ltr"
                  className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-right outline-none focus:border-zinc-900"
                />
              </div>
              <div className="flex w-32 flex-col gap-1">
                <label className="text-xs text-zinc-500">الحالة</label>
                <select
                  {...register(`${namePrefix}.${index}.amount_status` as const)}
                  className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-zinc-900"
                >
                  <option value="temporary">مؤقت</option>
                  <option value="confirmed">مثبت</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => remove(index)}
                className="rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                title="حذف الموقع"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
