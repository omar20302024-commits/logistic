-- ============================================================================
-- 0024 — إصلاح: إعادة بناء v_trips_full بعد أعمدة 0019 و 0022
-- ============================================================================
--
-- العيب: PostgreSQL بيوسّع `t.*` **وقت إنشاء الـ view** ويثبّت قائمة الأعمدة
-- وقتها. فالأعمدة اللي اتضافت على جدول trips بعد آخر بناء للـ view
-- (base_fare, labor_fare, extra_location_fare, overnight_fare,
--  driver_overnight_payment, requester, created_by, updated_by من 0019،
--  و vehicle_id, vehicle_type_label من 0022) **مش موجودة فيها أصلاً**.
--
-- النتيجة: تقرير الرحلات كان بيرمي
--   [42703] column v_trips_full.vehicle_type_label does not exist
--
-- ⚠️ قاعدة دائمة: **أي migration بيضيف عمود على جدول trips لازم يعيد بناء
-- v_trips_full في نفس الملف.** مفيش تنبيه من قاعدة البيانات لو نسيت — الـ view
-- بتفضل شغالة بأعمدتها القديمة والخطأ بيظهر بعدين في الواجهة بس.
-- (ده ثاني مرة يحصل: أول مرة في 0013، ودي التانية.)
--
-- و fn_driver_internal_trips بترجع `setof v_trips_full` فلازم تتحذف الأول.
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

drop function if exists fn_driver_internal_trips(uuid, date, date);
drop view if exists v_trips_full;

create view v_trips_full
  with (security_invoker = true) as
select
  t.*,
  d.name as driver_name,
  c.name as company_name,
  st.settlement_number,
  v.vehicle_no,
  coalesce(l.loading_count, 0)    as loading_count,
  coalesce(l.loading_total, 0)    as loading_total,
  coalesce(l.unloading_count, 0)  as unloading_count,
  coalesce(l.unloading_total, 0)  as unloading_total
from trips t
join drivers d   on d.id = t.driver_id
join companies c on c.id = t.company_id
left join driver_settlements st on st.id = t.settlement_id
left join vehicles v on v.id = t.vehicle_id
left join v_trip_location_totals l on l.trip_id = t.id;

create or replace function fn_driver_internal_trips(
  p_driver_id uuid,
  p_from date,
  p_to   date
)
returns setof v_trips_full
language sql stable
as $$
  select * from v_trips_full
  where driver_id = p_driver_id
    and trip_date between p_from and p_to
    and (status <> 'cancelled' or should_count_cancelled())
  order by trip_date;
$$;
