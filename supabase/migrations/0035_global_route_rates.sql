-- ============================================================================
-- 0035 — خطوط سير عامة: تُكتب مرة وتسري على كل سائقي الشركة
-- ============================================================================
--
-- 🔒 إضافي بالكامل: جدول جديد وسياسته. لا delete ولا truncate ولا drop table،
--    ولا تعديل على driver_route_rates. كل ما أدخلته يبقى كما هو.
--
-- المشكلة: driver_route_rates مفتاحها (driver_id, from_city, to_city) — يعني
-- لا مفهوم «خط سير عام» في النظام إطلاقاً. عشرون سائقاً × ثلاثون خط سير =
-- ستمائة صف تُكتب يدوياً، وكل سائق جديد يبدأ من الصفر. لا يتوسّع.
--
-- الحل: جدول بلا driver_id. وأولوية الترب تصير ثلاث درجات:
--
--   1) driver_route_rates   ← الاستثناء: سائق اتُّفق معه على غير المعتاد
--   2) route_rates (هذا)    ← العام: يُكتب مرة ويرثه كل سائق جديد تلقائياً
--   3) default_trip_payment ← آخر احتياط، كما هو اليوم
--
-- ⚠️ لسائقي الشركة فقط (employment_type = 'internal'). الموردون لا يرثون العام
--    إطلاقاً — تربهم باتفاق خاص لكل واحد. والشرط مطبَّق في الواجهة لا هنا، لأن
--    هذا الجدول لا يعرف السائق أصلاً.
--
-- ملاحظة على الإملاء: المطابقة تتم بالتطبيع العربي في الواجهة («جده» = «جدة»)،
-- وقاعدة البيانات لا تعرف هذا التطبيع. فالفريد هنا على النص الحرفي، وصفحة
-- الإضافة تفحص التكرار المطبَّع وترفضه. لم أبنِ دالة تطبيع عربي في SQL لأنها
-- ستصير توأماً ثانياً يلزم أن يطابق نسخة الواجهة حرفاً بحرف — ويكفي الموجود.
--
-- 🔒 لا أثر على رحلة قائمة: الرحلة تجمّد driver_base_payment وقت إنشائها،
--    فالتسعيرة تُقرأ مرة عند الإدخال. أي تعديل لاحق يسري على الجديد وحده.
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

create table if not exists route_rates (
  id          uuid primary key default gen_random_uuid(),
  from_city   text not null,
  to_city     text not null,
  trab_amount numeric(12,2) not null default 0 check (trab_amount >= 0),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (from_city, to_city)
);

create index if not exists idx_route_rates_cities on route_rates(from_city, to_city);

alter table route_rates enable row level security;

drop policy if exists "route_rates_admin_all" on route_rates;
create policy "route_rates_admin_all" on route_rates
  for all using ((select is_admin())) with check ((select is_admin()));

drop trigger if exists trg_route_rates_updated_at on route_rates;
create trigger trg_route_rates_updated_at
  before update on route_rates
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- اقتراح خطوط سير عامة من الموجود فعلاً
--
-- لكل خط سير: السعر الأكثر تكراراً بين **سائقي الشركة** (mode)، وعدد السواقين
-- الذين عليه، وعدد من يختلف عنه. لا يكتب شيئاً — يقترح فقط، والمستخدم يراجع
-- ويعتمد من صفحة خطوط السير.
-- ----------------------------------------------------------------------------
create or replace function fn_suggest_route_rates()
returns table (
  from_city      text,
  to_city        text,
  suggested_trab numeric,
  drivers_count  bigint,
  differing      bigint,
  already_global boolean
)
language sql
stable
as $fn$
  with internal_rates as (
    select r.from_city, r.to_city, r.trab_amount
    from driver_route_rates r
    join drivers d on d.id = r.driver_id
    where d.employment_type = 'internal'
  ),
  per_route as (
    select
      from_city,
      to_city,
      mode() within group (order by trab_amount) as suggested_trab,
      count(*)                                   as drivers_count
    from internal_rates
    group by from_city, to_city
  )
  select
    p.from_city,
    p.to_city,
    p.suggested_trab,
    p.drivers_count,
    (select count(*) from internal_rates i
      where i.from_city = p.from_city
        and i.to_city = p.to_city
        and i.trab_amount <> p.suggested_trab) as differing,
    exists (
      select 1 from route_rates g
      where g.from_city = p.from_city and g.to_city = p.to_city
    ) as already_global
  from per_route p
  order by p.drivers_count desc, p.from_city, p.to_city;
$fn$;
