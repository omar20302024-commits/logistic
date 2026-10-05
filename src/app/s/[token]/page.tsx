import { createClient } from "@/lib/supabase/server";
import { DriverStatementView } from "@/components/statement/DriverStatementView";
import { PrintClientButton } from "@/components/statement/PrintClientButton";
import { ReviewedByFooter } from "@/components/ui/ReviewedByFooter";

// ============================================================================
// رابط كشف السائق العام — قراءة فقط، بدون تسجيل دخول
// ============================================================================
//
// ⚠️ هذا هو المسار الوحيد في النظام الذي يُفتح بلا جلسة. قواعده:
//
// 1) لا يقرأ أي جدول إطلاقاً. ثلاث دوال security definer بالرمز فقط (0031).
//    دور anon لا يملك أي صلاحية على drivers أو trips أو settings.
// 2) قراءة فقط ببنية النظام لا بإخفاء الأزرار: لا نموذج ولا Server Action هنا،
//    والدوال الثلاث stable فلا تكتب شيئاً بحكم تعريفها في بوستجرس.
// 3) 🚫 ممنوع أي مورد خارجي في هذه الصفحة (صورة/خط/سكربت من نطاق آخر) — الرمز
//    في الـ URL وكان هيتسرّب في ترويسة Referer. خط Cairo يأتي من next/font
//    وهو مستضاف ذاتياً وقت البناء، فلا طلب خارجي منه.
// 4) 🔒 لا بيانات سرّية: الدوال مبنية على fn_driver_public_* التي لا تُرجع سعر
//    رحلة ولا ربحاً ولا ديزل (قاعدتا #3 و#11).
//
// الراتب معروض هنا عن قصد: الممنوع هو بيانات الشركة السرّية (سعر الرحلة والربح
// والديزل)، أما الراتب فبيانات السائق نفسه ومن حقه يشوفها.
//
// ملاحظة: نوع DriverStatementView نفسه لا يقبل الحقول السرّية، فحتى لو حاول أحد
// تمريرها مستقبلاً لن تمر من فحص الأنواع.

export const dynamic = "force-dynamic";

type TokenSummary = {
  driver_name: string;
  driver_phone: string | null;
  from_date: string;
  to_date: string;
  org_name: string;
  org_phone: string | null;
  currency_symbol: string;
  reviewed_by: string | null;
  trips_count: number;
  total_driver_payment: number;
  total_advances: number;
  total_deductions: number;
  custody_balance: number;
  driver_paid_expenses: number;
  salary_basic: number;
  salary_earned: number;
  pre_hire_days: number;
  leave_days: number;
  worked_days: number;
  net_salary: number;
  total_due_to_driver: number;
};

export default async function PublicDriverStatementPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const [{ data: summaryRows }, { data: trips }, { data: expenses }] = await Promise.all([
    supabase.rpc("fn_statement_by_token", { p_token: token }),
    supabase.rpc("fn_statement_trips_by_token", { p_token: token }),
    supabase.rpc("fn_statement_expenses_by_token", { p_token: token }),
  ]);

  const summary = (summaryRows as TokenSummary[] | null)?.[0];

  // رمز خاطئ، ورابط موقوف، وسائق محذوف — كلها تعطي نفس الرسالة بالضبط.
  // التمييز بينها كان هيحوّل الصفحة لأداة تخمين تكشف الرمز الصحيح.
  //
  // وكذلك لو كانت أعمدة الراتب ناقصة — يعني 0032 لسه ما اتشغّلش بينما الكود
  // اتنشر. الأحسن نقول «غير متاح» على أن نطبع للسائق مستنداً مالياً براتب صفر
  // أو NaN. الفشل هنا مقفول لا مفتوح.
  const salaryMissing = summary !== undefined && typeof summary.salary_basic !== "number";

  if (!summary || salaryMissing) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
        <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <h1 className="mb-2 text-lg font-bold text-zinc-900">هذا الرابط غير متاح حالياً</h1>
          <p className="text-sm text-zinc-500">
            قد يكون الرابط موقوفاً أو تم تغييره. راجع الإدارة للحصول على رابط جديد.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 sm:p-6">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-lg font-bold text-zinc-900">كشف حساب السائق</h1>
          <p className="text-sm text-zinc-500">
            {summary.driver_name} — من {summary.from_date} إلى {summary.to_date}
          </p>
        </div>
        <PrintClientButton />
      </div>

      <DriverStatementView
        orgName={summary.org_name}
        orgPhone={summary.org_phone}
        driverName={summary.driver_name}
        driverPhone={summary.driver_phone}
        from={summary.from_date}
        to={summary.to_date}
        trips={trips ?? []}
        summary={{
          trips_count: summary.trips_count,
          total_driver_payment: summary.total_driver_payment,
          total_advances: summary.total_advances,
          total_deductions: summary.total_deductions,
          salary_basic: summary.salary_basic,
          salary_earned: summary.salary_earned,
          pre_hire_days: summary.pre_hire_days,
          leave_days: summary.leave_days,
          worked_days: summary.worked_days,
          net_salary: summary.net_salary,
          custody_balance: summary.custody_balance,
          driver_paid_expenses: summary.driver_paid_expenses,
          total_due_to_driver: summary.total_due_to_driver,
        }}
        expenses={expenses ?? []}
        currencySymbol={summary.currency_symbol}
      />

      <ReviewedByFooter name={summary.reviewed_by} />
    </main>
  );
}
