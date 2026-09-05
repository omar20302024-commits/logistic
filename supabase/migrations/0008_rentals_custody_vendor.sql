-- ============================================================================
-- الإضافات الجديدة:
-- 1) عقود الإيجار الشهري + وحدات السكن (لتقسيم تكلفة السكن على عدة سائقين تلقائياً)
-- 2) تصنيف السائق (داخلي / مورد خارجي) + كشف حساب الموردين
-- 3) العهدة: حساب جاري متحرك لكل سائق (يزيد بالتسليم، يقل بالصرف)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) العهدة — driver_custody_entries
-- ----------------------------------------------------------------------------
create type custody_entry_type as enum ('credit', 'debit');
-- credit = يزيد رصيد العهدة (الشركة سلّمت السائق مبلغاً، أو السائق حصّل كاش من عميل نيابة عن الشركة)
-- debit  = يقلل رصيد العهدة (السائق صرف من العهدة على مصروف عمل، أو أرجع مبلغاً للشركة)

create table driver_custody_entries (
  id          uuid primary key default gen_random_uuid(),
  driver_id   uuid not null references drivers(id) on delete cascade,
  date        date not null default current_date,
  type        custody_entry_type not null,
  amount      numeric(12,2) not null check (amount > 0),
  description text,
  notes       text,
  created_at  timestamptz not null default now()
);

create index idx_driver_custody_driver_date on driver_custody_entries(driver_id, date);

alter table driver_custody_entries enable row level security;
create policy "driver_custody_admin_all" on driver_custody_entries
  for all using (is_admin()) with check (is_admin());

-- رصيد العهدة الحالي لسائق معيّن كما هو حتى تاريخ معيّن.
-- موجب = السائق لسه شايل فلوس الشركة (مستحق عليه). سالب = الشركة مديونة للسائق.
create or replace function fn_driver_custody_balance(p_driver_id uuid, p_as_of date)
returns numeric
language sql stable
as $$
  select coalesce(
    sum(case when type = 'credit' then amount else -amount end),
    0
  )
  from driver_custody_entries
  where driver_id = p_driver_id and date <= p_as_of;
$$;

-- ----------------------------------------------------------------------------
-- 2) دمج رصيد العهدة في كشف حساب السائق (الداخلي والعام)
--    نحتاج drop لأن مجموعة أعمدة الإرجاع تغيّرت (أضفنا custody_balance)
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
  total_advances         numeric,
  total_deductions       numeric,
  salary_basic           numeric,
  net_salary             numeric,
  custody_balance        numeric,
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
      coalesce(sum(trip_profit), 0)          as operating_profit
    from trips
    where driver_id = p_driver_id
      and trip_date between p_from and p_to
      and (status <> 'cancelled' or should_count_cancelled())
  ),
  adv_agg as (
    select coalesce(sum(amount), 0) as total_advances
    from driver_advances
    where driver_id = p_driver_id and date between p_from and p_to
  ),
  ded_agg as (
    select coalesce(sum(amount), 0) as total_deductions
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
    select fn_driver_custody_balance(p_driver_id, p_to) as custody_balance
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
    (trip_agg.total_driver_payment
      + (sal_agg.salary_basic - ded_agg.total_deductions - adv_agg.total_advances)
      - custody_agg.custody_balance) as total_due_to_driver
  from trip_agg, adv_agg, ded_agg, sal_agg, custody_agg;
$$;

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
    total_due_to_driver
  from fn_driver_period_summary(p_driver_id, p_from, p_to);
$$;

-- ----------------------------------------------------------------------------
-- 3) تصنيف السائق: داخلي (موظف) / مورد خارجي
-- ----------------------------------------------------------------------------
create type driver_employment_type as enum ('internal', 'external');

alter table drivers
  add column employment_type driver_employment_type not null default 'internal';

-- كشف حساب الموردين الخارجيين: عدد رحلاتهم، المستحق لهم، وربحك منهم
create or replace function fn_external_drivers_report(p_from date, p_to date)
returns table (
  driver_id             uuid,
  driver_name           text,
  trips_count           bigint,
  total_trip_amount     numeric,
  total_driver_payment  numeric,
  total_diesel          numeric,
  operating_profit      numeric,
  custody_balance       numeric,
  total_due             numeric
)
language sql stable
as $$
  select
    d.id, d.name,
    coalesce(t.trips_count, 0),
    coalesce(t.total_trip_amount, 0),
    coalesce(t.total_driver_payment, 0),
    coalesce(t.total_diesel, 0),
    coalesce(t.operating_profit, 0),
    fn_driver_custody_balance(d.id, p_to),
    coalesce(t.total_driver_payment, 0) - fn_driver_custody_balance(d.id, p_to)
  from drivers d
  left join lateral (
    select
      count(*) as trips_count,
      sum(trip_amount) as total_trip_amount,
      sum(driver_trip_payment) as total_driver_payment,
      sum(diesel_amount) as total_diesel,
      sum(trip_profit) as operating_profit
    from trips tr
    where tr.driver_id = d.id
      and tr.trip_date between p_from and p_to
      and (tr.status <> 'cancelled' or should_count_cancelled())
  ) t on true
  where d.employment_type = 'external'
  order by d.name;
