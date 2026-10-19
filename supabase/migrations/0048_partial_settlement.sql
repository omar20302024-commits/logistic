-- ============================================================================
-- 0048 — سداد جزئي: ادفع بعض المستحق، والباقي يبقى ديناً
-- ============================================================================
--
-- 🔒 إضافي بالكامل: أعمدة جديدة بقيَم افتراضية، ودوال تُستبدل. لا delete ولا
--    truncate ولا drop table. التصفيات القائمة تُقرأ كما هي: paid_amount
--    يُملأ بـ net_amount (أي أنها دُفعت كاملة) و carried_amount = 0.
--
-- المطلوب: عند التصفية أكتب المبلغ المدفوع — كاملاً أو أقل. والأقل يترك
-- «متبقٍّ» على الشركة يظهر في المستحق القادم.
--
-- ⚠️ لماذا «متبقٍّ محمول» لا «رحلات غير مصفّاة»
--
-- التصفية تَسِم الرحلات فتتجمّد أرقامها في سند — وهذا ما يمنع صرفها مرتين.
-- فلو تركنا بعض الرحلات بلا وسم لتمثيل النقص، لاختلّت المطابقة بين السند
-- وما يراه المورّد، ولاحتاج المستخدم أن يختار أي رحلة تُدفع — وهو لم يطلب
-- ذلك، بل طلب مبلغاً.
--
-- فالرحلات تُصفّى كلها، ويُسجَّل المدفوع فعلاً، والفرق يُحمَل كبندٍ **مفتوح**
-- مثل الرصيد الافتتاحي تماماً (0046): يدخل المستحق ما دام carry_settlement_id
-- فارغاً، وأول تصفية تالية تضمّه وتَسِمه فيخرج من الحساب.
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 1) الأعمدة
-- ----------------------------------------------------------------------------
alter table vendor_settlements
  add column if not exists paid_amount    numeric(12,2),
  add column if not exists carried_in     numeric(12,2) not null default 0,
  add column if not exists carried_amount numeric(12,2) not null default 0,
  add column if not exists carry_settlement_id uuid
    references vendor_settlements(id) on delete set null;

update vendor_settlements set paid_amount = net_amount where paid_amount is null;

alter table driver_settlements
  add column if not exists paid_amount    numeric(12,2),
  add column if not exists carried_in     numeric(12,2) not null default 0,
  add column if not exists carried_amount numeric(12,2) not null default 0,
  add column if not exists carry_settlement_id uuid
    references driver_settlements(id) on delete set null;

update driver_settlements set paid_amount = net_amount where paid_amount is null;

-- ----------------------------------------------------------------------------
-- 2) الرصيد المحمول — ما بقي غير مدفوع من تصفيات سابقة
-- ----------------------------------------------------------------------------
create or replace function fn_vendor_carried_balance(p_vendor_id uuid)
returns numeric
language sql stable
as $fn$
  select coalesce(sum(carried_amount), 0)
  from vendor_settlements
  where vendor_id = p_vendor_id
    and carried_amount > 0
    and carry_settlement_id is null;
$fn$;

create or replace function fn_driver_carried_balance(p_driver_id uuid)
returns numeric
language sql stable
as $fn$
  select coalesce(sum(carried_amount), 0)
  from driver_settlements
  where driver_id = p_driver_id
    and carried_amount > 0
    and carry_settlement_id is null;
$fn$;

-- ----------------------------------------------------------------------------
-- 3) تصفية المورّد بمبلغ مدفوع
--
-- p_paid_amount = null  ⇐  ادفع المستحق كاملاً (السلوك القديم حرفياً)
-- ----------------------------------------------------------------------------
drop function if exists fn_settle_vendor(uuid, date, date, date, text);
drop function if exists fn_settle_vendor(uuid, date, date, date, text, numeric);

