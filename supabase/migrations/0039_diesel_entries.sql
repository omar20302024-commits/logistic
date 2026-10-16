-- ============================================================================
-- 0039 — حركات الديزل: تفويلة بتاريخها ومبلغها
-- ============================================================================
--
-- 🔒 إضافي: جدول جديد وعمود ومشغّل. لا delete ولا truncate ولا drop table،
--    و**لا تُمَس أي دالة ربح**. أرقام الديزل المسجَّلة تبقى كما هي.
--
-- المطلوب: شريحة الديزل مع كل سيارة، والسائق يرسل صورة كل تفويلة. فبدل رقم
-- شهري واحد يُجمع يدوياً من الصور، تُسجَّل كل تفويلة بتاريخها ومبلغها.
--
-- على السائق لا السيارة: السيارة مرتبطة بسائق واحد حصرياً (0034) فهي مشتقّة
-- منه، والديزل محسوب على السائق منذ 0020 — فالتعليق على السائق يُبقي كل
-- الأرباح المحسوبة كما هي.
--
-- ----------------------------------------------------------------------------
-- لماذا مشغّل بدل تعديل دوال الربح
--
-- الديزل الشهري يدخل الحسابات من مكانين: fn_monthly_diesel_total للتقرير
-- المالي، و fn_dashboard_overview للوحة. وتعديل الاثنتين معاً قاعدة مكتوبة في
-- PROJECT_CONTEXT لأن إغفال إحداهما وقع ثلاث مرات من قبل.
--
-- فبدل إعادة كتابتهما ومخاطرة الانحراف، تبقى driver_monthly_diesel هي المصدر
-- الوحيد الذي تقرأه كل الدوال، ويملؤها المشغّل من الحركات. **صفر تعديل على أي
-- دالة ربح**، والحركات تدخل الحساب من اليوم الأول.
--
-- ----------------------------------------------------------------------------
-- عمود source يميّز المحسوب من المكتوب يدوياً
--
-- الشهور السابقة أرقامها مكتوبة يدوياً وتبقى كذلك ('manual'). والشهر الذي فيه
-- حركات يصير رقمه محسوباً منها ('entries') ويُحدَّث مع كل إضافة أو حذف.
--
-- وبدون هذا التمييز، حذف آخر حركة في شهر كان سيمحو رقماً يدوياً لم يضعه
-- المشغّل أصلاً.
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

create table if not exists driver_diesel_entries (
  id         uuid primary key default gen_random_uuid(),
  driver_id  uuid not null references drivers(id) on delete cascade,
  date       date not null default current_date,
  amount     numeric(12,2) not null check (amount > 0),
  reference  text,  -- رقم العملية إن وُجد — الصور تبقى عند المستخدم
  notes      text,
  created_at timestamptz not null default now()
);

create index if not exists idx_diesel_entries_driver_date
  on driver_diesel_entries(driver_id, date desc);

alter table driver_diesel_entries enable row level security;

drop policy if exists "driver_diesel_entries_admin_all" on driver_diesel_entries;
create policy "driver_diesel_entries_admin_all" on driver_diesel_entries
  for all using ((select is_admin())) with check ((select is_admin()));

-- ----------------------------------------------------------------------------
-- مصدر الرقم الشهري: مكتوب يدوياً أم محسوب من الحركات
-- ----------------------------------------------------------------------------
alter table driver_monthly_diesel
  add column if not exists source text not null default 'manual';

do $do$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_monthly_diesel_source') then
    alter table driver_monthly_diesel add constraint chk_monthly_diesel_source
      check (source in ('manual', 'entries'));
  end if;
end
$do$;

-- ----------------------------------------------------------------------------
-- المشغّل: يعيد حساب رقم الشهر من حركاته
--
-- يعمل على الشهر القديم والجديد معاً، فتعديل تاريخ حركة ينقلها بين شهرين
-- ويُصحّح الرقمين.
-- ----------------------------------------------------------------------------
create or replace function fn_recalc_monthly_diesel(p_driver_id uuid, p_date date)
returns void
language plpgsql
as $fn$
declare
  v_year  int := extract(year  from p_date)::int;
  v_month int := extract(month from p_date)::int;
  v_total numeric;
begin
  select coalesce(sum(amount), 0) into v_total
  from driver_diesel_entries
  where driver_id = p_driver_id
    and extract(year  from date)::int = v_year
    and extract(month from date)::int = v_month;

  if v_total > 0 then
    insert into driver_monthly_diesel (driver_id, year, month, amount, source)
    values (p_driver_id, v_year, v_month, v_total, 'entries')
    on conflict (driver_id, year, month)
    do update set amount = excluded.amount, source = 'entries', updated_at = now();
  else
    -- لا حركات: نحذف الصف المحسوب وحده، والمكتوب يدوياً لا يُمَس
    delete from driver_monthly_diesel
    where driver_id = p_driver_id and year = v_year and month = v_month
      and source = 'entries';
  end if;
end
$fn$;

create or replace function fn_diesel_entry_changed()
returns trigger
language plpgsql
as $fn$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform fn_recalc_monthly_diesel(old.driver_id, old.date);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform fn_recalc_monthly_diesel(new.driver_id, new.date);
  end if;
  return null;
end
$fn$;

drop trigger if exists trg_diesel_entry_changed on driver_diesel_entries;
create trigger trg_diesel_entry_changed
  after insert or update or delete on driver_diesel_entries
  for each row execute function fn_diesel_entry_changed();

-- ----------------------------------------------------------------------------
-- حركات سائق خلال فترة — للعرض في صفحته
-- ----------------------------------------------------------------------------
create or replace function fn_driver_diesel_entries(
  p_driver_id uuid,
  p_from date,
  p_to   date
)
returns table (
  id        uuid,
  date      date,
  amount    numeric,
  reference text,
  notes     text
)
language sql stable
as $fn$
  select id, date, amount, reference, notes
  from driver_diesel_entries
  where driver_id = p_driver_id
    and date between p_from and p_to
  order by date desc, created_at desc;
$fn$;
