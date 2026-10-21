-- ============================================================================
-- 0050 — الراتب حتى تاريخه في كشف حساب السائق
-- ============================================================================
--
-- 🔒 دالة واحدة تُستبدَل بنفس توقيعها، ودالتان صغيرتان جديدتان. لا جدول
--    يُمَس، ولا عمود، ولا بيانات.
--
-- المشكلة: كشف الحساب في العشرين من الشهر كان يعرض راتب الشهر كاملاً — أي
-- مالاً لم يُكتسب بعد. فيقرأه السائق على أنه مستحق له اليوم.
--
-- الحل: أيام الشهر التي لم تأتِ بعد لا تُحسب أيام عمل. وهي حالة ثالثة إلى
-- جانب ما قبل التعيين والإجازة:
--
--     أيام العمل = 30 − ما قبل التعيين − الإجازة − ما لم يأتِ بعد
--
-- ⚠️ لماذا دالة إجازة ثانية
--
-- النطاقان [أول الشهر .. التعيين) و(الحدّ .. آخر الشهر] منفصلان دائماً، فلا
-- يُطرح يومٌ مرتين بينهما. أما الإجازة فقد تُسجَّل مقدَّماً في يوم لم يأتِ
-- بعد — فتُطرح مرتين، ويظهر راتب أقل من الحق. لذلك تُقصّ الإجازة على نفس
-- الحدّ قبل طرحها.
--
-- 🔑 الحدّ = least(p_to, current_date). ليس p_to وحده: الفترة قد تُكتب إلى
--    آخر الشهر، واليوم الذي لم يأتِ لا يُعمل فيه مهما كتبنا في الفترة. وليس
--    current_date وحده: كشف شهر ماضٍ يجب أن يبقى كاملاً — وهو كذلك، لأن
--    نهاية الشهر الماضي أسبق من اليوم فلا يُقَصّ منه شيء.
--
-- ما لم يُمَس عمداً: fn_driver_earned_salary — مصدر شاشة الرواتب. الراتب
-- يُصرف عن الشهر كاملاً في آخره، والقَصّ وصفٌ لحالة اليوم لا تغيير لما
-- يُصرف. وفي آخر الشهر يتطابق الرقمان من تلقائهما.
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 1) أيام الشهر التي لم تأتِ بعد — بعد الحدّ تماماً
-- ----------------------------------------------------------------------------
create or replace function fn_month_unelapsed_days(
  p_year   int,
  p_month  int,
  p_cutoff date
)
returns int
language sql stable
as $fn$
  with b as (
    select
      make_date(p_year, p_month, 1) as month_start,
      (make_date(p_year, p_month, 1) + interval '1 month' - interval '1 day')::date as month_end
  )
  select case
    -- الحدّ قبل الشهر كله → لم يأتِ منه يوم
    when p_cutoff <  b.month_start then (b.month_end - b.month_start + 1)
    when p_cutoff >= b.month_end   then 0
    else (b.month_end - p_cutoff)
  end::int
  from b;
$fn$;

-- ----------------------------------------------------------------------------
-- 2) أيام الإجازة حتى الحدّ — نسخة fn_driver_leave_days بنهاية مقصوصة
-- ----------------------------------------------------------------------------
create or replace function fn_driver_leave_days_until(
  p_driver_id uuid,
  p_year   int,
  p_month  int,
  p_cutoff date
)
returns int
language sql stable
as $fn$
  with b as (
    select
      make_date(p_year, p_month, 1) as month_start,
      least(
        (make_date(p_year, p_month, 1) + interval '1 month' - interval '1 day')::date,
        p_cutoff
      ) as window_end
  )
  select coalesce(sum(
    least(coalesce(l.to_date, b.window_end), b.window_end)
    - greatest(l.from_date, b.month_start)
    + 1
  ), 0)::int
  from driver_leaves l, b
  where l.driver_id = p_driver_id
    and b.window_end >= b.month_start
    and l.from_date <= b.window_end
    and coalesce(l.to_date, b.window_end) >= b.month_start;
$fn$;

-- ----------------------------------------------------------------------------
-- 3) ملخص الفترة — نفس 0028 حرفياً، عدا أيام العمل
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
as $fn$
  with cutoff as (
    select least(p_to, current_date) as d
  ),
  trip_agg as (
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
  sal_rows as (
    select
      s.basic_salary,
      d.pre_hire,
      d.leave_d,
      -- الأيام التي لم تأتِ بعد تُطرح كما تُطرح الإجازة
      greatest(0, 30 - d.pre_hire - d.leave_d - d.unelapsed) as worked
    from salaries s
    cross join cutoff cu
    cross join lateral (
      select
        fn_driver_pre_hire_days(s.driver_id, s.year, s.month)               as pre_hire,
        fn_driver_leave_days_until(s.driver_id, s.year, s.month, cu.d)      as leave_d,
        fn_month_unelapsed_days(s.year, s.month, cu.d)                      as unelapsed
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
$fn$;

notify pgrst, 'reload schema';