$$;

-- ----------------------------------------------------------------------------
-- 4) وحدات السكن + عقود الإيجار الشهري
-- ----------------------------------------------------------------------------
create table housing_units (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  city          text,
  monthly_rent  numeric(12,2) not null default 0 check (monthly_rent >= 0),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger trg_housing_units_updated_at
  before update on housing_units
  for each row execute function set_updated_at();

alter table housing_units enable row level security;
create policy "housing_units_admin_all" on housing_units
  for all using (is_admin()) with check (is_admin());

create table rental_contracts (
  id               uuid primary key default gen_random_uuid(),
  driver_id        uuid not null references drivers(id) on delete restrict,
  company_id       uuid not null references companies(id) on delete restrict,
  city             text,
  month            int not null check (month between 1 and 12),
  year             int not null check (year between 2000 and 2100),
  monthly_amount   numeric(12,2) not null default 0 check (monthly_amount >= 0),
  housing_unit_id  uuid references housing_units(id) on delete set null,
  diesel_amount    numeric(12,2) not null default 0 check (diesel_amount >= 0),
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (driver_id, month, year)
);

create index idx_rental_contracts_driver on rental_contracts(driver_id);
create index idx_rental_contracts_company on rental_contracts(company_id);
create index idx_rental_contracts_period on rental_contracts(year, month);
create index idx_rental_contracts_housing on rental_contracts(housing_unit_id);

create trigger trg_rental_contracts_updated_at
  before update on rental_contracts
  for each row execute function set_updated_at();

alter table rental_contracts enable row level security;
create policy "rental_contracts_admin_all" on rental_contracts
  for all using (is_admin()) with check (is_admin());

-- تقرير ربحية عقود الإيجار لشهر/سنة معيّنة، مع تقسيم تكلفة السكن تلقائياً
-- على عدد العقود المشتركة في نفس وحدة السكن لنفس الشهر
create or replace function fn_rental_contracts_report(p_month int, p_year int)
returns table (
  contract_id         uuid,
  driver_id           uuid,
  driver_name         text,
  company_id          uuid,
  company_name        text,
  city                text,
  monthly_amount      numeric,
  housing_unit_name   text,
  housing_share       numeric,
  salary_basic        numeric,
  trips_count         bigint,
  trabat              numeric,
  diesel              numeric,
  net_profit          numeric
)
language sql stable
as $$
  with period as (
    select
      make_date(p_year, p_month, 1) as start_date,
      (make_date(p_year, p_month, 1) + interval '1 month' - interval '1 day')::date as end_date
  ),
  housing_counts as (
    select housing_unit_id, count(*) as cnt
    from rental_contracts
    where month = p_month and year = p_year and housing_unit_id is not null
    group by housing_unit_id
  )
  select
    rc.id,
    rc.driver_id, d.name,
    rc.company_id, c.name,
    rc.city,
    rc.monthly_amount,
    hu.name,
    case
      when rc.housing_unit_id is null then 0
      else coalesce(hu.monthly_rent, 0) / greatest(coalesce(hc.cnt, 1), 1)
    end as housing_share,
    coalesce(sal.basic_salary, 0),
    coalesce(t.trips_count, 0),
    coalesce(t.trabat, 0),
    case when coalesce(t.trips_count, 0) > 0 then coalesce(t.trip_diesel, 0) else rc.diesel_amount end,
    rc.monthly_amount
      - (case when rc.housing_unit_id is null then 0
              else coalesce(hu.monthly_rent, 0) / greatest(coalesce(hc.cnt, 1), 1) end)
      - coalesce(sal.basic_salary, 0)
      - coalesce(t.trabat, 0)
      - (case when coalesce(t.trips_count, 0) > 0 then coalesce(t.trip_diesel, 0) else rc.diesel_amount end)
      as net_profit
  from rental_contracts rc
  join drivers d on d.id = rc.driver_id
  join companies c on c.id = rc.company_id
  left join housing_units hu on hu.id = rc.housing_unit_id
  left join housing_counts hc on hc.housing_unit_id = rc.housing_unit_id
  left join salaries sal
    on sal.driver_id = rc.driver_id and sal.month = rc.month and sal.year = rc.year
  left join lateral (
    select
      count(*) as trips_count,
      sum(tr.driver_trip_payment) as trabat,
      sum(tr.diesel_amount) as trip_diesel
    from trips tr, period p
    where tr.driver_id = rc.driver_id
      and tr.company_id = rc.company_id
      and tr.trip_date between p.start_date and p.end_date
      and (tr.status <> 'cancelled' or should_count_cancelled())
  ) t on true
  where rc.month = p_month and rc.year = p_year
  order by d.name;
$$;
