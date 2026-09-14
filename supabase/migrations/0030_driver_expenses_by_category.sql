-- ============================================================================
-- 0030 — تفصيل مصروفات السائق حسب البند في كشوفاته
-- ============================================================================
--
-- المطلوب: بدل ما يقرأ السائق سطراً مبهماً، يشوف على إيه اتصرفت فلوسه:
--     ما صرفه على العمل        500
--        غسيل      300
--        إطارات    200
--
-- fn_driver_paid_expenses_by_category الموجودة من 0012 بتجمّع حسب البند لكن
-- **من غير فلتر سائق** — بترجّع مصروفات كل السواقين، فما تنفعش في كشف فردي.
-- الدالة دي هي نسختها بفلتر السائق. الدالة القديمة باقية كما هي للتقرير المالي.
--
-- 🔒 لا تسريب: بترجّع بنود مصروفات السائق نفسه ومبالغها فقط — لا سعر رحلة ولا
--    ربح ولا ديزل الشركة. آمنة للكشف العام (قاعدة #11).
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

create or replace function fn_driver_expenses_by_category(
  p_driver_id uuid,
  p_from date,
  p_to   date
)
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
  where driver_id = p_driver_id
    and reason = 'work_expense'
    and date between p_from and p_to
  group by 1
  order by 2 desc;
$$;
