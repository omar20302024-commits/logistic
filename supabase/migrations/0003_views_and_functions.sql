-- ============================================================================
-- Views و RPC Functions للتقارير المالية
-- المبدأ: كل تجميع/حساب يتم داخل Postgres، الواجهة تعرض فقط ما يصلها جاهزاً.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) v_trip_location_totals — إجمالي مواقع كل رحلة (تحميل/تنزيل، عدد ومبلغ)
-- ----------------------------------------------------------------------------
create or replace view v_trip_location_totals
  with (security_invoker = true) as
select
  trip_id,
  count(*) filter (where location_type = 'loading')  as loading_count,
  coalesce(sum(amount) filter (where location_type = 'loading'), 0)   as loading_total,
  count(*) filter (where location_type = 'unloading') as unloading_count,
  coalesce(sum(amount) filter (where location_type = 'unloading'), 0) as unloading_total,
  bool_or(amount_status = 'temporary') as has_temporary_amounts
from trip_locations
group by trip_id;

-- ----------------------------------------------------------------------------
-- 2) v_trips_full — رحلة + اسم السائق + اسم الشركة + إجماليات المواقع
--    (يُستخدم في الكشف الداخلي وتقارير الربحية فقط، ليس في كشف السائق)
-- ----------------------------------------------------------------------------
create or replace view v_trips_full
  with (security_invoker = true) as
select
  t.*,
  d.name as driver_name,
  c.name as company_name,
  coalesce(l.loading_count, 0)    as loading_count,
  coalesce(l.loading_total, 0)    as loading_total,
  coalesce(l.unloading_count, 0)  as unloading_count,
  coalesce(l.unloading_total, 0)  as unloading_total,
  coalesce(l.has_temporary_amounts, false) as has_temporary_amounts
from trips t
join drivers d   on d.id = t.driver_id
join companies c on c.id = t.company_id
left join v_trip_location_totals l on l.trip_id = t.id;

-- ----------------------------------------------------------------------------
-- 3) دالة مساعدة: هل نحتسب الرحلات الملغاة في الأرباح؟ (تقرأ من settings)
-- ----------------------------------------------------------------------------
create or replace function should_count_cancelled()
returns boolean
language sql stable
as $$
  select count_cancelled_trips_in_profit from settings where id = true;
$$;

-- ----------------------------------------------------------------------------
-- 4) fn_driver_period_summary — ملخص مالي لسائق خلال فترة (للـ Dashboard/كشف الحساب)
-- ----------------------------------------------------------------------------
create or replace function fn_driver_period_summary(
  p_driver_id uuid,
  p_from date,
  p_to   date
)
returns table (
  trips_count            bigint,
  total_trip_amount      numeric,
  total_driver_payment   numeric,
  total_diesel           numeric,
  operating_profit       numeric,
  total_advances         numeric,
  total_deductions       numeric,
  salary_basic           numeric,
  net_salary             numeric,
  total_due_to_driver    numeric
)
language sql stable
as $$
  with trip_agg as (
    select
      count(*)                              as trips_count,
      coalesce(sum(trip_amount), 0)          as total_trip_amount,
      coalesce(sum(driver_trip_payment), 0)  as total_driver_payment,
      coalesce(sum(diesel_amount), 0)        as total_diesel,
      coalesce(sum(trip_profit), 0)          as operating_profit
    from trips
    where driver_id = p_driver_id
      and trip_date between p_from and p_to
      and (status <> 'cancelled' or should_count_cancelled())
  ),
  adv_agg as (
    select coalesce(sum(amount), 0) as total_advances
    from driver_advances
    where driver_id = p_driver_id and date between p_from and p_to
  ),
  ded_agg as (
    select coalesce(sum(amount), 0) as total_deductions
    from driver_deductions
    where driver_id = p_driver_id and date between p_from and p_to
  ),
  sal_agg as (
    -- الرواتب التي يتقاطع شهرها مع الفترة المطلوبة
    select coalesce(sum(basic_salary), 0) as salary_basic
    from salaries
    where driver_id = p_driver_id
      and make_date(year, month, 1) <= p_to
      and (make_date(year, month, 1) + interval '1 month' - interval '1 day') >= p_from
  )
  select
    trip_agg.trips_count,
    trip_agg.total_trip_amount,
    trip_agg.total_driver_payment,
    trip_agg.total_diesel,
    trip_agg.operating_profit,
    adv_agg.total_advances,
    ded_agg.total_deductions,
    sal_agg.salary_basic,
    (sal_agg.salary_basic - ded_agg.total_deductions - adv_agg.total_advances) as net_salary,
    (trip_agg.total_driver_payment
      + (sal_agg.salary_basic - ded_agg.total_deductions - adv_agg.total_advances)) as total_due_to_driver
  from trip_agg, adv_agg, ded_agg, sal_agg;
