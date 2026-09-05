-- ============================================================================
-- المرحلة 2: Database Schema
-- نظام إدارة السائقين والرحلات والتربات والرواتب والربحية
-- ============================================================================
-- ملاحظة: كل المبالغ المالية numeric(12,2) لتفادي أخطاء الفاصلة العشرية.
-- كل جدول له RLS مفعّل من اليوم الأول (لا نؤجله لمرحلة لاحقة).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) Extensions
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto"; -- gen_random_uuid()
create extension if not exists "pg_trgm";  -- بحث سريع بالاسم (LIKE / similarity)

-- ----------------------------------------------------------------------------
-- 1) ENUM Types
-- ----------------------------------------------------------------------------
create type driver_status as enum ('active', 'inactive');
create type company_status as enum ('active', 'inactive');
create type trip_status as enum ('new', 'in_progress', 'completed', 'cancelled');
create type location_type as enum ('loading', 'unloading');
create type amount_status as enum ('temporary', 'confirmed');

-- جاهز للتوسع المستقبلي (Admin فقط مُفعّل فعلياً في هذه المرحلة)
create type user_role as enum ('admin', 'accountant', 'employee', 'driver');

-- ----------------------------------------------------------------------------
-- 2) دالة عامة لتحديث updated_at تلقائياً
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3) profiles — يمتد من auth.users (لأدوار المستخدمين)
-- ----------------------------------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  role        user_role not null default 'admin',
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- إنشاء profile تلقائياً عند تسجيل مستخدم جديد في Supabase Auth
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'admin');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ----------------------------------------------------------------------------
-- 4) settings — إعدادات عامة (صف واحد فقط)
-- ----------------------------------------------------------------------------
create table settings (
  id                                  boolean primary key default true,
  org_name                            text not null default 'مؤسستي',
  org_phone                           text,
  org_address                         text,
  logo_url                            text,
  currency_code                       text not null default 'SAR',
  currency_symbol                     text not null default 'ر.س',
  count_cancelled_trips_in_profit     boolean not null default false,
  updated_at                          timestamptz not null default now(),
  constraint settings_singleton check (id)
);

create trigger trg_settings_updated_at
  before update on settings
  for each row execute function set_updated_at();

insert into settings (id) values (true);

-- ----------------------------------------------------------------------------
-- 5) drivers — السائقون
-- ----------------------------------------------------------------------------
create table drivers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  salary      numeric(12,2) not null default 0 check (salary >= 0),
  hire_date   date,
  status      driver_status not null default 'active',
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_drivers_status on drivers(status);
create index idx_drivers_name_trgm on drivers using gin (name gin_trgm_ops);

create trigger trg_drivers_updated_at
  before update on drivers
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 6) companies — الشركات
-- ----------------------------------------------------------------------------
create table companies (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  phone           text,
  address         text,
  contact_person  text,
  status          company_status not null default 'active',
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_companies_status on companies(status);
create index idx_companies_name_trgm on companies using gin (name gin_trgm_ops);

create trigger trg_companies_updated_at
  before update on companies
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 7) trips — الرحلات (جوهر النظام)
-- ----------------------------------------------------------------------------
create table trips (
  id                    uuid primary key default gen_random_uuid(),
  trip_number           text not null unique,
  driver_id             uuid not null references drivers(id) on delete restrict,
  company_id            uuid not null references companies(id) on delete restrict,
  trip_date             date not null default current_date,
  from_location         text not null,
  to_location            text not null,

  -- سري: سعر الرحلة الذي أحصل عليه من العميل.
  -- محسوب ومُحدَّث تلقائياً = مجموع مبالغ مواقع التحميل/التنزيل التابعة لهذه الرحلة
  -- (عبر trigger على trip_locations أسفل هذا الملف). لا يُدخل يدوياً من الواجهة.
  trip_amount           numeric(12,2) not null default 0 check (trip_amount >= 0),
  -- تربة السائق
  driver_trip_payment   numeric(12,2) not null default 0 check (driver_trip_payment >= 0),
  -- مصروف الديزل كمبلغ مباشر
  diesel_amount         numeric(12,2) not null default 0 check (diesel_amount >= 0),

  -- ربح الرحلة: محسوب تلقائياً دائماً، لا يُدخل يدوياً أبداً
  trip_profit           numeric(12,2) generated always as
                           (trip_amount - driver_trip_payment - diesel_amount) stored,

  status                trip_status not null default 'completed',
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_trips_driver_id  on trips(driver_id);
create index idx_trips_company_id on trips(company_id);
create index idx_trips_date       on trips(trip_date);
create index idx_trips_status     on trips(status);
create index idx_trips_driver_date on trips(driver_id, trip_date);
create index idx_trips_company_date on trips(company_id, trip_date);

create trigger trg_trips_updated_at
  before update on trips
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 8) trip_locations — مواقع التحميل/التنزيل (كل موقع سجل مستقل بمبلغه الخاص)
-- ----------------------------------------------------------------------------
create table trip_locations (
  id              uuid primary key default gen_random_uuid(),
  trip_id         uuid not null references trips(id) on delete cascade,
  location_type   location_type not null,
  location_name   text not null,
  amount          numeric(12,2) not null default 0 check (amount >= 0),
  amount_status   amount_status not null default 'temporary',
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_trip_locations_trip_id on trip_locations(trip_id);
create index idx_trip_locations_type on trip_locations(trip_id, location_type);

create trigger trg_trip_locations_updated_at
  before update on trip_locations
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 8.1) مزامنة سعر الرحلة (trip_amount) تلقائياً = مجموع مبالغ مواقعها
--      (تحميل + تنزيل معاً، بصرف النظر عن حالة المبلغ مؤقت/مثبت — القيمة الحالية
--      لكل موقع تُحتسب فوراً، وتتحدث تلقائياً عند تثبيت أي مبلغ لاحقاً)
-- ----------------------------------------------------------------------------
create or replace function sync_trip_amount()
returns trigger
language plpgsql
as $$
declare
  v_trip_id uuid;
