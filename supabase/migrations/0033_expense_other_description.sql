-- ============================================================================
-- 0033 — إظهار وصف المصروف حين يكون البند «أخرى»
-- ============================================================================
--
-- 🔒 إضافي بالكامل: تعديل نص دالة واحدة. لا delete ولا truncate ولا drop table.
--    البيانات المسجَّلة لا تُمس.
--
-- المشكلة: بند «أخرى» لا يقول شيئاً. السائق يقرأ «أخرى 130» ولا يعرف على ماذا
-- صُرفت. والمعلومة موجودة أصلاً في حقل الوصف (description) على القيد نفسه.
--
-- الحل: حين يكون البند «أخرى» (أو فارغاً) ويوجد وصف، يصير عنوان السطر
--       «أخرى — تعبئة ديزل في الطريق» بدل «أخرى» وحدها. وبما أن التجميع يتم
--       على العنوان، فكل وصف مختلف يصير سطراً مستقلاً بمبلغه — أوضح للمراجعة.
--
-- البنود المعروفة (غسيل، إطارات، صيانة...) تبقى مجمَّعة في سطر واحد كما هي،
-- فإضافة الوصف لها تكرار بلا فائدة («غسيل — غسيل الشاحنة»).
--
-- ⚠️ لا drop هنا: مجموعة أعمدة الإرجاع لم تتغيّر، فـ create or replace تكفي
--    والصلاحيات تبقى سليمة. ولهذا السبب أيضاً لا يحتاج
--    fn_statement_expenses_by_token أي تعديل — هو يعمل select e.* على نفس
--    الأعمدة، ومنحة anon عليه لم تُمس.
--
-- ولا تغيير في الواجهة: المكوّنات تعرض expense_category كما يأتي من هنا.
--
-- 🔢 المجاميع لا تتغيّر: نفس الصفوف ونفس المبالغ، التجميع فقط صار على عنوان
--    أدق. مجموع الكل كما هو.
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
as $fn$
  select
    label,
    sum(amount) as total,
    count(*)    as entries_count
  from (
    select
      amount,
      case
        -- بند غير مفيد + وصف موجود  ←  نضيف الوصف
        when (
               expense_category is null
            or btrim(expense_category) = ''
            -- تهجئات «أخرى» المحتملة: المعتمدة من القائمة أولاً، والباقي
            -- احتياطاً لقيود قديمة أو مستوردة. لا نستخدم regex هنا عمداً:
            -- الحروف العربية داخل [ ] تُخزَّن بترتيب غير الذي يظهر على الشاشة.
            or btrim(expense_category) in ('أخرى', 'اخرى', 'أخري', 'اخري')
             )
             and coalesce(btrim(description), '') <> ''
        then coalesce(nullif(btrim(expense_category), ''), 'غير محدد')
             || ' — ' || btrim(description)

        -- غير ذلك: البند كما هو
        else coalesce(nullif(btrim(expense_category), ''), 'غير محدد')
      end as label
    from driver_custody_entries
    where driver_id = p_driver_id
      and reason = 'work_expense'
      and date between p_from and p_to
  ) s
  group by label
  order by 2 desc;
$fn$;
