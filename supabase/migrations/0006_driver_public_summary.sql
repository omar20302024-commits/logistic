-- ============================================================================
-- Phase 13: دالة ملخص آمنة لكشف حساب السائق (بدون أي بيانات سرية)
-- لا تُرجع: سعر الرحلة، الديزل، الربح التشغيلي — حتى لا تصل هذه البيانات
-- إلى أي كود يخص كشف السائق، حتى على مستوى قاعدة البيانات نفسها.
-- ============================================================================

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
    total_due_to_driver
  from fn_driver_period_summary(p_driver_id, p_from, p_to);
$$;