$$;

-- ----------------------------------------------------------------------------
-- 5) fn_driver_internal_trips — سطور الرحلات الكاملة (سري، للكشف الداخلي فقط)
-- ----------------------------------------------------------------------------
create or replace function fn_driver_internal_trips(
  p_driver_id uuid,
  p_from date,
  p_to   date
)
returns setof v_trips_full
language sql stable
as $$
  select * from v_trips_full
  where driver_id = p_driver_id
    and trip_date between p_from and p_to
    and (status <> 'cancelled' or should_count_cancelled())
  order by trip_date;
$$;

-- ----------------------------------------------------------------------------
-- 6) fn_driver_public_trips — سطور الرحلات لكشف السائق فقط
--    ملاحظة أمان: لا تُرجع trip_amount ولا trip_profit إطلاقاً، حتى على مستوى SQL.
-- ----------------------------------------------------------------------------
create or replace function fn_driver_public_trips(
  p_driver_id uuid,
  p_from date,
  p_to   date
)
returns table (
  trip_date        date,
  trip_number      text,
  company_name     text,
  from_location    text,
  to_location      text,
  loading_count    bigint,
  unloading_count  bigint,
  driver_trip_payment numeric
)
language sql stable
as $$
  select
    trip_date, trip_number, company_name, from_location, to_location,
    loading_count, unloading_count, driver_trip_payment
  from v_trips_full
  where driver_id = p_driver_id
    and trip_date between p_from and p_to
    and (status <> 'cancelled' or should_count_cancelled())
  order by trip_date;
$$;

-- ----------------------------------------------------------------------------
-- 7) fn_company_period_summary — ملخص شركة خلال فترة
-- ----------------------------------------------------------------------------
create or replace function fn_company_period_summary(
  p_company_id uuid,
  p_from date,
  p_to   date
)
returns table (
  trips_count           bigint,
  total_trip_amount     numeric,
  total_driver_payment  numeric,
  total_diesel          numeric,
  operating_profit      numeric,
  avg_trip_profit       numeric,
  drivers_involved      bigint
)
language sql stable
as $$
  select
    count(*),
    coalesce(sum(trip_amount), 0),
    coalesce(sum(driver_trip_payment), 0),
    coalesce(sum(diesel_amount), 0),
    coalesce(sum(trip_profit), 0),
    coalesce(avg(trip_profit), 0),
    count(distinct driver_id)
  from trips
  where company_id = p_company_id
    and trip_date between p_from and p_to
    and (status <> 'cancelled' or should_count_cancelled());
$$;

-- ----------------------------------------------------------------------------
-- 8) fn_financial_summary — التقرير المالي الشامل خلال فترة
-- ----------------------------------------------------------------------------
create or replace function fn_financial_summary(
  p_from date,
  p_to   date
)
returns table (
  total_revenue       numeric,  -- إجمالي قيمة الرحلات
  total_driver_payments numeric,-- إجمالي التربات
  total_diesel         numeric,
  operating_profit     numeric, -- الإيرادات - التربات - الديزل
  total_salaries        numeric,
  total_other_expenses  numeric,
  net_profit            numeric -- الربح التشغيلي - الرواتب - المصروفات الأخرى
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
    select coalesce(sum(basic_salary), 0) as total_salaries
    from salaries
    where make_date(year, month, 1) <= p_to
      and (make_date(year, month, 1) + interval '1 month' - interval '1 day') >= p_from
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
    exp_agg.total_other_expenses,
    (trip_agg.operating_profit - sal_agg.total_salaries - exp_agg.total_other_expenses) as net_profit
  from trip_agg, sal_agg, exp_agg;
$$;
