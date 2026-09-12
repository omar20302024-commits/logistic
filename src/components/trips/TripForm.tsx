"use client";

import { useEffect, useRef } from "react";
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
import { createTrip, updateTrip, getLastTripBranches } from "@/app/(dashboard)/trips/actions";
import { formatCurrency } from "@/lib/format";
import { normalizeArabic } from "@/lib/arabic";

type RouteRate = { from_city: string; to_city: string; trab_amount: number };
type DriverOption = {
  id: string;
  name: string;
  default_trip_payment: number;
  extra_stop_rate: number;
  route_rates: RouteRate[];
};
type CompanyOption = { id: string; name: string; extra_location_rate: number };
type BranchOption = { company_id: string; branch_code: string; branch_name: string | null };

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
  loading_locations: { location_name: string; branch_code: string | null; amount: number }[];
  unloading_locations: { location_name: string; branch_code: string | null; amount: number }[];
};

const emptyValues: TripFormInput = {
  trip_number: "",
  driver_id: "",
  company_id: "",
  trip_date: new Date().toISOString().slice(0, 10),
  from_location: "",
  to_location: "",
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
  loading_locations: [],
  unloading_locations: [],
};

export function TripForm({
  drivers,
  companies,
  branches,
  initialData,
  currencySymbol,
}: {
  drivers: DriverOption[];
  companies: CompanyOption[];
  branches: BranchOption[];
  initialData?: TripInitialData;
  currencySymbol: string;
}) {
  const router = useRouter();

  const {
    register,
    control,
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
          loading_locations: initialData.loading_locations.map((l) => ({
            ...l,
            branch_code: l.branch_code ?? "",
          })),
          unloading_locations: initialData.unloading_locations.map((l) => ({
            ...l,
            branch_code: l.branch_code ?? "",
          })),
        }
      : emptyValues,
  });

  const loadingArray = useFieldArray({ control, name: "loading_locations" });
  const unloadingArray = useFieldArray({ control, name: "unloading_locations" });

  const watchedLoading = watch("loading_locations");
  const watchedUnloading = watch("unloading_locations");
  const watchedBasePayment = watch("driver_base_payment");
  const watchedDiesel = watch("diesel_amount");
  const watchedDriverId = watch("driver_id");
  const watchedCompanyId = watch("company_id");
  const watchedFromLocation = watch("from_location");
  const watchedToLocation = watch("to_location");
  const watchedBaseFare = watch("base_fare");
  const watchedLaborFare = watch("labor_fare");
  const watchedExtraFare = watch("extra_location_fare");
  const watchedOvernightFare = watch("overnight_fare");
  const watchedDriverOvernight = watch("driver_overnight_payment");

  const selectedDriver = drivers.find((d) => d.id === watchedDriverId);
  const selectedCompany = companies.find((c) => c.id === watchedCompanyId);

  // جانب العميل وجانب السائق منفصلان تماماً (قاعدة #10):
  //   سعر الرحلة = الأساسية + العمالة + الموقع الإضافي + المبيت
  //   ترب السائق  = الترب الأساسي + (المواقع الإضافية × معدَّل هذا السائق) + بدل المبيت
  // لكلٍّ معدَّله ومصدره؛ مبالغ المواقع لم تعد تحدد سعر الرحلة.
  const loadingList = watchedLoading ?? [];
  const unloadingList = watchedUnloading ?? [];

  const extraStopsCount = Math.max(loadingList.length - 1, 0) + Math.max(unloadingList.length - 1, 0);
  const extraStopRate = selectedDriver?.extra_stop_rate ?? 0;
  const extraStopsPayment = extraStopsCount * extraStopRate;

  const matchedRoute = selectedDriver
    ? selectedDriver.route_rates.find(
        (r) =>
          norm(r.from_city) === norm(watchedFromLocation ?? "") &&
          norm(r.to_city) === norm(watchedToLocation ?? "")
      )
    : undefined;

  // السائق له خطوط سير محفوظة، و"من/إلى" مكتوبتان، ومع ذلك لم يتطابق أي خط سير.
  // بدون هذا التنبيه تكون الواجهة صامتة تماماً فلا يفرّق المستخدم بين "لا يوجد خط
  // سير لهذه الوجهة أصلاً" و"يوجد لكن الإملاء مختلف" — وكلاهما يعطي الترب الافتراضي.
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

  // اقتراح أجرة الموقع الإضافي للعميل = عدد المواقع الإضافية × معدَّل هذه الشركة.
  // اقتراح فقط — المستخدم يقدر يكتب رقماً مختلفاً ونحترمه، عشان في رحلات
  // بتتفق على مبلغ خاص. المعدَّل ده للعميل وحده ولا علاقة له بمعدَّل السائق.
  const companyExtraRate = selectedCompany?.extra_location_rate ?? 0;
  const suggestedExtraFare = extraStopsCount * companyExtraRate;
  const userTouchedExtraFare = useRef(!!initialData);
  useEffect(() => {
    if (userTouchedExtraFare.current) return;
    setValue("extra_location_fare", suggestedExtraFare);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedExtraFare]);
  // فروع هذا العميل فقط — الأكواد مميزة داخل العميل الواحد لا عبر النظام كله
  const companyBranches = branches.filter((b) => b.company_id === watchedCompanyId);

  // جلب فروع آخر رحلة لنفس العميل ونفس الوجهة — يوفّر إعادة كتابتها كل مرة
  const canFetchBranches = !!watchedCompanyId && !!(watchedToLocation ?? "").trim();
  const handleFetchBranches = async () => {
    const result = await getLastTripBranches(watchedCompanyId, watchedToLocation ?? "");
    if (result.error) {
      toast.error(result.error);
      return;
    }
    if (result.branches.length === 0) {
      toast.info("لا توجد رحلة سابقة لهذا العميل بنفس الوجهة");
      return;
    }
    // يستبدل مواقع التنزيل الحالية بالكامل — أوضح من الدمج، والمستخدم يرى النتيجة قبل الحفظ
    setValue(
      "unloading_locations",
      result.branches.map((b) => ({
        location_name: b.location_name,
        branch_code: b.branch_code ?? "",
        amount: b.amount,
      }))
    );
    toast.success(`تم جلب ${result.branches.length} فرعاً من آخر رحلة لهذه الوجهة`);
  };

  const totalDriverPayment =
    (Number(watchedBasePayment) || 0) + extraStopsPayment + (Number(watchedDriverOvernight) || 0);
  const estimatedProfit = totalTripAmount - totalDriverPayment - (Number(watchedDiesel) || 0);

  // تعبئة الترب الأساسي تلقائياً: أولوية لخط سير مطابق (نفس مدينتي التحميل/التنزيل)،
  // وإلا الترب الافتراضي العام للسائق — فقط عند إضافة رحلة جديدة ولم يعدّله المستخدم يدوياً
  const userTouchedPayment = useRef(!!initialData);
  useEffect(() => {
    if (initialData || userTouchedPayment.current || !selectedDriver) return;

    const from = norm(watchedFromLocation ?? "");
    const to = norm(watchedToLocation ?? "");
    const matchedRoute =
      from && to
        ? selectedDriver.route_rates.find(
            (r) => norm(r.from_city) === from && norm(r.to_city) === to
          )
        : undefined;

    setValue(
      "driver_base_payment",
      matchedRoute ? matchedRoute.trab_amount : selectedDriver.default_trip_payment
    );
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
            <label className="text-sm font-medium text-zinc-700">صاحب الطلب</label>
            <input
              {...register("requester")}
              placeholder="اسم مقدّم الطلب"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">السائق *</label>
            <select
              {...register("driver_id")}
              onChange={(e) => {
                userTouchedPayment.current = false;
                register("driver_id").onChange(e);
              }}
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
        <div className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
          <div className="mb-3 text-xs font-semibold text-zinc-500">أجرة العميل</div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">الأجرة الأساسية *</label>
              <input
                {...register("base_fare")}
                type="number"
                step="0.01"
                dir="ltr"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
              />
              {errors.base_fare && <p className="text-xs text-red-600">{errors.base_fare.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">أجرة العمالة</label>
              <input
                {...register("labor_fare")}
                type="number"
                step="0.01"
                dir="ltr"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
              />
              {errors.labor_fare && <p className="text-xs text-red-600">{errors.labor_fare.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">أجرة الموقع الإضافي</label>
              <input
                {...register("extra_location_fare")}
                type="number"
                step="0.01"
                dir="ltr"
                onChange={(e) => {
                  userTouchedExtraFare.current = true;
                  register("extra_location_fare").onChange(e);
                }}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
              />
              {errors.extra_location_fare && (
                <p className="text-xs text-red-600">{errors.extra_location_fare.message}</p>
              )}
              {companyExtraRate > 0 && extraStopsCount > 0 && (
                <p className="text-[11px] text-zinc-500">
                  مقترح: {extraStopsCount} × {formatCurrency(companyExtraRate, currencySymbol)} (معدَّل
                  هذه الشركة) = {formatCurrency(suggestedExtraFare, currencySymbol)}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">أجرة المبيت</label>
              <input
                {...register("overnight_fare")}
                type="number"
                step="0.01"
                dir="ltr"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
              />
              {errors.overnight_fare && (
                <p className="text-xs text-red-600">{errors.overnight_fare.message}</p>
              )}
              <p className="text-[11px] text-zinc-400">
                إن انتظر السائق لليوم التالي للتنزيل
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-zinc-200 pt-3">
            <span className="text-sm font-medium text-zinc-700">سعر الرحلة</span>
            <span className="text-sm font-bold text-zinc-900" dir="ltr">
              {formatCurrency(totalTripAmount, currencySymbol)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">الترب الأساسي *</label>
            <input
              {...register("driver_base_payment")}
              type="number"
              step="0.01"
              dir="ltr"
              onChange={(e) => {
                userTouchedPayment.current = true;
                register("driver_base_payment").onChange(e);
              }}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
            {errors.driver_base_payment && (
              <p className="text-xs text-red-600">{errors.driver_base_payment.message}</p>
            )}
            {matchedRoute && (
              <p className="text-[11px] text-emerald-600">
                ✓ مطابق لخط سير محفوظ لهذا السائق
              </p>
            )}
            {routeUnmatched && (
              <p className="text-[11px] text-amber-600">
                لا يوجد خط سير محفوظ لهذا السائق يطابق «من ← إلى»
                {!initialData && " — استُخدم الترب الافتراضي العام"}. راجع إملاء المدينتين،
                أو أضف خط السير من صفحة السائق.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">بدل مبيت السائق</label>
            <input
              {...register("driver_overnight_payment")}
              type="number"
              step="0.01"
              dir="ltr"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
            {errors.driver_overnight_payment && (
              <p className="text-xs text-red-600">{errors.driver_overnight_payment.message}</p>
            )}
            <p className="text-[11px] text-zinc-400">
              اتركه صفراً إن لم يستحقه — يُضاف لتربه ويظهر في كشوفاته
            </p>
          </div>
        </div>

        {extraStopsCount > 0 && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {extraStopsCount} موقع إضافي × {formatCurrency(extraStopRate, currencySymbol)} (معدَّل هذا السائق) =
            + {formatCurrency(extraStopsPayment, currencySymbol)} ترب زيادة (تلقائي) → إجمالي ترب السائق{" "}
            {formatCurrency(totalDriverPayment, currencySymbol)}
          </p>
        )}

        <div className="mt-4 flex items-center justify-between rounded-lg bg-zinc-900 px-4 py-3 text-white">
          <span className="text-sm font-medium">ربح الرحلة المتوقع</span>
          <span className="text-sm font-bold" dir="ltr">
            {formatCurrency(estimatedProfit, currencySymbol)}
          </span>
        </div>
        <p className="mt-2 text-[11px] text-zinc-400">
          الديزل لم يعد يُسجَّل على الرحلة — يُدخَل مرة واحدة لكل سائق في صفحة «الديزل الشهري» عند
          تقفيل الشهر، ويُخصم من صافي الربح هناك.
          {(Number(watchedDiesel) || 0) > 0 &&
            ` هذه الرحلة تحمل ديزلاً قديماً بقيمة ${formatCurrency(
              Number(watchedDiesel) || 0,
              currencySymbol
            )} وهو مخصوم من الربح أعلاه.`}
        </p>
      </div>

      {/* مواقع التحميل */}
      <LocationsEditor
        title="مواقع التحميل"
        fieldArray={loadingArray}
        register={register}
        namePrefix="loading_locations"
        hint="المبالغ هنا توزيع داخلي على المواقع ولم تعد تحدد سعر الرحلة — السعر يأتي من بنود الأجرة أعلاه. أي موقع تحميل بعد الأول يضيف ترباً ثابتاً للسائق (حسب معدله) تلقائياً"
        extraNoteFrom={1}
      />

      {/* قائمة أكواد فروع هذا العميل — تظهر كاقتراحات في كل حقل كود */}
      <datalist id="company-branch-codes">
        {companyBranches.map((b) => (
          <option key={b.branch_code} value={b.branch_code}>
            {b.branch_name ?? ""}
          </option>
        ))}
      </datalist>

      {/* مواقع التنزيل */}
      <LocationsEditor
        title="مواقع التنزيل"
        fieldArray={unloadingArray}
        register={register}
        namePrefix="unloading_locations"
        hint="المبالغ هنا توزيع داخلي على المواقع ولم تعد تحدد سعر الرحلة — السعر يأتي من بنود الأجرة أعلاه. أي موقع تنزيل بعد الأول يضيف ترباً ثابتاً للسائق (حسب معدله) تلقائياً"
        extraNoteFrom={1}
        onFetchBranches={canFetchBranches ? handleFetchBranches : undefined}
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
  hint,
  extraNoteFrom,
  onFetchBranches,
}: {
  title: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fieldArray: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: any;
  namePrefix: "loading_locations" | "unloading_locations";
  hint?: string;
  extraNoteFrom?: number;
  onFetchBranches?: () => void;
}) {
  const { fields, append, remove } = fieldArray;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-bold text-zinc-900">{title}</h3>
        <div className="flex items-center gap-2">
        {onFetchBranches && (
          <button
            type="button"
            onClick={onFetchBranches}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
            title="يستبدل المواقع الحالية بفروع آخر رحلة لنفس العميل ونفس الوجهة"
          >
            جلب فروع آخر رحلة
          </button>
        )}
        <button
          type="button"
          onClick={() => append({ location_name: "", branch_code: "", amount: 0 })}
          className="flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          <Plus size={14} />
          إضافة موقع
        </button>
        </div>
      </div>
      {hint && <p className="mb-4 text-[11px] text-zinc-400">{hint}</p>}

      {fields.length === 0 ? (
        <p className="py-4 text-center text-xs text-zinc-400">لا توجد مواقع مضافة</p>
      ) : (
        <div className="flex flex-col gap-2">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {fields.map((field: any, index: number) => (
            <div key={field.id} className="flex flex-wrap items-end gap-2 rounded-lg bg-zinc-50 p-3">
              <div className="flex w-24 flex-col gap-1">
                <label className="text-xs text-zinc-500">كود الفرع</label>
                <input
                  {...register(`${namePrefix}.${index}.branch_code` as const)}
                  list="company-branch-codes"
                  placeholder="5072"
                  dir="ltr"
                  className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-right outline-none focus:border-zinc-900"
                />
              </div>
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
              {extraNoteFrom !== undefined && (
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-medium ${
                    index < extraNoteFrom ? "bg-zinc-200 text-zinc-600" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {index < extraNoteFrom ? "ضمن سعر الرحلة" : "موقع إضافي"}
                </span>
              )}
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
