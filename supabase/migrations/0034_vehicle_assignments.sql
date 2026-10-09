-- ============================================================================
-- 0034 — سيارة واحدة لسائق واحد، والتحويل بتاريخ وسبب
-- ============================================================================
--
-- 🔒 إضافي: جدول جديد وفهرس ودوال. لا delete ولا truncate ولا drop table،
--    ولا عمود يُحذف. كل بيانات السيارات والسائقين تبقى كما هي.
--
-- المطلوب: السيارة المرتبطة بسائق لا يستخدمها سائق آخر، إلا بتحويل مسجَّل
--          بتاريخه وسببه.
--
-- التنفيذ:
--   1) فهرس فريد جزئي على drivers(vehicle_id) — القاعدة تُفرض في قاعدة البيانات
--      لا في الواجهة، فلا يكسرها استدعاء مباشر أو استيراد.
--   2) جدول vehicle_assignments يحفظ تاريخ كل ارتباط: من، ومتى بدأ، ومتى
--      انتهى، ولماذا حُوِّل.
--   3) دالة fn_assign_vehicle تنفّذ التحويل كله في عملية واحدة: تُنهي ارتباط
--      السائق القديم وتفتح ارتباط الجديد معاً — فلا تقع حالة وسطى تكسر الفهرس.
--
-- ⚠️ قبل أي شيء: لو كانت هناك سيارة مرتبطة بأكثر من سائق الآن، الملف **يتوقف
--    برسالة واضحة ولا يغيّر شيئاً**. لن أختار نيابةً عنك أي سائق يحتفظ بها.
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 0) فحص أمان: هل توجد سيارة عند أكثر من سائق؟
-- ----------------------------------------------------------------------------
do $do$
declare
  v_dups text;
begin
  select string_agg(x.label, '، ')
  into v_dups
  from (
    select v.vehicle_no || ' ← ' || string_agg(d.name, ' و ') as label
    from drivers d
    join vehicles v on v.id = d.vehicle_id
    where d.vehicle_id is not null
    group by v.id, v.vehicle_no
    having count(*) > 1
  ) x;

  if v_dups is not null then
    raise exception
      'توقف بلا أي تغيير: السيارات التالية مرتبطة بأكثر من سائق — %. افصلها من صفحة السائقين بحيث تبقى لسائق واحد، ثم أعد تشغيل هذا الملف.',
      v_dups;
  end if;
end
$do$;

-- ----------------------------------------------------------------------------
-- 1) سجل ارتباطات السيارات
--    to_date فارغ = الارتباط قائم الآن.
-- ----------------------------------------------------------------------------
create table if not exists vehicle_assignments (
  id         uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  driver_id  uuid not null references drivers(id)  on delete cascade,
  from_date  date not null default current_date,
  to_date    date,
  reason     text,
  notes      text,
  created_at timestamptz not null default now(),

  constraint chk_assignment_period check (to_date is null or to_date >= from_date)
);

create index if not exists idx_vassign_vehicle on vehicle_assignments(vehicle_id, from_date desc);
create index if not exists idx_vassign_driver  on vehicle_assignments(driver_id, from_date desc);

-- ارتباط مفتوح واحد لكل سيارة
create unique index if not exists idx_vassign_open_vehicle
  on vehicle_assignments(vehicle_id) where to_date is null;

alter table vehicle_assignments enable row level security;
drop policy if exists "vehicle_assignments_admin_all" on vehicle_assignments;
create policy "vehicle_assignments_admin_all" on vehicle_assignments
  for all using ((select is_admin())) with check ((select is_admin()));

-- ----------------------------------------------------------------------------
-- 2) القاعدة نفسها: سيارة واحدة لسائق واحد
-- ----------------------------------------------------------------------------
create unique index if not exists idx_drivers_vehicle_unique
  on drivers(vehicle_id) where vehicle_id is not null;

-- ----------------------------------------------------------------------------
-- 3) تسجيل الارتباطات القائمة
--    لا نعرف متى بدأت فعلاً، فنسجّلها بتاريخ اليوم وسبب يوضّح أنها سابقة
--    لتفعيل السجل — أصدق من اختلاق تاريخ.
-- ----------------------------------------------------------------------------
insert into vehicle_assignments (vehicle_id, driver_id, from_date, reason)
select d.vehicle_id, d.id, current_date, 'ارتباط قائم قبل تفعيل سجل التحويلات'
from drivers d
where d.vehicle_id is not null
  and not exists (
    select 1 from vehicle_assignments a
    where a.vehicle_id = d.vehicle_id and a.to_date is null
  );

-- ----------------------------------------------------------------------------
-- 4) التحويل في عملية واحدة
--
--    plpgsql لا sql: فيه خطوات مترتّبة وشروط. والأهم أن إنهاء القديم وفتح
--    الجديد يتمّان معاً — لو فُصلا لوقعت لحظة تكسر الفهرس الفريد.
-- ----------------------------------------------------------------------------
create or replace function fn_assign_vehicle(
  p_driver_id  uuid,
  p_vehicle_id uuid,
  p_date       date default current_date,
  p_reason     text default null
)
returns void
language plpgsql
as $fn$
declare
  v_holder uuid;
begin
  if p_driver_id is null then
    raise exception 'السائق مطلوب';
  end if;

  -- فكّ ارتباط: السيارة فارغة
  if p_vehicle_id is null then
    update vehicle_assignments
       set to_date = p_date,
           reason  = coalesce(nullif(btrim(p_reason), ''), reason)
     where driver_id = p_driver_id and to_date is null;

    update drivers set vehicle_id = null where id = p_driver_id;
    return;
  end if;

  select id into v_holder
  from drivers
  where vehicle_id = p_vehicle_id and id <> p_driver_id;

  -- السيارة عند سائق آخر → تحويل، والسبب إلزامي
  if v_holder is not null then
    if coalesce(btrim(p_reason), '') = '' then
      raise exception 'سبب التحويل مطلوب: السيارة مرتبطة بسائق آخر';
    end if;

    update vehicle_assignments
       set to_date = p_date,
           reason  = coalesce(reason, '') ||
                     case when coalesce(reason,'') = '' then '' else ' — ' end ||
                     'حُوِّلت: ' || btrim(p_reason)
     where driver_id = v_holder and vehicle_id = p_vehicle_id and to_date is null;

    update drivers set vehicle_id = null where id = v_holder;
  end if;

  -- السائق كان على سيارة أخرى → أغلقها
  update vehicle_assignments
     set to_date = p_date
   where driver_id = p_driver_id and to_date is null and vehicle_id <> p_vehicle_id;

  update drivers set vehicle_id = p_vehicle_id where id = p_driver_id;

  -- افتح الارتباط الجديد إن لم يكن مفتوحاً أصلاً
  if not exists (
    select 1 from vehicle_assignments
    where vehicle_id = p_vehicle_id and driver_id = p_driver_id and to_date is null
  ) then
    insert into vehicle_assignments (vehicle_id, driver_id, from_date, reason)
    values (p_vehicle_id, p_driver_id, p_date, nullif(btrim(p_reason), ''));
  end if;
end
$fn$;

-- ----------------------------------------------------------------------------
-- 5) من يحمل كل سيارة الآن — للواجهة
-- ----------------------------------------------------------------------------
drop view if exists v_vehicle_current_driver;

create view v_vehicle_current_driver
  with (security_invoker = true) as
select
  v.id         as vehicle_id,
  v.vehicle_no,
  v.type_slug,
  v.status,
  d.id         as driver_id,
  d.name       as driver_name
from vehicles v
left join drivers d on d.vehicle_id = v.id;
