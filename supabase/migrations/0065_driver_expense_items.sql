-- ============================================================================
-- 0065 — تقرير بنود مصاريف السائقين: مَن صرف، وكم مرة، وبكم
-- ============================================================================
--
-- 🔒 إضافة دالة واحدة. لا جدول يُمَس، ولا عمود، ولا بيانات.
--
-- السؤال: «مين غسل السيارة، وكام مرة، وبكام؟» — والإجابة موجودة في
-- `driver_custody_entries`، لكن لا تقرير يسألها.
--
-- 🔑 العقبة الحقيقية: «غسيل» ليس بنداً في القائمة، فالمستخدم يختار «أخرى»
--    ويكتبها في الوصف. فالبند الفعليّ تارةً في `expense_category` وتارةً في
--    `description`. ولذلك يُبنى هنا عمودٌ واحد `item`:
--      • البند المختار إن كان مفيداً (غسيل، إطارات، صيانة…)
--      • وإلّا الوصف المكتوب («غسيل سيارة»)
--      • وإلّا «غير محدد»
--    مع توحيد المسافات حتى لا ينقسم «غسيل  سيارة» عن «غسيل سيارة».
--
-- 📌 ولأن الوصف نصٌّ حرّ، فـ «غسيل» و«غسيل سيارة» يبقيان سطرين — وهذا صِدق
--    لا نقص: هكذا كُتبا. والواجهة فيها بحثٌ يجمع ما يطابق الكلمة في صفٍّ
--    واحد لكل سائق، فيُقرأ السؤال كما سُئل.
--
-- 🔢 لا تصنيف ولا تخمين: `entries_count` عدد القيود كما هي، و`total_amount`
--    مجموع مبالغها. وأُضيف أول تاريخ وآخره ليُعرف المدى داخل الفترة.
--
-- 🚚 السيارة من `fn_driver_vehicle_at` بتاريخ آخر قيد — فإن انتقلت السيارة
--    من سائق لآخر نُسب الغسيل للسيارة التي كانت معه وقتها.
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

drop function if exists fn_driver_expense_items(date, date);

create function fn_driver_expense_items(p_from date, p_to date)
returns table (
  driver_id     uuid,
  driver_name   text,
  vehicle_no    text,
  item          text,
  entries_count bigint,
  total_amount  numeric,
  first_date    date,
  last_date     date
)
language sql stable
as $fn$
  with labelled as (
    select
      c.driver_id,
      c.amount,
      c.date,
      regexp_replace(
        case
          -- بندٌ لا يقول شيئاً: «أخرى» أو فارغ — فالوصف هو البند الحقيقي
          when coalesce(btrim(c.expense_category), '') = ''
            or btrim(c.expense_category) in ('أخرى', 'اخرى', 'أخري', 'اخري')
          then coalesce(nullif(btrim(c.description), ''), 'غير محدد')
          else btrim(c.expense_category)
        end,
        '\s+', ' ', 'g'
      ) as item
    from driver_custody_entries c
    where c.reason = 'work_expense'
      and c.date between p_from and p_to
  ),
  grouped as (
    select
      l.driver_id,
      l.item,
      count(*)       as entries_count,
      sum(l.amount)  as total_amount,
      min(l.date)    as first_date,
      max(l.date)    as last_date
    from labelled l
    group by l.driver_id, l.item
  )
  select
    g.driver_id,
    d.name,
    veh.vehicle_no,
    g.item,
    g.entries_count,
    g.total_amount,
    g.first_date,
    g.last_date
  from grouped g
  join drivers d on d.id = g.driver_id
  left join lateral (
    select fn_driver_vehicle_at(g.driver_id, g.last_date) as vehicle_id
  ) va on true
  left join vehicles veh on veh.id = va.vehicle_id
  order by g.total_amount desc, d.name;
$fn$;

notify pgrst, 'reload schema';
