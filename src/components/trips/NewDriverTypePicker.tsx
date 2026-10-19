"use client";

/**
 * نوع السائق الذي سيُنشأ من صف الاستيراد/المزامنة.
 *
 * الاسم في الملف قد لا يكون في النظام، فيُنشأ سائق جديد. وهنا يُقرَّر: سائق
 * شركة، أم خارجي مستقل، أم خارجي تحت مورّد بعينه — فيدخل تلقائياً كشف ذلك
 * المورّد وتصفياته.
 *
 * يظهر فقط حين لم يُربط الصف بسائق موجود: تغيير مورّد سائق قائم يكون من
 * صفحته، لا من شاشة استيراد.
 */
export function NewDriverTypePicker({
  employmentType,
  vendorId,
  vendors,
  disabled = false,
  highlight = false,
  onChange,
}: {
  employmentType: "internal" | "external";
  vendorId: string;
  vendors: { id: string; name: string }[];
  disabled?: boolean;
  /** الملاحظات توحي بأنه خارجي — نلفت النظر دون أن نقرّر */
  highlight?: boolean;
  onChange: (patch: { employmentType?: "internal" | "external"; vendorId?: string }) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <select
        value={employmentType}
        disabled={disabled}
        onChange={(e) => {
          const next = e.target.value as "internal" | "external";
          // سائق الشركة لا مورّد له، فلا يبقى اختيار معلّق لو رجع للداخلي
          onChange({ employmentType: next, vendorId: next === "internal" ? "" : vendorId });
        }}
        className={`rounded border px-1.5 py-1 text-[10px] ${
          highlight ? "border-amber-300 bg-amber-50" : "border-zinc-200"
        }`}
      >
        <option value="internal">يُنشأ: سائق شركة</option>
        <option value="external">يُنشأ: خارجي</option>
      </select>

      {employmentType === "external" && (
        <select
          value={vendorId}
          disabled={disabled}
          onChange={(e) => onChange({ vendorId: e.target.value })}
          className="rounded border border-zinc-200 px-1.5 py-1 text-[10px]"
        >
          <option value="">بدون مورّد (خارجي مستقل)</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              تحت: {v.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
