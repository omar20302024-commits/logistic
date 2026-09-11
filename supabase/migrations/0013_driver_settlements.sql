-- ============================================================================
-- 0013 — تصفية التربات: سند تصفية بأرقام مجمّدة + منع الازدواج على مستوى الرحلة
-- ============================================================================
--
-- الفكرة: التصفية واقعة تاريخية، مش حساب حيّ. الأرقام بتتحسب بدوال SQL وقت
-- التصفية وبعدين تتجمّد في السند — عشان لو رحلة قديمة اتعدّلت بعدين، المبلغ
-- اللي اتصرف فعلاً ما يتغيّرش بأثر رجعي. (ده مش إدخال يدوي لإجمالي، فقاعدة
-- "كل الحسابات تلقائية" محفوظة.)
--
-- منع الازدواج: كل رحلة بتتوسم بـ settlement_id. يعني رحلة بتتسجل متأخرة
-- بتاريخ قديم جوّه فترة متصفّية هتفضل بدون تصفية وتظهر في السند اللي بعده،
-- بدل ما تضيع بصمت أو تتحسب مرتين.
--
-- السلف والخصومات: كل واحدة بتنتمي لدلو واحد بس — إما الراتب وإما التربات.
-- ده بيخلي الخصم المزدوج مستحيل بنيوياً، مش مجرد اتفاق. الافتراضي 'salary'
-- عشان كل البيانات القديمة تفضل زي ما هي بالظبط.
-- ----------------------------------------------------------------------------

-- الملف كله قابل لإعادة التشغيل بأمان (idempotent): لو وقف في النص لأي سبب،
-- شغّله تاني من أوله من غير ما تحذف حاجة.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'settle_bucket') then
    create type settle_bucket as enum ('salary', 'trabs');
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 1) جدول التصفيات
-- ----------------------------------------------------------------------------
create table if not exists driver_settlements (
  id                 uuid primary key default gen_random_uuid(),
  settlement_number  text not null unique,
  driver_id          uuid not null references drivers(id) on delete restrict,
  from_date          date not null,
  to_date            date not null,
  settled_on         date not null default current_date,

  -- أرقام مجمّدة وقت التصفية
  trips_count        bigint        not null default 0,
  total_trabs        numeric(12,2) not null default 0,  -- تربات الرحلات المتصفّية
  custody_credits    numeric(12,2) not null default 0,  -- اللي استلمه (عهدة/تحصيل)
  custody_debits     numeric(12,2) not null default 0,  -- اللي صرفه أو أرجعه
  driver_expenses    numeric(12,2) not null default 0,  -- منها: مصروفات عمل دفعها
  total_advances     numeric(12,2) not null default 0,  -- سلف محمّلة على التربات
  total_deductions   numeric(12,2) not null default 0,  -- خصومات محمّلة على التربات
  net_amount         numeric(12,2) not null default 0,  -- الصافي المستحق له

  notes              text,
  created_at         timestamptz not null default now(),

  constraint chk_settlement_period check (to_date >= from_date)
);

create index if not exists idx_settlements_driver on driver_settlements(driver_id, to_date desc);

alter table driver_settlements enable row level security;

drop policy if exists "driver_settlements_admin_all" on driver_settlements;
create policy "driver_settlements_admin_all" on driver_settlements
  for all using (is_admin()) with check (is_admin());

-- ترقيم تلقائي: STL-<السنة>-<تسلسل>
create sequence if not exists settlement_number_seq start 1;

