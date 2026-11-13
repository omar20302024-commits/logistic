-- ============================================================================
-- 0059 — ربط الديزل والمصروفات بالسيارة + تقرير الديزل الشهري
-- ============================================================================
--
-- 🔒 إضافي: عمودان جديدان بقيَم فارغة، ودوال جديدة. لا delete ولا drop table،
--    ولا يتغيّر رقم واحد ممّا يُحسب اليوم.
--
-- المطلوب: سيارة تنتقل من سائق لآخر، وتقرير ديزلها يكون عن الفترة التي كانت
-- فيها مع كلٍّ منهما.
--
-- ⚠️ لماذا عمود صريح لا استنتاج وقت القراءة
--
-- الديزل مربوط بالسائق لا بالسيارة. ويمكن استنتاج السيارة من سجل التحويلات
-- وقت العرض — لكن التفويلة قد تغطّي فترة (0041) تقع على جانبَي التحويل، فلا
-- جواب واحد لها. والأسوأ أن تعديل سجل التحويلات لاحقاً يغيّر تقارير أُخرجت
-- وسُلّمت.
--
-- فالسيارة تُثبَّت على التفويلة وقت الإدخال، تلقائياً من سجل التحويلات،
-- ويبقى للمستخدم تغييرها. ما وقع وقع.
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 1) من كان يحمل أي سيارة في تاريخ بعينه
-- ----------------------------------------------------------------------------
create or replace function fn_driver_vehicle_at(p_driver_id uuid, p_date date)
returns uuid
language sql stable
as $fn$
  select a.vehicle_id
  from vehicle_assignments a
  where a.driver_id = p_driver_id
    and a.from_date <= p_date
    and (a.to_date is null or a.to_date >= p_date)
  -- الأحدث أولاً: لو تداخل سجلّان لخطأ إدخال، يُعتمد الأقرب للتاريخ
  order by a.from_date desc
  limit 1;
$fn$;

-- ----------------------------------------------------------------------------
-- 2) الأعمدة
-- ----------------------------------------------------------------------------
alter table driver_diesel_entries
  add column if not exists vehicle_id uuid references vehicles(id) on delete set null;

alter table expenses
  add column if not exists vehicle_id uuid references vehicles(id) on delete set null;

create index if not exists idx_diesel_entries_vehicle
  on driver_diesel_entries(vehicle_id, date desc) where vehicle_id is not null;

create index if not exists idx_expenses_vehicle
  on expenses(vehicle_id, date desc) where vehicle_id is not null;

-- ----------------------------------------------------------------------------
-- 3) التعبئة التلقائية عند الإدخال
--
-- before insert فقط لا update: تغيير التاريخ لاحقاً لا يسحب السيارة من تحت
-- تقرير صدر. والمستخدم يملك تعديل العمود صراحةً متى شاء.
-- ----------------------------------------------------------------------------
create or replace function fn_fill_diesel_vehicle()
returns trigger
language plpgsql
as $fn$
begin
  if new.vehicle_id is null then
    new.vehicle_id := fn_driver_vehicle_at(new.driver_id, new.date);
  end if;
  return new;
end
$fn$;

drop trigger if exists trg_fill_diesel_vehicle on driver_diesel_entries;
create trigger trg_fill_diesel_vehicle
  before insert on driver_diesel_entries
  for each row execute function fn_fill_diesel_vehicle();

create or replace function fn_fill_expense_vehicle()
returns trigger
language plpgsql
as $fn$
begin
  if new.vehicle_id is null and new.driver_id is not null then
    new.vehicle_id := fn_driver_vehicle_at(new.driver_id, new.date);
  end if;
  return new;
end
$fn$;

drop trigger if exists trg_fill_expense_vehicle on expenses;
create trigger trg_fill_expense_vehicle
  before insert on expenses
  for each row execute function fn_fill_expense_vehicle();

-- ----------------------------------------------------------------------------
-- 4) تعبئة القديم
--
-- ⚠️ سجل التحويلات بدأ يوم تشغيل 0034، والارتباطات القائمة سُجّلت بتاريخ ذلك
--    اليوم لا بتاريخ بدايتها الحقيقي. فتفويلة أقدم منه لا يغطّيها سجلّ.
--    فنُسندها إلى **أقدم** سيارة مسجَّلة لذلك السائق — وهي سيارته القائمة
--    وقت تفعيل السجل. تقدير معلن، لا اختلاق تاريخ.
--
-- يملأ الفارغ وحده، فإعادة التشغيل لا تدهس تصحيحاً يدوياً.
-- ----------------------------------------------------------------------------
update driver_diesel_entries e
   set vehicle_id = coalesce(
     fn_driver_vehicle_at(e.driver_id, e.date),
     (select a.vehicle_id from vehicle_assignments a
       where a.driver_id = e.driver_id
       order by a.from_date asc limit 1)
   )
 where e.vehicle_id is null;

