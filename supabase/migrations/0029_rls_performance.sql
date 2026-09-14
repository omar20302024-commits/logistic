-- ============================================================================
-- 0029 — إصلاح جذري: بطء النظام كله (Gateway Timeout في كل الصفحات)
-- ============================================================================
--
-- 🔴 هذا هو السبب الحقيقي، وهو يفسّر لماذا كل الصفحات تسقط وليس صفحة واحدة.
--
-- التشخيص:
--   كل سياسات RLS مكتوبة هكذا:  using (is_admin())
--   و is_admin() بتعمل استعلام على جدول profiles.
--
--   لما تُكتب الدالة **مباشرة** في السياسة، بوستجرس بينفّذها **لكل صف** —
--   مش مرة واحدة للاستعلام. يعني عرض 169 رحلة مع joins على drivers و companies
--   بيعمل آلاف الاستعلامات على profiles، كل واحد بينادي auth.uid().
--
--   وده كان مستخفياً وقت ما كانت الرحلات قليلة. بعد استيراد الـ 169 رحلة
--   وصل الحِمل لحدّ المهلة، فبقت كل صفحة تقع — وكل صفحة بتطلع رسالة الملف
--   المختلفة بتاعتها، فبدت وكأنها تلات مشاكل منفصلة وهي مشكلة واحدة.
--
-- الإصلاح المعروف في بوستجرس: لفّ النداء في استعلام فرعي —  (select is_admin())
--   ساعتها المخطِّط بيحوّله لـ InitPlan يُنفَّذ **مرة واحدة** لكل استعلام.
--   النتيجة المنطقية واحدة تماماً: نفس الصلاحيات بالظبط، ولا صف واحد يتغيّر
--   مين يشوفه. الفرق في عدد مرات التنفيذ فقط.
--
-- 🔒 الأمان لم يضعف إطلاقاً: RLS باقية مفعّلة على كل الجداول، والشرط هو هو،
--    و is_admin() نفسها لم تتغيّر. ده تحسين تنفيذ مش تخفيف صلاحيات.
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 1) إعادة كتابة كل سياسات admin لتنفّذ is_admin() مرة واحدة
--    الجداول اللي لسه ما اتعملتش (لو ملف أقدم ما اتشغّلش) بتتخطّى بأمان.
-- ----------------------------------------------------------------------------
do $do$
declare
  r record;
begin
  for r in
    select * from (values
      ('settings_admin_all',            'settings'),
      ('drivers_admin_all',             'drivers'),
      ('companies_admin_all',           'companies'),
      ('trips_admin_all',               'trips'),
      ('trip_locations_admin_all',      'trip_locations'),
      ('driver_advances_admin_all',     'driver_advances'),
      ('driver_deductions_admin_all',   'driver_deductions'),
      ('salaries_admin_all',            'salaries'),
      ('expenses_admin_all',            'expenses'),
      ('driver_custody_admin_all',      'driver_custody_entries'),
      ('driver_leaves_admin_all',       'driver_leaves'),
      ('driver_settlements_admin_all',  'driver_settlements'),
      ('driver_route_rates_admin_all',  'driver_route_rates'),
      ('driver_monthly_diesel_admin_all','driver_monthly_diesel'),
      ('company_branches_admin_all',    'company_branches'),
      ('vehicles_admin_all',            'vehicles'),
      ('vehicle_types_admin_all',       'vehicle_types'),
      ('waybills_admin_all',            'waybills'),
      ('housing_units_admin_all',       'housing_units'),
      ('rental_contracts_admin_all',    'rental_contracts')
    ) as t(policy_name, table_name)
  loop
    if to_regclass('public.' || r.table_name) is not null then
      execute format('drop policy if exists %I on public.%I', r.policy_name, r.table_name);
      execute format(
        'create policy %I on public.%I for all using ((select is_admin())) with check ((select is_admin()))',
        r.policy_name, r.table_name
      );
    end if;
  end loop;
end
$do$;

-- ----------------------------------------------------------------------------
-- 2) سياسات profiles — نفس المعالجة، مع auth.uid() كمان
--    auth.uid() بتتنفّذ لكل صف بنفس الطريقة، فبتتلفّ هي كمان.
-- ----------------------------------------------------------------------------
drop policy if exists "profiles_select_own_or_admin" on profiles;
create policy "profiles_select_own_or_admin" on profiles
  for select using (id = (select auth.uid()) or (select is_admin()));

drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles
  for update using (id = (select auth.uid()));

-- ----------------------------------------------------------------------------
-- 3) should_count_cancelled() — كانت بتدخل في RLS مرة تانية
--
--    الدالة دي موجودة في شرط WHERE في أغلب التقارير والدوال، وبتقرأ من جدول
--    settings — وde جدول عليه RLS. يعني كل نداء كان بيشغّل سياسة settings
--    اللي بتنادي is_admin() اللي بتستعلم profiles. نداء متداخل جوّه نداء.
--
--    security definer بيخلّيها تقرأ الإعداد مباشرة من غير ما تعيد الدخول في
--    RLS. الدالة بترجّع قيمة إعداد واحدة (هل نحسب الرحلات الملغاة في الربح؟)
--    وهي ليست بيانات سرية، فما فيش تسريب.
--
--    وأضفت coalesce: لو صف الإعدادات مش موجود كانت بترجّع NULL بدل false.
-- ----------------------------------------------------------------------------
create or replace function should_count_cancelled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select count_cancelled_trips_in_profit from settings where id = true),
    false
  );
$$;
