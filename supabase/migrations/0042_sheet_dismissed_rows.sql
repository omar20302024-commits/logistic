-- ============================================================================
-- 0042 — تجاهل صفوف من مزامنة جوجل شيت
-- ============================================================================
--
-- 🔒 إضافي: جدول صغير واحد. لا delete ولا truncate ولا drop table، ولا تُمَس
--    أي رحلة ولا أي دالة ربح.
--
-- المشكلة: بعض صفوف الشيت لا تُستورد أبداً —
--   • رحلة بلا سائق: بضاعتها حُوِّلت لسائق آخر، لكن كشف العميل يذكرها منفردة
--   • رحلة ملغاة
--
-- وهي تبقى في الشيت فتظهر «جديدة» في **كل** مزامنة إلى الأبد، فيعاد فحصها
-- وتخطّيها يدوياً كل مرة.
--
-- الحل: نحفظ مفتاح مصدرها فقط. الصف يبقى في الشيت كما هو (ليس لنا سلطان
-- عليه)، لكن المزامنة تعرفه وتضعه جانباً بدل أن تقترحه.
--
-- ⚠️ لا نُنشئ رحلة ملغاة في النظام لتفادي تكرارها: الرحلة الملغاة تدخل عدد
--    الرحلات والتقارير وتشوّش الكشوفات. حفظ المفتاح وحده أنظف — لا أثر لها
--    في أي حساب.
--
-- والتجاهل قابل للتراجع: حذف الصف من هنا يُعيد الرحلة «جديدة» في المزامنة
-- التالية.
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

create table if not exists sheet_sync_dismissed (
  id           uuid primary key default gen_random_uuid(),
  source_key   text not null unique,
  reason       text,
  dismissed_at timestamptz not null default now()
);

create index if not exists idx_sheet_dismissed_key on sheet_sync_dismissed(source_key);

alter table sheet_sync_dismissed enable row level security;

drop policy if exists "sheet_sync_dismissed_admin_all" on sheet_sync_dismissed;
create policy "sheet_sync_dismissed_admin_all" on sheet_sync_dismissed
  for all using ((select is_admin())) with check ((select is_admin()));
