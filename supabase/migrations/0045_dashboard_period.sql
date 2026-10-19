-- ============================================================================
-- 0045 — لوحة التحكم: بفترة، وسائقو الشركة وحدهم
-- ============================================================================
--
-- 🔒 إضافي: إعادة تعريف دالة قراءة واحدة. لا delete ولا truncate ولا drop
--    table، ولا تتغيّر أي بيانات.
--
-- عيبان:
--
-- ١) «إجمالي السائقين» كان يعدّ **كل** من في الجدول. وبعد إضافة الموردين
--    (0043) صار يخلط سائقي الشركة بسائقي الموردين، فالرقم لم يعد يعني شيئاً.
--    صار يعدّ employment_type = 'internal' وحدهم.
--
-- ٢) اللوحة كانت **بلا فترة** — أرقام متراكمة منذ أول يوم. فلا سبيل لرؤية شهر
--    بعينه. صارت تأخذ p_from و p_to.
--
-- ⚠️ التوقيع تغيّر من () إلى (date, date) — وهما دالتان مختلفتان في بوستجرس،
--    فنحذف القديمة صراحةً وإلا بقيت معلّقة بلا مستدعٍ.
--
-- 🔢 معادلة صافي الربح منقولة **حرفياً** بنفس الترتيب ونفس البنود — المتغيّر
--    هو نطاق ما يُجمع لا طريقة جمعه. والقاعدة المكتوبة: fn_financial_summary
--    و fn_dashboard_overview يتعدّلان معاً. البنود هنا هي بنودها نفسها.
--
-- التعدادات (السائقون، الشركات) تبقى إجمالية لا بالفترة: هي سجلّ لا نشاط.
-- أما الرحلات والمال فبالفترة.
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

drop function if exists fn_dashboard_overview();
drop function if exists fn_dashboard_overview(date, date);

create or replace function fn_dashboard_overview(p_from date, p_to date)
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
as $fn$
  with d as (
    -- سائقو الشركة وحدهم — الموردون لهم كشوفاتهم في صفحة الموردين
    select
      count(*) as drivers_count,
      count(*) filter (where status = 'active') as active_drivers_count
    from drivers
    where employment_type = 'internal'
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
    where trip_date between p_from and p_to
      and (status <> 'cancelled' or should_count_cancelled())
  ),
  rent as (
    select * from fn_rental_period_totals(p_from, p_to)
  ),
  sal as (
    -- الشهر يُحتسب لو أي جزء منه داخل الفترة — نفس منطق الرواتب في بقية النظام
    select coalesce(sum(
      fn_driver_earned_salary(driver_id, year, month, basic_salary)
    ), 0) as total_salaries
    from salaries
    where make_date(year, month, 1) <= p_to
      and (make_date(year, month, 1) + interval '1 month' - interval '1 day')::date >= p_from
  ),
  ded as (
    select coalesce(sum(amount), 0) as total_deductions
    from driver_deductions where date between p_from and p_to
  ),
  adv as (
    select coalesce(sum(amount), 0) as total_advances
    from driver_advances where date between p_from and p_to
  ),
  drv_exp as (
    select coalesce(sum(amount), 0) as total_driver_expenses
    from driver_custody_entries
    where reason = 'work_expense' and date between p_from and p_to
  ),
  mon_diesel as (
    -- نفس الدالة التي يستعملها التقرير المالي، فلا ينحرف الرقمان
    select fn_monthly_diesel_total(p_from, p_to) as total_monthly_diesel
  ),
  exp as (
    select coalesce(sum(amount), 0) as total_other_expenses
    from expenses where date between p_from and p_to
  )
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
$fn$;
