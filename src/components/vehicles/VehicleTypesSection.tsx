"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  vehicleTypeSchema,
  type VehicleTypeInput,
  type VehicleTypeValues,
  type VehicleTypeRecord,
} from "@/lib/validation/vehicle";
import { createVehicleType, updateVehicleType } from "@/app/(dashboard)/vehicles/actions";

export function VehicleTypesSection({ types }: { types: VehicleTypeRecord[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<VehicleTypeRecord | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VehicleTypeInput, unknown, VehicleTypeValues>({
    resolver: zodResolver(vehicleTypeSchema),
    defaultValues: { slug: "", name_ar: "", sort_order: 0, is_active: true },
  });

  const openForm = (type: VehicleTypeRecord | null) => {
    setEditing(type);
    reset(
      type
        ? {
            slug: type.slug,
            name_ar: type.name_ar,
            sort_order: type.sort_order,
            is_active: type.is_active,
          }
        : { slug: "", name_ar: "", sort_order: types.length + 1, is_active: true }
    );
    setOpen(true);
  };

  const onSubmit = async (values: VehicleTypeValues) => {
    const result = editing
      ? await updateVehicleType(editing.id, values)
      : await createVehicleType(values);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(editing ? "تم تعديل النوع" : "تم إضافة النوع");
    setOpen(false);
    router.refresh();
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-zinc-900">أنواع السيارات</h3>
          <p className="text-xs text-zinc-400">
            أضف نوعاً جديداً متى شئت — الأنواع في جدول لا في قائمة ثابتة
          </p>
        </div>
        <button
          type="button"
          onClick={() => openForm(null)}
          className="flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          <Plus size={14} />
          إضافة نوع
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {types.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => openForm(t)}
            className={`group flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${
              t.is_active
                ? "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                : "border-zinc-200 bg-zinc-50 text-zinc-400"
            }`}
          >
            {t.name_ar}
            {!t.is_active && <span className="text-[10px]">(غير نشط)</span>}
            <Pencil size={12} className="opacity-0 transition group-hover:opacity-100" />
          </button>
        ))}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "تعديل نوع السيارة" : "إضافة نوع سيارة"}
        maxWidth="max-w-sm"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">الاسم العربي *</label>
            <input
              {...register("name_ar")}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
            {errors.name_ar && <p className="text-xs text-red-600">{errors.name_ar.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">المعرّف *</label>
            <input
              {...register("slug")}
              dir="ltr"
              placeholder="trailer"
              disabled={!!editing}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 disabled:bg-zinc-50 disabled:text-zinc-400"
            />
            {errors.slug && <p className="text-xs text-red-600">{errors.slug.message}</p>}
            <p className="text-[11px] text-zinc-400">
              {editing
                ? "المعرّف لا يُعدَّل بعد الإنشاء — السيارات مرتبطة به"
                : "بحروف إنجليزية صغيرة، يُستخدم داخلياً للربط"}
            </p>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">الترتيب</label>
              <input
                {...register("sort_order")}
                type="number"
                dir="ltr"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
              />
            </div>
            <label className="mt-6 flex items-center gap-2 text-sm text-zinc-700">
              <input type="checkbox" {...register("is_active")} className="size-4 accent-zinc-900" />
              نشط
            </label>
          </div>

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
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
    </div>
  );
}
