-- ============================================================================
-- 0032 — إضافة الراتب لرابط كشف السائق العام
-- ============================================================================
--
-- 🔒 إضافي بالكامل: توسيع أعمدة دالة واحدة. لا delete ولا truncate ولا
--    drop table. البيانات المسجَّلة لا تُمس.
--
-- المطلوب: الرابط يعرض الراتب مع الرحلات والترب.
--
-- 🔒 لا يخالف قاعدتَي #3 و#11: الممنوع في كشف السائق هو **سعر الرحلة والربح
--    والديزل** — بيانات الشركة السرّية. الراتب بيانات السائق نفسه ومن حقه
--    يشوفها. والأعمدة الجديدة كلها تأتي من fn_driver_public_summary التي لا
--    تُرجع أياً من الثلاثة أصلاً، فالضمان قائم كما هو.
--
-- ⚠️ لماذا drop قبل create:
--    CREATE OR REPLACE مايقدرش يغيّر مجموعة أعمدة returns table. ولأن الـ drop
--    بيسقّط الصلاحيات معه، لازم **إعادة grant لـ anon** في آخر الملف — من غيرها
--    الرابط العام هيقف تماماً بخطأ صلاحيات.
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

drop function if exists fn_statement_by_token(text);

create or replace function fn_statement_by_token(p_token text)
returns table (
  driver_name          text,
  driver_phone         text,
  from_date            date,
  to_date              date,
  org_name             text,
  org_phone            text,
  currency_symbol      text,
  reviewed_by          text,
  trips_count          bigint,
  total_driver_payment numeric,
  total_advances       numeric,
  total_deductions     numeric,
  custody_balance      numeric,
  driver_paid_expenses numeric,
  -- الجديد: الراتب
  salary_basic         numeric,
  salary_earned        numeric,
  pre_hire_days        int,
  leave_days           int,
  worked_days          int,
  net_salary           numeric,
  total_due_to_driver  numeric
)
language sql
stable
security definer
set search_path = public
as $fn$
  with d as (
    select
      id, name, phone,
      make_date(
        coalesce(statement_year,  extract(year  from current_date)::int),
        coalesce(statement_month, extract(month from current_date)::int),
        1
      ) as f
    from drivers
    where public_token = p_token
      and public_link_enabled
      and p_token is not null
      and length(p_token) >= 20
  ),
  p as (
    select id, name, phone, f as from_date,
           (f + interval '1 month' - interval '1 day')::date as to_date
    from d
  )
  select
    p.name, p.phone, p.from_date, p.to_date,
    s.org_name, s.org_phone, s.currency_symbol, s.reviewed_by,
    sm.trips_count, sm.total_driver_payment, sm.total_advances,
    sm.total_deductions, sm.custody_balance, sm.driver_paid_expenses,
    sm.salary_basic, sm.salary_earned, sm.pre_hire_days, sm.leave_days,
    sm.worked_days, sm.net_salary, sm.total_due_to_driver
  from p
  cross join (select * from settings where id = true) s
  cross join lateral fn_driver_public_summary(p.id, p.from_date, p.to_date) sm;
$fn$;

-- ⚠️ إجباري بعد الـ drop أعلاه — بدونه الرابط يقف.
grant execute on function fn_statement_by_token(text) to anon;
