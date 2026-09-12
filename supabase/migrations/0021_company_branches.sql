-- ============================================================================
-- 0021 — سجل فروع العملاء بأكوادها
-- ============================================================================
--
-- مواقع الرحلة كانت نصاً حراً، فنفس الفرع بيتكتب بصيغ مختلفة كل مرة ومفيش
-- طريقة تجمّع حركته. دلوقتي لكل عميل سجل فروع بكود مميز، وموقع الرحلة يقدر
-- يرتبط بفرع منه.
--
-- الكود اختياري: تقدر تكمّل بالنص الحر زي ما انت عامل، والربط بالفرع ميزة
-- إضافية مش شرط. الرحلات القديمة كلها بتفضل شغالة زي ما هي.
--
-- ملاحظة: النِّسب المئوية للفروع (الموجودة في wattam) اتلغت بطلب المستخدم،
-- وكذلك تقرير الفروع. مبالغ المواقع بتفضل توزيع داخلي بلا نسب.
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 1) سجل الفروع لكل عميل
-- ----------------------------------------------------------------------------
create table if not exists company_branches (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  branch_code text not null,
  branch_name text,
  city        text,
  address     text,
  contact     text,
  phone       text,
  is_active   boolean not null default true,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- الكود مميز داخل العميل الواحد فقط — عميلان مختلفان ممكن يستخدما نفس الكود
  unique (company_id, branch_code)
);

create index if not exists idx_company_branches_company on company_branches(company_id);
create index if not exists idx_company_branches_code on company_branches(branch_code);

alter table company_branches enable row level security;

drop policy if exists "company_branches_admin_all" on company_branches;
create policy "company_branches_admin_all" on company_branches
  for all using (is_admin()) with check (is_admin());

drop trigger if exists trg_company_branches_updated_at on company_branches;
create trigger trg_company_branches_updated_at
  before update on company_branches
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 2) ربط موقع الرحلة بفرع
--    branch_code محفوظ كنص مستقل عن branch_id عن قصد: لو الفرع اتحذف من
--    السجل، الرحلة تفضل شايلة الكود اللي اتنفذت عليه فعلاً — الرحلة وثيقة
--    تاريخية، مش مرآة للسجل الحالي.
-- ----------------------------------------------------------------------------
alter table trip_locations
  add column if not exists branch_code text,
  add column if not exists branch_id   uuid references company_branches(id) on delete set null;

create index if not exists idx_trip_locations_branch on trip_locations(branch_id)
  where branch_id is not null;

-- ----------------------------------------------------------------------------
-- 3) فروع آخر رحلة لنفس العميل ونفس الوجهة
--    بيوفّر إعادة كتابة نفس الفروع كل مرة للوجهات المتكررة.
--    المطابقة على الوجهة بتتجاهل الفروق الإملائية بنفس منطق src/lib/arabic.ts
--    (أشكال الألف والتاء المربوطة والمسافات) — مبسّطة على مستوى SQL.
-- ----------------------------------------------------------------------------
create or replace function fn_normalize_ar(p_text text)
returns text
language sql
immutable
as $$
  select lower(btrim(regexp_replace(
    translate(
      coalesce(p_text, ''),
      'أإآٱىةؤئیک',
      'اااايهوييك'
    ),
    '\s+', ' ', 'g'
  )));
$$;

create or replace function fn_last_trip_branches(
  p_company_id  uuid,
  p_to_location text
)
returns table (
  location_name text,
  branch_code   text,
  branch_id     uuid,
  amount        numeric
)
language sql stable
as $$
  with last_trip as (
    select t.id
    from trips t
    where t.company_id = p_company_id
      and fn_normalize_ar(t.to_location) = fn_normalize_ar(p_to_location)
      and exists (
        select 1 from trip_locations tl
        where tl.trip_id = t.id and tl.location_type = 'unloading'
      )
    order by t.trip_date desc, t.created_at desc
    limit 1
  )
  select tl.location_name, tl.branch_code, tl.branch_id, tl.amount
  from trip_locations tl
  join last_trip lt on lt.id = tl.trip_id
  where tl.location_type = 'unloading'
  order by tl.sort_order, tl.created_at;
$$;
