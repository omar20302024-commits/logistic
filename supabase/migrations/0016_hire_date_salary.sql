-- ============================================================================
-- 0016 — تاريخ التعيين يدخل حساب الراتب
-- ============================================================================
--
-- `drivers.hire_date` كان موجوداً من 0001 ويتدخّل في نموذج السائق ويظهر في
-- الجدول، لكنه ما كانش بيدخل أي حساب. دلوقتي بقى أساس احتساب أيام العمل.
--
-- القاعدة: الراتب بيجري من تاريخ التعيين، ومالوش أي علاقة بالرحلات. سائق
-- متعيّن ومفيش له ولا رحلة واحدة بياخد راتبه كامل — الرحلات بتاعة الترب، مش
-- بتاعة الراتب (قاعدة #4: الراتب مصروف شهري مستقل).
--
--   أيام قبل التعيين = الأيام اللي في الشهر وقبل تاريخ التعيين
--   أيام الإجازة      = أيام الإجازة داخل الشهر (بعد تاريخ التعيين)
--   أيام العمل        = greatest(0, 30 − أيام قبل التعيين − أيام الإجازة)
--   الراتب المستحق    = الراتب الأساسي × أيام العمل ÷ 30
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 1) تعيين تاريخ بداية العمل لكل السائقين: 1 سبتمبر 2026
--    (طلب صريح من المستخدم). بيكتب فوق أي تاريخ تعيين قديم — لو سائق ليه تاريخ
--    مختلف، عدّله من نموذج السائق بعد تشغيل الملف.
-- ----------------------------------------------------------------------------
update drivers set hire_date = date '2026-09-01';

-- من دلوقتي جايّ، أي سائق جديد لازم يكون له تاريخ تعيين — من غيره الراتب
-- مش هيتحسب صح
alter table drivers alter column hire_date set default current_date;

-- ----------------------------------------------------------------------------
-- 2) أيام الشهر اللي السائق ما كانش متعيّن فيها
--    hire_date فاضي = نفترض إنه متعيّن من زمان (ما نخصمش حاجة)
-- ----------------------------------------------------------------------------
create or replace function fn_driver_pre_hire_days(
  p_driver_id uuid,
  p_year int,
  p_month int
)
returns int
language sql stable
as $$
  with bounds as (
    select
      make_date(p_year, p_month, 1) as month_start,
      (make_date(p_year, p_month, 1) + interval '1 month' - interval '1 day')::date as month_end
  )
  select coalesce((
    select case
      when d.hire_date is null                then 0
      when d.hire_date <= b.month_start       then 0
      -- اتعيّن بعد نهاية الشهر ده خالص → الشهر كله مش شغل
      when d.hire_date >  b.month_end         then (b.month_end - b.month_start + 1)
      else (d.hire_date - b.month_start)
    end
    from drivers d, bounds b
    where d.id = p_driver_id
  ), 0)::int;
$$;

-- ----------------------------------------------------------------------------
-- 3) أيام الإجازة — مقصوصة عند تاريخ التعيين
--    من غير القص، إجازة مسجَّلة بتاريخ قبل التعيين كانت هتتخصم مرتين: مرة
--    كأيام قبل تعيين ومرة كإجازة.
-- ----------------------------------------------------------------------------
create or replace function fn_driver_leave_days(
  p_driver_id uuid,
  p_year int,
  p_month int
)
returns int
language sql stable
as $$
  with bounds as (
    select
      make_date(p_year, p_month, 1) as month_start,
      (make_date(p_year, p_month, 1) + interval '1 month' - interval '1 day')::date as month_end
  ),
  drv as (
    select hire_date from drivers where id = p_driver_id
  )
  select coalesce(sum(
    least(coalesce(l.to_date, b.month_end), b.month_end)
    - greatest(l.from_date, b.month_start, coalesce(drv.hire_date, b.month_start))
    + 1
  ) filter (
    where least(coalesce(l.to_date, b.month_end), b.month_end)
       >= greatest(l.from_date, b.month_start, coalesce(drv.hire_date, b.month_start))
  ), 0)::int
  from driver_leaves l, bounds b, drv
  where l.driver_id = p_driver_id
    and l.from_date <= b.month_end
    and coalesce(l.to_date, b.month_end) >= b.month_start;
$$;

-- ----------------------------------------------------------------------------
-- 4) الراتب المستحق = الأساسي × أيام العمل ÷ 30
-- ----------------------------------------------------------------------------
create or replace function fn_driver_earned_salary(
  p_driver_id uuid,
  p_year int,
  p_month int,
  p_basic numeric
)
returns numeric
language sql stable
as $$
  select round(
    p_basic * greatest(
      0,
      30
      - fn_driver_pre_hire_days(p_driver_id, p_year, p_month)
      - fn_driver_leave_days(p_driver_id, p_year, p_month)
    ) / 30.0,
    2
  );
