-- ============================================================================
-- 0031 — رابط كشف للسائق: قراءة فقط، بدون تسجيل دخول
-- ============================================================================
--
-- 🔒 هذا الملف **إضافي بالكامل**: أعمدة جديدة ودوال جديدة فقط.
--    لا delete ولا truncate ولا drop table ولا إعادة بناء أي جدول.
--    كل البيانات المسجَّلة حالياً تبقى كما هي حرفياً.
--
-- الفكرة: كل سائق له رمز عشوائي، والرابط /s/<token> يفتح كشف ترب شهر واحد
-- للقراءة فقط بدون تسجيل دخول.
--
-- ⚠️ الرابط = كلمة مرور. من يملكه يرى الكشف. ولهذا:
--    • public_link_enabled افتراضه **false** — لا رابط يعمل حتى تفعّله يدوياً.
--      (لو كان الافتراض true لصار كل السواقين مكشوفين لحظة تشغيل هذا الملف.)
--    • زر التجديد يبدّل الرمز فيبطل كل نسخة قديمة نهائياً.
--
-- ملاحظة على الفرق بين الزرّين:
--    الإيقاف **قابل للعكس بنفس الرمز** — فهو مفتاح تحكم لا علاج لتسريب.
--    التجديد هو العلاج: يبطل المسرَّب إلى الأبد.
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 1) توليد رمز عشوائي آمن — 24 بايت تبقى 32 حرفاً base64url
--    base64url عشان الرمز يعدّي في الـ URL من غير ترميز (+ و / و = مشاكل).
-- ----------------------------------------------------------------------------
create or replace function fn_generate_public_token()
returns text
language sql
volatile
as $fn$
  select replace(replace(replace(
    encode(gen_random_bytes(24), 'base64'),
  '+', '-'), '/', '_'), '=', '');
$fn$;

-- ----------------------------------------------------------------------------
-- 2) أعمدة جديدة على drivers — إضافة فقط
-- ----------------------------------------------------------------------------
alter table drivers
  add column if not exists public_token        text,
  add column if not exists public_link_enabled boolean not null default false,
  add column if not exists statement_year      int,
  add column if not exists statement_month     int;

-- رمز لكل سائق موجود (العمود الجديد فاضي، فدي تعبئة مش تعديل بيانات قائمة)
update drivers set public_token = fn_generate_public_token() where public_token is null;

-- والسواقون الجدد ياخدوا رمزاً تلقائياً
alter table drivers alter column public_token set default fn_generate_public_token();

create unique index if not exists idx_drivers_public_token on drivers(public_token);

-- الشهر لازم يكون 1..12 (ADD CONSTRAINT مالهاش IF NOT EXISTS)
do $do$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_statement_month') then
    alter table drivers add constraint chk_statement_month
      check (statement_month is null or statement_month between 1 and 12);
  end if;
end
$do$;

-- ----------------------------------------------------------------------------
-- 3) الدوال العامة — security definer، بالرمز فقط
--
--    كل دالة بتترجم الرمز لسائق + فترة، وبعدين بتنادي **الدوال الآمنة الموجودة**
--    (fn_driver_public_*) — فمنطق السرّية مصدره واحد، وأي تعديل عليه مستقبلاً
--    بيسري على الرابط العام تلقائياً ومحدش بينساه.
--
--    الفترة: statement_year/month، ولو NULL يبقى **الشهر الحالي** (يتدحرج وحده).
--
--    رمز غلط أو رابط موقوف → صفر صفوف. نفس الرد بالظبط، فالرد ما ينفعش أداة
--    تخمين تميّز الرمز الصحيح من الخاطئ.
-- ----------------------------------------------------------------------------

