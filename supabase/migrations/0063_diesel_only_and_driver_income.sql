-- ============================================================================
-- 0063 — فصل تقرير الديزل عن تقرير إيراد السائق/السيارة
-- ============================================================================
--
-- 🔒 دالة تُستبدَل ودالتان جديدتان. لا جدول يُمَس، ولا عمود، ولا بيانات.
--
-- تقرير 0059 جمع الديزل والتربات ومصاريف السيارة في جدول واحد، فصار يجيب
-- عن سؤالين في آن ولا يُحسن أيّهما. فيُفصل:
--
--   fn_diesel_monthly_report   → الديزل وحده. «كم شرب هذا السائق هذا الشهر»
--   fn_driver_income_report    → الإيراد والتكلفة والصافي لكل سائق/سيارة
--   fn_driver_expense_months   → تفصيل مصاريف العهدة ببنودها، ليُبسَط أعمدةً
--
-- 📌 «المصاريف» هنا هي ما يُسجَّل في صفحة السائق صرفاً من العهدة على العمل
--    (`reason = 'work_expense'`) ببنودها التي يكتبها المستخدم: غسيل، بنشر،
--    أخرى… وليست `expenses` — تلك مصروفات الشركة (الزيت مثلاً، 0040).
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 1) الديزل وحده
--    الأعمدة تغيّرت، فلا يكفي create or replace
-- ----------------------------------------------------------------------------
drop function if exists fn_diesel_monthly_report(date, date);

create function fn_diesel_monthly_report(p_from date, p_to date)
returns table (
  driver_id     uuid,
  driver_name   text,
  year          int,
  month         int,
  vehicle_id    uuid,
  vehicle_no    text,
  trips_count   bigint,
  diesel_amount numeric
)
language sql stable
as $fn$
  with months as (
    select
      m::date                                          as month_start,
      (m + interval '1 month' - interval '1 day')::date as month_end
    from generate_series(
      date_trunc('month', p_from)::date,
      date_trunc('month', p_to)::date,
      interval '1 month'
    ) as m
  )
  select
    d.id,
    d.name,
    extract(year  from mo.month_start)::int,
    extract(month from mo.month_start)::int,
    veh.id,
    veh.vehicle_no,
    coalesce(t.trips_count, 0),
    coalesce(dz.amount, 0)
  from drivers d
  cross join months mo
  left join lateral (
    select fn_driver_vehicle_at(d.id, mo.month_end) as vehicle_id
  ) va on true
  left join vehicles veh on veh.id = va.vehicle_id
  left join lateral (
    select count(*) as trips_count
    from trips tr
    where tr.driver_id = d.id
      and tr.trip_date between mo.month_start and mo.month_end
      and (tr.status <> 'cancelled' or should_count_cancelled())
  ) t on true
  left join lateral (
    select sum(dm.amount) as amount
    from driver_monthly_diesel dm
    where dm.driver_id = d.id
      and dm.year  = extract(year  from mo.month_start)::int
      and dm.month = extract(month from mo.month_start)::int
  ) dz on true
  where d.employment_type = 'internal'
    and coalesce(dz.amount, 0) > 0
  order by d.name, mo.month_start;
$fn$;

-- ----------------------------------------------------------------------------
-- 2) إيراد السائق/السيارة
--
-- 📌 الصافي = قيمة الرحلات − (الترب + الديزل + مصاريف العهدة).
--    الراتب خارجه عمداً: هذا كشف السيارة لا كشف الموظف، والراتب يُصرف
--    سواء دارت السيارة أم وقفت.
-- ----------------------------------------------------------------------------
create or replace function fn_driver_income_report(p_from date, p_to date)
returns table (
  driver_id         uuid,
  driver_name       text,
  year              int,
  month             int,
  vehicle_no        text,
  trips_count       bigint,
  total_trip_amount numeric,
  total_trabs       numeric,
  diesel_amount     numeric,
  custody_expenses  numeric,
  net_amount        numeric
)
language sql stable
as $fn$
  with months as (
    select
      m::date                                          as month_start,
      (m + interval '1 month' - interval '1 day')::date as month_end
    from generate_series(
      date_trunc('month', p_from)::date,
      date_trunc('month', p_to)::date,
      interval '1 month'
    ) as m
  )
  select
    d.id,
    d.name,
    extract(year  from mo.month_start)::int,
    extract(month from mo.month_start)::int,
    veh.vehicle_no,
    coalesce(t.trips_count, 0),
    coalesce(t.total_trip_amount, 0),
    coalesce(t.total_trabs, 0),
    coalesce(dz.amount, 0),
    coalesce(ex.total, 0),
    coalesce(t.total_trip_amount, 0)
      - coalesce(t.total_trabs, 0)
      - coalesce(dz.amount, 0)
      - coalesce(ex.total, 0)
  from drivers d
  cross join months mo
  left join lateral (
    select fn_driver_vehicle_at(d.id, mo.month_end) as vehicle_id
  ) va on true
  left join vehicles veh on veh.id = va.vehicle_id
  left join lateral (
    select
      count(*)                    as trips_count,
      sum(tr.trip_amount)         as total_trip_amount,
      sum(tr.driver_trip_payment) as total_trabs
    from trips tr
    where tr.driver_id = d.id
      and tr.trip_date between mo.month_start and mo.month_end
      and (tr.status <> 'cancelled' or should_count_cancelled())
  ) t on true
  left join lateral (
    select sum(dm.amount) as amount
    from driver_monthly_diesel dm
    where dm.driver_id = d.id
      and dm.year  = extract(year  from mo.month_start)::int
      and dm.month = extract(month from mo.month_start)::int
  ) dz on true
  left join lateral (
    select sum(c.amount) as total
    from driver_custody_entries c
    where c.driver_id = d.id
      and c.reason = 'work_expense'
      and c.date between mo.month_start and mo.month_end
  ) ex on true
  where d.employment_type = 'internal'
    and (
      coalesce(t.trips_count, 0) > 0
      or coalesce(dz.amount, 0) > 0
      or coalesce(ex.total, 0) > 0
    )
  order by d.name, mo.month_start;
$fn$;

-- ----------------------------------------------------------------------------
-- 3) بنود مصاريف العهدة شهرياً — صفّ لكل بند، تُبسَط أعمدةً في الواجهة
--
-- 🔑 البنود يكتبها المستخدم حرّةً (غسيل، بنشر، أخرى…) فلا تُثبَّت أعمدةً في
--    SQL. تُرجَع صفوفاً وتتكفّل الواجهة بترتيبها أعمدةً حسب الموجود فعلاً.
-- ----------------------------------------------------------------------------
create or replace function fn_driver_expense_months(p_from date, p_to date)
returns table (
  driver_id        uuid,
  year             int,
  month            int,
  expense_category text,
  total            numeric
)
language sql stable
as $fn$
  select
    c.driver_id,
    extract(year  from c.date)::int,
    extract(month from c.date)::int,
    coalesce(nullif(btrim(c.expense_category), ''), 'غير محدد'),
    sum(c.amount)
  from driver_custody_entries c
  join drivers d on d.id = c.driver_id
  where c.reason = 'work_expense'
    and c.date between p_from and p_to
    and d.employment_type = 'internal'
  group by 1, 2, 3, 4
  order by 1, 2, 3, 4;
$fn$;

notify pgrst, 'reload schema';