$$;

-- ----------------------------------------------------------------------------
-- 5) كشف الراتب — يعرض أيام ما قبل التعيين منفصلة عن أيام الإجازة
-- ----------------------------------------------------------------------------
drop view if exists v_salary_statements;

create view v_salary_statements
  with (security_invoker = true) as
select
  s.id,
  s.driver_id,
  d.name as driver_name,
  s.month,
  s.year,
  s.basic_salary,
  fn_driver_pre_hire_days(s.driver_id, s.year, s.month) as pre_hire_days,
  fn_driver_leave_days(s.driver_id, s.year, s.month)    as leave_days,
  greatest(0, 30
    - fn_driver_pre_hire_days(s.driver_id, s.year, s.month)
    - fn_driver_leave_days(s.driver_id, s.year, s.month)) as worked_days,
  fn_driver_earned_salary(s.driver_id, s.year, s.month, s.basic_salary) as earned_salary,
  coalesce(ded.total, 0) as deductions_total,
  coalesce(adv.total, 0) as advances_total,
  (fn_driver_earned_salary(s.driver_id, s.year, s.month, s.basic_salary)
    - coalesce(ded.total, 0) - coalesce(adv.total, 0)) as net_salary,
  s.paid_amount,
  (fn_driver_earned_salary(s.driver_id, s.year, s.month, s.basic_salary)
    - coalesce(ded.total, 0) - coalesce(adv.total, 0) - s.paid_amount) as remaining_amount,
  s.payment_date,
  s.notes,
  s.created_at,
  s.updated_at
from salaries s
join drivers d on d.id = s.driver_id
left join lateral (
  select sum(amount) as total
  from driver_deductions dd
  where dd.driver_id = s.driver_id
    and dd.settle_against = 'salary'
    and dd.date >= make_date(s.year, s.month, 1)
    and dd.date <= (make_date(s.year, s.month, 1) + interval '1 month' - interval '1 day')::date
) ded on true
left join lateral (
  select sum(amount) as total
  from driver_advances da
  where da.driver_id = s.driver_id
    and da.settle_against = 'salary'
    and da.date >= make_date(s.year, s.month, 1)
    and da.date <= (make_date(s.year, s.month, 1) + interval '1 month' - interval '1 day')::date
) adv on true;

