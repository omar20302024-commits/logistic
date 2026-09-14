-- ============================================================================
-- 0028 — إصلاح: بطء كشف السائق (Gateway Timeout)
-- ============================================================================
--
-- 🔴 الأهم أولاً: **0027 هو الإصلاح الأساسي لهذه المشكلة، وليس هذا الملف.**
--
-- صفحة كشف الترب بتنادي fn_driver_public_trips، وهي بتنادي
-- fn_extra_loading_points(t.from_location) **لكل رحلة**. والدالة دي بتنادي
-- fn_loading_count — وهي نفس الدالة اللي كانت بتعمل timeout في صفحة الرحلات،
-- لأنها كانت مكتوبة باستعلام فرعي فيه regexp_split_to_table فما يقدرش المخطِّط
-- يدمجها (inline)، فبتتنفّذ نداءً كاملاً لكل صف.
--
-- 0027 أعاد كتابتها بتعبير سلمي قابل للدمج. يعني: لو 0027 ما اتشغّلش، فالصفحتان
-- بيقعا من نفس السبب بالظبط. شغّل 0027 الأول ثم هذا الملف.
--
-- ----------------------------------------------------------------------------
-- وهذا الملف يعالج شيئاً ثانياً منفصلاً في fn_driver_period_summary:
--
-- كانت بتستدعي دالتَي الأيام تلات مرات لكل صف راتب:
--     fn_driver_earned_salary(...)                  ← بتنادي الاثنتين بداخلها
--     fn_driver_pre_hire_days(...)                  ← مرة تانية
--     fn_driver_leave_days(...)                     ← مرة تانية
--     greatest(0, 30 - pre_hire(...) - leave(...))  ← مرة تالتة لكل واحدة
--
-- ست نداءات حيث تكفي اثنتان، وكل نداء استعلام كامل على drivers أو driver_leaves
-- لأن الدالتين تغلّفان استعلاماً فرعياً فلا يمكن دمجهما.
--
-- الإصلاح: lateral يحسب الرقمين مرة واحدة لكل صف، والباقي حساب على ناتجهما،
-- مع فرد معادلة الراتب المستحق كما هي حرفياً:
--     round(basic * greatest(0, 30 - pre_hire - leave) / 30.0, 2)
-- 🔒 النتيجة الرقمية واحدة تماماً — نفس المعادلة بنفس الترتيب وبنفس التقريب.
--
-- الملف قابل لإعادة التشغيل بأمان.
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
  -- الرقمان يُحسبان مرة واحدة لكل صف، والباقي مشتق منهما
  sal_rows as (
    select
      s.basic_salary,
      d.pre_hire,
      d.leave_d,
      greatest(0, 30 - d.pre_hire - d.leave_d) as worked
    from salaries s
    cross join lateral (
      select
        fn_driver_pre_hire_days(s.driver_id, s.year, s.month) as pre_hire,
        fn_driver_leave_days(s.driver_id, s.year, s.month)    as leave_d
    ) d
    where s.driver_id = p_driver_id
      and make_date(s.year, s.month, 1) <= p_to
      and (make_date(s.year, s.month, 1) + interval '1 month' - interval '1 day')::date >= p_from
  ),
  sal_agg as (
    select
      coalesce(sum(basic_salary), 0)                              as salary_basic,
      coalesce(sum(round(basic_salary * worked / 30.0, 2)), 0)     as salary_earned,
      coalesce(sum(pre_hire), 0)::int                              as pre_hire_days,
      coalesce(sum(leave_d), 0)::int                               as leave_days,
      coalesce(sum(worked), 0)::int                                as worked_days
    from sal_rows
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
    trips_count, total_driver_payment, total_advances, total_deductions,
    salary_basic, salary_earned, pre_hire_days, leave_days, worked_days,
    net_salary, custody_balance, trab_advances, trab_deductions,
    driver_paid_expenses, settled_trabs, unsettled_trabs, total_due_to_driver
  from fn_driver_period_summary(p_driver_id, p_from, p_to);
$$;

-- ----------------------------------------------------------------------------
-- لا فهارس جديدة هنا عن قصد: كل ما تحتاجه هذه الدوال موجود بالفعل —
--   salaries               ← unique (driver_id, month, year)
--   driver_leaves          ← idx_driver_leaves_driver (driver_id, from_date)
--   driver_custody_entries ← idx_driver_custody_driver_date (driver_id, date)
--   driver_advances        ← idx_driver_advances_driver_date
--   driver_deductions      ← idx_driver_deductions_driver_date
-- فهرس مكرر ما بيسرّعش القراءة وبيبطّئ كل إدخال وتعديل.
-- ----------------------------------------------------------------------------
