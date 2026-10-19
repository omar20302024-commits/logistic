-- ============================================================================
-- 0047 — تسعيرة المورّد: سعر خط السير له هو ولكل سائقيه
-- ============================================================================
--
-- 🔒 إضافي: جدول وعرض. لا delete ولا truncate ولا drop table، ولا تُمَس أي
--    رحلة ولا أي دالة ربح.
--
-- المطلوب: الرياض ← جدة سعرها على العميل 1600، وتُعطى للمورّد بـ 1400، فالربح
-- 200. والمورّد قد يشغّل ثلاثة سائقين — فالسعر يُكتب **مرة واحدة له** لا ثلاثاً.
--
-- البنية قائمة أصلاً: trips.trip_amount سعر العميل، و driver_trip_payment ما
-- يأخذه المورّد، والربح فرقهما — وهو ما تحسبه fn_vendor_trips. الناقص كان
-- **من أين يأتي رقم الـ1400** دون كتابته لكل سائق على حدة.
--
-- ----------------------------------------------------------------------------
-- أولوية سعر الخط بعد هذا الملف
--
--   1) خط سير خاص بالسائق      ← الاستثناء: سائق اتُّفق معه على غير المعتاد
--   2) خط سير المورّد (الجديد)  ← يرثه كل سائقي المورّد
--   3) خط السير العام           ← لسائقي الشركة وحدهم (0035)
--   4) الترب الافتراضي للسائق
--
-- ⚠️ لم أعدّل resolveBasePayment ولا الدوال التي تستدعيها. بدل ذلك: عرضٌ
--    واحد يدمج خطوط السائق وخطوط مورّده، والسائق يغلب. فالصفحات تقرأ منه بدل
--    driver_route_rates ويبقى منطق الترب كما هو في كل مكان.
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

create table if not exists vendor_route_rates (
  id          uuid primary key default gen_random_uuid(),
  vendor_id   uuid not null references vendors(id) on delete cascade,
  from_city   text not null,
  to_city     text not null,
  trab_amount numeric(12,2) not null default 0 check (trab_amount >= 0),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (vendor_id, from_city, to_city)
);

create index if not exists idx_vendor_route_rates_vendor on vendor_route_rates(vendor_id);

alter table vendor_route_rates enable row level security;
drop policy if exists "vendor_route_rates_admin_all" on vendor_route_rates;
create policy "vendor_route_rates_admin_all" on vendor_route_rates
  for all using ((select is_admin())) with check ((select is_admin()));

drop trigger if exists trg_vendor_route_rates_updated_at on vendor_route_rates;
create trigger trg_vendor_route_rates_updated_at
  before update on vendor_route_rates
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- خطوط السير الفعّالة لكل سائق: خطوطه ثم خطوط مورّده
--
-- السائق يغلب: distinct on (driver_id, from, to) مرتّبة بالأولوية، فيبقى
-- الأعلى أولويةً وحده لكل ثلاثي.
-- ----------------------------------------------------------------------------
drop view if exists v_driver_effective_rates;

create view v_driver_effective_rates
  with (security_invoker = true) as
select distinct on (driver_id, from_city, to_city)
  driver_id,
  from_city,
  to_city,
  trab_amount,
  source
from (
  -- أولوية 1: خط سير خاص بالسائق
  select r.driver_id, r.from_city, r.to_city, r.trab_amount, 'driver'::text as source, 1 as rank
  from driver_route_rates r

  union all

  -- أولوية 2: خط سير مورّده، يسري على كل سائقيه
  select d.id, vr.from_city, vr.to_city, vr.trab_amount, 'vendor'::text, 2
  from vendor_route_rates vr
  join drivers d on d.vendor_id = vr.vendor_id
) s
order by driver_id, from_city, to_city, rank;
