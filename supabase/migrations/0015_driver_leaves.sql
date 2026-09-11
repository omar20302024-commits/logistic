-- ============================================================================
-- 0015 — الإجازات واحتساب الراتب بأيام العمل
-- ============================================================================
--
-- السائقون مغتربون ويعملون كل أيام الشهر بلا يوم راحة أسبوعي، وإجازتهم ممكن
-- تمتد شهراً أو شهرين. فالقواعد المتفق عليها:
--
--   1) المقام 30 يوماً دائماً (مش أيام الشهر الفعلية) — قيمة اليوم ثابتة طول
--      السنة وسهلة الشرح للسائق. في شهر 31 يوماً، اللي يشتغله كله ياخد راتبه
--      كاملاً بلا زيادة.
--   2) كل أيام التقويم في الإجازة تُخصم — مفيش استثناء ليوم راحة.
--   3) مفيش إجازة مدفوعة. أي إجازة تُخصم بعدد أيامها.
--
--   أيام العمل      = greatest(0, 30 − أيام الإجازة داخل الشهر)
--   الراتب المستحق  = الراتب الأساسي × أيام العمل ÷ 30
--
-- الراتب الأساسي يفضل كامل الشهر في `salaries`، والمستحق **يتحسب** — مفيش قيمة
-- مجزَّأة بتتدخل يدوياً (قاعدة #5).
-- ----------------------------------------------------------------------------

-- الملف كله قابل لإعادة التشغيل بأمان (idempotent): لو وقف في النص لأي سبب،
-- شغّله تاني من أوله من غير ما تحذف حاجة. كل خطوة بتتأكد الأول إن الكائن مش
-- موجود. (السبب: النسخة الأولى وقفت عند `create table` لما اتشغّلت مرتين.)

create table if not exists driver_leaves (
  id         uuid primary key default gen_random_uuid(),
  driver_id  uuid not null references drivers(id) on delete cascade,
  from_date  date not null,
  -- فاضي = إجازة مفتوحة، لسه ما اتحددش تاريخ الرجوع
  to_date    date,
  notes      text,
  created_at timestamptz not null default now(),

  constraint chk_leave_period check (to_date is null or to_date >= from_date)
);

create index if not exists idx_driver_leaves_driver on driver_leaves(driver_id, from_date);

alter table driver_leaves enable row level security;

drop policy if exists "driver_leaves_admin_all" on driver_leaves;
create policy "driver_leaves_admin_all" on driver_leaves
  for all using (is_admin()) with check (is_admin());

-- منع تداخل إجازتين لنفس السائق على مستوى قاعدة البيانات.
-- من غير القيد ده، تسجيل نفس الإجازة مرتين بالغلط بيخصم أيامها مرتين ويقلّل
-- الراتب من غير ما حد ياخد باله.
-- ملاحظة: محتاج امتداد btree_gist (متاح في Supabase).
create extension if not exists btree_gist;

-- `add constraint` مفيهاش `if not exists`، فنتأكد يدوياً
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'no_overlapping_driver_leaves'
  ) then
    alter table driver_leaves
      add constraint no_overlapping_driver_leaves
      exclude using gist (
        driver_id with =,
        daterange(from_date, coalesce(to_date, 'infinity'::date), '[]') with &&
      );
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- عدد أيام إجازة السائق المتقاطعة مع شهر معيّن
-- الإجازة المفتوحة (to_date فاضي) بتغطي الشهر لآخره
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
  )
  select coalesce(sum(
    least(coalesce(l.to_date, b.month_end), b.month_end)
    - greatest(l.from_date, b.month_start)
    + 1
  ), 0)::int
  from driver_leaves l, bounds b
  where l.driver_id = p_driver_id
    and l.from_date <= b.month_end
    and coalesce(l.to_date, b.month_end) >= b.month_start;
$$;

-- ----------------------------------------------------------------------------
-- الراتب المستحق عن شهر = الأساسي × أيام العمل ÷ 30
-- المصدر الوحيد لهذا الرقم: يستدعيه كشف الراتب وملخص فترة السائق معاً، عشان
-- الرقم اللي في كشف السائق يبقى هو نفسه اللي في شاشة الرواتب بالظبط.
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
    p_basic * greatest(0, 30 - fn_driver_leave_days(p_driver_id, p_year, p_month)) / 30.0,
    2
  );
$$;

-- ----------------------------------------------------------------------------
-- كشف الراتب: يعرض الأساسي والمستحق وأيام العمل، والصافي يتحسب من المستحق
-- (drop لأن أعمدة الـ view اتغيّرت في النص مش في الآخر بس)
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
  fn_driver_leave_days(s.driver_id, s.year, s.month) as leave_days,
  greatest(0, 30 - fn_driver_leave_days(s.driver_id, s.year, s.month)) as worked_days,
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
-- ملخص فترة السائق: الراتب اللي يدخل المستحق لازم يكون المستحق مش الأساسي.
--
-- ده أهم سطر في الملف: كشف السائق (/statement/public) بيقرأ من هنا. من غير
-- التعديل ده كان هيتبعت للسائق راتب شهر كامل بينما تصفيته على 10 أيام.
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
  salary_basic           numeric,  -- الأساسي التعاقدي كامل الشهر
  salary_earned          numeric,  -- المستحق بعد خصم أيام الإجازة
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
      coalesce(sum(fn_driver_leave_days(s.driver_id, s.year, s.month)), 0)::int as leave_days,
      coalesce(sum(greatest(0, 30 - fn_driver_leave_days(s.driver_id, s.year, s.month))), 0)::int
        as worked_days
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
