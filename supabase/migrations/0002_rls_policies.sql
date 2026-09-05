-- ============================================================================
-- سياسات Row Level Security (RLS)
-- المرحلة الحالية: دور admin فقط له صلاحية كاملة. باقي الأدوار (محاسب/موظف/سائق)
-- مُعرَّفة في enum مسبقاً لكن بدون سياسات فعلية بعد — تُضاف لاحقاً بدون تغيير البنية.
-- ============================================================================

-- دالة مساعدة: هل المستخدم الحالي admin؟
create or replace function is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- تفعيل RLS على كل الجداول
alter table profiles           enable row level security;
alter table settings           enable row level security;
alter table drivers            enable row level security;
alter table companies          enable row level security;
alter table trips              enable row level security;
alter table trip_locations     enable row level security;
alter table driver_advances    enable row level security;
alter table driver_deductions  enable row level security;
alter table salaries           enable row level security;
alter table expenses           enable row level security;

-- profiles: المستخدم يرى صفه فقط، والـ admin يرى الجميع
create policy "profiles_select_own_or_admin" on profiles
  for select using (id = auth.uid() or is_admin());
create policy "profiles_update_own" on profiles
  for update using (id = auth.uid());

-- بقية الجداول: admin فقط (كل العمليات) في هذه المرحلة
create policy "settings_admin_all" on settings
  for all using (is_admin()) with check (is_admin());

create policy "drivers_admin_all" on drivers
  for all using (is_admin()) with check (is_admin());

create policy "companies_admin_all" on companies
  for all using (is_admin()) with check (is_admin());

create policy "trips_admin_all" on trips
  for all using (is_admin()) with check (is_admin());

create policy "trip_locations_admin_all" on trip_locations
  for all using (is_admin()) with check (is_admin());

create policy "driver_advances_admin_all" on driver_advances
  for all using (is_admin()) with check (is_admin());

create policy "driver_deductions_admin_all" on driver_deductions
  for all using (is_admin()) with check (is_admin());

create policy "salaries_admin_all" on salaries
  for all using (is_admin()) with check (is_admin());

create policy "expenses_admin_all" on expenses
  for all using (is_admin()) with check (is_admin());

-- ----------------------------------------------------------------------------
-- ملاحظة توسّع مستقبلي (لا يُنفَّذ الآن):
-- عند تفعيل دور 'driver' لاحقاً، تُضاف سياسة select فقط على trips/salaries/...
-- بشرط driver_id = (select id from drivers where linked_user_id = auth.uid())
-- بعد إضافة عمود ربط driver <-> auth user. غير مطلوب في المرحلة الأولى.
-- ----------------------------------------------------------------------------
