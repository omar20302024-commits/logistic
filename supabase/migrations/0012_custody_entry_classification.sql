-- ============================================================================
-- 0012 — تصنيف قيود العهدة + دمج مصروفات السائق في حساب الربح
-- ============================================================================
--
-- المشكلة اللي بيحلها الملف ده:
--
-- 1) النوع 'debit' كان بيخلط حالتين مختلفتين محاسبياً تماماً:
--      أ) السائق صرف على مصروف عمل (ديزل/صيانة) → ده مصروف حقيقي على الشركة
--      ب) السائق أرجع مبلغاً للشركة            → ده مجرد حركة نقدية، مش مصروف
--    من غير تفرقة بينهم، أي دمج للعهدة في الربح هيحتسب المبالغ المُرجَعة
--    كمصروفات ويقلل الربح غلط.
--
-- 2) مصروفات السائق ما كانتش بتدخل حساب الربح إطلاقاً:
--      net_profit = operating_profit − salaries − expenses
--    والعهدة مش في المعادلة. فلو السائق دفع 500 ديزل من جيبه واتسجلت عهدة بس،
--    كان بيستلم الـ 500 (صح) لكن الربح يفضل مبالغ فيه بـ 500 (غلط).
--
-- القيود القديمة كلها بتاخد 'unspecified' وهي **لا تمسّ الربح إطلاقاً** —
-- عشان أرقامك التاريخية ما تتغيّرش فجأة. صنّفها يدوياً وقت ما تحب.
-- ----------------------------------------------------------------------------

-- الملف كله قابل لإعادة التشغيل بأمان (idempotent): لو وقف في النص لأي سبب،
-- شغّله تاني من أوله من غير ما تحذف حاجة.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'custody_entry_reason') then
    create type custody_entry_reason as enum (
      'unspecified',            -- قيد قديم قبل التصنيف — محايد، لا يدخل الربح
      'from_company',           -- credit: الشركة سلّمت السائق مبلغاً
      'collected_for_company',  -- credit: السائق حصّل كاش من عميل نيابة عن الشركة
      'work_expense',           -- debit : صرف على مصروف عمل → مصروف حقيقي يخصم من الربح
      'returned_to_company'     -- debit : أرجع مبلغاً للشركة → حركة نقدية فقط
    );
  end if;
end $$;

alter table driver_custody_entries
  add column if not exists reason           custody_entry_reason not null default 'unspecified',
  add column if not exists expense_category text,
  add column if not exists trip_id          uuid references trips(id) on delete set null;

-- السبب لازم يكون متسقاً مع نوع الحركة — مستحيل يتسجل credit بسبب debit
-- (`add constraint` مفيهاش `if not exists`، فنتأكد يدوياً)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_custody_reason_matches_type') then
    alter table driver_custody_entries
      add constraint chk_custody_reason_matches_type check (
        reason = 'unspecified'
        or (type = 'credit' and reason in ('from_company', 'collected_for_company'))
        or (type = 'debit'  and reason in ('work_expense', 'returned_to_company'))
      );
  end if;

  -- بند المصروف (ديزل/صيانة/…) له معنى فقط لما يكون القيد مصروف عمل
  if not exists (select 1 from pg_constraint where conname = 'chk_custody_category_only_for_expense') then
    alter table driver_custody_entries
      add constraint chk_custody_category_only_for_expense check (
        expense_category is null or reason = 'work_expense'
      );
  end if;
end $$;

create index if not exists idx_custody_reason on driver_custody_entries(reason);
create index if not exists idx_custody_trip on driver_custody_entries(trip_id) where trip_id is not null;

-- ----------------------------------------------------------------------------
-- مصروفات دفعها السائق خلال فترة — المصدر الوحيد لهذا الرقم في كل النظام
-- ----------------------------------------------------------------------------
create or replace function fn_driver_paid_expenses(p_from date, p_to date)
returns numeric
language sql stable
as $$
  select coalesce(sum(amount), 0)
  from driver_custody_entries
  where reason = 'work_expense'
    and date between p_from and p_to;
$$;

-- تفصيل مصروفات السائقين حسب البند — للتقرير المالي
create or replace function fn_driver_paid_expenses_by_category(p_from date, p_to date)
returns table (
  expense_category text,
  total            numeric,
  entries_count    bigint
)
language sql stable
as $$
  select
    coalesce(expense_category, 'غير محدد') as expense_category,
    sum(amount)                            as total,
    count(*)                               as entries_count
  from driver_custody_entries
  where reason = 'work_expense'
    and date between p_from and p_to
  group by 1
  order by 2 desc;
$$;

-- ----------------------------------------------------------------------------
-- التقرير المالي: مصروفات السائقين بقت بند مستقل في المعادلة
-- (drop لازم لأن أعمدة الإرجاع اتغيّرت)
-- ----------------------------------------------------------------------------
drop function if exists fn_financial_summary(date, date);

create or replace function fn_financial_summary(
  p_from date,
  p_to   date
)
returns table (
  total_revenue           numeric,  -- إجمالي قيمة الرحلات
  total_driver_payments   numeric,  -- إجمالي التربات
  total_diesel            numeric,  -- ديزل مدفوع من الشركة (على الرحلة)
  operating_profit        numeric,  -- الإيرادات − التربات − الديزل
  total_salaries          numeric,
  total_driver_expenses   numeric,  -- مصروفات دفعها السائقون (عهدة أو من جيبهم)
  total_other_expenses    numeric,
  net_profit              numeric
)
language sql stable
as $$
  with trip_agg as (
    select
      coalesce(sum(trip_amount), 0)         as total_revenue,
      coalesce(sum(driver_trip_payment), 0) as total_driver_payments,
      coalesce(sum(diesel_amount), 0)       as total_diesel,
      coalesce(sum(trip_profit), 0)         as operating_profit
    from trips
    where trip_date between p_from and p_to
      and (status <> 'cancelled' or should_count_cancelled())
  ),
  sal_agg as (
    select coalesce(sum(basic_salary), 0) as total_salaries
    from salaries
    where make_date(year, month, 1) <= p_to
      and (make_date(year, month, 1) + interval '1 month' - interval '1 day') >= p_from
  ),
  drv_exp as (
    select fn_driver_paid_expenses(p_from, p_to) as total_driver_expenses
  ),
  exp_agg as (
    select coalesce(sum(amount), 0) as total_other_expenses
    from expenses
    where date between p_from and p_to
  )
  select
    trip_agg.total_revenue,
    trip_agg.total_driver_payments,
    trip_agg.total_diesel,
    trip_agg.operating_profit,
    sal_agg.total_salaries,
    drv_exp.total_driver_expenses,
    exp_agg.total_other_expenses,
    (trip_agg.operating_profit
      - sal_agg.total_salaries
      - drv_exp.total_driver_expenses
      - exp_agg.total_other_expenses) as net_profit
  from trip_agg, sal_agg, drv_exp, exp_agg;
$$;