begin
  -- عند INSERT/UPDATE: أعد حساب سعر رحلة الصف الجديد
  if (tg_op = 'INSERT' or tg_op = 'UPDATE') then
    v_trip_id := new.trip_id;
    update trips
      set trip_amount = (
        select coalesce(sum(amount), 0) from trip_locations where trip_id = v_trip_id
      )
      where id = v_trip_id;
  end if;

  -- عند UPDATE مع تغيير trip_id، أو عند DELETE: أعد حساب سعر الرحلة القديمة أيضاً
  if (tg_op = 'DELETE') then
    v_trip_id := old.trip_id;
    update trips
      set trip_amount = (
        select coalesce(sum(amount), 0) from trip_locations where trip_id = v_trip_id
      )
      where id = v_trip_id;
  elsif (tg_op = 'UPDATE' and old.trip_id is distinct from new.trip_id) then
    update trips
      set trip_amount = (
        select coalesce(sum(amount), 0) from trip_locations where trip_id = old.trip_id
      )
      where id = old.trip_id;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger trg_sync_trip_amount
  after insert or update or delete on trip_locations
  for each row execute function sync_trip_amount();

-- ----------------------------------------------------------------------------
-- 9) driver_advances — السلف
-- ----------------------------------------------------------------------------
create table driver_advances (
  id          uuid primary key default gen_random_uuid(),
  driver_id   uuid not null references drivers(id) on delete cascade,
  date        date not null default current_date,
  amount      numeric(12,2) not null check (amount > 0),
  description text,
  notes       text,
  created_at  timestamptz not null default now()
);

create index idx_driver_advances_driver_date on driver_advances(driver_id, date);

-- ----------------------------------------------------------------------------
-- 10) driver_deductions — الخصومات
-- ----------------------------------------------------------------------------
create table driver_deductions (
  id          uuid primary key default gen_random_uuid(),
  driver_id   uuid not null references drivers(id) on delete cascade,
  date        date not null default current_date,
  amount      numeric(12,2) not null check (amount > 0),
  description text,
  notes       text,
  created_at  timestamptz not null default now()
);

create index idx_driver_deductions_driver_date on driver_deductions(driver_id, date);

-- ----------------------------------------------------------------------------
-- 11) salaries — سجل الراتب الشهري (المدخلات الأساسية فقط، الباقي محسوب بـ view)
-- ----------------------------------------------------------------------------
create table salaries (
  id            uuid primary key default gen_random_uuid(),
  driver_id     uuid not null references drivers(id) on delete cascade,
  month         int not null check (month between 1 and 12),
  year          int not null check (year between 2000 and 2100),
  basic_salary  numeric(12,2) not null default 0 check (basic_salary >= 0),
  paid_amount   numeric(12,2) not null default 0 check (paid_amount >= 0),
  payment_date  date,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (driver_id, month, year)
);

create index idx_salaries_driver on salaries(driver_id);
create index idx_salaries_period on salaries(year, month);

create trigger trg_salaries_updated_at
  before update on salaries
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 12) expenses — مصروفات إدارية أخرى (غير مرتبطة برحلة معينة)
-- ----------------------------------------------------------------------------
create table expenses (
  id          uuid primary key default gen_random_uuid(),
  date        date not null default current_date,
  category    text not null,
  description text,
  amount      numeric(12,2) not null check (amount >= 0),
  notes       text,
  created_at  timestamptz not null default now()
);

create index idx_expenses_date on expenses(date);
create index idx_expenses_category on expenses(category);
