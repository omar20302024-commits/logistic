-- ============================================================================
-- 0018 — اكتمال معادلة الربح: عقود الإيجار + مصروفات السائقين في كل الشاشات
-- ============================================================================
--
-- عيبان اتكشفوا في مراجعة محاسبية:
--
-- 1) عقود الإيجار الشهري كانت خارج صافي الربح تماماً منذ 0008.
--    `rental_contracts.monthly_amount` (إيراد) و`diesel_amount` (تكلفة)
--    و`housing_units.monthly_rent` (تكلفة) كانوا بيظهروا في
--    `fn_rental_contracts_report` بس، ومايدخلوش المعادلة إطلاقاً.
--    **خط نشاط كامل بإيراداته وتكاليفه بره الربح.**
--
-- 2) `fn_dashboard_overview` ما كانتش بتخصم مصروفات السائقين اللي اتضافت في
--    0012 لـ `fn_financial_summary` وحدها — فالشاشتان كانتا بتقولا رقمين
--    مختلفين لصافي الربح.
--
-- ملاحظة حاسمة على عدم الازدواج: سائقو عقود الإيجار **ما بتتسجلش لهم رحلات**
-- في جدول trips (مؤكَّد من المستخدم). فإضافة monthly_amount كإيراد مش بتكرر
-- أي إيراد رحلات. وبالمثل، رواتبهم محسوبة أصلاً ضمن sal_agg (اللي بيجمع كل
-- صفوف salaries)، فما بتتضافش تاني هنا.
--
-- تكلفة السكن: وحدة السكن بتتحسب مرة واحدة عن كل شهر فيه عقد واحد على الأقل
-- بيستخدمها — نفس منطق التقسيم اللي في fn_rental_contracts_report بالظبط،
-- عشان ما يبقاش فيه رقمين مختلفين لنفس التكلفة.
--   ⚠️ وحدة سكن مفيهاش أي عقد في شهر معيّن ما بتتحسبش. لو بتدفع إيجارها وهي
--   فاضية، سجّله في `expenses` — دي بتدخل الربح.
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 1) إجماليات عقود الإيجار خلال فترة — المصدر الوحيد لهذه الأرقام
-- ----------------------------------------------------------------------------
create or replace function fn_rental_period_totals(p_from date, p_to date)
returns table (
  rental_revenue  numeric,
  rental_diesel   numeric,
  housing_cost    numeric
)
language sql stable
as $$
  with in_period as (
    select rc.*
    from rental_contracts rc
    where make_date(rc.year, rc.month, 1) <= p_to
      and (make_date(rc.year, rc.month, 1) + interval '1 month' - interval '1 day')::date >= p_from
  ),
  -- الوحدة تتحسب مرة واحدة عن كل شهر استُخدمت فيه، مهما كان عدد العقود
  used_units as (
    select distinct housing_unit_id, month, year
    from in_period
    where housing_unit_id is not null
  )
  select
    coalesce((select sum(monthly_amount) from in_period), 0) as rental_revenue,
    coalesce((select sum(diesel_amount)  from in_period), 0) as rental_diesel,
    coalesce((
      select sum(hu.monthly_rent)
      from used_units u
      join housing_units hu on hu.id = u.housing_unit_id
    ), 0) as housing_cost;
$$;

-- ----------------------------------------------------------------------------
-- 2) التقرير المالي الشامل
-- ----------------------------------------------------------------------------
drop function if exists fn_financial_summary(date, date);

create or replace function fn_financial_summary(
  p_from date,
  p_to   date
)
returns table (
  total_revenue           numeric,  -- قيمة الرحلات
  total_driver_payments   numeric,
  total_diesel            numeric,  -- ديزل الرحلات
  total_rental_revenue    numeric,  -- إيراد عقود الإيجار الشهري
  total_rental_diesel     numeric,  -- ديزل عقود الإيجار
  operating_profit        numeric,
  total_salaries          numeric,  -- المستحق بأيام العمل
  total_driver_expenses   numeric,
  total_housing_cost      numeric,
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
  rent_agg as (
    select * from fn_rental_period_totals(p_from, p_to)
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
    rent_agg.rental_revenue,
    rent_agg.rental_diesel,
    -- الربح التشغيلي = ربح الرحلات + (إيراد العقود − ديزلها)
    (trip_agg.operating_profit + rent_agg.rental_revenue - rent_agg.rental_diesel)
      as operating_profit,
    sal_agg.total_salaries,
    drv_exp.total_driver_expenses,
    rent_agg.housing_cost,
    exp_agg.total_other_expenses,
    (trip_agg.operating_profit + rent_agg.rental_revenue - rent_agg.rental_diesel
      - sal_agg.total_salaries
      - drv_exp.total_driver_expenses
      - rent_agg.housing_cost
      - exp_agg.total_other_expenses) as net_profit
  from trip_agg, rent_agg, sal_agg, drv_exp, exp_agg;
$$;

-- ----------------------------------------------------------------------------
-- 3) لوحة التحكم — نفس البنود بالظبط، عشان الشاشتين ما يفترقوش تاني
--    (كل الأوقات، فالفترة من 2000 لبكرة)
-- ----------------------------------------------------------------------------
drop function if exists fn_dashboard_overview();

create or replace function fn_dashboard_overview()
returns table (
  drivers_count          bigint,
  active_drivers_count   bigint,
  companies_count        bigint,
  trips_count            bigint,
  total_trip_amount      numeric,
  total_driver_payments  numeric,
  total_diesel           numeric,
  total_rental_revenue   numeric,
  total_rental_diesel    numeric,
  operating_profit       numeric,
  total_salaries         numeric,
  total_deductions       numeric,
  total_advances         numeric,
  total_driver_expenses  numeric,
  total_housing_cost     numeric,
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
  rent as (
    select * from fn_rental_period_totals(date '2000-01-01', date '2100-12-31')
  ),
  sal as (
    select coalesce(sum(
      fn_driver_earned_salary(driver_id, year, month, basic_salary)
    ), 0) as total_salaries
    from salaries
  ),
  ded as (select coalesce(sum(amount), 0) as total_deductions from driver_deductions),
  adv as (select coalesce(sum(amount), 0) as total_advances from driver_advances),
  drv_exp as (
    select coalesce(sum(amount), 0) as total_driver_expenses
    from driver_custody_entries
    where reason = 'work_expense'
  ),
  exp as (select coalesce(sum(amount), 0) as total_other_expenses from expenses)
  select
    d.drivers_count, d.active_drivers_count, c.companies_count,
    t.trips_count, t.total_trip_amount, t.total_driver_payments, t.total_diesel,
    rent.rental_revenue, rent.rental_diesel,
    (t.operating_profit + rent.rental_revenue - rent.rental_diesel) as operating_profit,
    sal.total_salaries, ded.total_deductions, adv.total_advances,
    drv_exp.total_driver_expenses, rent.housing_cost, exp.total_other_expenses,
    (t.operating_profit + rent.rental_revenue - rent.rental_diesel
      - sal.total_salaries
      - drv_exp.total_driver_expenses
      - rent.housing_cost
      - exp.total_other_expenses) as net_profit
  from d, c, t, rent, sal, ded, adv, drv_exp, exp;
$$;
