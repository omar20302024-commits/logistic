-- ============================================================================
-- 0017 — دوال الربح تستخدم الراتب المستحق بدل الراتب التعاقدي
-- ============================================================================
--
-- عيب أُدخل في 0015/0016: الراتب بقى يتحسب بأيام العمل (إجازة + تاريخ تعيين)،
-- لكن التمرير ده ما وصلش لدوال الربح. النتيجة إن كل شاشة بتقول رقم مختلف:
--
--   fn_driver_period_summary  → المستحق ✅   (كشف السائق)
--   v_salary_statements       → المستحق ✅   (شاشة الرواتب)
--   fn_financial_summary      → التعاقدي ❌  (صافي الربح)
--   fn_dashboard_overview     → التعاقدي ❌  (لوحة التحكم)
--   fn_drivers_report         → التعاقدي ❌  (تقرير السائقين)
--
-- سائق راتبه 3000 وفي إجازة 20 يوماً: تكلفته الحقيقية 1000، لكن الربح كان
-- بيخصم 3000 — فالربح بيظهر أقل مما هو، والفرق بيكبر كل ما الإجازات تزيد.
--
-- الإصلاح: الدوال التلاتة تستدعي fn_driver_earned_salary — نفس الدالة اللي
-- بيستدعيها كشف السائق وشاشة الرواتب، فمستحيل الأرقام تفترق تاني.
--
-- ملاحظة: `salaries.basic_salary` يفضل زي ما هو (الراتب التعاقدي كامل الشهر).
-- الخصم بأيام العمل بيحصل وقت القراءة، مش بتعديل البيانات المخزَّنة.
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 1) التقرير المالي — صافي الربح
-- ----------------------------------------------------------------------------
create or replace function fn_financial_summary(
  p_from date,
  p_to   date
)
returns table (
  total_revenue           numeric,
  total_driver_payments   numeric,
  total_diesel            numeric,
  operating_profit        numeric,
  total_salaries          numeric,  -- المستحق بأيام العمل، مش التعاقدي
  total_driver_expenses   numeric,
  total_other_expenses    numeric,
  net_profit              numeric
)
language sql stable
as $$
  with trip_agg as (
    select
      coalesce(sum(trip_amount), 0)         as total_revenue,
      coalesce(sum(driver_trip_payment), 0) as total_driver_payments,
      coalesce(sum(diesel_amount), 0)       as total_diesel,
      coalesce(sum(trip_profit), 0)         as operating_profit
    from trips
    where trip_date between p_from and p_to
      and (status <> 'cancelled' or should_count_cancelled())
  ),
  sal_agg as (
    select coalesce(sum(
      fn_driver_earned_salary(driver_id, year, month, basic_salary)
    ), 0) as total_salaries
    from salaries
    where make_date(year, month, 1) <= p_to
      and (make_date(year, month, 1) + interval '1 month' - interval '1 day') >= p_from
  ),
  drv_exp as (
    select fn_driver_paid_expenses(p_from, p_to) as total_driver_expenses
  ),
  exp_agg as (
    select coalesce(sum(amount), 0) as total_other_expenses
    from expenses
    where date between p_from and p_to
  )
  select
    trip_agg.total_revenue,
    trip_agg.total_driver_payments,
    trip_agg.total_diesel,
    trip_agg.operating_profit,
    sal_agg.total_salaries,
    drv_exp.total_driver_expenses,
    exp_agg.total_other_expenses,
    (trip_agg.operating_profit
      - sal_agg.total_salaries
      - drv_exp.total_driver_expenses
      - exp_agg.total_other_expenses) as net_profit
  from trip_agg, sal_agg, drv_exp, exp_agg;
$$;

