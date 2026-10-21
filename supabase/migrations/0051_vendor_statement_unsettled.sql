-- ============================================================================
-- 0051 — كشف المورّد: الرحلات غير المصروفة فقط
-- ============================================================================
--
-- 🔒 دالة واحدة تُستبدَل بنفس توقيعها. لا جدول يُمَس، ولا عمود، ولا بيانات.
--
-- نفس علّة رابط السائق في 0049: الكشف الذي يُسلَّم للمورّد كان يسرد رحلات
-- الفترة كلها ومنها ما صُرف بسند — فيطالب بما قبضه.
--
-- وهنا كان الاختلال أوضح: الكشف يجمع الرحلات **كلها** ثم يخصم السلف
-- **المفتوحة وحدها** (الصفحة تمرّر openAdvances). فطرفا المعادلة على
-- أساسين مختلفين، و«الصافي المستحق» أكبر من الحقيقة بمقدار ما صُرف.
--
-- 🔑 الشرط vendor_settlement_id is null — تصفية المورّد، لا settlement_id
--    الذي يخصّ تصفية السائق. وهو نفس شرط unsettled_cost في
--    fn_vendor_period_summary، فيتطابق الكشف مع «المستحق الآن» في الصفحة.
--
-- fn_vendor_trips (التبويب الداخلي) **لم تُمَس**: تعرض الكل ومعها عمود
-- «مصفّاة» عن قصد — فهي تقريرك أنت لا كشفه هو.
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

create or replace function fn_vendor_payable_trips(
  p_vendor_id uuid,
  p_from date,
  p_to   date
)
returns table (
  trip_date      date,
  trip_number    text,
  driver_name    text,
  from_location  text,
  to_location    text,
  branches_count int,
  amount         numeric
)
language sql stable
as $fn$
  -- 🔒 لا trip_amount ولا profit في أعمدة الإرجاع إطلاقاً (قاعدة #11)
  select
    t.trip_date, t.trip_number, d.name,
    t.from_location, t.to_location, t.branches_count,
    t.driver_trip_payment
  from trips t
  join drivers d on d.id = t.driver_id
  where d.vendor_id = p_vendor_id
    and t.trip_date between p_from and p_to
    and t.vendor_settlement_id is null
    and (t.status <> 'cancelled' or should_count_cancelled())
  order by t.trip_date, t.trip_number;
$fn$;

notify pgrst, 'reload schema';