create or replace function fn_generate_settlement_number()
returns trigger
language plpgsql
as $$
begin
  if new.settlement_number is null or btrim(new.settlement_number) = '' then
    new.settlement_number := 'STL-' || to_char(current_date, 'YYYY') || '-'
      || lpad(nextval('settlement_number_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_generate_settlement_number on driver_settlements;
create trigger trg_generate_settlement_number
  before insert on driver_settlements
  for each row execute function fn_generate_settlement_number();

-- ----------------------------------------------------------------------------
-- 2) وسم العناصر المتصفّية
--    on delete set null: لو اتلغى سند، عناصره ترجع قابلة للتصفية تاني
-- ----------------------------------------------------------------------------
alter table trips
  add column if not exists settlement_id uuid references driver_settlements(id) on delete set null;
create index if not exists idx_trips_settlement on trips(settlement_id) where settlement_id is not null;

alter table driver_custody_entries
  add column if not exists settlement_id uuid references driver_settlements(id) on delete set null;
create index if not exists idx_custody_settlement on driver_custody_entries(settlement_id) where settlement_id is not null;

alter table driver_advances
  add column if not exists settle_against settle_bucket not null default 'salary',
  add column if not exists settlement_id  uuid references driver_settlements(id) on delete set null;

alter table driver_deductions
  add column if not exists settle_against settle_bucket not null default 'salary',
  add column if not exists settlement_id  uuid references driver_settlements(id) on delete set null;

-- عنصر محمّل على الراتب لا يجوز يتوسم بسند تصفية — الحارس ضد الخصم المزدوج
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_advance_bucket_matches_settlement') then
    alter table driver_advances
      add constraint chk_advance_bucket_matches_settlement check (
        settlement_id is null or settle_against = 'trabs'
      );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'chk_deduction_bucket_matches_settlement') then
    alter table driver_deductions
      add constraint chk_deduction_bucket_matches_settlement check (
        settlement_id is null or settle_against = 'trabs'
      );
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 2.1) رصيد العهدة بقى يحسب الحركات غير المُصفّاة بس
--
-- من غير الشرط ده بيحصل خطأ مال حقيقي: لو السائق دفع 500 من جيبه (رصيد −500)
-- وصرفناهم له في تصفية، الحركة بتفضل في الجدول والرصيد يفضل −500، فالكشف
-- يطالب بالـ 500 تاني رغم إنها اتدفعت. الحركة المتصفّية حركة مقفولة.
-- ----------------------------------------------------------------------------
create or replace function fn_driver_custody_balance(p_driver_id uuid, p_as_of date)
returns numeric
language sql stable
as $$
  select coalesce(
    sum(case when type = 'credit' then amount else -amount end),
    0
  )
  from driver_custody_entries
  where driver_id = p_driver_id
    and date <= p_as_of
    and settlement_id is null;
$$;

-- ----------------------------------------------------------------------------
-- 3) كشف الراتب: يحسب السلف والخصومات المحمّلة على الراتب فقط
--    اللي اتحوّلت للتربات بقت مسؤولية سند التصفية، فلو فضلت هنا تتخصم مرتين
-- ----------------------------------------------------------------------------
create or replace view v_salary_statements
  with (security_invoker = true) as
select
  s.id,
  s.driver_id,
  d.name as driver_name,
  s.month,
  s.year,
  s.basic_salary,
  coalesce(ded.total, 0) as deductions_total,
  coalesce(adv.total, 0) as advances_total,
  (s.basic_salary - coalesce(ded.total, 0) - coalesce(adv.total, 0)) as net_salary,
  s.paid_amount,
  (s.basic_salary - coalesce(ded.total, 0) - coalesce(adv.total, 0) - s.paid_amount) as remaining_amount,
  s.payment_date,
  s.notes,
  s.created_at,
  s.updated_at
from salaries s
join drivers d on d.id = s.driver_id
left join lateral (
  select sum(amount) as total
  from driver_deductions dd
  where dd.driver_id = s.driver_id
    and dd.settle_against = 'salary'
    and dd.date >= make_date(s.year, s.month, 1)
    and dd.date <= (make_date(s.year, s.month, 1) + interval '1 month' - interval '1 day')::date
) ded on true
left join lateral (
  select sum(amount) as total
  from driver_advances da
  where da.driver_id = s.driver_id
    and da.settle_against = 'salary'
    and da.date >= make_date(s.year, s.month, 1)
    and da.date <= (make_date(s.year, s.month, 1) + interval '1 month' - interval '1 day')::date
) adv on true;

-- ----------------------------------------------------------------------------
-- 4) ملخص فترة السائق — كل سلفة تتخصم مرة واحدة بالظبط
-- ----------------------------------------------------------------------------
drop function if exists fn_driver_public_summary(uuid, date, date);
drop function if exists fn_driver_period_summary(uuid, date, date);