-- ----------------------------------------------------------------------------
-- 2) لوحة التحكم
-- ----------------------------------------------------------------------------
create or replace function fn_dashboard_overview()
returns table (
  drivers_count          bigint,
  active_drivers_count   bigint,
  companies_count        bigint,
  trips_count            bigint,
  total_trip_amount      numeric,
  total_driver_payments  numeric,
  total_diesel           numeric,
  operating_profit       numeric,
  total_salaries         numeric,
  total_deductions       numeric,
  total_advances         numeric,
  total_other_expenses   numeric,
  net_profit             numeric
)
language sql stable
as $$
  with d as (
    select
      count(*) as drivers_count,
      count(*) filter (where status = 'active') as active_drivers_count
    from drivers
  ),
  c as (
    select count(*) as companies_count from companies
  ),
  t as (
    select
      count(*) as trips_count,
      coalesce(sum(trip_amount), 0)         as total_trip_amount,
      coalesce(sum(driver_trip_payment), 0) as total_driver_payments,
      coalesce(sum(diesel_amount), 0)       as total_diesel,
      coalesce(sum(trip_profit), 0)         as operating_profit
    from trips
    where (status <> 'cancelled' or should_count_cancelled())
  ),
  sal as (
    select coalesce(sum(
      fn_driver_earned_salary(driver_id, year, month, basic_salary)
    ), 0) as total_salaries
    from salaries
  ),
  ded as (select coalesce(sum(amount), 0) as total_deductions from driver_deductions),
  adv as (select coalesce(sum(amount), 0) as total_advances from driver_advances),
  exp as (select coalesce(sum(amount), 0) as total_other_expenses from expenses)
  select
    d.drivers_count, d.active_drivers_count, c.companies_count,
    t.trips_count, t.total_trip_amount, t.total_driver_payments, t.total_diesel, t.operating_profit,
    sal.total_salaries, ded.total_deductions, adv.total_advances, exp.total_other_expenses,
    (t.operating_profit - sal.total_salaries - exp.total_other_expenses) as net_profit
  from d, c, t, sal, ded, adv, exp;
$$;

-- ----------------------------------------------------------------------------
-- 3) تقرير السائقين
--    العمود اتسمى salary_earned بدل salary_basic — الاسم القديم بقى كذب على
--    القارئ بعد ما المحتوى بقى المستحق مش التعاقدي.
--    (drop لازم: تغيير اسم عمود في returns table مش بيمشي مع create or replace)
-- ----------------------------------------------------------------------------
drop function if exists fn_drivers_report(date, date);

create or replace function fn_drivers_report(p_from date, p_to date)
returns table (
  driver_id             uuid,
  driver_name           text,
  driver_status         driver_status,
  trips_count           bigint,
  total_trip_amount     numeric,
  total_driver_payment  numeric,
  total_diesel          numeric,
  operating_profit      numeric,
  salary_earned         numeric,
  net_profit            numeric
)
language sql stable
as $$
  select
    d.id, d.name, d.status,
    coalesce(t.trips_count, 0),
    coalesce(t.total_trip_amount, 0),
    coalesce(t.total_driver_payment, 0),
    coalesce(t.total_diesel, 0),
    coalesce(t.operating_profit, 0),
    coalesce(s.salary_earned, 0),
    coalesce(t.operating_profit, 0) - coalesce(s.salary_earned, 0)
  from drivers d
  left join lateral (
    select
      count(*) as trips_count,
      sum(trip_amount) as total_trip_amount,
      sum(driver_trip_payment) as total_driver_payment,
      sum(diesel_amount) as total_diesel,
      sum(trip_profit) as operating_profit
    from trips tr
    where tr.driver_id = d.id
      and tr.trip_date between p_from and p_to
      and (tr.status <> 'cancelled' or should_count_cancelled())
  ) t on true
  left join lateral (
    select sum(
      fn_driver_earned_salary(sal.driver_id, sal.year, sal.month, sal.basic_salary)
    ) as salary_earned
    from salaries sal
    where sal.driver_id = d.id
      and make_date(sal.year, sal.month, 1) <= p_to
      and (make_date(sal.year, sal.month, 1) + interval '1 month' - interval '1 day')::date >= p_from
  ) s on true
  order by d.name;
$$;
