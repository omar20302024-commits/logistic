-- ============================================================================
-- 0043 — الموردون: جهة تجمع عدّة سائقين، بكشف وتصفية
-- ============================================================================
--
-- 🔒 إضافي بالكامل: جداول جديدة وأعمدة اختيارية. لا delete ولا truncate ولا
--    drop table، ولا تُمَس أي دالة ربح ولا أي رحلة مسجَّلة.
--
-- المشكلة: النظام يعرف «سائقاً خارجياً» فرداً فقط. والمورّد الواحد قد يشغّل
-- ثلاث سيارات بأسماء سائقين مختلفة، فتظهر ثلاثة أسطر منفصلة بلا سبيل لجمعها.
--
-- الحل: المورّد جهة فوق السائقين، و vendor_id على السائق **اختياري**:
--   • سائق خارجي تحت مورّد      → يدخل كشف المورّد
--   • سائق خارجي بلا مورّد       → يبقى كما هو اليوم بلا أي تغيير
-- والمستخدم يستعين أحياناً بسائق خارجي لرحلة واحدة بلا مورّد، فهذا مقصود لا نقص.
--
-- ⚠️ السلفة هنا **من حساب الرحلات لا عهدة**. العهدة تعني مالاً بيد السائق
--    يُحاسَب عليه، وسلفة المورّد خصمٌ مباشر مما له على الرحلات. خلطهما كان
--    سيُدخل المورّد في حسابات العهدة وهي ليست له.
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

create table if not exists vendors (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text,
  notes      text,
  status     text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_vendor_status check (status in ('active', 'inactive'))
);

create index if not exists idx_vendors_name on vendors(name);

alter table vendors enable row level security;
drop policy if exists "vendors_admin_all" on vendors;
create policy "vendors_admin_all" on vendors
  for all using ((select is_admin())) with check ((select is_admin()));

drop trigger if exists trg_vendors_updated_at on vendors;
create trigger trg_vendors_updated_at
  before update on vendors
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- ربط السائق بمورّده — اختياري، ويعني شيئاً للخارجيين وحدهم
-- ----------------------------------------------------------------------------
alter table drivers
  add column if not exists vendor_id uuid references vendors(id) on delete set null;

create index if not exists idx_drivers_vendor
  on drivers(vendor_id) where vendor_id is not null;

-- ----------------------------------------------------------------------------
-- تصفية المورّد — نفس نمط تصفية التربات: أرقام مجمّدة وقت الصرف
--
-- التجميد مقصود: لو عُدّلت رحلة بعد الصرف يبقى السند شاهداً على ما صُرف فعلاً.
-- ----------------------------------------------------------------------------
create table if not exists vendor_settlements (
  id                uuid primary key default gen_random_uuid(),
  settlement_number text not null unique,
  vendor_id         uuid not null references vendors(id) on delete restrict,
  from_date         date not null,
  to_date           date not null,
  settled_on        date not null default current_date,

  trips_count       bigint        not null default 0,
  total_vendor_cost numeric(12,2) not null default 0,  -- ما للمورّد على رحلاته
  total_advances    numeric(12,2) not null default 0,  -- سلف تُخصم منه
  net_amount        numeric(12,2) not null default 0,  -- الصافي المصروف

  notes             text,
  created_at        timestamptz not null default now(),

  constraint chk_vendor_settlement_period check (to_date >= from_date)
);

create index if not exists idx_vendor_settlements_vendor
  on vendor_settlements(vendor_id, to_date desc);

alter table vendor_settlements enable row level security;
drop policy if exists "vendor_settlements_admin_all" on vendor_settlements;
create policy "vendor_settlements_admin_all" on vendor_settlements
  for all using ((select is_admin())) with check ((select is_admin()));

create sequence if not exists vendor_settlement_number_seq start 1;

create or replace function fn_generate_vendor_settlement_number()
returns trigger
language plpgsql
as $fn$
begin
  if new.settlement_number is null or btrim(new.settlement_number) = '' then
    new.settlement_number := 'VND-' || to_char(current_date, 'YYYY') || '-'
      || lpad(nextval('vendor_settlement_number_seq')::text, 4, '0');
  end if;
  return new;
end
$fn$;

drop trigger if exists trg_vendor_settlement_number on vendor_settlements;
create trigger trg_vendor_settlement_number
  before insert on vendor_settlements
  for each row execute function fn_generate_vendor_settlement_number();

-- ----------------------------------------------------------------------------
-- سلف المورّد — تُخصم من حساب رحلاته
-- ----------------------------------------------------------------------------
create table if not exists vendor_advances (
  id            uuid primary key default gen_random_uuid(),
  vendor_id     uuid not null references vendors(id) on delete cascade,
  date          date not null default current_date,
  amount        numeric(12,2) not null check (amount > 0),
  description   text,
  settlement_id uuid references vendor_settlements(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_vendor_advances_vendor
  on vendor_advances(vendor_id, date desc);

alter table vendor_advances enable row level security;
drop policy if exists "vendor_advances_admin_all" on vendor_advances;
create policy "vendor_advances_admin_all" on vendor_advances
  for all using ((select is_admin())) with check ((select is_admin()));

-- ----------------------------------------------------------------------------
-- وسم الرحلة بتصفية المورّد — يمنع صرفها مرتين
-- ----------------------------------------------------------------------------
alter table trips
  add column if not exists vendor_settlement_id uuid
    references vendor_settlements(id) on delete set null;

create index if not exists idx_trips_vendor_settlement
  on trips(vendor_settlement_id) where vendor_settlement_id is not null;
