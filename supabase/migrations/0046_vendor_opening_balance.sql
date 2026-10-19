-- ============================================================================
-- 0046 — رصيد افتتاحي للمورّد
-- ============================================================================
--
-- 🔒 إضافي: أعمدة على vendors وتعديل دالتين. لا delete ولا truncate ولا drop
--    table، ولا تُمَس أي رحلة ولا أي دالة ربح.
--
-- المطلوب: مورّد له مبلغ متبقٍّ قديم من رحلات سابقة لم تُسجَّل في النظام —
-- يُكتب مرة واحدة مع سبب يوضّح مصدره.
--
-- ⚠️ لماذا يُصفّى مرة واحدة لا يُضاف لكل فترة
--
-- الرصيد الافتتاحي ليس حركة في شهر بعينه. فلو أُضيف لمستحق كل فترة لظهر في
-- يناير وفبراير ومارس كأنه دَين جديد كل مرة، ولتضاعف بلا نهاية.
--
-- فيُعامل كبندٍ **مفتوح** مثل الرحلة غير المصروفة: يدخل المستحق ما دام
-- opening_settlement_id فارغاً، وأول تصفية تضمّه وتَسِمه فيخرج من الحساب
-- إلى الأبد.
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

alter table vendors
  add column if not exists opening_balance numeric(12,2) not null default 0,
  add column if not exists opening_reason  text,
  add column if not exists opening_date    date,
  add column if not exists opening_settlement_id uuid
    references vendor_settlements(id) on delete set null;

do $do$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_vendor_opening_balance') then
    alter table vendors add constraint chk_vendor_opening_balance
      check (opening_balance >= 0);
  end if;
end
$do$;

-- ----------------------------------------------------------------------------
-- الملخص: يضمّ الرصيد الافتتاحي ما دام غير مصفّى
-- ----------------------------------------------------------------------------
drop function if exists fn_vendor_period_summary(uuid, date, date);

create or replace function fn_vendor_period_summary(
  p_vendor_id uuid,
  p_from date,
  p_to   date
)
returns table (
  trips_count         bigint,
  drivers_count       bigint,
  total_client_amount numeric,
  total_vendor_cost   numeric,
  total_profit        numeric,
  total_advances      numeric,
  settled_cost        numeric,
  unsettled_cost      numeric,
  opening_balance     numeric,
  net_due             numeric
)
language sql stable
as $fn$
  with trip_agg as (
    select
      count(*)                                   as trips_count,
      count(distinct t.driver_id)                as drivers_count,
      coalesce(sum(t.trip_amount), 0)            as total_client_amount,
      coalesce(sum(t.driver_trip_payment), 0)    as total_vendor_cost,
      coalesce(sum(t.trip_amount - t.driver_trip_payment), 0) as total_profit,
      coalesce(sum(t.driver_trip_payment)
        filter (where t.vendor_settlement_id is not null), 0) as settled_cost,
      coalesce(sum(t.driver_trip_payment)
        filter (where t.vendor_settlement_id is null), 0)     as unsettled_cost
    from trips t
    join drivers d on d.id = t.driver_id
    where d.vendor_id = p_vendor_id
      and t.trip_date between p_from and p_to
      and (t.status <> 'cancelled' or should_count_cancelled())
  ),
  adv_agg as (
    select
      coalesce(sum(amount), 0) as total_advances,
      coalesce(sum(amount) filter (where settlement_id is null), 0) as open_advances
    from vendor_advances
    where vendor_id = p_vendor_id and date between p_from and p_to
  ),
  open_bal as (
    -- غير المصفّى منه فقط، وإلا تكرّر في كل فترة
    select coalesce(
      (select opening_balance from vendors
        where id = p_vendor_id and opening_settlement_id is null), 0
    ) as amount
  )
  select
    trip_agg.trips_count,
    trip_agg.drivers_count,
    trip_agg.total_client_amount,
    trip_agg.total_vendor_cost,
    trip_agg.total_profit,
    adv_agg.total_advances,
    trip_agg.settled_cost,
    trip_agg.unsettled_cost,
    open_bal.amount,
    (trip_agg.unsettled_cost + open_bal.amount - adv_agg.open_advances) as net_due
  from trip_agg, adv_agg, open_bal;
$fn$;

