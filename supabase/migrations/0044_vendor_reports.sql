-- ============================================================================
-- 0044 — كشوفات المورّد: الداخلي الكامل، والذي يُسلَّم له
-- ============================================================================
--
-- 🔒 إضافي: دوال قراءة فقط. لا تكتب شيئاً ولا تُمَس أي دالة ربح.
--
-- دالتان منفصلتان لا دالة واحدة بمفتاح إخفاء:
--
--   fn_vendor_trips         →  الداخلي: سعر العميل والربح وكل شيء
--   fn_vendor_payable_trips →  الذي يُسلَّم للمورّد: **لا تُرجع سعر العميل ولا
--                              الربح أصلاً**، فلا وجود لهما في النتيجة
--
-- الفصل مقصود: كشف يخرج لطرف خارجي لا يُؤتمن على «نسينا نخفي عموداً». وحين
-- لا يُرجع المصدرُ الحقلَ، لا يمكن تسريبه بخطأ في الواجهة ولا في الطباعة.
-- نفس انضباط fn_driver_public_* (قاعدة #11).
--
-- ⚠️ أي تعديل مستقبلي يضيف حقلاً لـ fn_vendor_payable_trips يجب أن يمرّ بهذا
--    السؤال: هل يراه المورّد؟ سعر العميل والربح لا يراهما أبداً.
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 1) ملخص المورّد في فترة — للعرض الداخلي
-- ----------------------------------------------------------------------------
create or replace function fn_vendor_period_summary(
  p_vendor_id uuid,
  p_from date,
  p_to   date
)
returns table (
  trips_count        bigint,
  drivers_count      bigint,
  total_client_amount numeric,
  total_vendor_cost   numeric,
  total_profit        numeric,
  total_advances      numeric,
  settled_cost        numeric,
  unsettled_cost      numeric,
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
    -- المستحق = ما لم يُصرف من رحلاته ناقص سلفه غير المخصومة بعد
    (trip_agg.unsettled_cost - adv_agg.open_advances) as net_due
  from trip_agg, adv_agg;
$fn$;

-- ----------------------------------------------------------------------------
-- 2) رحلات المورّد — الداخلي الكامل
-- ----------------------------------------------------------------------------
create or replace function fn_vendor_trips(
  p_vendor_id uuid,
  p_from date,
  p_to   date
)
returns table (
  trip_id        uuid,
  trip_date      date,
  trip_number    text,
  driver_name    text,
  company_name   text,
  from_location  text,
  to_location    text,
  branches_count int,
  client_amount  numeric,
  vendor_cost    numeric,
  profit         numeric,
  settled        boolean
)
language sql stable
as $fn$
  select
    t.id, t.trip_date, t.trip_number,
    d.name, c.name,
    t.from_location, t.to_location, t.branches_count,
    t.trip_amount,
    t.driver_trip_payment,
    (t.trip_amount - t.driver_trip_payment),
    (t.vendor_settlement_id is not null)
  from trips t
  join drivers d   on d.id = t.driver_id
  join companies c on c.id = t.company_id
  where d.vendor_id = p_vendor_id
    and t.trip_date between p_from and p_to
    and (t.status <> 'cancelled' or should_count_cancelled())
  order by t.trip_date, t.trip_number;
$fn$;

-- ----------------------------------------------------------------------------
-- 3) رحلات المورّد — الكشف الذي يُسلَّم له
--
-- 🔒 لا trip_amount ولا profit في أعمدة الإرجاع إطلاقاً.
-- ----------------------------------------------------------------------------
create or replace function fn_vendor_payable_trips(
  p_vendor_id uuid,
  p_from date,
  p_to   date
)
returns table (
  trip_date      date,
  trip_number    text,
  driver_name    text,
  from_location  text,
  to_location    text,
  branches_count int,
  amount         numeric
)
language sql stable
as $fn$
  select
    t.trip_date, t.trip_number, d.name,
    t.from_location, t.to_location, t.branches_count,
    t.driver_trip_payment
  from trips t
  join drivers d on d.id = t.driver_id
  where d.vendor_id = p_vendor_id
    and t.trip_date between p_from and p_to
    and (t.status <> 'cancelled' or should_count_cancelled())
  order by t.trip_date, t.trip_number;
$fn$;

-- ----------------------------------------------------------------------------
-- 4) قائمة الموردين مع أرقامهم في فترة — لصفحة الموردين
-- ----------------------------------------------------------------------------
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
    coalesce(t.unsettled_cost, 0)
  from vendors v
  left join lateral (
    select count(*) as cnt from drivers d where d.vendor_id = v.id
  ) dc on true
  left join lateral (
    select
      count(*)                                as trips_count,
      sum(t.trip_amount)                      as total_client_amount,
      sum(t.driver_trip_payment)              as total_vendor_cost,
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

-- ----------------------------------------------------------------------------
-- 5) تنفيذ التصفية في عملية واحدة
--
-- plpgsql لا sql: إنشاء السند ووسم رحلاته وسلفه يجب أن يتم معاً. لو فُصلت
-- لوقعت حالة وسطى — سند بلا رحلات، أو رحلات موسومة بسند لم يُنشأ.
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
begin
  -- ما لم يُصرف بعد في هذه الفترة
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

  if v_trips_count = 0 and v_advances = 0 then
    raise exception 'لا توجد رحلات ولا سلف غير مصفّاة لهذا المورّد في الفترة المحددة';
  end if;

  insert into vendor_settlements (
    vendor_id, from_date, to_date, settled_on,
    trips_count, total_vendor_cost, total_advances, net_amount, notes
  )
  values (
    p_vendor_id, p_from, p_to, p_settled_on,
    v_trips_count, v_cost, v_advances, (v_cost - v_advances), p_notes
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

  return v_settlement_id;
end
$fn$;
