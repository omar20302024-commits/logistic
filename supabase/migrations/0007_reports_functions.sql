-- ============================================================================
-- Phase 14-17: دوال التقارير
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) fn_drivers_report — تقرير السائقين (كل السائقين حتى بدون رحلات في الفترة)
-- ----------------------------------------------------------------------------
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
  salary_basic          numeric,
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
    coalesce(s.salary_basic, 0),
    coalesce(t.operating_profit, 0) - coalesce(s.salary_basic, 0)
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
    select sum(basic_salary) as salary_basic
    from salaries sal
    where sal.driver_id = d.id
      and make_date(sal.year, sal.month, 1) <= p_to
      and (make_date(sal.year, sal.month, 1) + interval '1 month' - interval '1 day')::date >= p_from
  ) s on true
  order by d.name;
$$;

-- ----------------------------------------------------------------------------
-- 2) fn_companies_report — تقرير الشركات
-- ----------------------------------------------------------------------------
create or replace function fn_companies_report(p_from date, p_to date)
returns table (
  company_id            uuid,
  company_name          text,
  company_status        company_status,
  trips_count           bigint,
  total_trip_amount     numeric,
  total_driver_payment  numeric,
  total_diesel          numeric,
  operating_profit      numeric
)
language sql stable
as $$
  select
    c.id, c.name, c.status,
    coalesce(t.trips_count, 0),
    coalesce(t.total_trip_amount, 0),
    coalesce(t.total_driver_payment, 0),
    coalesce(t.total_diesel, 0),
    coalesce(t.operating_profit, 0)
  from companies c
  left join lateral (
    select
      count(*) as trips_count,
      sum(trip_amount) as total_trip_amount,
      sum(driver_trip_payment) as total_driver_payment,
      sum(diesel_amount) as total_diesel,
      sum(trip_profit) as operating_profit
    from trips tr
    where tr.company_id = c.id
      and tr.trip_date between p_from and p_to
      and (tr.status <> 'cancelled' or should_count_cancelled())
  ) t on true
  order by c.name;
$$;

-- ----------------------------------------------------------------------------
-- 3) fn_driver_payments_report — تقرير التربات (قابل للفلترة بسائق/شركة)
-- ----------------------------------------------------------------------------
create or replace function fn_driver_payments_report(
  p_from date,
  p_to   date,
  p_driver_id uuid default null,
  p_company_id uuid default null
)
returns table (
  driver_id             uuid,
  driver_name           text,
  trips_count           bigint,
  total_driver_payment  numeric
)
language sql stable
as $$
  select d.id, d.name, count(t.id), coalesce(sum(t.driver_trip_payment), 0)
  from drivers d
  join trips t
    on t.driver_id = d.id
    and t.trip_date between p_from and p_to
    and (t.status <> 'cancelled' or should_count_cancelled())
    and (p_driver_id is null or t.driver_id = p_driver_id)
    and (p_company_id is null or t.company_id = p_company_id)
  group by d.id, d.name
  order by d.name;
$$;

-- ----------------------------------------------------------------------------
-- 4) fn_trips_report_totals — إجماليات تقرير ربحية الرحلات (يطابق فلاتر القائمة)
-- ----------------------------------------------------------------------------
create or replace function fn_trips_report_totals(
  p_from date,
  p_to   date,
  p_driver_id uuid default null,
  p_company_id uuid default null,
  p_status trip_status default null
)
returns table (
  trips_count           bigint,
  total_trip_amount     numeric,
  total_driver_payment  numeric,
  total_diesel          numeric,
  operating_profit      numeric
)
language sql stable
as $$
  select
    count(*),
    coalesce(sum(trip_amount), 0),
    coalesce(sum(driver_trip_payment), 0),
    coalesce(sum(diesel_amount), 0),
    coalesce(sum(trip_profit), 0)
  from trips
  where trip_date between p_from and p_to
    and (status <> 'cancelled' or should_count_cancelled())
    and (p_driver_id is null or driver_id = p_driver_id)
    and (p_company_id is null or company_id = p_company_id)
    and (p_status is null or status = p_status);
$$;
