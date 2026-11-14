-- ============================================================================
-- 0064 — إيراد السائق/السيارة: الراتب ضمن التكاليف
-- ============================================================================
--
-- 🔒 دالة واحدة تُستبدَل. لا جدول يُمَس، ولا عمود، ولا بيانات.
--
-- في 0063 تركتُ الراتب خارج الحساب بحجّة أن هذا «كشف السيارة لا كشف
-- الموظف». والمستخدم يريد السؤال كاملاً: **هذا السائق اشتغل بكم، وصرف
-- ديزلاً ومصاريف وراتباً كم، وكم بقي؟**
--
-- فالراتب يدخل التكاليف:
--   الصافي = قيمة الرحلات − (الترب + الديزل + مصاريف العهدة + الراتب)
--
-- 🔑 المصدر `fn_driver_earned_salary` نفسها التي تقرأ منها شاشة الرواتب
--    وكشف الحساب — فالراتب هنا هو الراتب هناك، بأيام العمل والإجازات
--    نفسها. حسابٌ ثانٍ كان سيفترق عنها عند أول إجازة.
--
-- 📌 الشهر بلا صفّ راتب يُحسب صفراً لا يُسقط السائق: رحلاته وديزله حقائق
--    قائمة سواء وُلّد الراتب أم لم يُولَّد بعد.
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

drop function if exists fn_driver_income_report(date, date);

create function fn_driver_income_report(p_from date, p_to date)
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
  salary_amount     numeric,
  total_costs       numeric,
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
    coalesce(sal.earned, 0),
    (coalesce(t.total_trabs, 0) + coalesce(dz.amount, 0)
      + coalesce(ex.total, 0) + coalesce(sal.earned, 0)) as total_costs,
    (coalesce(t.total_trip_amount, 0)
      - coalesce(t.total_trabs, 0)
      - coalesce(dz.amount, 0)
      - coalesce(ex.total, 0)
      - coalesce(sal.earned, 0)) as net_amount
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
  -- نفس دالة شاشة الرواتب: الراتب هنا هو الراتب هناك
  left join lateral (
    select fn_driver_earned_salary(s.driver_id, s.year, s.month, s.basic_salary) as earned
    from salaries s
    where s.driver_id = d.id
      and s.year  = extract(year  from mo.month_start)::int
      and s.month = extract(month from mo.month_start)::int
  ) sal on true
  where d.employment_type = 'internal'
    and (
      coalesce(t.trips_count, 0) > 0
      or coalesce(dz.amount, 0) > 0
      or coalesce(ex.total, 0) > 0
      or coalesce(sal.earned, 0) > 0
    )
  order by d.name, mo.month_start;
$fn$;

notify pgrst, 'reload schema';
