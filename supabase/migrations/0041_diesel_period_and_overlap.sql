-- ============================================================================
-- 0041 — ديزل لفترة، وقياس الازدواج قياساً حقيقياً
-- ============================================================================
--
-- 🔒 إضافي: عمود وقيد ودالة قراءة. لا delete ولا truncate ولا drop table،
--    ولا تُمَس أي دالة ربح.
--
-- ----------------------------------------------------------------------------
-- 1) ديزل لفترة: «من 1-10 إلى 15-10 استهلاك كذا»
--
-- عمود to_date اختياري. فارغ = تفويلة بتاريخ واحد كما هو اليوم، ومملوء = فترة
-- بمبلغ مجمَّل.
--
-- ⚠️ الفترة مقيَّدة بشهر واحد. لو امتدت من 25-10 إلى 05-11 فإلى أي شهر يُنسب
--    المبلغ؟ نسبُه للشهر الأول خطأ صامت في رقم شهري يدخل الربح، وتقسيمه
--    بالتناسب تخمين. فالقيد يرفضها ويطلب تقسيمها صفّين — صريح بدل صامت.
-- ----------------------------------------------------------------------------

alter table driver_diesel_entries
  add column if not exists to_date date;

do $do$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_diesel_period') then
    alter table driver_diesel_entries add constraint chk_diesel_period
      check (
        to_date is null
        or (
          to_date >= date
          and extract(year  from to_date) = extract(year  from date)
          and extract(month from to_date) = extract(month from date)
        )
      );
  end if;
end
$do$;

-- الدالة التي تُرجع حركات السائق — نضيف to_date لها
drop function if exists fn_driver_diesel_entries(uuid, date, date);

create or replace function fn_driver_diesel_entries(
  p_driver_id uuid,
  p_from date,
  p_to   date
)
returns table (
  id        uuid,
  date      date,
  to_date   date,
  amount    numeric,
  reference text,
  notes     text
)
language sql stable
as $fn$
  select id, date, to_date, amount, reference, notes
  from driver_diesel_entries
  where driver_id = p_driver_id
    and date between p_from and p_to
  order by date desc, created_at desc;
$fn$;

-- ----------------------------------------------------------------------------
-- 2) الازدواج الحقيقي: شهر فيه ديزل رحلات **و** ديزل شهري معاً
--
-- التحذير السابق كان يقيس **إجمالي** ديزل الرحلات القديم، فينذر لأي سائق عليه
-- رقم قديم حتى لو لم يقع ازدواج أصلاً — والازدواج لا يقع إلا باجتماع الاثنين
-- في نفس الشهر. هذه الدالة تقيس ذلك شهراً بشهر.
-- ----------------------------------------------------------------------------
create or replace function fn_driver_diesel_overlap(p_driver_id uuid)
returns table (
  year           int,
  month          int,
  trips_diesel   numeric,
  monthly_diesel numeric
)
language sql stable
as $fn$
  with per_month as (
    select
      extract(year  from trip_date)::int as y,
      extract(month from trip_date)::int as m,
      sum(coalesce(diesel_amount, 0))    as amt
    from trips
    where driver_id = p_driver_id
      and coalesce(diesel_amount, 0) > 0
    group by 1, 2
  )
  select p.y, p.m, p.amt, md.amount
  from per_month p
  join driver_monthly_diesel md
    on md.driver_id = p_driver_id
   and md.year = p.y
   and md.month = p.m
  order by p.y desc, p.m desc;
$fn$;
