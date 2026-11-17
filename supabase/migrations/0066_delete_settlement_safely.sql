-- ============================================================================
-- 0066 — إلغاء التصفية بشكل صحيح: المورّد (جديد) والسائق (سدّ ثغرة)
-- ============================================================================
--
-- 🔒 دالتان: واحدة جديدة وواحدة تُستبدَل. لا جدول يُمَس، ولا عمود.
--    ولا يُحذف شيء إلا السند الذي يطلبه المستخدم صراحةً.
--
-- تصفية المورّد لم يكن لها إلغاء أصلاً — تُنشأ بالخطأ فتبقى. والحذف المباشر
-- من الجدول يبدو كافياً لأن كل المفاتيح `on delete set null`:
--   • `trips.vendor_settlement_id`      → تعود الرحلات قابلة للتصفية
--   • `vendor_advances.settlement_id`   → تعود السلف مفتوحة
--   • `vendors.opening_settlement_id`   → يعود الرصيد الافتتاحي مستحقاً
--   • `vendor_settlements.carry_settlement_id` → يعود متبقّي السند السابق مفتوحاً
-- وكلّها صحيحة. لكنها **تُنفَّذ صامتةً**، فتُكتب هنا صراحةً قبل الحذف: من
-- قرأ الدالة عرف ما يُفَكّ، ولا يعتمد صحّة الحساب على تذكُّر قارئٍ لاحق.
--
-- ⚠️ الحالة التي يجب أن تُرفَض — وهي سبب هذا الملف:
--    سندٌ دُفع ناقصاً، ثم دخل متبقّيه في سندٍ أحدث (`carry_settlement_id`
--    مملوء). حذفه يُعيد رحلاته مفتوحةً **مع بقاء قيمتها محمولةً داخل السند
--    الأحدث المجمَّد** — فتُصرَف مرّتين. ولا إصلاح بعدها إلا يدوياً.
--    فالحذف يُرفَض برسالة تسمّي السند الأحدث: احذف الأحدث أولاً، ثم هذا.
--
--    والاتجاه المعاكس سليم: حذف الأحدث يفتح متبقّي الأقدم تلقائياً.
--
-- 🔑 ونفس الثغرة كانت في `fn_delete_driver_settlement` المكتوبة في 0013 —
--    أي قبل أن يوجد الرصيد المحمول في 0048. فتُستبدَل بالحارس نفسه، ويبقى
--    سلوكها الأصلي حرفاً بحرف: السلف والخصومات تعود لدلو الراتب.
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 1) إلغاء تصفية مورّد
-- ----------------------------------------------------------------------------
create or replace function fn_delete_vendor_settlement(p_settlement_id uuid)
returns void
language plpgsql
as $fn$
declare
  v_vendor_id uuid;
  v_carried_into text;
begin
  select vendor_id into v_vendor_id
  from vendor_settlements
  where id = p_settlement_id;

  if v_vendor_id is null then
    raise exception 'التصفية غير موجودة — ربما حُذفت من قبل';
  end if;

  -- الحارس: متبقّي هذا السند دخل سنداً أحدث ومجمَّداً
  select later.settlement_number into v_carried_into
  from vendor_settlements st
  join vendor_settlements later on later.id = st.carry_settlement_id
  where st.id = p_settlement_id;

  if v_carried_into is not null then
    raise exception 'لا يمكن إلغاء هذه التصفية: متبقّيها دخل في التصفية % — ألغِ الأحدث أولاً', v_carried_into;
  end if;

  -- فكّ الوسم صراحةً (المفاتيح تفعل هذا أيضاً، لكن المكتوب يُقرأ)
  update trips
     set vendor_settlement_id = null
   where vendor_settlement_id = p_settlement_id;

  update vendor_advances
     set settlement_id = null
   where settlement_id = p_settlement_id;

  update vendors
     set opening_settlement_id = null
   where opening_settlement_id = p_settlement_id;

  -- متبقّي السند السابق الذي ابتلعه هذا السند يعود مفتوحاً
  update vendor_settlements
     set carry_settlement_id = null
   where carry_settlement_id = p_settlement_id;

  delete from vendor_settlements where id = p_settlement_id;
end
$fn$;

-- ----------------------------------------------------------------------------
-- 2) إلغاء تصفية سائق — نفس الحارس، ونفس السلوك القديم فيما عداه
-- ----------------------------------------------------------------------------
create or replace function fn_delete_driver_settlement(p_settlement_id uuid)
returns void
language plpgsql
as $fn$
declare
  v_exists boolean;
  v_carried_into text;
begin
  select true into v_exists
  from driver_settlements
  where id = p_settlement_id;

  if v_exists is null then
    raise exception 'التصفية غير موجودة — ربما حُذفت من قبل';
  end if;

  select later.settlement_number into v_carried_into
  from driver_settlements st
  join driver_settlements later on later.id = st.carry_settlement_id
  where st.id = p_settlement_id;

  if v_carried_into is not null then
    raise exception 'لا يمكن إلغاء هذه التصفية: متبقّيها دخل في التصفية % — ألغِ الأحدث أولاً', v_carried_into;
  end if;

  -- السلوك الأصلي (0013): السلف والخصومات ترجع لدلو الراتب
  update driver_advances
     set settle_against = 'salary', settlement_id = null
   where settlement_id = p_settlement_id;

  update driver_deductions
     set settle_against = 'salary', settlement_id = null
   where settlement_id = p_settlement_id;

  update trips
     set settlement_id = null
   where settlement_id = p_settlement_id;

  update driver_custody_entries
     set settlement_id = null
   where settlement_id = p_settlement_id;

  update driver_settlements
     set carry_settlement_id = null
   where carry_settlement_id = p_settlement_id;

  delete from driver_settlements where id = p_settlement_id;
end
$fn$;

notify pgrst, 'reload schema';