create or replace function fn_driver_period_summary(
  p_driver_id uuid,
  p_from date,
  p_to   date
)
returns table (
  trips_count            bigint,
  total_trip_amount      numeric,
  total_driver_payment   numeric,
  total_diesel           numeric,
  operating_profit       numeric,
  total_advances         numeric,  -- محمّلة على الراتب
  total_deductions       numeric,  -- محمّلة على الراتب
  salary_basic           numeric,
  net_salary             numeric,
  custody_balance        numeric,
  trab_advances          numeric,  -- محمّلة على التربات
  trab_deductions        numeric,  -- محمّلة على التربات
  driver_paid_expenses   numeric,  -- مصروفات عمل دفعها السائق
  settled_trabs          numeric,  -- تربات رحلات اتصفّت فعلاً
  unsettled_trabs        numeric,  -- تربات لسه ما اتصفّتش
  total_due_to_driver    numeric
)
language sql stable
as $$
  with trip_agg as (
    select
      count(*)                              as trips_count,
      coalesce(sum(trip_amount), 0)          as total_trip_amount,
      coalesce(sum(driver_trip_payment), 0)  as total_driver_payment,
      coalesce(sum(diesel_amount), 0)        as total_diesel,
      coalesce(sum(trip_profit), 0)          as operating_profit,
      coalesce(sum(driver_trip_payment) filter (where settlement_id is not null), 0) as settled_trabs,
      coalesce(sum(driver_trip_payment) filter (where settlement_id is null), 0)     as unsettled_trabs
    from trips
    where driver_id = p_driver_id
      and trip_date between p_from and p_to
      and (status <> 'cancelled' or should_count_cancelled())
  ),
  adv_agg as (
    select
      coalesce(sum(amount) filter (where settle_against = 'salary'), 0) as total_advances,
      coalesce(sum(amount) filter (where settle_against = 'trabs'), 0)  as trab_advances,
      -- المفتوحة بس هي اللي تتخصم من المستحق؛ المتصفّية اتخصمت في سندها
      coalesce(sum(amount) filter (where settle_against = 'trabs' and settlement_id is null), 0)
        as trab_advances_open
    from driver_advances
    where driver_id = p_driver_id and date between p_from and p_to
  ),
  ded_agg as (
    select
      coalesce(sum(amount) filter (where settle_against = 'salary'), 0) as total_deductions,
      coalesce(sum(amount) filter (where settle_against = 'trabs'), 0)  as trab_deductions,
      coalesce(sum(amount) filter (where settle_against = 'trabs' and settlement_id is null), 0)
        as trab_deductions_open
    from driver_deductions
    where driver_id = p_driver_id and date between p_from and p_to
  ),
  sal_agg as (
    select coalesce(sum(basic_salary), 0) as salary_basic
    from salaries
    where driver_id = p_driver_id
      and make_date(year, month, 1) <= p_to
      and (make_date(year, month, 1) + interval '1 month' - interval '1 day')::date >= p_from
  ),
  custody_agg as (
    select
      fn_driver_custody_balance(p_driver_id, p_to) as custody_balance,
      (select coalesce(sum(amount), 0)
         from driver_custody_entries
        where driver_id = p_driver_id
          and reason = 'work_expense'
          and date between p_from and p_to) as driver_paid_expenses
  )
  select
    trip_agg.trips_count,
    trip_agg.total_trip_amount,
    trip_agg.total_driver_payment,
    trip_agg.total_diesel,
    trip_agg.operating_profit,
    adv_agg.total_advances,
    ded_agg.total_deductions,
    sal_agg.salary_basic,
    (sal_agg.salary_basic - ded_agg.total_deductions - adv_agg.total_advances) as net_salary,
    custody_agg.custody_balance,
    adv_agg.trab_advances,
    ded_agg.trab_deductions,
    custody_agg.driver_paid_expenses,
    trip_agg.settled_trabs,
    trip_agg.unsettled_trabs,
    -- المستحق = اللي لسه ما اتصرفش. التربات المتصفّية وعهدتها وسلفها اتقفلت
    -- في سندها، فلو دخلت هنا تاني يبقى مطالبة بمال مدفوع.
    (trip_agg.unsettled_trabs
      + (sal_agg.salary_basic - ded_agg.total_deductions - adv_agg.total_advances)
      - custody_agg.custody_balance
      - adv_agg.trab_advances_open
      - ded_agg.trab_deductions_open) as total_due_to_driver
  from trip_agg, adv_agg, ded_agg, sal_agg, custody_agg;
$$;