-- ----------------------------------------------------------------------------
-- 6) ملخص فترة السائق — نفس الأعمدة + pre_hire_days
-- ----------------------------------------------------------------------------
drop function if exists fn_driver_public_summary(uuid, date, date);
drop function if exists fn_driver_period_summary(uuid, date, date);

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
  salary_earned          numeric,
  pre_hire_days          int,
  leave_days             int,
  worked_days            int,
  net_salary             numeric,
  custody_balance        numeric,
  trab_advances          numeric,
  trab_deductions        numeric,
  driver_paid_expenses   numeric,
  settled_trabs          numeric,
  unsettled_trabs        numeric,
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
      coalesce(sum(trip_profit), 0)          as operating_profit,
      coalesce(sum(driver_trip_payment) filter (where settlement_id is not null), 0) as settled_trabs,
      coalesce(sum(driver_trip_payment) filter (where settlement_id is null), 0)     as unsettled_trabs
    from trips
    where driver_id = p_driver_id
      and trip_date between p_from and p_to
      and (status <> 'cancelled' or should_count_cancelled())
  ),
  adv_agg as (
    select
      coalesce(sum(amount) filter (where settle_against = 'salary'), 0) as total_advances,
      coalesce(sum(amount) filter (where settle_against = 'trabs'), 0)  as trab_advances,
      coalesce(sum(amount) filter (where settle_against = 'trabs' and settlement_id is null), 0)
        as trab_advances_open
    from driver_advances
    where driver_id = p_driver_id and date between p_from and p_to
  ),
  ded_agg as (
    select
      coalesce(sum(amount) filter (where settle_against = 'salary'), 0) as total_deductions,
      coalesce(sum(amount) filter (where settle_against = 'trabs'), 0)  as trab_deductions,
      coalesce(sum(amount) filter (where settle_against = 'trabs' and settlement_id is null), 0)
        as trab_deductions_open
    from driver_deductions
    where driver_id = p_driver_id and date between p_from and p_to
  ),
  sal_agg as (
    select
      coalesce(sum(s.basic_salary), 0) as salary_basic,
      coalesce(sum(fn_driver_earned_salary(s.driver_id, s.year, s.month, s.basic_salary)), 0)
        as salary_earned,
      coalesce(sum(fn_driver_pre_hire_days(s.driver_id, s.year, s.month)), 0)::int as pre_hire_days,
      coalesce(sum(fn_driver_leave_days(s.driver_id, s.year, s.month)), 0)::int     as leave_days,
      coalesce(sum(greatest(0, 30
        - fn_driver_pre_hire_days(s.driver_id, s.year, s.month)
        - fn_driver_leave_days(s.driver_id, s.year, s.month))), 0)::int as worked_days
    from salaries s
    where s.driver_id = p_driver_id
      and make_date(s.year, s.month, 1) <= p_to
      and (make_date(s.year, s.month, 1) + interval '1 month' - interval '1 day')::date >= p_from
  ),
  custody_agg as (
    select
      fn_driver_custody_balance(p_driver_id, p_to) as custody_balance,
      (select coalesce(sum(amount), 0)
         from driver_custody_entries
        where driver_id = p_driver_id
          and reason = 'work_expense'
          and date between p_from and p_to) as driver_paid_expenses
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
    sal_agg.salary_earned,
    sal_agg.pre_hire_days,
    sal_agg.leave_days,
    sal_agg.worked_days,
    (sal_agg.salary_earned - ded_agg.total_deductions - adv_agg.total_advances) as net_salary,
    custody_agg.custody_balance,
    adv_agg.trab_advances,
    ded_agg.trab_deductions,
    custody_agg.driver_paid_expenses,
    trip_agg.settled_trabs,
    trip_agg.unsettled_trabs,
    (trip_agg.unsettled_trabs
      + (sal_agg.salary_earned - ded_agg.total_deductions - adv_agg.total_advances)
      - custody_agg.custody_balance
      - adv_agg.trab_advances_open
      - ded_agg.trab_deductions_open) as total_due_to_driver
  from trip_agg, adv_agg, ded_agg, sal_agg, custody_agg;
$$;

-- كشف السائق الآمن: بدون سعر رحلة/ربح/ديزل (قاعدة #11)
create or replace function fn_driver_public_summary(
  p_driver_id uuid,
  p_from date,
  p_to   date
)
returns table (
  trips_count           bigint,
  total_driver_payment  numeric,
  total_advances        numeric,
  total_deductions      numeric,
  salary_basic          numeric,
  salary_earned         numeric,
  pre_hire_days         int,
  leave_days            int,
  worked_days           int,
  net_salary            numeric,
  custody_balance       numeric,
  trab_advances         numeric,
  trab_deductions       numeric,
  driver_paid_expenses  numeric,
  settled_trabs         numeric,
  unsettled_trabs       numeric,
  total_due_to_driver   numeric
)
language sql stable
as $$
  select
    trips_count,
    total_driver_payment,
    total_advances,
    total_deductions,
    salary_basic,
    salary_earned,
    pre_hire_days,
    leave_days,
    worked_days,
    net_salary,
    custody_balance,
    trab_advances,
    trab_deductions,
    driver_paid_expenses,
    settled_trabs,
    unsettled_trabs,
    total_due_to_driver
  from fn_driver_period_summary(p_driver_id, p_from, p_to);
$$;

-- ----------------------------------------------------------------------------
-- 7) توليد سجلات رواتب الشهر دفعة واحدة
--
-- الراتب مالوش علاقة بالرحلات: أي سائق داخلي نشط متعيّن قبل نهاية الشهر بياخد
-- سجل راتب، حتى لو مفيش له ولا رحلة. المبلغ بييجي من drivers.salary (الراتب
-- التعاقدي)، والخصم بأيام الإجازة/ما قبل التعيين بيحصل تلقائياً في الـ view.
--
-- الموردون الخارجيون مستثنون — دول بياخدوا ترب لكل رحلة، مش راتب شهري.
--
-- `not exists` + قيد unique(driver_id, month, year) بيمنعوا التكرار، فالزر
-- ممكن يتضغط أكتر من مرة بأمان: اللي موجود يتساب، والناقص يتضاف.
-- ----------------------------------------------------------------------------
create or replace function fn_generate_month_salaries(p_year int, p_month int)
returns int
language plpgsql
as $$
declare
  v_count int;
  v_month_end date := (make_date(p_year, p_month, 1) + interval '1 month' - interval '1 day')::date;
begin
  insert into salaries (driver_id, month, year, basic_salary)
  select d.id, p_month, p_year, d.salary
  from drivers d
  where d.status = 'active'
    and d.employment_type = 'internal'
    and (d.hire_date is null or d.hire_date <= v_month_end)
    and not exists (
      select 1 from salaries s
      where s.driver_id = d.id and s.year = p_year and s.month = p_month
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
