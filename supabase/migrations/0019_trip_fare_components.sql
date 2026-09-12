-- ============================================================================
-- 0019 — بنود الأجرة + صاحب الطلب + الحالات + سجل من أنشأ/عدّل
-- ============================================================================
--
-- سعر الرحلة كان بيتحسب من مجموع مبالغ مواقعها. دلوقتي بقى بيتحسب من أربعة
-- بنود صريحة زي نظام wattam:
--
--   سعر الرحلة (العميل) = الأجرة الأساسية + أجرة العمالة + أجرة الموقع الإضافي
--                        + أجرة المبيت
--
-- (المرتجع اتشال بطلب المستخدم: المرتجع بيتسجل كرحلة عادية، فمالوش معنى كبند.
--  والمبيت اتضاف لأن السائق ممكن يستنى لليوم التاني عشان التنزيل.)
--
-- ⚠️ معادلة الترب اتضاف لها بند اختياري واحد بس (بدل المبيت)، والباقي زي ما هو:
--   ترب السائق = الترب الأساسي + (المواقع الإضافية × معدل السائق) + بدل المبيت
-- بدل المبيت صفر افتراضياً، فكل رحلة قديمة بتطلع بنفس تربها بالظبط. وهو بند
-- لكل رحلة مش معدل ثابت، لأن السائق يستحقه "في بعض الأوقات" بس.
-- وده بيخلي قاعدة #10 صريحة ومتناظرة أخيراً: للعميل معدله وللسائق معدله،
-- كلٌّ بيتحسب من مصدره المنفصل تماماً.
--
-- 🔒 صفر فقد في البيانات التاريخية: كل رحلة قديمة بتاخد base_fare = سعرها
-- الحالي بالظبط، والبنود التلاتة التانية صفر. فالمجموع يفضل هو هو، وكل تقرير وربح
-- يفضل زي ما هو بالمليم.
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 1) حالات الرحلة: إضافة مش استبدال
--    'cancelled' لازم تفضل — فيه ~10 دوال بتعتمد عليها عبر should_count_cancelled()
--    وإعداد "الرحلات الملغاة لا تدخل الأرباح" مبني عليها.
-- ----------------------------------------------------------------------------
alter type trip_status add value if not exists 'completed_invoiced';
alter type trip_status add value if not exists 'completed_not_invoiced';
alter type trip_status add value if not exists 'suspended';
alter type trip_status add value if not exists 'delivered_returned';

-- ----------------------------------------------------------------------------
-- 2) سعر الموقع الإضافي للعميل — نظير extra_stop_rate بتاع السائق
-- ----------------------------------------------------------------------------
alter table companies
  add column if not exists extra_location_rate numeric(12,2) not null default 0
    check (extra_location_rate >= 0);

comment on column companies.extra_location_rate is
  'سعر الموقع الإضافي الواحد لهذا العميل. منفصل تماماً عن drivers.extra_stop_rate';

-- ----------------------------------------------------------------------------
-- 3) بنود الأجرة + صاحب الطلب + سجل التعديل
-- ----------------------------------------------------------------------------
alter table trips
  add column if not exists base_fare           numeric(12,2) not null default 0
    check (base_fare >= 0),
  add column if not exists labor_fare          numeric(12,2) not null default 0
    check (labor_fare >= 0),
  add column if not exists extra_location_fare numeric(12,2) not null default 0
    check (extra_location_fare >= 0),
  add column if not exists overnight_fare      numeric(12,2) not null default 0
    check (overnight_fare >= 0),
  -- بدل مبيت السائق: اختياري لكل رحلة، مش معدَّل ثابت للسائق.
  -- السبب: المستخدم قال السائق يستحق عن المبيت "في بعض الأوقات" — فمعدَّل دائم
  -- هيتطبّق حتى لما ما يستحقش، وده كذب على الواقع. صفر افتراضاً، يتكتب لما يستحق.
  add column if not exists driver_overnight_payment numeric(12,2) not null default 0
    check (driver_overnight_payment >= 0),
  add column if not exists requester           text,
  add column if not exists created_by          uuid references profiles(id) on delete set null,
  add column if not exists updated_by          uuid references profiles(id) on delete set null;

-- ----------------------------------------------------------------------------
-- 4) الترحيل: كل رحلة قديمة تاخد سعرها الحالي في الأجرة الأساسية
--    لازم يحصل قبل التريغر الجديد، وبيتنفّذ مرة واحدة بس (الشرط بيحميه من
--    إعادة التشغيل: الرحلات اللي اتعبّت خلاص base_fare بتاعها مش صفر)
-- ----------------------------------------------------------------------------
update trips
   set base_fare = trip_amount
 where base_fare = 0
   and trip_amount > 0;

-- ----------------------------------------------------------------------------
-- 5) سعر الرحلة بقى يتحسب من البنود التلاتة
--    تريغر before على trips نفسه — أبسط وأضمن من تعديل recalc_trip_totals،
--    لأنه بيمسك أي تعديل على أي بند أياً كان مصدره
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
    + coalesce(new.overnight_fare, 0);
  return new;
end;
$$;

drop trigger if exists trg_sync_trip_amount_from_fares on trips;
create trigger trg_sync_trip_amount_from_fares
  before insert or update of base_fare, labor_fare, extra_location_fare, overnight_fare
  on trips
  for each row execute function fn_sync_trip_amount_from_fares();

-- ----------------------------------------------------------------------------
-- 6) recalc_trip_totals ما بقاش يلمس سعر الرحلة
--    المواقع بقت تأثّر على ترب السائق بس (عدد المواقع الإضافية × معدله).
--    مبالغ المواقع بقت توزيع تكلفة على الفروع، مش مصدر السعر — ده بيتبني في 0021.
-- ----------------------------------------------------------------------------
create or replace function recalc_trip_totals(p_trip_id uuid)
returns void
language plpgsql
as $$
declare
  v_loading_count    int;
  v_unloading_count  int;
  v_base_payment     numeric;
  v_extra_rate       numeric;
  v_extra_stops      int;
begin
  select
    count(*) filter (where location_type = 'loading'),
    count(*) filter (where location_type = 'unloading')
  into v_loading_count, v_unloading_count
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
     set driver_trip_payment = coalesce(v_base_payment, 0)
                             + coalesce(v_extra_rate, 0) * v_extra_stops
                             + coalesce(driver_overnight_payment, 0)
   where id = p_trip_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 7) نفس الإضافة في تريغر trips: بدل المبيت جزء من ترب السائق
--    والتريغر لازم يشتغل كمان لما بدل المبيت نفسه يتغيّر
-- ----------------------------------------------------------------------------
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

  new.driver_trip_payment := coalesce(new.driver_base_payment, 0)
                           + coalesce(v_extra_rate, 0) * v_extra_stops
                           + coalesce(new.driver_overnight_payment, 0);
  return new;
end;
$$;

drop trigger if exists trg_sync_driver_trip_payment on trips;
create trigger trg_sync_driver_trip_payment
  before insert or update of driver_base_payment, driver_id, driver_overnight_payment on trips
  for each row execute function sync_driver_trip_payment_on_base_change();