create function fn_settle_vendor(
  p_vendor_id uuid,
  p_from date,
  p_to   date,
  p_settled_on  date default current_date,
  p_notes       text default null,
  p_paid_amount numeric default null
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
  v_carried_in    numeric;
  v_total_due     numeric;
  v_paid          numeric;
  v_carry_out     numeric;
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

  v_carried_in := fn_vendor_carried_balance(p_vendor_id);

  if v_trips_count = 0 and v_advances = 0 and v_opening = 0 and v_carried_in = 0 then
    raise exception 'لا توجد رحلات ولا سلف ولا رصيد مستحق غير مصفّى لهذا المورّد في الفترة المحددة';
  end if;

  v_total_due := v_cost + v_opening + v_carried_in - v_advances;
  v_paid      := coalesce(p_paid_amount, v_total_due);

  if v_paid < 0 then
    raise exception 'المبلغ المدفوع لا يكون سالباً';
  end if;

  -- الزيادة ليست سداداً بل سلفة على القادم، ولها بابها
  if v_paid > v_total_due then
    raise exception 'المبلغ المدفوع (%) أكبر من المستحق (%) — سجّل الزيادة كسلفة',
      v_paid, v_total_due;
  end if;

  v_carry_out := v_total_due - v_paid;

  insert into vendor_settlements (
    vendor_id, from_date, to_date, settled_on,
    trips_count, total_vendor_cost, total_advances,
    carried_in, net_amount, paid_amount, carried_amount, notes
  )
  values (
    p_vendor_id, p_from, p_to, p_settled_on,
    v_trips_count,
    -- الافتتاحي جزء من تكلفة هذا السند؛ والمحمول عمودُه الخاص فلا يُحسب مرتين
    (v_cost + v_opening),
    v_advances,
    v_carried_in,
    v_total_due,
    v_paid,
    v_carry_out,
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

  if v_opening > 0 then
    update vendors
       set opening_settlement_id = v_settlement_id
     where id = p_vendor_id and opening_settlement_id is null;
  end if;

  -- المحمول السابق دخل هذا السند، فيُوسَم كي لا يدخل سنداً آخر.
  -- الصف الجديد مستثنى: متبقّيه هو المحمول المفتوح من الآن.
  if v_carried_in > 0 then
    update vendor_settlements
       set carry_settlement_id = v_settlement_id
     where vendor_id = p_vendor_id
       and carried_amount > 0
       and carry_settlement_id is null
       and id <> v_settlement_id;
  end if;

  return v_settlement_id;
end
$fn$;

-- ----------------------------------------------------------------------------
-- 4) تصفية السائق بمبلغ مدفوع — نفس المنطق حرفاً بحرف
-- ----------------------------------------------------------------------------
drop function if exists fn_create_driver_settlement(uuid, date, date, date, uuid[], uuid[], text);
drop function if exists fn_create_driver_settlement(uuid, date, date, date, uuid[], uuid[], text, numeric);

create function fn_create_driver_settlement(
  p_driver_id     uuid,
  p_from          date,
  p_to            date,
  p_settled_on    date default current_date,
  p_advance_ids   uuid[] default '{}'::uuid[],
  p_deduction_ids uuid[] default '{}'::uuid[],
  p_notes         text default null,
  p_paid_amount   numeric default null
)
returns uuid
language plpgsql
as $fn$
declare
  v_preview    record;
  v_id         uuid;
  v_carried_in numeric;
  v_total_due  numeric;
  v_paid       numeric;
  v_carry_out  numeric;
begin
  if p_to < p_from then
    raise exception 'تاريخ نهاية الفترة لا يمكن أن يسبق تاريخ بدايتها';
  end if;

  select * into v_preview
  from fn_driver_settlement_preview(p_driver_id, p_from, p_to, p_advance_ids, p_deduction_ids);

  v_carried_in := fn_driver_carried_balance(p_driver_id);

  if v_preview.trips_count = 0
     and v_preview.custody_credits = 0
     and v_preview.custody_debits = 0
     and v_preview.total_advances = 0
     and v_preview.total_deductions = 0
     and v_carried_in = 0 then
    raise exception 'لا يوجد ما يُصفّى في هذه الفترة — كل العناصر متصفّية بالفعل أو لا توجد حركات';
  end if;

  v_total_due := v_preview.net_amount + v_carried_in;
  v_paid      := coalesce(p_paid_amount, v_total_due);

  if v_paid < 0 then
    raise exception 'المبلغ المدفوع لا يكون سالباً';
  end if;

  if v_paid > v_total_due then
    raise exception 'المبلغ المدفوع (%) أكبر من المستحق (%) — سجّل الزيادة كسلفة',
      v_paid, v_total_due;
  end if;

  v_carry_out := v_total_due - v_paid;

  insert into driver_settlements (
    driver_id, from_date, to_date, settled_on,
    trips_count, total_trabs, custody_credits, custody_debits, driver_expenses,
    total_advances, total_deductions,
    carried_in, net_amount, paid_amount, carried_amount, notes
  ) values (
    p_driver_id, p_from, p_to, p_settled_on,
    v_preview.trips_count, v_preview.total_trabs,
    v_preview.custody_credits, v_preview.custody_debits, v_preview.driver_expenses,
    v_preview.total_advances, v_preview.total_deductions,
    v_carried_in, v_total_due, v_paid, v_carry_out, p_notes
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

  if v_carried_in > 0 then
    update driver_settlements
       set carry_settlement_id = v_id
     where driver_id = p_driver_id
       and carried_amount > 0
       and carry_settlement_id is null
       and id <> v_id;
  end if;

  return v_id;
end
$fn$;

-- ----------------------------------------------------------------------------
-- 5) تقرير الموردين: «غير مصفّى» يشمل المحمول
--    التوقيع كما هو، فلا drop ولا أثر على من يستدعيها.
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
      + fn_vendor_carried_balance(v.id)
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

notify pgrst, 'reload schema';
