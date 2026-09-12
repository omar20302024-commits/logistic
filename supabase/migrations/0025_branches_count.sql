-- ============================================================================
-- 0025 — عدد الفروع رقماً واحداً بدل قائمة مواقع
-- ============================================================================
--
-- بدل ما المستخدم يضيف كل موقع تنزيل في صف مستقل، بقى يكتب رقم واحد:
-- "عدد الفروع في الرحلة". وده بيبسّط الإدخال جداً للرحلات اللي فيها 11 فرع.
--
-- ⚠️ ده بيغيّر مصدر "المواقع الإضافية" في معادلتين:
--   أجرة الموقع الإضافي (العميل) = الفروع المحاسَب عليها × معدَّل الشركة
--   ترب المواقع الإضافية (السائق) = الفروع المحاسَب عليها × معدَّل السائق
-- كل واحد بمعدَّله المنفصل زي ما هو (قاعدة #10)، بس العدد بقى من branches_count
-- مش من عدد صفوف trip_locations.
--
-- 🔑 قاعدة الخصم: أول فرع في كل مدينة تنزيل مش بيتحاسب لأنه ضمن الأجرة
-- الأساسية. فلو "إلى" فيها أكتر من مدينة مفصولة بـ + بيتخصم فرع لكل مدينة:
--   السلي → الطائف           · 11 فرع → 10 محاسَب عليها
--   الرياض → الطائف+المدينة+جدة · 13 فرع → 10 محاسَب عليها
-- والفصل بيتجاهل المسافات، فـ "الطائف+المدينة" و"الطائف + المدينة" واحد.
--
-- 🔒 البيانات القديمة: trip_locations بكل صفوفها زي ما هي ومحدش بيلمسها،
-- و branches_count بيتعبّى للرحلات القديمة من عدد مواقع التنزيل المسجَّلة
-- فعلاً + مدن التنزيل، عشان تربها ما يتغيّرش.
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

alter table trips
  add column if not exists branches_count     int not null default 0
    check (branches_count >= 0),
  add column if not exists vehicle_type_slug  text references vehicle_types(slug) on delete set null;

-- ----------------------------------------------------------------------------
-- 1) عدد مدن التنزيل داخل نص "إلى" — المفصول بـ + مع تجاهل المسافات
--    أقل قيمة 1 حتى لو النص فاضي، لأن كل رحلة لها وجهة واحدة على الأقل
-- ----------------------------------------------------------------------------
create or replace function fn_destination_count(p_to_location text)
returns int
language sql
immutable
as $$
  select greatest(1, (
    select count(*)::int
    from regexp_split_to_table(coalesce(p_to_location, ''), '\+') as part
    where btrim(part) <> ''
  ));
$$;

-- ----------------------------------------------------------------------------
-- 2) الفروع المحاسَب عليها = إجمالي الفروع − عدد مدن التنزيل
-- ----------------------------------------------------------------------------
create or replace function fn_chargeable_stops(p_branches_count int, p_to_location text)
returns int
language sql
immutable
as $$
  select greatest(0, coalesce(p_branches_count, 0) - fn_destination_count(p_to_location));
$$;

-- ----------------------------------------------------------------------------
-- 3) ترحيل الرحلات القديمة: نعبّي branches_count بحيث يطلع نفس عدد المواقع
--    الإضافية اللي كان بيتحسب بيه تربها، فالترب ما يتغيّرش ولا ريال
--
--    الترب القديم كان: (مواقع التحميل − 1) + (مواقع التنزيل − 1)
--    والجديد: branches_count − عدد مدن التنزيل
--    فنحط branches_count = القديم + عدد مدن التنزيل
-- ----------------------------------------------------------------------------
update trips t
   set branches_count = sub.old_extra + fn_destination_count(t.to_location)
  from (
    select
      tl.trip_id,
      greatest(count(*) filter (where tl.location_type = 'loading') - 1, 0)
      + greatest(count(*) filter (where tl.location_type = 'unloading') - 1, 0) as old_extra
    from trip_locations tl
    group by tl.trip_id
  ) sub
 where sub.trip_id = t.id
   and t.branches_count = 0;

-- ----------------------------------------------------------------------------
-- 4) ترب السائق بقى من branches_count
-- ----------------------------------------------------------------------------
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
    fn_chargeable_stops(t.branches_count, t.to_location)
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
  v_stops := fn_chargeable_stops(new.branches_count, new.to_location);

  new.driver_trip_payment := coalesce(new.driver_base_payment, 0)
                           + coalesce(v_extra_rate, 0) * coalesce(v_stops, 0)
                           + coalesce(new.driver_overnight_payment, 0);
  return new;
end;
$$;

-- التريغر لازم يشتغل كمان لما عدد الفروع أو وجهة الرحلة تتغيّر
drop trigger if exists trg_sync_driver_trip_payment on trips;
create trigger trg_sync_driver_trip_payment
  before insert or update of
    driver_base_payment, driver_id, driver_overnight_payment, branches_count, to_location
  on trips
  for each row execute function sync_driver_trip_payment_on_base_change();

-- ----------------------------------------------------------------------------
-- 5) أنواع السيارات حسب قائمة المستخدم
-- ----------------------------------------------------------------------------
update vehicle_types set name_ar = 'دينا'  where slug = 'diana';
update vehicle_types set name_ar = 'سطحة' where slug = 'sata';

insert into vehicle_types (slug, name_ar, sort_order) values
  ('lorry',       'لوري',     3),
  ('dina_shabak', 'دينا شبك', 4)
on conflict (slug) do nothing;

update vehicle_types set sort_order = 1 where slug = 'diana';
update vehicle_types set sort_order = 2 where slug = 'trailer';
update vehicle_types set sort_order = 5 where slug = 'sata';
update vehicle_types set is_active = false where slug = 'shabak';

-- ----------------------------------------------------------------------------
-- 6) إعادة بناء v_trips_full — القاعدة المذكورة في 0024:
--    أي عمود جديد على trips لازم يعيد بناء الـ view في نفس الملف
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
