-- ============================================================================
-- 0060 — إيرادات العملاء الشهرية + قائمة الدخل + تقرير المطابقة
-- ============================================================================
--
-- 🔒 إضافي: جدول جديد ودوال جديدة. لا جدول قائم يُمَس، ولا دالة تُستبدَل،
--    ولا يتغيّر رقم واحد في لوحة التحكم ولا في التقرير المالي الحالي.
--
-- ⚠️ المشكلة: الرحلة سجلّ تشغيلي، والفاتورة سجلّ مالي، ولا يتطابقان دائماً.
--    سائق واحد يؤدي عملاً يُفوتَر على العميل كسيارتين، فإيراد الفاتورة أكبر
--    ممّا في النظام — ورحلات السائق صحيحة كما هي.
--
-- 🔑 القرار: **لا يُمَسّ مبلغ الرحلة إطلاقاً.** تعديله لمطابقة الفاتورة
--    يُفسد ربحية الرحلة وترب السائق ومقارنات السائقين، ويُخفي الفرق بدل أن
--    يُظهره. فالفاتورة تُسجَّل في جدول مستقل، ويُفرَد تقرير يعرض الفرق
--    صراحةً — ما يُرى يُراجَع، وما يُدمَج يضيع.
--
-- 📌 الإدخال إجمالي شهري لكل عميل (الرقم النهائي للشهر) — لا فاتورة بفاتورة.
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 1) الجدول
-- ----------------------------------------------------------------------------
create table if not exists company_monthly_revenues (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  year       int not null check (year between 2000 and 2100),
  month      int not null check (month between 1 and 12),
  amount     numeric(12,2) not null default 0 check (amount >= 0),
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- رقم واحد لكل عميل في كل شهر: الإدخال المكرر خطأ لا حالة
  unique (company_id, year, month)
);

create index if not exists idx_company_revenues_period
  on company_monthly_revenues(year, month);

alter table company_monthly_revenues enable row level security;

-- (select is_admin()) لا is_admin(): الأولى تُرفع إلى InitPlan فتُنفَّذ مرة
-- واحدة للاستعلام كله، والثانية لكل صف (درس 0029)
drop policy if exists "company_monthly_revenues_admin_all" on company_monthly_revenues;
create policy "company_monthly_revenues_admin_all" on company_monthly_revenues
  for all using ((select is_admin())) with check ((select is_admin()));

drop trigger if exists trg_company_revenues_updated on company_monthly_revenues;
create trigger trg_company_revenues_updated
  before update on company_monthly_revenues
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 2) إجمالي الإيراد المفوتَر في فترة
--
-- 📅 بتداخل الشهر مع الفترة — نفس قاعدة fn_monthly_diesel_total حرفياً، فلا
--    يختلف معنى «الفترة» من تقرير لآخر.
-- ----------------------------------------------------------------------------
create or replace function fn_invoiced_revenue_total(p_from date, p_to date)
returns numeric
language sql stable
as $fn$
  select coalesce(sum(amount), 0)
  from company_monthly_revenues
  where make_date(year, month, 1) <= p_to
    and (make_date(year, month, 1) + interval '1 month' - interval '1 day')::date >= p_from;
$fn$;

-- ----------------------------------------------------------------------------
-- 3) المطابقة: المفوتَر مقابل ما في النظام، لكل عميل
-- ----------------------------------------------------------------------------
create or replace function fn_revenue_reconciliation(p_from date, p_to date)
returns table (
  company_id       uuid,
  company_name     text,
  invoiced_amount  numeric,
  trips_amount     numeric,
  trips_count      bigint,
  difference       numeric
)
language sql stable
as $fn$
  select
    c.id,
    c.name,
    coalesce(inv.total, 0),
    coalesce(t.total, 0),
    coalesce(t.cnt, 0),
    coalesce(inv.total, 0) - coalesce(t.total, 0)
  from companies c
  left join lateral (
    select sum(r.amount) as total
    from company_monthly_revenues r
    where r.company_id = c.id
      and make_date(r.year, r.month, 1) <= p_to
      and (make_date(r.year, r.month, 1) + interval '1 month' - interval '1 day')::date >= p_from
  ) inv on true
  left join lateral (
    select sum(tr.trip_amount) as total, count(*) as cnt
    from trips tr
    where tr.company_id = c.id
      and tr.trip_date between p_from and p_to
      and (tr.status <> 'cancelled' or should_count_cancelled())
  ) t on true
  where coalesce(inv.total, 0) <> 0 or coalesce(t.cnt, 0) > 0
  order by c.name;
$fn$;

-- ----------------------------------------------------------------------------
-- 4) قائمة الدخل — إيرادها الفواتير لا الرحلات
--
-- البنود المخصومة هي نفسها التي يخصمها fn_financial_summary حرفاً بحرف،
-- فلا يختلف تعريف «المصروف» بين التقريرين. الفرق الوحيد هو مصدر الإيراد.
--
-- ⚠️ fn_financial_summary **لم تُمَس**: لوحة التحكم والتقرير المالي يبقيان
--    على إيراد الرحلات كما طلب المستخدم، وهذه صفحة مستقلة.
-- ----------------------------------------------------------------------------
create or replace function fn_income_statement(p_from date, p_to date)
returns table (
  invoiced_revenue      numeric,
  trips_revenue         numeric,
  revenue_difference    numeric,
  rental_revenue        numeric,
  total_revenue         numeric,
  total_driver_payments numeric,
  total_trip_diesel     numeric,
  total_monthly_diesel  numeric,
  total_rental_diesel   numeric,
  total_salaries        numeric,
  total_driver_expenses numeric,
  total_housing_cost    numeric,
  total_other_expenses  numeric,
  total_costs           numeric,
  net_profit            numeric
)
language sql stable
as $fn$
  with trip_agg as (
    select
      coalesce(sum(trip_amount), 0)         as trips_revenue,
      coalesce(sum(driver_trip_payment), 0) as total_driver_payments,
      coalesce(sum(diesel_amount), 0)       as total_trip_diesel
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
  inv as (
    select fn_invoiced_revenue_total(p_from, p_to) as invoiced_revenue
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
    inv.invoiced_revenue,
    trip_agg.trips_revenue,
    (inv.invoiced_revenue - trip_agg.trips_revenue) as revenue_difference,
    rent_agg.rental_revenue,
    (inv.invoiced_revenue + rent_agg.rental_revenue) as total_revenue,
    trip_agg.total_driver_payments,
    trip_agg.total_trip_diesel,
    mon_diesel.total_monthly_diesel,
    rent_agg.rental_diesel,
    sal_agg.total_salaries,
    drv_exp.total_driver_expenses,
    rent_agg.housing_cost,
    exp_agg.total_other_expenses,
    (trip_agg.total_driver_payments
      + trip_agg.total_trip_diesel
      + mon_diesel.total_monthly_diesel
      + rent_agg.rental_diesel
      + sal_agg.total_salaries
      + drv_exp.total_driver_expenses
      + rent_agg.housing_cost
      + exp_agg.total_other_expenses) as total_costs,
    (inv.invoiced_revenue + rent_agg.rental_revenue
      - trip_agg.total_driver_payments
      - trip_agg.total_trip_diesel
      - mon_diesel.total_monthly_diesel
      - rent_agg.rental_diesel
      - sal_agg.total_salaries
      - drv_exp.total_driver_expenses
      - rent_agg.housing_cost
      - exp_agg.total_other_expenses) as net_profit
  from trip_agg, rent_agg, sal_agg, inv, drv_exp, mon_diesel, exp_agg;
$fn$;

notify pgrst, 'reload schema';