update expenses x
   set vehicle_id = coalesce(
     fn_driver_vehicle_at(x.driver_id, x.date),
     (select a.vehicle_id from vehicle_assignments a
       where a.driver_id = x.driver_id
       order by a.from_date asc limit 1)
   )
 where x.vehicle_id is null and x.driver_id is not null;

-- ----------------------------------------------------------------------------
-- 5) تقرير الديزل الشهري
--
-- صفّ لكل سائق في كل شهر داخل الفترة. فاختيار شهر واحد يعطي صفّاً لكل سائق،
-- واختيار ثلاثة يعطي ثلاثة صفوف — نفس التقرير يخدم النظرتين.
--
-- 🔑 الديزل من driver_monthly_diesel: هو ما تخصمه دوال الربح، ويضمّ الشهور
--    المُدخلة يدوياً بلا تفويلات (نفس قرار 0058).
--
-- 📌 «المتبقي» = قيمة الرحلات − (الترب + الديزل + مصاريف السيارة)
--    أي صافي ما تركته السيارة لك في ذلك الشهر، قبل الراتب.
--
-- 🚗 رقم السيارة = التي كان يحملها في آخر يوم من الشهر. والتحويل في منتصف
--    الشهر يُظهر السيارة الأخيرة — ولهذا يُفرد عمود «ديزل هذه السيارة»
--    المحسوب من التفويلات الموسومة، فيُرى الانقسام.
-- ----------------------------------------------------------------------------
create or replace function fn_diesel_monthly_report(p_from date, p_to date)
returns table (
  driver_id          uuid,
  driver_name        text,
  year               int,
  month              int,
  vehicle_id         uuid,
  vehicle_no         text,
  trips_count        bigint,
  total_trip_amount  numeric,
  total_trabs        numeric,
  diesel_amount      numeric,
  vehicle_expenses   numeric,
  remaining          numeric
)
language sql stable
as $fn$
  with months as (
    select
      m::date                                           as month_start,
      (m + interval '1 month' - interval '1 day')::date  as month_end
    from generate_series(
      date_trunc('month', p_from)::date,
      date_trunc('month', p_to)::date,
      interval '1 month'
    ) as m
  )
  select
    d.id,
    d.name,
    extract(year  from mo.month_start)::int,
    extract(month from mo.month_start)::int,
    veh.id,
    veh.vehicle_no,
    coalesce(t.trips_count, 0),
    coalesce(t.total_trip_amount, 0),
    coalesce(t.total_trabs, 0),
    coalesce(dz.amount, 0),
    coalesce(ex.total, 0),
    coalesce(t.total_trip_amount, 0)
      - coalesce(t.total_trabs, 0)
      - coalesce(dz.amount, 0)
      - coalesce(ex.total, 0)
  from drivers d
  cross join months mo
  left join lateral (
    select fn_driver_vehicle_at(d.id, mo.month_end) as vehicle_id
  ) va on true
  left join vehicles veh on veh.id = va.vehicle_id
  left join lateral (
    select
      count(*)                              as trips_count,
      sum(tr.trip_amount)                   as total_trip_amount,
      sum(tr.driver_trip_payment)           as total_trabs
    from trips tr
    where tr.driver_id = d.id
      and tr.trip_date between mo.month_start and mo.month_end
      and (tr.status <> 'cancelled' or should_count_cancelled())
  ) t on true
  left join lateral (
    select sum(dm.amount) as amount
    from driver_monthly_diesel dm
    where dm.driver_id = d.id
      and dm.year  = extract(year  from mo.month_start)::int
      and dm.month = extract(month from mo.month_start)::int
  ) dz on true
  left join lateral (
    select sum(x.amount) as total
    from expenses x
    where x.driver_id = d.id
      and x.date between mo.month_start and mo.month_end
  ) ex on true
  where d.employment_type = 'internal'
    and (
      coalesce(t.trips_count, 0) > 0
      or coalesce(dz.amount, 0) > 0
      or coalesce(ex.total, 0) > 0
    )
  order by d.name, mo.month_start;
$fn$;

notify pgrst, 'reload schema';
