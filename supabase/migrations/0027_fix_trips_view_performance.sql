-- ============================================================================
-- 0027 — إصلاح: بطء صفحة الرحلات (Gateway Timeout)
-- ============================================================================
--
-- العيب: 0026 أضاف لـ v_trips_full عموداً محسوباً بدالة لكل صف:
--     fn_extra_loading_points(t.from_location) as extra_loading_points
-- وهو عمود **لا يقرأه أي شيء في النظام** — أضفته بلا داعٍ.
--
-- وصفحة الرحلات بتطلب count: exact، فقاعدة البيانات مضطرة تنفّذ الدالة على
-- **كل الرحلات** مش على صفحة واحدة. والدالة كانت فيها regexp_split_to_table
-- جوّه استعلام فرعي، وده بيمنع المخطِّط من دمج الدالة (inline) فبتتنفّذ نداءً
-- كاملاً لكل صف. النتيجة: تجاوز المهلة.
--
-- الإصلاح شقّان:
--   1) شيل العمود من الـ view — محدش بيستخدمه.
--   2) أعِد كتابة دالتَي العدّ بتعبير سلمي (scalar) بدل الاستعلام الفرعي، فيقدر
--      المخطِّط يدمجهما. ده بيسرّع كمان كشف السائق وحساب الترب.
--
-- 🔒 النتيجة الرقمية واحدة بالظبط: "عدد الأجزاء غير الفارغة المفصولة بـ +،
--    وأقلها 1" — نفس منطق src/lib/trip-calc.ts حرفياً.
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 1) عدّ الأجزاء بتعبير سلمي قابل للدمج
--
--    ثلاث خطوات تنظيف ثم عدّ علامات + :
--      '\s*\+\s*' → '+'   يشيل المسافات حوالين العلامة (الطائف + جدة)
--      '\++'      → '+'   يدمج العلامات المتكررة (الطائف++جدة)
--      btrim(,'+')        يشيل العلامات في الطرفين (+الطائف+)
--    وبعدها عدد الأجزاء = عدد العلامات + 1، وفاضي = 1.
-- ----------------------------------------------------------------------------
create or replace function fn_split_count(p_text text)
returns int
language sql
immutable
as $$
  select case
    when cleaned = '' then 1
    else length(cleaned) - length(replace(cleaned, '+', '')) + 1
  end
  from (
    select btrim(
      regexp_replace(
        regexp_replace(btrim(coalesce(p_text, '')), '\s*\+\s*', '+', 'g'),
        '\++', '+', 'g'
      ),
      '+'
    ) as cleaned
  ) s;
$$;

create or replace function fn_destination_count(p_to_location text)
returns int
language sql
immutable
as $$
  select fn_split_count(p_to_location);
$$;

create or replace function fn_loading_count(p_from_location text)
returns int
language sql
immutable
as $$
  select fn_split_count(p_from_location);
$$;

-- ----------------------------------------------------------------------------
-- 2) إعادة بناء v_trips_full بدون العمود المحسوب
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

-- ----------------------------------------------------------------------------
-- 3) فهارس للفلاتر المستخدمة في صفحة الرحلات
--    الصفحة بتفلتر بالتاريخ والسائق والشركة والحالة، وبتطلب count: exact
-- ----------------------------------------------------------------------------
create index if not exists idx_trips_date_desc on trips(trip_date desc);
create index if not exists idx_trips_driver_date on trips(driver_id, trip_date desc);
create index if not exists idx_trips_company_date on trips(company_id, trip_date desc);
create index if not exists idx_trips_status on trips(status);
