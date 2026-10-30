-- ============================================================================
-- 0056 — سبب الخصم والسلفة بين قوسين في الكشف
-- ============================================================================
--
-- 🔒 ثلاث دوال تُستبدَل بعمودين نصّيين. لا جدول يُمَس، ولا بيانات، ولا
--    يتغيّر رقم واحد ممّا يُحسب — الإضافة للعرض وحده.
--
-- «− الخصومات 300» تقول كم ولا تقول لماذا، مثلما كانت الإضافات في 0054.
-- فيُجمع البيان نصّاً واحداً ويُطبع بين قوسين بجوار العنوان:
-- «− الخصومات (تأخير، مخالفة مرورية)».
--
-- 🔑 الأسباب من دلو الراتب وحده (`settle_against = 'salary'`) — وهو نفس
--    مُرشِّح المبلغ المعروض بجوارها. لو جُمعت من الدلوين لظهر بيانٌ لا
--    يخصّ الرقم الذي بجانبه.
--
-- والسلف أُعطيت نفس المعاملة: سطران متجاوران في كشف واحد، أحدهما يفسّر
-- نفسه والآخر لا — تفاوتٌ لا مبرّر له، وكلفته في نفس الملف صفر.
--
-- ⚠️ fn_statement_by_token ممنوحة لـanon، والـdrop يُسقط المنحة. إعادتها
--    في آخر الملف إجبارية وإلا وقف رابط السائق.
--
-- يعتمد على 0053 و0054 و0055. شغّله بعدها.
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

drop function if exists fn_driver_period_summary(uuid, date, date);

create function fn_driver_period_summary(
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
  salary_additions       numeric,
  salary_additions_note  text,
  trab_advances_open     numeric,
  trab_deductions_open   numeric,
  total_deductions_note  text,
  total_advances_note    text,
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
        as trab_advances_open,
      -- الأسباب تُجمع من دلو الراتب وحده، ليطابق النصُّ المبلغَ الذي بجواره.
      -- filter تتبع قوسَ الدالة المغلق، لا تدخل بين وسائطها.
      nullif(
        string_agg(
          nullif(btrim(coalesce(description, '')), ''),
          '، ' order by date
        ) filter (where settle_against = 'salary'),
        ''
      ) as total_advances_note
    from driver_advances
    where driver_id = p_driver_id and date between p_from and p_to
  ),
  ded_agg as (
    select
      coalesce(sum(amount) filter (where settle_against = 'salary'), 0) as total_deductions,
      coalesce(sum(amount) filter (where settle_against = 'trabs'), 0)  as trab_deductions,
      coalesce(sum(amount) filter (where settle_against = 'trabs' and settlement_id is null), 0)
        as trab_deductions_open,
      nullif(
        string_agg(
          nullif(btrim(coalesce(description, '')), ''),
          '، ' order by date
        ) filter (where settle_against = 'salary'),
        ''
      ) as total_deductions_note
    from driver_deductions
    where driver_id = p_driver_id and date between p_from and p_to
  ),
  add_agg as (
    select
      coalesce(sum(amount), 0) as salary_additions,
      -- nullif يمنع نصاً فارغاً حين لا سبب مكتوباً، فلا يُطبع قوسان فارغان
      nullif(
        string_agg(nullif(btrim(coalesce(reason, '')), ''), '، ' order by date),
        ''
      ) as salary_additions_note
    from driver_salary_additions
    where driver_id = p_driver_id and date between p_from and p_to
  ),
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
    add_agg.salary_additions,
    add_agg.salary_additions_note,
    adv_agg.trab_advances_open,
    ded_agg.trab_deductions_open,
    ded_agg.total_deductions_note,
    adv_agg.total_advances_note,
    sal_agg.pre_hire_days,
    sal_agg.leave_days,
    sal_agg.worked_days,
    (sal_agg.salary_earned + add_agg.salary_additions
      - ded_agg.total_deductions - adv_agg.total_advances) as net_salary,
    custody_agg.custody_balance,
    adv_agg.trab_advances,
    ded_agg.trab_deductions,
    custody_agg.driver_paid_expenses,
    trip_agg.settled_trabs,
    trip_agg.unsettled_trabs,
    (trip_agg.unsettled_trabs
      + (sal_agg.salary_earned + add_agg.salary_additions
         - ded_agg.total_deductions - adv_agg.total_advances)
      - custody_agg.custody_balance
      - adv_agg.trab_advances_open
      - ded_agg.trab_deductions_open) as total_due_to_driver
  from trip_agg, adv_agg, ded_agg, add_agg, sal_agg, custody_agg;
