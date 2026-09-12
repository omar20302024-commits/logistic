"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  tripSchema,
  statusLabels,
  type TripFormInput,
  type TripFormValues,
} from "@/lib/validation/trip";
import { createTrip, updateTrip } from "@/app/(dashboard)/trips/actions";
import { formatCurrency } from "@/lib/format";
import { normalizeArabic } from "@/lib/arabic";
import { chargeableStops, destinationCount } from "@/lib/trip-calc";

type RouteRate = { from_city: string; to_city: string; trab_amount: number };
type DriverOption = {
  id: string;
  name: string;
  default_trip_payment: number;
  extra_stop_rate: number;
  route_rates: RouteRate[];
};
type CompanyOption = { id: string; name: string; extra_location_rate: number };
type VehicleTypeOption = { slug: string; name_ar: string };

// مطابقة أسماء المدن تتجاهل الفروق الإملائية الشائعة (جده/جدة، الاحساء/الأحساء،
// المسافات الزائدة) — التفاصيل في src/lib/arabic.ts
const norm = normalizeArabic;

export type TripInitialData = {
  id: string;
  trip_number: string;
  driver_id: string;
  company_id: string;
  trip_date: string;
  from_location: string;
  to_location: string;
  branches_count: number;
  vehicle_type_slug: string | null;
  base_fare: number;
  labor_fare: number;
  extra_location_fare: number;
  overnight_fare: number;
  driver_base_payment: number;
  driver_overnight_payment: number;
  diesel_amount: number;
  requester: string | null;
  status: TripFormInput["status"];
  notes: string | null;
};

const emptyValues: TripFormInput = {
  trip_number: "",
  driver_id: "",
  company_id: "",
  trip_date: new Date().toISOString().slice(0, 10),
  from_location: "",
  to_location: "",
  branches_count: 1,
  vehicle_type_slug: "diana",
  base_fare: 0,
  labor_fare: 0,
  extra_location_fare: 0,
  overnight_fare: 0,
  driver_base_payment: 0,
  driver_overnight_payment: 0,
  diesel_amount: 0,
  requester: "",
  status: "completed",
  notes: "",
};

