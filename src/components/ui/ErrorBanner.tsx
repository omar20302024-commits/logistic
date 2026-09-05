type SupabaseErrorLike = {
  message?: string;
  code?: string;
  hint?: string | null;
  details?: string | null;
} | null | undefined;

/**
 * بانر خطأ موحّد يعرض رسالة Postgres/Supabase الحقيقية دائماً (message + code)
 * بدلاً من تخمين السبب في كل صفحة على حدة. بهذا أي خطأ مستقبلي (نسيان تشغيل
 * ملف SQL، خطأ صلاحيات RLS، اسم دالة خاطئ...) يظهر بسببه الفعلي فوراً على
 * الشاشة دون الحاجة للتخمين أو الرجوع لسجلات السيرفر.
 */
export function ErrorBanner({ error, hint }: { error: SupabaseErrorLike; hint?: string }) {
  if (!error) return null;

  return (
    <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 print:hidden">
      <p className="font-medium">حدث خطأ أثناء تحميل البيانات من قاعدة البيانات.</p>
      {hint && <p className="mt-1 text-red-600">{hint}</p>}
      {(error.message || error.code) && (
        <p className="mt-2 rounded bg-red-100 px-2 py-1 font-mono text-xs text-red-600" dir="ltr">
          {error.code ? `[${error.code}] ` : ""}
          {error.message}
        </p>
      )}
    </div>
  );
}
