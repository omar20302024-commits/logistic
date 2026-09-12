-- ============================================================================
-- 0020 — الديزل الشهري لكل سائق بدل تسجيله على كل رحلة
-- ============================================================================
--
-- الديزل بيتشرى بالتعبئة مش بالرحلة، فتوزيعه تخميناً على الرحلات كان بيدّي رقماً
-- أدق في الشكل وأقل دقة في الحقيقة. دلوقتي بيتسجل مرة واحدة لكل سائق في الشهر
-- عند تقفيل الشهر.
--
-- 🔒 البيانات القديمة ما اتغيرتش: عمود trips.diesel_amount بكل قيمه التاريخية
-- زي ما هو، و trip_profit المخزَّن للرحلات القديمة زي ما هو. اللي اتشال هو حقل
-- الديزل من **نموذج إدخال** الرحلة بس، فالرحلات الجديدة بتبدأ بصفر.
--
-- ⚠️ نتيجة لازم تتعرف: ربح الرحلة الواحدة بقى غير متجانس عند نقطة التحويل.
--   الرحلات القديمة: trip_profit = السعر − الترب − ديزلها
--   الرحلات الجديدة: trip_profit = السعر − الترب        (الديزل بقى مصروف شهري)
-- صافي الربح الإجمالي سليم في الحالتين (الديزل الشهري بيتخصم تحت الربح
-- التشغيلي زي الرواتب)، لكن مقارنة ربحية رحلة قديمة برحلة جديدة مش عادلة.
--
-- 🛡️ خطر الازدواج: لو شهر فيه رحلات بديزلها **وكمان** سجل ديزل شهري لنفس
-- السائق، الديزل بيتحسب مرتين. fn_diesel_overlap_check بترصد ده، والواجهة
-- بتحذّرك قبل الحفظ.
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 1) جدول الديزل الشهري
--    لكل سائق سجل واحد بس في الشهر (unique) — بيمنع الازدواج من الأساس
-- ----------------------------------------------------------------------------
create table if not exists driver_monthly_diesel (
  id          uuid primary key default gen_random_uuid(),
  driver_id   uuid not null references drivers(id) on delete cascade,
  year        int not null check (year between 2000 and 2100),
  month       int not null check (month between 1 and 12),
  amount      numeric(12,2) not null default 0 check (amount >= 0),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (driver_id, year, month)
);

create index if not exists idx_monthly_diesel_period
  on driver_monthly_diesel(year, month);

alter table driver_monthly_diesel enable row level security;

drop policy if exists "driver_monthly_diesel_admin_all" on driver_monthly_diesel;
create policy "driver_monthly_diesel_admin_all" on driver_monthly_diesel
  for all using (is_admin()) with check (is_admin());

drop trigger if exists trg_monthly_diesel_updated_at on driver_monthly_diesel;
create trigger trg_monthly_diesel_updated_at
  before update on driver_monthly_diesel
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 2) إجمالي الديزل الشهري خلال فترة — المصدر الوحيد لهذا الرقم
--    الشهر بيتحسب لو أي جزء منه داخل الفترة (نفس منطق الرواتب بالظبط)
-- ----------------------------------------------------------------------------
create or replace function fn_monthly_diesel_total(p_from date, p_to date)
returns numeric
language sql stable
as $$
  select coalesce(sum(amount), 0)
  from driver_monthly_diesel
  where make_date(year, month, 1) <= p_to
    and (make_date(year, month, 1) + interval '1 month' - interval '1 day')::date >= p_from;
$$;

