-- ============================================================================
-- دوال تحليلات لوحة التحكم (Phase 5)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) fn_dashboard_overview — كل بطاقات الإحصائيات الرئيسية (إجمالي كل الأوقات)
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
  sal as (select coalesce(sum(basic_salary), 0) as total_salaries from salaries),
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
-- 2) fn_monthly_trends — سلسلة زمنية شهرية للرسوم البيانية (آخر N شهر، افتراضياً 12)
--    يشمل الأشهر بدون رحلات كصفوف بقيمة صفر (حتى لا ينكسر الرسم البياني)
-- ----------------------------------------------------------------------------
create or replace function fn_monthly_trends(p_months int default 12)
returns table (
  month_start            date,
  trips_count            bigint,
  total_trip_amount      numeric,
  total_driver_payments  numeric,
  total_diesel           numeric,
  operating_profit       numeric
)
language sql stable
as $$
  with months as (
    select generate_series(
      date_trunc('month', current_date) - ((p_months - 1) || ' month')::interval,
      date_trunc('month', current_date),
      '1 month'::interval
    )::date as month_start
  )
  select
    m.month_start,
    coalesce(count(t.id), 0)                        as trips_count,
    coalesce(sum(t.trip_amount), 0)                 as total_trip_amount,
    coalesce(sum(t.driver_trip_payment), 0)         as total_driver_payments,
    coalesce(sum(t.diesel_amount), 0)               as total_diesel,
    coalesce(sum(t.trip_profit), 0)                 as operating_profit
  from months m
  left join trips t
    on date_trunc('month', t.trip_date)::date = m.month_start
    and (t.status <> 'cancelled' or should_count_cancelled())
  group by m.month_start
  order by m.month_start;
$$;

-- ----------------------------------------------------------------------------
-- 3) fn_top_drivers_profitability — أعلى السائقين ربحية خلال فترة
-- ----------------------------------------------------------------------------
create or replace function fn_top_drivers_profitability(
  p_from date,
  p_to   date,
  p_limit int default 10
)
returns table (
  driver_id         uuid,
  driver_name       text,
  trips_count       bigint,
  operating_profit  numeric
)
language sql stable
as $$
  select
    d.id,
    d.name,
    count(t.id),
    coalesce(sum(t.trip_profit), 0)
  from drivers d
  join trips t
    on t.driver_id = d.id
    and t.trip_date between p_from and p_to
    and (t.status <> 'cancelled' or should_count_cancelled())
  group by d.id, d.name
  order by coalesce(sum(t.trip_profit), 0) desc
  limit p_limit;
$$;

-- ----------------------------------------------------------------------------
-- 4) fn_top_companies_profitability — أعلى الشركات ربحية خلال فترة
-- ----------------------------------------------------------------------------
create or replace function fn_top_companies_profitability(
  p_from date,
  p_to   date,
  p_limit int default 10
)
returns table (
  company_id        uuid,
  company_name      text,
  trips_count       bigint,
  operating_profit  numeric
)
language sql stable
as $$
  select
    c.id,
    c.name,
    count(t.id),
    coalesce(sum(t.trip_profit), 0)
  from companies c
  join trips t
    on t.company_id = c.id
    and t.trip_date between p_from and p_to
    and (t.status <> 'cancelled' or should_count_cancelled())
  group by c.id, c.name
  order by coalesce(sum(t.trip_profit), 0) desc
  limit p_limit;
$$;
