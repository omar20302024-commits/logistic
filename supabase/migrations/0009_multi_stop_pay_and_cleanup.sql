-- ============================================================================
-- 1) حذف مفهوم "مؤقت/مثبت" لمبالغ المواقع (لم يعد مطلوباً)
-- 2) مواقع التنزيل المتعددة: أول موقع تنزيل ضمن سعر الرحلة، وأي موقع إضافي
--    يُضاف تلقائياً كتربة زيادة للسائق (بدل ما يُحتسب ضمن سعر الرحلة)
-- 3) تربة أساسية افتراضية لكل سائق (تُملأ تلقائياً عند إنشاء رحلة جديدة)
-- ============================================================================

-- نحتاج حذف وإعادة إنشاء الكائنات التالية بالترتيب الصحيح لأن عمود
-- amount_status سيُحذف، وشكل v_trips_full سيتغيّر:
drop function if exists fn_driver_public_trips(uuid, date, date);
drop function if exists fn_driver_internal_trips(uuid, date, date);
drop view if exists v_trips_full;
drop view if exists v_trip_location_totals;

-- ----------------------------------------------------------------------------
-- حذف عمود حالة المبلغ (مؤقت/مثبت) من مواقع الرحلة
-- ----------------------------------------------------------------------------
alter table trip_locations drop column amount_status;
drop type if exists amount_status;

-- ترتيب المواقع (يحدّد أي موقع تنزيل هو "الأول" المشمول بسعر الرحلة)
alter table trip_locations add column sort_order integer not null default 0;

-- ----------------------------------------------------------------------------
-- تربة أساسية افتراضية لكل سائق + تربة أساسية لكل رحلة (مُدخلة يدوياً)
-- ----------------------------------------------------------------------------
alter table drivers add column default_trip_payment numeric(12,2) not null default 0
  check (default_trip_payment >= 0);

alter table trips add column driver_base_payment numeric(12,2) not null default 0
  check (driver_base_payment >= 0);

-- الحفاظ على البيانات الحالية: التربة المُدخلة سابقاً تصبح "التربة الأساسية"
update trips set driver_base_payment = driver_trip_payment;

-- ----------------------------------------------------------------------------
-- إعادة بناء views المواقع بدون amount_status
-- ----------------------------------------------------------------------------
create or replace view v_trip_location_totals
  with (security_invoker = true) as
select
  trip_id,
  count(*) filter (where location_type = 'loading')  as loading_count,
  coalesce(sum(amount) filter (where location_type = 'loading'), 0)   as loading_total,
  count(*) filter (where location_type = 'unloading') as unloading_count,
  coalesce(sum(amount) filter (where location_type = 'unloading'), 0) as unloading_total
from trip_locations
group by trip_id;

create or replace view v_trips_full
  with (security_invoker = true) as
select
  t.*,
  d.name as driver_name,
  c.name as company_name,
  coalesce(l.loading_count, 0)    as loading_count,
  coalesce(l.loading_total, 0)    as loading_total,
  coalesce(l.unloading_count, 0)  as unloading_count,
  coalesce(l.unloading_total, 0)  as unloading_total
from trips t
join drivers d   on d.id = t.driver_id
join companies c on c.id = t.company_id
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

-- كشف السائق الآمن: نضيف التربة الأساسية حتى يظهر للسائق تفصيل
-- (تربة الرحلة الأساسية + تربة المواقع الإضافية = الإجمالي)
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
  loading_count        bigint,
  unloading_count      bigint,
  driver_base_payment  numeric,
  driver_trip_payment  numeric
)
language sql stable
as $$
  select
    trip_date, trip_number, company_name, from_location, to_location,
    loading_count, unloading_count, driver_base_payment, driver_trip_payment
  from v_trips_full
  where driver_id = p_driver_id
    and trip_date between p_from and p_to
    and (status <> 'cancelled' or should_count_cancelled())
  order by trip_date;
$$;

-- ----------------------------------------------------------------------------
-- إعادة حساب سعر الرحلة وتربة السائق معاً كل مرة تتغيّر فيها مواقع الرحلة:
--   سعر الرحلة      = كل مواقع التحميل + أول موقع تنزيل فقط (الأقل ترتيباً)
--   تربة السائق      = التربة الأساسية + مجموع مبالغ مواقع التنزيل الإضافية
-- ----------------------------------------------------------------------------
create or replace function recalc_trip_totals(p_trip_id uuid)
returns void
language plpgsql
as $$
declare
  v_first_unloading_id uuid;
  v_loading_total       numeric;
  v_first_unloading_amt numeric;
  v_extra_unloading_total numeric;
  v_base_payment        numeric;
begin
  select id into v_first_unloading_id
  from trip_locations
  where trip_id = p_trip_id and location_type = 'unloading'
  order by sort_order, created_at
  limit 1;

  select coalesce(sum(amount), 0) into v_loading_total
  from trip_locations
  where trip_id = p_trip_id and location_type = 'loading';

  select coalesce(amount, 0) into v_first_unloading_amt
  from trip_locations
  where id = v_first_unloading_id;

  select coalesce(sum(amount), 0) into v_extra_unloading_total
  from trip_locations
  where trip_id = p_trip_id
    and location_type = 'unloading'
    and (v_first_unloading_id is null or id <> v_first_unloading_id);

  select driver_base_payment into v_base_payment
  from trips where id = p_trip_id;

  update trips
  set trip_amount = v_loading_total + coalesce(v_first_unloading_amt, 0),
      driver_trip_payment = coalesce(v_base_payment, 0) + v_extra_unloading_total
  where id = p_trip_id;
end;
$$;

create or replace function sync_trip_amount()
returns trigger
language plpgsql
as $$
declare
  v_trip_id uuid;
begin
  if (tg_op = 'INSERT' or tg_op = 'UPDATE') then
    v_trip_id := new.trip_id;
    perform recalc_trip_totals(v_trip_id);
  end if;

  if (tg_op = 'DELETE') then
    perform recalc_trip_totals(old.trip_id);
  elsif (tg_op = 'UPDATE' and old.trip_id is distinct from new.trip_id) then
    perform recalc_trip_totals(old.trip_id);
  end if;

  return coalesce(new, old);
end;
$$;
-- (trg_sync_trip_amount على trip_locations موجود بالفعل من migration 0001 ويستخدم هذه الدالة)

-- تحديث تربة السائق تلقائياً لو غيّرنا التربة الأساسية للرحلة مباشرة
create or replace function sync_driver_trip_payment_on_base_change()
returns trigger
language plpgsql
as $$
declare
  v_first_unloading_id uuid;
  v_extra_unloading_total numeric;
begin
  select id into v_first_unloading_id
  from trip_locations
  where trip_id = new.id and location_type = 'unloading'
  order by sort_order, created_at
  limit 1;

  select coalesce(sum(amount), 0) into v_extra_unloading_total
  from trip_locations
  where trip_id = new.id
    and location_type = 'unloading'
    and (v_first_unloading_id is null or id <> v_first_unloading_id);

  new.driver_trip_payment := coalesce(new.driver_base_payment, 0) + v_extra_unloading_total;
  return new;
end;
$$;

drop trigger if exists trg_sync_driver_trip_payment on trips;
create trigger trg_sync_driver_trip_payment
  before insert or update of driver_base_payment on trips
  for each row execute function sync_driver_trip_payment_on_base_change();
