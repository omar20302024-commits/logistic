-- ============================================================================
-- 0062 — ترب خطوط السير من الرحلات الفعلية
-- ============================================================================
--
-- 🔒 دالة قراءة واحدة جديدة، وإسقاط دالة 0061 التي حلّت محلّها. لا جدول
--    يُمَس، ولا عمود، ولا بيانات.
--
-- 0061 قرأ جداول التسعيرة (المتّفق عليه). والمطلوب **ما صُرف فعلاً**:
-- نفس مصدر كشف حساب السائق — جدول الرحلات.
--
-- 🔑 التجميع على (السائق، من، إلى، **ترب الرحلة**) لا على الخط وحده.
--    فلو تغيّر الترب على نفس الخط بين رحلة وأخرى، ظهر كل مبلغ في صفّه مع
--    عدد رحلاته — وهذا ما تريد الإدارة رؤيته، لا متوسّطاً يُخفي الاختلاف.
--
-- 📌 «ترب الرحلة» هو الأساسي (driver_base_payment) — ما يأخذه على الخط.
--    و«إجمالي التربات» هو المدفوع كاملاً (driver_trip_payment) شاملاً
--    المواقع الإضافية والمبيت. والفرق بينهما مقصود ومعروض.
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

drop function if exists fn_driver_rates_report();

create or replace function fn_driver_route_trabs(p_from date, p_to date)
returns table (
  driver_id       uuid,
  driver_name     text,
  employment_type text,
  vendor_name     text,
  from_location   text,
  to_location     text,
  base_payment    numeric,
  trips_count     bigint,
  total_trabs     numeric
)
language sql stable
as $fn$
  select
    d.id,
    d.name,
    d.employment_type::text,
    v.name,
    t.from_location,
    t.to_location,
    t.driver_base_payment,
    count(*),
    coalesce(sum(t.driver_trip_payment), 0)
  from trips t
  join drivers d on d.id = t.driver_id
  left join vendors v on v.id = d.vendor_id
  where t.trip_date between p_from and p_to
    and (t.status <> 'cancelled' or should_count_cancelled())
  group by d.id, d.name, d.employment_type, v.name,
           t.from_location, t.to_location, t.driver_base_payment
  order by d.name, t.from_location, t.to_location, t.driver_base_payment;
$fn$;

notify pgrst, 'reload schema';
