-- ============================================================================
-- 0049 — رابط السائق: الرحلات غير المصفّاة فقط
-- ============================================================================
--
-- 🔒 دالتان تُستبدَلان بنفس توقيعهما. لا جدول يُمَس، ولا عمود، ولا بيانات.
--
-- المشكلة: الرابط يعرض كل رحلات الشهر — ومنها ما صُرف بسند تصفية. فيظن
-- السائق أن له مالاً قبضه، ويطالب بما أُخذ.
--
-- ⚠️ الاتساق هو بيت القصيد
--
-- «إجمالي المستحق» في الكشف يحسبه fn_driver_period_summary من unsettled_trabs
-- أصلاً — أي أنه **لا يشمل المصفّى منذ البداية**. فالخلل كان في الجدول وعدّاده
-- وحدهما: قائمة بعشرين رحلة ومستحقٌّ لثمانٍ.
--
-- فنُخفي المصفّى من ثلاثة مواضع معاً — الجدول، و«عدد الرحلات»، و«إجمالي
-- الترب» — ليصير مجموع الجدول مطابقاً للسطر الأخير تماماً.
--
-- 🔑 الشرط هو settlement_id is null بالضبط، وهو نفس شرط unsettled_trabs في
--    fn_driver_period_summary. أي شرط أوسع (مثل ضمّ vendor_settlement_id)
--    كان سيُخرج رحلةً من الجدول وتبقى في المستحق — وهو الخلل نفسه معكوساً.
--
-- 🔐 الصلاحيات: التوقيع لم يتغيّر فلا drop، و create or replace يُبقي المنح.
--    ومع ذلك نعيد المنح صراحةً — فالرابط يقف بدونها، والسطر لا يضرّ.
--
-- الدوال الإدارية (fn_driver_public_trips و fn_driver_public_summary) لم
-- تُمَس: صفحات /statement للمسؤول تبقى تعرض كل شيء كما هي.
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 1) جدول الرحلات في الرابط — غير المصفّى فقط
-- ----------------------------------------------------------------------------
create or replace function fn_statement_trips_by_token(p_token text)
returns table (
  trip_date            date,
  trip_number          text,
  company_name         text,
  from_location        text,
  to_location          text,
  branches_count       int,
  extra_loading_points int,
  driver_base_payment  numeric,
  driver_trip_payment  numeric
)
language sql
stable
security definer
set search_path = public
as $fn$
  with d as (
    select
      id,
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
    select id, f as from_date, (f + interval '1 month' - interval '1 day')::date as to_date
    from d
  )
  -- لا نمرّ بـ fn_driver_public_trips: هي للمسؤول وتعرض الكل عن قصد.
  -- والأعمدة هنا نسخة منها حرفياً — لا سعر رحلة ولا ربح ولا ديزل (#3 و#11).
  select
    t.trip_date,
    t.trip_number,
    c.name,
    t.from_location,
    t.to_location,
    t.branches_count,
    fn_extra_loading_points(t.from_location),
    t.driver_base_payment,
    t.driver_trip_payment
  from p
  join trips t on t.driver_id = p.id
   and t.trip_date between p.from_date and p.to_date
  join companies c on c.id = t.company_id
  where t.settlement_id is null
    and (t.status <> 'cancelled' or should_count_cancelled())
  order by t.trip_date;
$fn$;

-- ----------------------------------------------------------------------------
-- 2) ترويسة الكشف — العدّاد وإجمالي الترب على نفس الأساس
--
-- باقي الأرقام (الراتب والسلف والعهدة والمستحق) تبقى من دالة الملخص كما هي.
-- ----------------------------------------------------------------------------
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
    -- غير المصفّى وحده، ليطابق الجدول أعلاه والمستحق أدناه
    open_t.trips_count,
    open_t.total_driver_payment,
    sm.total_advances,
    sm.total_deductions, sm.custody_balance, sm.driver_paid_expenses,
    sm.salary_basic, sm.salary_earned, sm.pre_hire_days, sm.leave_days,
    sm.worked_days, sm.net_salary, sm.total_due_to_driver
  from p
  cross join (select * from settings where id = true) s
  cross join lateral fn_driver_public_summary(p.id, p.from_date, p.to_date) sm
  cross join lateral (
    select
      count(*)                                      as trips_count,
      coalesce(sum(t.driver_trip_payment), 0)       as total_driver_payment
    from trips t
    where t.driver_id = p.id
      and t.trip_date between p.from_date and p.to_date
      and t.settlement_id is null
      and (t.status <> 'cancelled' or should_count_cancelled())
  ) open_t;
$fn$;

-- ⚠️ المنح باقية بعد create or replace، ونعيدها احتياطاً — الرابط يقف بدونها
grant execute on function fn_statement_by_token(text)       to anon;
grant execute on function fn_statement_trips_by_token(text) to anon;

notify pgrst, 'reload schema';
