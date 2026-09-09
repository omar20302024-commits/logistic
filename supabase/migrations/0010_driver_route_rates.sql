-- ============================================================================
-- ترب حسب خط السير: لكل سائق مجموعة (مدينة تحميل -> مدينة تنزيل -> الترب المتفق
-- عليه)، بحيث عند اختيار السائق وكتابة نفس المدينتين في رحلة جديدة يتم تعبئة
-- الترب تلقائياً. + ترب افتراضي لكل موقع تنزيل إضافي (بدل القيمة الثابتة 10).
-- ============================================================================

alter table drivers add column extra_stop_rate numeric(12,2) not null default 0
  check (extra_stop_rate >= 0);

create table driver_route_rates (
  id          uuid primary key default gen_random_uuid(),
  driver_id   uuid not null references drivers(id) on delete cascade,
  from_city   text not null,
  to_city     text not null,
  trab_amount numeric(12,2) not null default 0 check (trab_amount >= 0),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (driver_id, from_city, to_city)
);

create index idx_driver_route_rates_driver on driver_route_rates(driver_id);

create trigger trg_driver_route_rates_updated_at
  before update on driver_route_rates
  for each row execute function set_updated_at();

alter table driver_route_rates enable row level security;
create policy "driver_route_rates_admin_all" on driver_route_rates
  for all using (is_admin()) with check (is_admin());
