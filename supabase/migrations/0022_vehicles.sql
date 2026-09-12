-- ============================================================================
-- 0022 — السيارات وأنواعها
-- ============================================================================
--
-- النظام ما كانش فيه سيارات إطلاقاً. دلوقتي فيه سجل سيارات، وكل سائق ممكن
-- تتربط بيه سيارة، وكل رحلة بتسجّل السيارة ونوعها.
--
-- الأنواع في جدول مستقل مش enum، عشان تقدر تضيف نوع جديد من الواجهة من غير
-- migration جديد. الأنواع الأولية زي wattam: ديانا/تريلا/شبك/سطة/أخرى.
--
-- كل ده اختياري بالكامل: رحلة من غير سيارة شغالة زي ما هي، وكل الرحلات
-- القديمة ما تأثرتش.
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 1) أنواع السيارات
-- ----------------------------------------------------------------------------
create table if not exists vehicle_types (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name_ar    text not null,
  sort_order int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

alter table vehicle_types enable row level security;

drop policy if exists "vehicle_types_admin_all" on vehicle_types;
create policy "vehicle_types_admin_all" on vehicle_types
  for all using (is_admin()) with check (is_admin());

insert into vehicle_types (slug, name_ar, sort_order) values
  ('diana',   'ديانا', 1),
  ('trailer', 'تريلا', 2),
  ('shabak',  'شبك',   3),
  ('sata',    'سطة',   4),
  ('other',   'أخرى',  5)
on conflict (slug) do nothing;

-- ----------------------------------------------------------------------------
-- 2) السيارات
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'vehicle_status') then
    create type vehicle_status as enum ('active', 'inactive', 'maintenance');
  end if;
end $$;

create table if not exists vehicles (
  id          uuid primary key default gen_random_uuid(),
  vehicle_no  text not null unique,
  plate_no    text,
  type_slug   text references vehicle_types(slug) on delete set null,
  status      vehicle_status not null default 'active',
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_vehicles_type on vehicles(type_slug);

alter table vehicles enable row level security;

drop policy if exists "vehicles_admin_all" on vehicles;
create policy "vehicles_admin_all" on vehicles
  for all using (is_admin()) with check (is_admin());

drop trigger if exists trg_vehicles_updated_at on vehicles;
create trigger trg_vehicles_updated_at
  before update on vehicles
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 3) سيارة السائق — تُقترح تلقائياً في نموذج الرحلة عند اختياره
--    on delete set null: حذف السيارة ما يحذفش السائق
-- ----------------------------------------------------------------------------
alter table drivers
  add column if not exists vehicle_id uuid references vehicles(id) on delete set null;

-- ----------------------------------------------------------------------------
-- 4) سيارة الرحلة + نوعها
--    vehicle_type_label نسخة نصية من اسم النوع وقت الرحلة عن قصد: لو السيارة
--    اتغيّر نوعها بعدين أو اتحذفت، الرحلة تفضل شايلة النوع اللي اتنفذت بيه
--    فعلاً — نفس مبدأ branch_code في 0021.
-- ----------------------------------------------------------------------------
alter table trips
  add column if not exists vehicle_id         uuid references vehicles(id) on delete set null,
  add column if not exists vehicle_type_label text;

create index if not exists idx_trips_vehicle on trips(vehicle_id) where vehicle_id is not null;