export function TripForm({
  drivers,
  companies,
  vehicleTypes,
  initialData,
  currencySymbol,
}: {
  drivers: DriverOption[];
  companies: CompanyOption[];
  vehicleTypes: VehicleTypeOption[];
  initialData?: TripInitialData;
  currencySymbol: string;
}) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
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
          branches_count: initialData.branches_count,
          vehicle_type_slug: initialData.vehicle_type_slug ?? "",
          base_fare: initialData.base_fare,
          labor_fare: initialData.labor_fare,
          extra_location_fare: initialData.extra_location_fare,
          overnight_fare: initialData.overnight_fare,
          driver_base_payment: initialData.driver_base_payment,
          driver_overnight_payment: initialData.driver_overnight_payment,
          diesel_amount: initialData.diesel_amount,
          requester: initialData.requester ?? "",
          status: initialData.status,
          notes: initialData.notes ?? "",
        }
      : emptyValues,
  });

  const watchedDriverId = watch("driver_id");
  const watchedCompanyId = watch("company_id");
  const watchedFromLocation = watch("from_location");
  const watchedToLocation = watch("to_location");
  const watchedBranchesCount = watch("branches_count");
  const watchedBaseFare = watch("base_fare");
  const watchedLaborFare = watch("labor_fare");
  const watchedExtraFare = watch("extra_location_fare");
  const watchedOvernightFare = watch("overnight_fare");
  const watchedBasePayment = watch("driver_base_payment");
  const watchedDriverOvernight = watch("driver_overnight_payment");
  const watchedDiesel = watch("diesel_amount");

  const selectedDriver = drivers.find((d) => d.id === watchedDriverId);
  const selectedCompany = companies.find((c) => c.id === watchedCompanyId);

  // جانب العميل وجانب السائق منفصلان تماماً (قاعدة #10):
  //   سعر الرحلة = الأساسية + العمالة + الموقع الإضافي + المبيت
  //   ترب السائق  = الترب الأساسي + (الفروع المحاسَب عليها × معدَّل السائق) + بدل المبيت
  // العدد واحد للاثنين، لكن لكلٍّ معدَّله.
  const destinations = destinationCount(watchedToLocation ?? "");
  const stops = chargeableStops(Number(watchedBranchesCount) || 0, watchedToLocation ?? "");
  const extraStopRate = selectedDriver?.extra_stop_rate ?? 0;
  const extraStopsPayment = stops * extraStopRate;

  const matchedRoute = selectedDriver
    ? selectedDriver.route_rates.find(
        (r) =>
          norm(r.from_city) === norm(watchedFromLocation ?? "") &&
          norm(r.to_city) === norm(watchedToLocation ?? "")
      )
    : undefined;

  // السائق له خطوط سير محفوظة، و"من/إلى" مكتوبتان، ومع ذلك لم يتطابق أي خط سير.
  // بدون هذا التنبيه تكون الواجهة صامتة فلا يفرّق المستخدم بين "لا يوجد خط سير
  // لهذه الوجهة" و"يوجد لكن الإملاء مختلف" — وكلاهما يعطي الترب الافتراضي.
  const routeRatesExist = (selectedDriver?.route_rates.length ?? 0) > 0;
  const routeUnmatched =
    routeRatesExist &&
    !matchedRoute &&
    norm(watchedFromLocation ?? "") !== "" &&
    norm(watchedToLocation ?? "") !== "";

  const totalTripAmount =
    (Number(watchedBaseFare) || 0) +
    (Number(watchedLaborFare) || 0) +
    (Number(watchedExtraFare) || 0) +
    (Number(watchedOvernightFare) || 0);

  // اقتراح أجرة الموقع الإضافي = الفروع المحاسَب عليها × معدَّل هذه الشركة.
  // اقتراح فقط — يقدر المستخدم يكتب رقماً مختلفاً ونحترمه.
  const companyExtraRate = selectedCompany?.extra_location_rate ?? 0;
  const suggestedExtraFare = stops * companyExtraRate;
  const userTouchedExtraFare = useRef(!!initialData);
  useEffect(() => {
    if (userTouchedExtraFare.current) return;
    setValue("extra_location_fare", suggestedExtraFare);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedExtraFare]);

  const totalDriverPayment =
    (Number(watchedBasePayment) || 0) + extraStopsPayment + (Number(watchedDriverOvernight) || 0);
  const estimatedProfit = totalTripAmount - totalDriverPayment - (Number(watchedDiesel) || 0);

  // تعبئة الترب الأساسي تلقائياً: أولوية لخط سير مطابق، وإلا الترب الافتراضي
  // العام للسائق — فقط عند إضافة رحلة جديدة ولم يعدّله المستخدم يدوياً
  const userTouchedPayment = useRef(!!initialData);
  useEffect(() => {
    if (initialData || userTouchedPayment.current || !selectedDriver) return;

    const from = norm(watchedFromLocation ?? "");
    const to = norm(watchedToLocation ?? "");
    const route =
      from && to
        ? selectedDriver.route_rates.find(
            (r) => norm(r.from_city) === from && norm(r.to_city) === to
          )
        : undefined;

    setValue("driver_base_payment", route ? route.trab_amount : selectedDriver.default_trip_payment);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedDriverId, watchedFromLocation, watchedToLocation]);

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

  const input =
    "rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900";
  const numInput = `${input} text-right`;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      {/* بيانات الرحلة الأساسية */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-bold text-zinc-900">بيانات الرحلة</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="رقم الرحلة">
            <input
              {...register("trip_number")}
              dir="ltr"
              placeholder="توليد تلقائي إن تُرك فارغاً"
              className={numInput}
            />
          </Field>

          <Field label="تاريخ الرحلة *" error={errors.trip_date?.message}>
            <input {...register("trip_date")} type="date" dir="ltr" className={numInput} />
          </Field>

          <Field label="الحالة">
            <select {...register("status")} className={input}>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="السائق *" error={errors.driver_id?.message}>
            <select
              {...register("driver_id")}
              onChange={(e) => {
                userTouchedPayment.current = false;
                register("driver_id").onChange(e);
              }}
              className={input}
            >
              <option value="">— اختر السائق —</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="نوع السيارة">
            <select {...register("vehicle_type_slug")} className={input}>
              {vehicleTypes.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name_ar}
                </option>
              ))}
            </select>
          </Field>

          <Field label="الشركة *" error={errors.company_id?.message}>
            <select {...register("company_id")} className={input}>
              <option value="">— اختر الشركة —</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="من *" error={errors.from_location?.message}>
            <input {...register("from_location")} className={input} />
          </Field>

          <Field label="إلى *" error={errors.to_location?.message}>
            <input
              {...register("to_location")}
              placeholder="الطائف + المدينة + جدة"
              className={input}
            />
            {destinations > 1 && (
              <p className="text-[11px] text-zinc-500">{destinations} مدن تنزيل</p>
            )}
          </Field>

          <Field label="عدد الفروع في الرحلة" error={errors.branches_count?.message}>
            <input
              {...register("branches_count")}
              type="number"
              min={0}
              dir="ltr"
              className={numInput}
            />
            <p className="text-[11px] text-zinc-400">
              {destinations > 1
                ? `يُخصم فرع لكل مدينة تنزيل (${destinations}) لأنه ضمن الأجرة الأساسية`
                : "الفرع الأول لا يُحتسب لأنه ضمن الأجرة الأساسية"}
              {stops > 0 && ` — المحاسَب عليه ${stops}`}
            </p>
          </Field>

          <Field label="صاحب الطلب">
            <input {...register("requester")} placeholder="اسم مقدّم الطلب" className={input} />
          </Field>
        </div>
      </div>

      {/* المبالغ المالية */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="mb-1 text-sm font-bold text-zinc-900">المبالغ المالية</h3>
        <p className="mb-4 text-xs text-zinc-400">بيانات سرية — للإدارة فقط</p>

        <div className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
          <div className="mb-3 text-xs font-semibold text-zinc-500">أجرة العميل</div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="الأجرة الأساسية *" error={errors.base_fare?.message}>
              <input
                {...register("base_fare")}
                type="number"
                step="0.01"
                dir="ltr"
                className={`${numInput} bg-white`}
              />
              <p className="text-[11px] text-zinc-400">أجرة الرحلة من وإلى</p>
            </Field>

            <Field label="أجرة العمالة" error={errors.labor_fare?.message}>
              <input
                {...register("labor_fare")}
                type="number"
                step="0.01"
                dir="ltr"
                className={`${numInput} bg-white`}
              />
            </Field>

            <Field label="أجرة الموقع الإضافي" error={errors.extra_location_fare?.message}>
              <input
                {...register("extra_location_fare")}
                type="number"
                step="0.01"
                dir="ltr"
                onChange={(e) => {
                  userTouchedExtraFare.current = true;
                  register("extra_location_fare").onChange(e);
                }}
                className={`${numInput} bg-white`}
              />
              {companyExtraRate > 0 && stops > 0 && (
                <p className="text-[11px] text-zinc-500">
                  مقترح: {stops} × {formatCurrency(companyExtraRate, currencySymbol)} ={" "}
                  {formatCurrency(suggestedExtraFare, currencySymbol)}
                </p>
              )}
              {companyExtraRate === 0 && watchedCompanyId && (
                <p className="text-[11px] text-amber-600">
                  لم تُحدَّد تكلفة الفرع الإضافي لهذه الشركة — اضبطها في سجل الشركة ليُحسب تلقائياً
                </p>
              )}
            </Field>

            <Field label="أجرة المبيت" error={errors.overnight_fare?.message}>
              <input
                {...register("overnight_fare")}
                type="number"
                step="0.01"
                dir="ltr"
                className={`${numInput} bg-white`}
              />
            </Field>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-zinc-200 pt-3">
            <span className="text-sm font-medium text-zinc-700">سعر الرحلة</span>
            <span className="text-sm font-bold text-zinc-900" dir="ltr">
              {formatCurrency(totalTripAmount, currencySymbol)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="الترب الأساسي *" error={errors.driver_base_payment?.message}>
            <input
              {...register("driver_base_payment")}
              type="number"
              step="0.01"
              dir="ltr"
              onChange={(e) => {
                userTouchedPayment.current = true;
                register("driver_base_payment").onChange(e);
              }}
              className={numInput}
            />
            {matchedRoute && (
              <p className="text-[11px] text-emerald-600">✓ مطابق لخط سير محفوظ لهذا السائق</p>
            )}
            {routeUnmatched && (
              <p className="text-[11px] text-amber-600">
                لا يوجد خط سير محفوظ لهذا السائق يطابق «من ← إلى»
                {!initialData && " — استُخدم الترب الافتراضي العام"}. راجع إملاء المدينتين، أو أضف
                خط السير من صفحة السائق.
              </p>
            )}
          </Field>

          <Field label="بدل مبيت السائق" error={errors.driver_overnight_payment?.message}>
            <input
              {...register("driver_overnight_payment")}
              type="number"
              step="0.01"
              dir="ltr"
              className={numInput}
            />
            <p className="text-[11px] text-zinc-400">اتركه صفراً إن لم يستحقه</p>
          </Field>
        </div>

        {stops > 0 && extraStopRate > 0 && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {stops} فرع محاسَب عليه × {formatCurrency(extraStopRate, currencySymbol)} (معدَّل هذا
            السائق) = + {formatCurrency(extraStopsPayment, currencySymbol)} ترب زيادة → إجمالي ترب
            السائق {formatCurrency(totalDriverPayment, currencySymbol)}
          </p>
        )}

        <div className="mt-4 flex items-center justify-between rounded-lg bg-zinc-900 px-4 py-3 text-white">
          <span className="text-sm font-medium">ربح الرحلة المتوقع</span>
          <span className="text-sm font-bold" dir="ltr">
            {formatCurrency(estimatedProfit, currencySymbol)}
          </span>
        </div>
        <p className="mt-2 text-[11px] text-zinc-400">
          الديزل لم يعد يُسجَّل على الرحلة — يُدخَل مرة واحدة لكل سائق في صفحة «الديزل الشهري».
          {(Number(watchedDiesel) || 0) > 0 &&
            ` هذه الرحلة تحمل ديزلاً قديماً بقيمة ${formatCurrency(
              Number(watchedDiesel) || 0,
              currencySymbol
            )} وهو مخصوم من الربح أعلاه.`}
        </p>
      </div>

      {/* ملاحظات */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <Field label="ملاحظات">
          <textarea {...register("notes")} rows={3} className={`${input} resize-none`} />
        </Field>
      </div>

      <div className="flex gap-3">
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
          className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {isSubmitting ? "جارٍ الحفظ..." : initialData ? "حفظ التعديلات" : "إضافة الرحلة"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-zinc-700">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
