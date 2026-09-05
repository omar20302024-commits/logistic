"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { settingsSchema, type SettingsFormValues } from "@/lib/validation/settings";
import { updateSettings } from "@/app/(dashboard)/settings/actions";

export function SettingsForm({ initial }: { initial: SettingsFormValues }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: initial,
  });

  const onSubmit = async (values: SettingsFormValues) => {
    const result = await updateSettings(values);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("تم حفظ الإعدادات بنجاح");
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-bold text-zinc-900">بيانات المؤسسة</h3>
        <p className="mb-4 text-xs text-zinc-400">تظهر هذه البيانات في رأس الكشوفات والتقارير المطبوعة</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">اسم المؤسسة *</label>
            <input {...register("org_name")} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" />
            {errors.org_name && <p className="text-xs text-red-600">{errors.org_name.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">رقم الهاتف</label>
            <input {...register("org_phone")} dir="ltr" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-sm font-medium text-zinc-700">العنوان</label>
            <input {...register("org_address")} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-bold text-zinc-900">العملة</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">رمز العملة (ISO)</label>
            <input {...register("currency_code")} dir="ltr" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">رمز العرض</label>
            <input {...register("currency_symbol")} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-bold text-zinc-900">قواعد الحساب</h3>
        <label className="flex items-center gap-3 text-sm text-zinc-700">
          <input type="checkbox" {...register("count_cancelled_trips_in_profit")} className="h-4 w-4 rounded border-zinc-300" />
          احتساب الرحلات الملغاة ضمن حسابات الربح والتقارير (غير مفعّل افتراضياً)
        </label>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={isSubmitting} className="rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">
          {isSubmitting ? "جارٍ الحفظ..." : "حفظ الإعدادات"}
        </button>
      </div>
    </form>
  );
}
