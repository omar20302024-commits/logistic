-- ============================================================================
-- 0058 — تقرير السائقين: سائقو الشركة وحدهم، وديزل صفحة السائق
-- ============================================================================
--
-- 🔒 دالة واحدة تُستبدَل. لا جدول يُمَس، ولا عمود، ولا بيانات.
--
-- تعديلان في دالة واحدة لأن التقريرين يقرآن منها:
--   /reports/drivers          تقرير السائقين
--   /reports/drivers-ranking  ترتيب السائقين (رحلات وتربات)
--
-- ----------------------------------------------------------------------------
-- 1) سائقو الشركة وحدهم
-- ----------------------------------------------------------------------------
-- الخارجيون والموردون ليسوا موظفين: لا راتب لهم ولا ديزل تدفعه الشركة،
-- فصفوفهم في تقرير ربحية الموظفين تُفسد المقارنة والإجماليات. ولهم كشوفهم:
-- /vendors و /reports/external-drivers.
--
-- ----------------------------------------------------------------------------
-- 2) الديزل من صفحة السائق
-- ----------------------------------------------------------------------------
-- كان `total_diesel` = مجموع `trips.diesel_amount` وحده — أي الديزل القديم
-- المسجَّل على الرحلة. والمستخدم يُدخل الديزل اليوم في صفحة السائق، فيُحفظ
-- في driver_monthly_diesel (يغذّيها trigger من تفويلات 0039)، فلا يظهر في
-- التقرير إطلاقاً.
--
-- 🔑 المصدر هو driver_monthly_diesel لا driver_diesel_entries مباشرةً:
--    الجدول الشهري هو ما تخصمه دوال الربح أصلاً، ويضمّ الشهور المُدخلة
--    يدوياً التي لا تفويلات لها. القراءة من التفويلات كانت ستُسقطها.
--
-- ⚠️ ولأن الديزل الشهري يُخصم الآن، يُطرح من الربح التشغيلي كذلك — وإلا
--    صار الجدول لا يُجمع: سعر − ترب − ديزل ≠ الربح المكتوب بجانبه.
--    والصيغة تبقى اشتقاقاً من sum(trip_profit) كما كانت، ناقصاً الشهري.
--
-- 📅 الشهري يُحسب بتداخل الشهر مع الفترة — نفس قاعدة fn_monthly_diesel_total
--    حرفياً. ففترة نصف شهر تجرّ ديزل الشهر كاملاً، وهو سلوك النظام القائم
--    لا استثناء هنا.
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

drop function if exists fn_drivers_report(date, date);

create function fn_drivers_report(p_from date, p_to date)
returns table (
  driver_id             uuid,
  driver_name           text,
  driver_status         driver_status,
  trips_count           bigint,
  total_trip_amount     numeric,
  total_driver_payment  numeric,
  total_diesel          numeric,
  operating_profit      numeric,
  salary_earned         numeric,
  net_profit            numeric
)
language sql stable
as $$
  select
    d.id, d.name, d.status,
    coalesce(t.trips_count, 0),
    coalesce(t.total_trip_amount, 0),
    coalesce(t.total_driver_payment, 0),
    -- ديزل الرحلات القديم + ديزل صفحة السائق
    coalesce(t.total_diesel, 0) + coalesce(md.monthly_diesel, 0),
    -- trip_profit يخصم ديزل الرحلة أصلاً، فلا يُطرح إلا الشهري
    coalesce(t.operating_profit, 0) - coalesce(md.monthly_diesel, 0),
    coalesce(s.salary_earned, 0),
    coalesce(t.operating_profit, 0)
      - coalesce(md.monthly_diesel, 0)
      - coalesce(s.salary_earned, 0)
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
  left join lateral (
    select sum(dm.amount) as monthly_diesel
    from driver_monthly_diesel dm
    where dm.driver_id = d.id
      and make_date(dm.year, dm.month, 1) <= p_to
      and (make_date(dm.year, dm.month, 1) + interval '1 month' - interval '1 day')::date >= p_from
  ) md on true
  left join lateral (
    select sum(
      fn_driver_earned_salary(sal.driver_id, sal.year, sal.month, sal.basic_salary)
    ) as salary_earned
    from salaries sal
    where sal.driver_id = d.id
      and make_date(sal.year, sal.month, 1) <= p_to
      and (make_date(sal.year, sal.month, 1) + interval '1 month' - interval '1 day')::date >= p_from
  ) s on true
  where d.employment_type = 'internal'
  order by d.name;
$$;

notify pgrst, 'reload schema';