create or replace function fn_statement_by_token(p_token text)
returns table (
  driver_name          text,
  driver_phone         text,
  from_date            date,
  to_date              date,
  org_name             text,
  org_phone            text,
  currency_symbol      text,
  reviewed_by          text,
  trips_count          bigint,
  total_driver_payment numeric,
  total_advances       numeric,
  total_deductions     numeric,
  custody_balance      numeric,
  driver_paid_expenses numeric
)
language sql
stable
security definer
set search_path = public
as $fn$
  with d as (
    select
      id, name, phone,
      make_date(
        coalesce(statement_year,  extract(year  from current_date)::int),
        coalesce(statement_month, extract(month from current_date)::int),
        1
      ) as f
    from drivers
    where public_token = p_token
      and public_link_enabled
      and p_token is not null
      and length(p_token) >= 20
  ),
  p as (
    select id, name, phone, f as from_date,
           (f + interval '1 month' - interval '1 day')::date as to_date
    from d
  )
  select
    p.name, p.phone, p.from_date, p.to_date,
    s.org_name, s.org_phone, s.currency_symbol, s.reviewed_by,
    sm.trips_count, sm.total_driver_payment, sm.total_advances,
    sm.total_deductions, sm.custody_balance, sm.driver_paid_expenses
  from p
  cross join (select * from settings where id = true) s
  cross join lateral fn_driver_public_summary(p.id, p.from_date, p.to_date) sm;
$fn$;

create or replace function fn_statement_trips_by_token(p_token text)
returns table (
  trip_date            date,
  trip_number          text,
  company_name         text,
  from_location        text,
  to_location          text,
  branches_count       int,
  extra_loading_points int,
  driver_base_payment  numeric,
  driver_trip_payment  numeric
)
language sql
stable
security definer
set search_path = public
as $fn$
  with d as (
    select
      id,
      make_date(
        coalesce(statement_year,  extract(year  from current_date)::int),
        coalesce(statement_month, extract(month from current_date)::int),
        1
      ) as f
    from drivers
    where public_token = p_token
      and public_link_enabled
      and p_token is not null
      and length(p_token) >= 20
  ),
  p as (
    select id, f as from_date, (f + interval '1 month' - interval '1 day')::date as to_date
    from d
  )
  select t.*
  from p
  cross join lateral fn_driver_public_trips(p.id, p.from_date, p.to_date) t;
$fn$;

create or replace function fn_statement_expenses_by_token(p_token text)
returns table (
  expense_category text,
  total            numeric,
  entries_count    bigint
)
language sql
stable
security definer
set search_path = public
as $fn$
  with d as (
    select
      id,
      make_date(
        coalesce(statement_year,  extract(year  from current_date)::int),
        coalesce(statement_month, extract(month from current_date)::int),
        1
      ) as f
    from drivers
    where public_token = p_token
      and public_link_enabled
      and p_token is not null
      and length(p_token) >= 20
  ),
  p as (
    select id, f as from_date, (f + interval '1 month' - interval '1 day')::date as to_date
    from d
  )
  select e.*
  from p
  cross join lateral fn_driver_expenses_by_category(p.id, p.from_date, p.to_date) e;
$fn$;

-- ----------------------------------------------------------------------------
-- 4) الصلاحيات — anon ينفّذ هذه الثلاث **فقط**، ولا يلمس أي جدول
--
--    RLS باقية admin-only على كل الجداول كما هي. الزائر المجهول ماعندوش أي
--    صلاحية قراءة على drivers أو trips أو settings — بس ينادي الدوال دي.
--
--    fn_generate_public_token ممنوعة صراحةً عن anon: مالوش داعي يولّد رموزاً.
-- ----------------------------------------------------------------------------
grant execute on function fn_statement_by_token(text)          to anon;
grant execute on function fn_statement_trips_by_token(text)    to anon;
grant execute on function fn_statement_expenses_by_token(text) to anon;

-- fn_generate_public_token: ممنوعة عن anon، ومسموحة للمسؤول لأن زر التجديد
-- بيناديها.
--
-- ⚠️ ترتيب السطرين مهم: revoke from public بيشيل الصلاحية الافتراضية عن
--    **كل الأدوار** بما فيها authenticated، فلازم grant بعدها وإلا زر التجديد
--    هيقع بخطأ صلاحيات. توليد رمز عشوائي وحده غير ضار — الخطر في ربطه بسائق،
--    وده UPDATE على drivers محمي بـ RLS للمسؤول وحده.
revoke execute on function fn_generate_public_token() from public;
grant  execute on function fn_generate_public_token() to authenticated;
