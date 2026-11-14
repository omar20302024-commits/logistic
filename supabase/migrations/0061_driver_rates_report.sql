-- ============================================================================
-- 0061 — تقرير ترب خطوط السير لكل سائق
-- ============================================================================
--
-- 🔒 دالة قراءة واحدة جديدة. لا جدول يُمَس، ولا عمود، ولا بيانات.
--
-- المطلوب: كشف يُقدَّم للإدارة يوضّح كم يأخذ كل سائق على كل خط سير.
--
-- ⚠️ الترب الفعلي ليس في جدول واحد، بل ثلاث طبقات بأولوية:
--      1) خط سير خاص بالسائق        (driver_route_rates)
--      2) خط سير مورّده              (vendor_route_rates)
--      3) خط سير عام لسائقي الشركة   (route_rates)
--    والأعلى يحجب ما دونه. والتقرير يُظهر **ما يُطبَّق فعلاً** مع مصدره،
--    لا الجداول الثلاثة متجاورة — وإلا قرأت الإدارة رقماً لا يُصرف.
--
-- 🚫 العام لا يسري على الخارجيين (قرار 0035): فلا يُدرج لهم.
--
-- 📌 نفس ترتيب الأولوية في v_driver_effective_rates و resolveBasePayment —
--    ثلاثة مواضع تقول الشيء نفسه، فأيّ تغيير في القاعدة يُنقل إليها جميعاً.
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

create or replace function fn_driver_rates_report()
returns table (
  driver_id       uuid,
  driver_name     text,
  employment_type text,
  vendor_name     text,
  from_city       text,
  to_city         text,
  trab_amount     numeric,
  source          text,
  default_payment numeric
)
language sql stable
as $fn$
  with layered as (
    -- 1) خاص بالسائق
    select r.driver_id, r.from_city, r.to_city, r.trab_amount,
           'خاص بالسائق'::text as source, 1 as rank
    from driver_route_rates r

    union all

    -- 2) خط سير المورّد — يسري على كل سائقيه
    select d.id, vr.from_city, vr.to_city, vr.trab_amount,
           'المورّد'::text, 2
    from vendor_route_rates vr
    join drivers d on d.vendor_id = vr.vendor_id

    union all

    -- 3) العام — لسائقي الشركة وحدهم
    select d.id, g.from_city, g.to_city, g.trab_amount,
           'عام'::text, 3
    from route_rates g
    cross join drivers d
    where d.employment_type = 'internal'
  ),
  effective as (
    select distinct on (driver_id, from_city, to_city)
      driver_id, from_city, to_city, trab_amount, source
    from layered
    order by driver_id, from_city, to_city, rank
  )
  select
    d.id,
    d.name,
    d.employment_type::text,
    v.name,
    e.from_city,
    e.to_city,
    e.trab_amount,
    e.source,
    d.default_trip_payment
  from drivers d
  join effective e on e.driver_id = d.id
  left join vendors v on v.id = d.vendor_id
  where d.status = 'active'
  order by d.name, e.from_city, e.to_city;
$fn$;

notify pgrst, 'reload schema';
