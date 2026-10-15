-- ============================================================================
-- 0038 — اقتراح خطوط السير العامة من الرحلات لا من معدَّلات السواقين
-- ============================================================================
--
-- 🔒 إضافي: إعادة تعريف دالة اقتراح واحدة. لا delete ولا truncate ولا drop
--    table، ولا تُكتب خطوط سير — الدالة تقترح والمستخدم يعتمد.
--
-- العيب في 0035: الاقتراح كان يقرأ driver_route_rates، وهي الجدول الذي قلّة
-- ما فيه هي سبب بناء الخطوط العامة أصلاً. فالاقتراح كان يستقي من الفراغ.
--
-- الصواب: الخطوط الحقيقية في **الرحلات نفسها** — كل زوج (تحميل، تنزيل) مسجَّل
-- فعلاً، ومعه ما دُفع عليه. فنقترح من العمل الواقع لا من جدول شبه فارغ.
--
-- لكل زوج: الترب الأساسي الأكثر تكراراً، وعدد الرحلات عليه، وكم رحلة خالفته.
--
-- ⚠️ لسائقي الشركة فقط — الخطوط العامة لا يرثها الموردون (0035)، فإدخال
--    أسعارهم في المتوسط يفسده.
--
-- ⚠️ والرحلات بترب صفر مستبعَدة: المستورَد قد يدخل بصفر، ولو دخل في الحساب
--    لسحب القيمة الأكثر تكراراً إلى الصفر.
--
-- تغيّرت أعمدة الإرجاع (drivers_count ← trips_count) فيلزم drop قبل create.
-- الدالة غير ممنوحة لـ anon، فلا صلاحيات تسقط معها.
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

drop function if exists fn_suggest_route_rates();

create or replace function fn_suggest_route_rates()
returns table (
  from_city      text,
  to_city        text,
  suggested_trab numeric,
  trips_count    bigint,
  differing      bigint,
  already_global boolean
)
language sql
stable
as $fn$
  with trip_routes as (
    select
      btrim(t.from_location) as from_city,
      btrim(t.to_location)   as to_city,
      t.driver_base_payment  as trab
    from trips t
    join drivers d on d.id = t.driver_id
    where d.employment_type = 'internal'
      and t.status <> 'cancelled'
      and coalesce(t.driver_base_payment, 0) > 0
      and btrim(coalesce(t.from_location, '')) <> ''
      and btrim(coalesce(t.to_location, '')) <> ''
  ),
  per_route as (
    select
      from_city,
      to_city,
      mode() within group (order by trab) as suggested_trab,
      count(*)                            as trips_count
    from trip_routes
    group by from_city, to_city
  )
  select
    p.from_city,
    p.to_city,
    p.suggested_trab,
    p.trips_count,
    (select count(*) from trip_routes r
      where r.from_city = p.from_city
        and r.to_city = p.to_city
        and r.trab <> p.suggested_trab) as differing,
    exists (
      select 1 from route_rates g
      where g.from_city = p.from_city and g.to_city = p.to_city
    ) as already_global
  from per_route p
  order by p.trips_count desc, p.from_city, p.to_city;
$fn$;