-- ----------------------------------------------------------------------------
-- 3) حارس الازدواج: سائقون لهم ديزل على رحلاتهم **و** سجل شهري في نفس الشهر
-- ----------------------------------------------------------------------------
create or replace function fn_diesel_overlap_check(p_year int, p_month int)
returns table (
  driver_id     uuid,
  driver_name   text,
  trips_diesel  numeric,
  monthly_diesel numeric
)
language sql stable
as $$
  with bounds as (
    select
      make_date(p_year, p_month, 1) as month_start,
      (make_date(p_year, p_month, 1) + interval '1 month' - interval '1 day')::date as month_end
  )
  select
    d.id, d.name,
    coalesce(t.total, 0),
    md.amount
  from driver_monthly_diesel md
  join drivers d on d.id = md.driver_id
  left join lateral (
    select sum(tr.diesel_amount) as total
    from trips tr, bounds b
    where tr.driver_id = md.driver_id
      and tr.trip_date between b.month_start and b.month_end
      and tr.diesel_amount > 0
  ) t on true
  where md.year = p_year
    and md.month = p_month
    and coalesce(t.total, 0) > 0
  order by d.name;
$$;

-- ----------------------------------------------------------------------------
-- 4) التقرير المالي: الديزل الشهري بند مستقل تحت الربح التشغيلي
--    (ديزل الرحلات التاريخي جوّه operating_profit أصلاً عبر trip_profit)
-- ----------------------------------------------------------------------------
drop function if exists fn_financial_summary(date, date);

create or replace function fn_financial_summary(
  p_from date,
  p_to   date
)
returns table (
  total_revenue            numeric,
  total_driver_payments    numeric,
  total_diesel             numeric,  -- ديزل مسجَّل على الرحلات (تاريخي)
  total_rental_revenue     numeric,
  total_rental_diesel      numeric,
  operating_profit         numeric,
  total_salaries           numeric,
  total_driver_expenses    numeric,
  total_monthly_diesel     numeric,  -- الديزل الشهري للسائقين
  total_housing_cost       numeric,
  total_other_expenses     numeric,
  net_profit               numeric
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
  mon_diesel as (
    select fn_monthly_diesel_total(p_from, p_to) as total_monthly_diesel
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
    (trip_agg.operating_profit + rent_agg.rental_revenue - rent_agg.rental_diesel)
      as operating_profit,
    sal_agg.total_salaries,
    drv_exp.total_driver_expenses,
    mon_diesel.total_monthly_diesel,
    rent_agg.housing_cost,
    exp_agg.total_other_expenses,
    (trip_agg.operating_profit + rent_agg.rental_revenue - rent_agg.rental_diesel
      - sal_agg.total_salaries
      - drv_exp.total_driver_expenses
      - mon_diesel.total_monthly_diesel
      - rent_agg.housing_cost
      - exp_agg.total_other_expenses) as net_profit
  from trip_agg, rent_agg, sal_agg, drv_exp, mon_diesel, exp_agg;
$$;

-- ----------------------------------------------------------------------------
-- 5) لوحة التحكم — نفس البنود بالظبط (القاعدة: الاتنين يتعدّلوا معاً دايماً)
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
  total_monthly_diesel   numeric,
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
  mon_diesel as (
    select coalesce(sum(amount), 0) as total_monthly_diesel from driver_monthly_diesel
  ),
  exp as (select coalesce(sum(amount), 0) as total_other_expenses from expenses)
  select
    d.drivers_count, d.active_drivers_count, c.companies_count,
    t.trips_count, t.total_trip_amount, t.total_driver_payments, t.total_diesel,
    rent.rental_revenue, rent.rental_diesel,
    (t.operating_profit + rent.rental_revenue - rent.rental_diesel) as operating_profit,
    sal.total_salaries, ded.total_deductions, adv.total_advances,
    drv_exp.total_driver_expenses, mon_diesel.total_monthly_diesel,
    rent.housing_cost, exp.total_other_expenses,
    (t.operating_profit + rent.rental_revenue - rent.rental_diesel
      - sal.total_salaries
      - drv_exp.total_driver_expenses
      - mon_diesel.total_monthly_diesel
      - rent.housing_cost
      - exp.total_other_expenses) as net_profit
  from d, c, t, rent, sal, ded, adv, drv_exp, mon_diesel, exp;
$$;