-- ----------------------------------------------------------------------------
-- التصفية: تضمّ الرصيد الافتتاحي وتَسِمه فلا يعود
-- ----------------------------------------------------------------------------
create or replace function fn_settle_vendor(
  p_vendor_id uuid,
  p_from date,
  p_to   date,
  p_settled_on date default current_date,
  p_notes text default null
)
returns uuid
language plpgsql
as $fn$
declare
  v_settlement_id uuid;
  v_trips_count   bigint;
  v_cost          numeric;
  v_advances      numeric;
  v_opening       numeric;
begin
  select count(*), coalesce(sum(t.driver_trip_payment), 0)
    into v_trips_count, v_cost
  from trips t
  join drivers d on d.id = t.driver_id
  where d.vendor_id = p_vendor_id
    and t.trip_date between p_from and p_to
    and t.vendor_settlement_id is null
    and (t.status <> 'cancelled' or should_count_cancelled());

  select coalesce(sum(amount), 0) into v_advances
  from vendor_advances
  where vendor_id = p_vendor_id
    and date between p_from and p_to
    and settlement_id is null;

  select coalesce(opening_balance, 0) into v_opening
  from vendors
  where id = p_vendor_id and opening_settlement_id is null;

  v_opening := coalesce(v_opening, 0);

  if v_trips_count = 0 and v_advances = 0 and v_opening = 0 then
    raise exception 'لا توجد رحلات ولا سلف ولا رصيد افتتاحي غير مصفّى لهذا المورّد في الفترة المحددة';
  end if;

  insert into vendor_settlements (
    vendor_id, from_date, to_date, settled_on,
    trips_count, total_vendor_cost, total_advances, net_amount, notes
  )
  values (
    p_vendor_id, p_from, p_to, p_settled_on,
    v_trips_count,
    -- الرصيد الافتتاحي جزء من المستحق المصروف، فيدخل الإجمالي المجمّد
    (v_cost + v_opening),
    v_advances,
    (v_cost + v_opening - v_advances),
    p_notes
  )
  returning id into v_settlement_id;

  update trips t
     set vendor_settlement_id = v_settlement_id
    from drivers d
   where d.id = t.driver_id
     and d.vendor_id = p_vendor_id
     and t.trip_date between p_from and p_to
     and t.vendor_settlement_id is null
     and (t.status <> 'cancelled' or should_count_cancelled());

  update vendor_advances
     set settlement_id = v_settlement_id
   where vendor_id = p_vendor_id
     and date between p_from and p_to
     and settlement_id is null;

  -- وسم الرصيد الافتتاحي فلا يدخل تصفية ثانية
  if v_opening > 0 then
    update vendors
       set opening_settlement_id = v_settlement_id
     where id = p_vendor_id and opening_settlement_id is null;
  end if;

  return v_settlement_id;
end
$fn$;

-- ----------------------------------------------------------------------------
-- تقرير الموردين: يُظهر الافتتاحي ضمن غير المصفّى
-- ----------------------------------------------------------------------------
drop function if exists fn_vendors_report(date, date);

create or replace function fn_vendors_report(p_from date, p_to date)
returns table (
  vendor_id           uuid,
  vendor_name         text,
  vendor_status       text,
  drivers_count       bigint,
  trips_count         bigint,
  total_client_amount numeric,
  total_vendor_cost   numeric,
  total_profit        numeric,
  opening_balance     numeric,
  unsettled_cost      numeric
)
language sql stable
as $fn$
  select
    v.id, v.name, v.status,
    coalesce(dc.cnt, 0),
    coalesce(t.trips_count, 0),
    coalesce(t.total_client_amount, 0),
    coalesce(t.total_vendor_cost, 0),
    coalesce(t.total_profit, 0),
    case when v.opening_settlement_id is null then coalesce(v.opening_balance, 0) else 0 end,
    coalesce(t.unsettled_cost, 0)
      + case when v.opening_settlement_id is null then coalesce(v.opening_balance, 0) else 0 end
  from vendors v
  left join lateral (
    select count(*) as cnt from drivers d where d.vendor_id = v.id
  ) dc on true
  left join lateral (
    select
      count(*)                                   as trips_count,
      sum(t.trip_amount)                         as total_client_amount,
      sum(t.driver_trip_payment)                 as total_vendor_cost,
      sum(t.trip_amount - t.driver_trip_payment) as total_profit,
      sum(t.driver_trip_payment)
        filter (where t.vendor_settlement_id is null) as unsettled_cost
    from trips t
    join drivers d on d.id = t.driver_id
    where d.vendor_id = v.id
      and t.trip_date between p_from and p_to
      and (t.status <> 'cancelled' or should_count_cancelled())
  ) t on true
  order by v.name;
$fn$;
