-- ============================================================================
-- 0026 — نقاط التحميل الإضافية + عدد المواقع في كشف السائق
-- ============================================================================
--
-- التحميل ممكن يكون من أكتر من مكان:
--   من: الكيتشن الجديد + الكيتشن القديم + الكيتشن طريق الخرج
-- أول نقطة تحميل ضمن الأجرة الأساسية، واللي بعدها بتتحاسب بمعدَّل الشركة
-- (نفس المعدَّل المستخدم لفروع التنزيل). في المثال ده: نقطتان إضافيتان.
--
-- نفس قاعدة الفصل بـ + مع تجاهل المسافات المستخدمة في "إلى" (0025).
--
-- ⚠️ ترب السائق: نقاط التحميل الإضافية بترجع تتحسب في تربه زي ما كانت قبل
-- 0025 بالظبط (كان: greatest(loading_count-1,0) + greatest(unloading_count-1,0)).
-- 0025 شال جزء التحميل من غير قصد لما استغنى عن trip_locations، وده بيرجّعه.
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

alter table trips
  add column if not exists extra_loading_fare numeric(12,2) not null default 0
    check (extra_loading_fare >= 0);

-- ----------------------------------------------------------------------------
-- 1) عدد نقاط التحميل داخل نص "من" — نفس منطق fn_destination_count
-- ----------------------------------------------------------------------------
create or replace function fn_loading_count(p_from_location text)
returns int
language sql
immutable
as $$
  select greatest(1, (
    select count(*)::int
    from regexp_split_to_table(coalesce(p_from_location, ''), '\+') as part
    where btrim(part) <> ''
  ));
$$;

-- نقاط التحميل الإضافية = عدد نقاط التحميل − 1
create or replace function fn_extra_loading_points(p_from_location text)
returns int
language sql
immutable
as $$
  select greatest(0, fn_loading_count(p_from_location) - 1);
$$;

-- ----------------------------------------------------------------------------
-- 2) سعر الرحلة = الأساسية + العمالة + الموقع الإضافي + التحميل الإضافي + المبيت
-- ----------------------------------------------------------------------------
create or replace function fn_sync_trip_amount_from_fares()
returns trigger
language plpgsql
as $$
begin
  new.trip_amount :=
      coalesce(new.base_fare, 0)
    + coalesce(new.labor_fare, 0)
    + coalesce(new.extra_location_fare, 0)
    + coalesce(new.extra_loading_fare, 0)
    + coalesce(new.overnight_fare, 0);
  return new;
end;
$$;

drop trigger if exists trg_sync_trip_amount_from_fares on trips;
create trigger trg_sync_trip_amount_from_fares
  before insert or update of
    base_fare, labor_fare, extra_location_fare, extra_loading_fare, overnight_fare
  on trips
  for each row execute function fn_sync_trip_amount_from_fares();

-- ----------------------------------------------------------------------------
-- 3) ترب السائق: فروع التنزيل المحاسَب عليها + نقاط التحميل الإضافية
-- ----------------------------------------------------------------------------
create or replace function fn_driver_extra_stops(
  p_branches_count int,
  p_from_location  text,
  p_to_location    text
)
returns int
language sql
immutable
as $$
  select fn_chargeable_stops(p_branches_count, p_to_location)
       + fn_extra_loading_points(p_from_location);
$$;

create or replace function recalc_trip_totals(p_trip_id uuid)
returns void
language plpgsql
as $$
declare
  v_base_payment numeric;
  v_extra_rate   numeric;
  v_stops        int;
  v_overnight    numeric;
begin
  select
    t.driver_base_payment,
    t.driver_overnight_payment,
    d.extra_stop_rate,
    fn_driver_extra_stops(t.branches_count, t.from_location, t.to_location)
  into v_base_payment, v_overnight, v_extra_rate, v_stops
  from trips t
  join drivers d on d.id = t.driver_id
  where t.id = p_trip_id;

  update trips
     set driver_trip_payment = coalesce(v_base_payment, 0)
                             + coalesce(v_extra_rate, 0) * coalesce(v_stops, 0)
                             + coalesce(v_overnight, 0)
   where id = p_trip_id;
end;
$$;

create or replace function sync_driver_trip_payment_on_base_change()
returns trigger
language plpgsql
as $$
declare
  v_extra_rate numeric;
  v_stops      int;
begin
  select extra_stop_rate into v_extra_rate from drivers where id = new.driver_id;
  v_stops := fn_driver_extra_stops(new.branches_count, new.from_location, new.to_location);

  new.driver_trip_payment := coalesce(new.driver_base_payment, 0)
                           + coalesce(v_extra_rate, 0) * coalesce(v_stops, 0)
                           + coalesce(new.driver_overnight_payment, 0);
  return new;
end;
$$;

drop trigger if exists trg_sync_driver_trip_payment on trips;
create trigger trg_sync_driver_trip_payment
  before insert or update of
    driver_base_payment, driver_id, driver_overnight_payment,
    branches_count, from_location, to_location
  on trips
  for each row execute function sync_driver_trip_payment_on_base_change();

-- ----------------------------------------------------------------------------
-- 4) أنواع سيارات موجودة في ملفات الاستيراد
-- ----------------------------------------------------------------------------
update vehicle_types set is_active = true, name_ar = 'شبك', sort_order = 6 where slug = 'shabak';

insert into vehicle_types (slug, name_ar, sort_order) values
  ('crane', 'كرين (ونش)', 7)
on conflict (slug) do nothing;

-- ----------------------------------------------------------------------------
-- 5) كشف السائق الآمن: عدد المواقع الفعلي كما كُتب وقت التسجيل
--    (قبل خصم موقع لكل مدينة تنزيل — المستخدم يريد الرقم الخام)
--    🔒 لا يزال بلا سعر رحلة ولا ربح ولا ديزل (قاعدة #11)
-- ----------------------------------------------------------------------------
drop function if exists fn_driver_public_trips(uuid, date, date);

create or replace function fn_driver_public_trips(
  p_driver_id uuid,
  p_from date,
  p_to   date
)
returns table (
  trip_date            date,
  trip_number          text,
  company_name         text,
  from_location        text,
  to_location          text,
  branches_count       int,
  extra_loading_points int,
  driver_base_payment  numeric,
  driver_trip_payment  numeric
)
language sql stable
as $$
  select
    t.trip_date,
    t.trip_number,
    c.name,
    t.from_location,
    t.to_location,
    t.branches_count,
    fn_extra_loading_points(t.from_location),
    t.driver_base_payment,
    t.driver_trip_payment
  from trips t
  join companies c on c.id = t.company_id
  where t.driver_id = p_driver_id
    and t.trip_date between p_from and p_to
    and (t.status <> 'cancelled' or should_count_cancelled())
  order by t.trip_date;
$$;

-- ----------------------------------------------------------------------------
-- 6) إعادة بناء v_trips_full — القاعدة: أي عمود جديد على trips يستوجب ذلك
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
  fn_extra_loading_points(t.from_location) as extra_loading_points,
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