-- كشف السائق الآمن: نفس الأرقام ناقص أي بيانات سرية
-- (سعر الرحلة / الربح / الديزل لا تُرجَع من هنا أصلاً — قاعدة #11)
create or replace function fn_driver_public_summary(
  p_driver_id uuid,
  p_from date,
  p_to   date
)
returns table (
  trips_count           bigint,
  total_driver_payment  numeric,
  total_advances        numeric,
  total_deductions      numeric,
  salary_basic          numeric,
  net_salary            numeric,
  custody_balance       numeric,
  trab_advances         numeric,
  trab_deductions       numeric,
  driver_paid_expenses  numeric,
  settled_trabs         numeric,
  unsettled_trabs       numeric,
  total_due_to_driver   numeric
)
language sql stable
as $$
  select
    trips_count,
    total_driver_payment,
    total_advances,
    total_deductions,
    salary_basic,
    net_salary,
    custody_balance,
    trab_advances,
    trab_deductions,
    driver_paid_expenses,
    settled_trabs,
    unsettled_trabs,
    total_due_to_driver
  from fn_driver_period_summary(p_driver_id, p_from, p_to);
$$;

-- ----------------------------------------------------------------------------
-- 5) معاينة التصفية — بتحسب على العناصر غير المتصفّية بس
--    السلف والخصومات بتتبعت كـ IDs عشان انت اللي بتختار أنهي واحدة تتحمّل
--    على التربات في السند ده، والباقي يفضل مع الراتب
-- ----------------------------------------------------------------------------
create or replace function fn_driver_settlement_preview(
  p_driver_id     uuid,
  p_from          date,
  p_to            date,
  p_advance_ids   uuid[] default '{}'::uuid[],
  p_deduction_ids uuid[] default '{}'::uuid[]
)
returns table (
  trips_count       bigint,
  total_trabs       numeric,
  custody_credits   numeric,
  custody_debits    numeric,
  driver_expenses   numeric,
  total_advances    numeric,
  total_deductions  numeric,
  net_amount        numeric
)
language sql stable
as $$
  with t as (
    select
      count(*)                                     as trips_count,
      coalesce(sum(driver_trip_payment), 0)        as total_trabs
    from trips
    where driver_id = p_driver_id
      and trip_date between p_from and p_to
      and settlement_id is null
      and (status <> 'cancelled' or should_count_cancelled())
  ),
  c as (
    select
      coalesce(sum(amount) filter (where type = 'credit'), 0)          as custody_credits,
      coalesce(sum(amount) filter (where type = 'debit'), 0)           as custody_debits,
      coalesce(sum(amount) filter (where reason = 'work_expense'), 0)  as driver_expenses
    from driver_custody_entries
    where driver_id = p_driver_id
      and date between p_from and p_to
      and settlement_id is null
  ),
  a as (
    select coalesce(sum(amount), 0) as total_advances
    from driver_advances
    where driver_id = p_driver_id
      and settlement_id is null
      and id = any(p_advance_ids)
  ),
  d as (
    select coalesce(sum(amount), 0) as total_deductions
    from driver_deductions
    where driver_id = p_driver_id
      and settlement_id is null
      and id = any(p_deduction_ids)
  )
  select
    t.trips_count,
    t.total_trabs,
    c.custody_credits,
    c.custody_debits,
    c.driver_expenses,
    a.total_advances,
    d.total_deductions,
    -- المستحق = التربات + اللي صرفه/أرجعه − اللي استلمه − السلف − الخصومات
    (t.total_trabs + c.custody_debits - c.custody_credits
      - a.total_advances - d.total_deductions) as net_amount
  from t, c, a, d;
$$;

-- ----------------------------------------------------------------------------
-- 6) تنفيذ التصفية — عملية ذرّية: تحسب، تجمّد، توسم
--    نفس شروط المعاينة بالحرف، عشان اللي شفته هو اللي اتصفّى بالظبط
-- ----------------------------------------------------------------------------
create or replace function fn_create_driver_settlement(
  p_driver_id     uuid,
  p_from          date,
  p_to            date,
  p_settled_on    date default current_date,
  p_advance_ids   uuid[] default '{}'::uuid[],
  p_deduction_ids uuid[] default '{}'::uuid[],
  p_notes         text default null
)
returns uuid
language plpgsql
as $$
declare
  v_preview record;
  v_id      uuid;
