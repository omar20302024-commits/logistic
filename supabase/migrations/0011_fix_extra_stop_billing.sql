-- ============================================================================
-- تصحيح مهم: فصل "سعر الموقع الإضافي للعميل" عن "ترب الموقع الإضافي للسائق"
--
-- الوضع الصحيح:
--   - المبلغ المكتوب على أي موقع (تحميل أو تنزيل) هو دائماً سعر العميل، ويُجمع
--     بالكامل ضمن سعر الرحلة (trip_amount) — مهما كان عدد المواقع.
--   - أول موقع تحميل وأول موقع تنزيل "ضمن سعر الرحلة" فقط من ناحية أنه لا يُحتسب
--     كموقع إضافي، لكن مبلغه يدخل في trip_amount بنفس الطريقة تماماً مثل أي موقع.
--   - أي موقع إضافي (تحميل زيادة أو تنزيل زيادة) يضيف للسائق ترباً ثابتاً محدَّداً
--     مسبقاً لهذا السائق (drivers.extra_stop_rate) — بصرف النظر عن المبلغ الذي
--     كتبته للعميل على هذا الموقع، لأن كل عميل وكل سائق لهما اتفاق مختلف.
-- ============================================================================

create or replace function recalc_trip_totals(p_trip_id uuid)
returns void
language plpgsql
as $$
declare
  v_loading_count    int;
  v_unloading_count  int;
  v_locations_total  numeric;
  v_base_payment     numeric;
  v_extra_rate       numeric;
  v_extra_stops      int;
begin
  select
    count(*) filter (where location_type = 'loading'),
    count(*) filter (where location_type = 'unloading'),
    coalesce(sum(amount), 0)
  into v_loading_count, v_unloading_count, v_locations_total
  from trip_locations
  where trip_id = p_trip_id;

  select t.driver_base_payment, d.extra_stop_rate
  into v_base_payment, v_extra_rate
  from trips t
  join drivers d on d.id = t.driver_id
  where t.id = p_trip_id;

  v_extra_stops := greatest(coalesce(v_loading_count, 0) - 1, 0)
                 + greatest(coalesce(v_unloading_count, 0) - 1, 0);

  update trips
  set trip_amount = v_locations_total,
      driver_trip_payment = coalesce(v_base_payment, 0) + coalesce(v_extra_rate, 0) * v_extra_stops
  where id = p_trip_id;
end;
$$;

-- تحديث ترب السائق أيضاً لو تغيّر السائق نفسه أو الترب الأساسي مباشرة (وليس فقط
-- عند تغيّر المواقع)، لأن معدل الموقع الإضافي يعتمد على السائق المختار
create or replace function sync_driver_trip_payment_on_base_change()
returns trigger
language plpgsql
as $$
declare
  v_loading_count   int;
  v_unloading_count int;
  v_extra_rate      numeric;
  v_extra_stops     int;
begin
  select
    count(*) filter (where location_type = 'loading'),
    count(*) filter (where location_type = 'unloading')
  into v_loading_count, v_unloading_count
  from trip_locations
  where trip_id = new.id;

  select extra_stop_rate into v_extra_rate from drivers where id = new.driver_id;

  v_extra_stops := greatest(coalesce(v_loading_count, 0) - 1, 0)
                 + greatest(coalesce(v_unloading_count, 0) - 1, 0);

  new.driver_trip_payment := coalesce(new.driver_base_payment, 0) + coalesce(v_extra_rate, 0) * v_extra_stops;
  return new;
end;
$$;

drop trigger if exists trg_sync_driver_trip_payment on trips;
create trigger trg_sync_driver_trip_payment
  before insert or update of driver_base_payment, driver_id on trips
  for each row execute function sync_driver_trip_payment_on_base_change();

-- إعادة حساب كل الرحلات الموجودة حالياً بالمنطق الجديد
do $$
declare
  r record;
begin
  for r in select id from trips loop
    perform recalc_trip_totals(r.id);
  end loop;
end;
$$;
