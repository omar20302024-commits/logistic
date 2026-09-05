-- ============================================================================
-- دعم Phase 8 (رقم الرحلة التلقائي) و Phase 10 (كشف الراتب المحسوب)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) توليد رقم الرحلة تلقائياً إن لم يُدخله المستخدم (قابل للتعديل يدوياً)
--    الصيغة: TRP-<السنة>-<تسلسل 4 أرقام>
-- ----------------------------------------------------------------------------
create sequence if not exists trip_number_seq start 1;

create or replace function fn_generate_trip_number()
returns trigger
language plpgsql
as $$
begin
  if new.trip_number is null or btrim(new.trip_number) = '' then
    new.trip_number := 'TRP-' || to_char(current_date, 'YYYY') || '-'
      || lpad(nextval('trip_number_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

create trigger trg_generate_trip_number
  before insert on trips
  for each row execute function fn_generate_trip_number();

-- ----------------------------------------------------------------------------
-- 2) v_salary_statements — كشف الراتب الكامل محسوباً (خصومات/سلف/صافي/متبقي)
--    الخصومات والسلف تُجمع تلقائياً من الجداول التفصيلية ضمن شهر الراتب
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
    and dd.date >= make_date(s.year, s.month, 1)
    and dd.date <= (make_date(s.year, s.month, 1) + interval '1 month' - interval '1 day')::date
) ded on true
left join lateral (
  select sum(amount) as total
  from driver_advances da
  where da.driver_id = s.driver_id
    and da.date >= make_date(s.year, s.month, 1)
    and da.date <= (make_date(s.year, s.month, 1) + interval '1 month' - interval '1 day')::date
) adv on true;