$fn$;

-- ----------------------------------------------------------------------------
drop function if exists fn_driver_public_summary(uuid, date, date);

create function fn_driver_public_summary(
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
  salary_additions      numeric,
  salary_additions_note text,
  trab_advances_open    numeric,
  trab_deductions_open  numeric,
  total_deductions_note text,
  total_advances_note   text,
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
as $fn$
  select
    trips_count, total_driver_payment, total_advances, total_deductions,
    salary_basic, salary_earned, salary_additions, salary_additions_note,
    trab_advances_open, trab_deductions_open,
    total_deductions_note, total_advances_note,
    pre_hire_days, leave_days, worked_days,
    net_salary, custody_balance, trab_advances, trab_deductions,
    driver_paid_expenses, settled_trabs, unsettled_trabs, total_due_to_driver
  from fn_driver_period_summary(p_driver_id, p_from, p_to);
$fn$;

-- ----------------------------------------------------------------------------
drop function if exists fn_statement_by_token(text);

create function fn_statement_by_token(p_token text)
returns table (
  driver_name           text,
  driver_phone          text,
  from_date             date,
  to_date               date,
  org_name              text,
  org_phone             text,
  currency_symbol       text,
  reviewed_by           text,
  trips_count           bigint,
  total_driver_payment  numeric,
  total_advances        numeric,
  total_deductions      numeric,
  custody_balance       numeric,
  driver_paid_expenses  numeric,
  salary_basic          numeric,
  salary_earned         numeric,
  salary_additions      numeric,
  salary_additions_note text,
  trab_advances_open    numeric,
  trab_deductions_open  numeric,
  total_deductions_note text,
  total_advances_note   text,
  pre_hire_days         int,
  leave_days            int,
  worked_days           int,
  net_salary            numeric,
  total_due_to_driver   numeric
)
language sql
stable
security definer
set search_path = public
as $fn$
  with d as (
    select
      id, name, phone,
      make_date(
        coalesce(statement_year,  extract(year  from current_date)::int),
        coalesce(statement_month, extract(month from current_date)::int),
        1
      ) as f
    from drivers
    where public_token = p_token
      and public_link_enabled
      and p_token is not null
      and length(p_token) >= 20
  ),
  p as (
    select id, name, phone, f as from_date,
           (f + interval '1 month' - interval '1 day')::date as to_date
    from d
  )
  select
    p.name, p.phone, p.from_date, p.to_date,
    s.org_name, s.org_phone, s.currency_symbol, s.reviewed_by,
    -- غير المصفّى وحده، ليطابق جدول الرحلات والمستحق (0049)
    open_t.trips_count,
    open_t.total_driver_payment,
    sm.total_advances,
    sm.total_deductions, sm.custody_balance, sm.driver_paid_expenses,
    sm.salary_basic, sm.salary_earned, sm.salary_additions, sm.salary_additions_note,
    sm.trab_advances_open, sm.trab_deductions_open,
    sm.total_deductions_note, sm.total_advances_note,
    sm.pre_hire_days, sm.leave_days,
    sm.worked_days, sm.net_salary, sm.total_due_to_driver
  from p
  cross join (select * from settings where id = true) s
  cross join lateral fn_driver_public_summary(p.id, p.from_date, p.to_date) sm
  cross join lateral (
    select
      count(*)                                      as trips_count,
      coalesce(sum(t.driver_trip_payment), 0)       as total_driver_payment
    from trips t
    where t.driver_id = p.id
      and t.trip_date between p.from_date and p.to_date
      and t.settlement_id is null
      and (t.status <> 'cancelled' or should_count_cancelled())
  ) open_t;
$fn$;

-- ⚠️ إجباري بعد الـdrop أعلاه — بدونه الرابط يقف
grant execute on function fn_statement_by_token(text) to anon;

notify pgrst, 'reload schema';