begin
  if p_to < p_from then
    raise exception 'تاريخ نهاية الفترة لا يمكن أن يسبق تاريخ بدايتها';
  end if;

  select * into v_preview
  from fn_driver_settlement_preview(p_driver_id, p_from, p_to, p_advance_ids, p_deduction_ids);

  if v_preview.trips_count = 0
     and v_preview.custody_credits = 0
     and v_preview.custody_debits = 0
     and v_preview.total_advances = 0
     and v_preview.total_deductions = 0 then
    raise exception 'لا يوجد ما يُصفّى في هذه الفترة — كل العناصر متصفّية بالفعل أو لا توجد حركات';
  end if;

  insert into driver_settlements (
    driver_id, from_date, to_date, settled_on,
    trips_count, total_trabs, custody_credits, custody_debits, driver_expenses,
    total_advances, total_deductions, net_amount, notes
  ) values (
    p_driver_id, p_from, p_to, p_settled_on,
    v_preview.trips_count, v_preview.total_trabs,
    v_preview.custody_credits, v_preview.custody_debits, v_preview.driver_expenses,
    v_preview.total_advances, v_preview.total_deductions, v_preview.net_amount, p_notes
  )
  returning id into v_id;

  update trips
     set settlement_id = v_id
   where driver_id = p_driver_id
     and trip_date between p_from and p_to
     and settlement_id is null
     and (status <> 'cancelled' or should_count_cancelled());

  update driver_custody_entries
     set settlement_id = v_id
   where driver_id = p_driver_id
     and date between p_from and p_to
     and settlement_id is null;

  -- تحويل الدلو والوسم في خطوة واحدة — القيد chk_* بيضمن إنهم ما يفترقوش
  update driver_advances
     set settle_against = 'trabs', settlement_id = v_id
   where driver_id = p_driver_id
     and settlement_id is null
     and id = any(p_advance_ids);

  update driver_deductions
     set settle_against = 'trabs', settlement_id = v_id
   where driver_id = p_driver_id
     and settlement_id is null
     and id = any(p_deduction_ids);

  return v_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 7) إلغاء تصفية — بيفك الوسم ويرجّع السلف/الخصومات لدلو الراتب
--    (الحذف المباشر من الجدول بيسيب settle_against='trabs' يتيماً بلا سند)
-- ----------------------------------------------------------------------------
create or replace function fn_delete_driver_settlement(p_settlement_id uuid)
returns void
language plpgsql
as $$
begin
  update driver_advances
     set settle_against = 'salary', settlement_id = null
   where settlement_id = p_settlement_id;

  update driver_deductions
     set settle_against = 'salary', settlement_id = null
   where settlement_id = p_settlement_id;

  -- trips و custody بيترجعوا null تلقائياً بـ on delete set null
  delete from driver_settlements where id = p_settlement_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 8) إعادة بناء v_trips_full لتشمل حالة التصفية
--    ضروري لأن PostgreSQL بيوسّع `t.*` وقت إنشاء الـ view، فالعمود الجديد
--    settlement_id مش هيظهر فيها لوحده مهما اتضافت أعمدة على جدول trips.
--    و fn_driver_internal_trips بترجع setof v_trips_full فلازم تتحذف الأول.
-- ----------------------------------------------------------------------------
drop function if exists fn_driver_internal_trips(uuid, date, date);
drop view if exists v_trips_full;

create view v_trips_full
  with (security_invoker = true) as
select
  t.*,
  d.name as driver_name,
  c.name as company_name,
  st.settlement_number,
  coalesce(l.loading_count, 0)    as loading_count,
  coalesce(l.loading_total, 0)    as loading_total,
  coalesce(l.unloading_count, 0)  as unloading_count,
  coalesce(l.unloading_total, 0)  as unloading_total
from trips t
join drivers d   on d.id = t.driver_id
join companies c on c.id = t.company_id
left join driver_settlements st on st.id = t.settlement_id
left join v_trip_location_totals l on l.trip_id = t.id;

create or replace function fn_driver_internal_trips(
  p_driver_id uuid,
  p_from date,
  p_to   date
)
returns setof v_trips_full
language sql stable
as $$
  select * from v_trips_full
  where driver_id = p_driver_id
    and trip_date between p_from and p_to
    and (status <> 'cancelled' or should_count_cancelled())
  order by trip_date;
$$;
