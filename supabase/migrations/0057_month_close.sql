-- ============================================================================
-- 0057 — إقفال الشهر: تصفية مجموعة سائقين دفعة واحدة
-- ============================================================================
--
-- 🔒 دالتان جديدتان لا غير. لا جدول يُمَس ولا عمود، ولا تُعاد كتابة دالة
--    قائمة — الإقفال يستدعي fn_create_driver_settlement نفسها، فلا يوجد
--    منطق تصفية ثانٍ يفترق عن الأول مع الوقت.
--
-- الحاجة: انتهى الشهر، وسُلّمت الرواتب والتربات. فتح صفحة كل سائق لتسجيل
-- ذلك عملٌ لا ينتهي، والنسيان فيه وارد.
--
-- ⚠️ ما يفعله الإقفال لكل سائق محدَّد:
--   1) سند تصفية تربات للفترة — يَسِم رحلاتها وحركات عهدتها فلا تُصرف ثانيةً
--   2) تسجيل راتب الشهر مدفوعاً بالكامل
--
-- 🔑 السلف والخصومات **لا تُنقل بين الدلاء**: الدالة لا تَسِم إلا ما يُمرَّر
--    في p_advance_ids/p_deduction_ids، ونحن نمرّر فارغاً. فما كان محمَّلاً
--    على الراتب يبقى عليه، وهو الفرق بين إقفالٍ جماعي وقرارٍ فردي لا يصحّ
--    أخذه نيابةً عن المستخدم.
--
-- 🔑 السائق الذي لا شيء لديه لا يُسقط العملية: الاستثناء يُلتقط لكل سائق
--    على حدة ويُذكر في النتيجة. إقفالٌ يتوقف عند أول سائق فارغ لا ينفع.
--
-- 🚫 لا صرف مزدوج: سند التربات لا يأخذ إلا غير المصفّى، والراتب يُكتب
--    paid_amount = الصافي (إسناد لا جمع) فإعادة التشغيل لا تضاعف شيئاً.
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 1) المعاينة — صفّ لكل سائق، بلا أي كتابة
-- ----------------------------------------------------------------------------
create or replace function fn_month_close_preview(
  p_driver_ids uuid[],
  p_from date,
  p_to   date
)
returns table (
  driver_id        uuid,
  driver_name      text,
  employment_type  text,
  trips_count      bigint,
  total_trabs      numeric,
  custody_balance  numeric,
  trab_net         numeric,
  salary_net       numeric,
  salary_paid      numeric,
  has_salary_row   boolean
)
language sql stable
as $fn$
  select
    d.id,
    d.name,
    d.employment_type::text,
    coalesce(pv.trips_count, 0),
    coalesce(pv.total_trabs, 0),
    coalesce(pv.custody_credits, 0) - coalesce(pv.custody_debits, 0),
    coalesce(pv.net_amount, 0),
    coalesce(sal.net_salary, 0),
    coalesce(sal.paid_amount, 0),
    (sal.driver_id is not null)
  from drivers d
  -- left join لا cross: لو لم تُرجع المعاينة صفاً لسائق، يسقط السائق كله من
  -- القائمة — وغياب سائق من شاشة إقفال أسوأ من صفٍّ أصفاره ظاهرة
  left join lateral fn_driver_settlement_preview(
    d.id, p_from, p_to, '{}'::uuid[], '{}'::uuid[]
  ) pv on true
  left join lateral (
    select v.driver_id, v.net_salary, v.paid_amount
    from v_salary_statements v
    where v.driver_id = d.id
      and v.year  = extract(year  from p_from)::int
      and v.month = extract(month from p_from)::int
  ) sal on true
  where d.id = any(p_driver_ids)
  order by d.name;
$fn$;

-- ----------------------------------------------------------------------------
-- 2) التنفيذ — سند تربات وراتب مدفوع لكل سائق
--
-- يُرجع صفّاً لكل سائق: ما تمّ وما لم يتمّ ولماذا. فالمستخدم يرى النتيجة
-- بدل أن يخمّنها.
-- ----------------------------------------------------------------------------
create or replace function fn_month_close_apply(
  p_driver_ids   uuid[],
  p_from         date,
  p_to           date,
  p_settled_on   date default current_date,
  p_settle_trabs boolean default true,
  p_pay_salary   boolean default true,
  p_notes        text default null
)
returns table (
  driver_id      uuid,
  driver_name    text,
  settlement_id  uuid,
  trab_amount    numeric,
  salary_amount  numeric,
  trab_note      text,
  salary_note    text
)
language plpgsql
as $fn$
declare
  v_driver   record;
  v_id       uuid;
  v_trab     numeric;
  v_salary   numeric;
  v_tnote    text;
  v_snote    text;
  v_year     int := extract(year  from p_from)::int;
  v_month    int := extract(month from p_from)::int;
  v_net      numeric;
begin
  if p_to < p_from then
    raise exception 'تاريخ نهاية الفترة لا يمكن أن يسبق تاريخ بدايتها';
  end if;

  if coalesce(array_length(p_driver_ids, 1), 0) = 0 then
    raise exception 'لم يُحدَّد أي سائق';
  end if;

  for v_driver in
    select d.id, d.name from drivers d where d.id = any(p_driver_ids) order by d.name
  loop
    v_id     := null;
    v_trab   := 0;
    v_salary := 0;
    v_tnote  := null;
    v_snote  := null;

    -- --- التربات والعهدة
    if p_settle_trabs then
      begin
        -- السلف والخصومات تبقى على دلوها: مصفوفتان فارغتان عمداً
        v_id := fn_create_driver_settlement(
          v_driver.id, p_from, p_to, p_settled_on,
          '{}'::uuid[], '{}'::uuid[],
          coalesce(p_notes, 'إقفال شهر ' || to_char(p_from, 'YYYY-MM')),
          null
        );

        select net_amount into v_trab
        from driver_settlements where id = v_id;

        v_tnote := 'تمت التصفية';
      exception
        when others then
          -- «لا يوجد ما يُصفّى» وغيرها: يُذكر ولا يُسقط بقية السائقين
          v_tnote := sqlerrm;
      end;
    else
      v_tnote := 'لم تُطلب';
    end if;

    -- --- الراتب
    if p_pay_salary then
      begin
        select v.net_salary into v_net
        from v_salary_statements v
        where v.driver_id = v_driver.id and v.year = v_year and v.month = v_month;

        if v_net is null then
          v_snote := 'لا يوجد راتب مسجَّل لهذا الشهر — ولّد الرواتب أولاً';
        else
          -- إسناد لا جمع: إعادة التشغيل لا تضاعف المدفوع.
          -- والسالب يصير صفراً، فالقيد يمنع paid_amount < 0 — وصافٍ سالب
          -- يعني أن المستحق على السائق لا له، فلا يُدفع شيء.
          v_salary := greatest(coalesce(v_net, 0), 0);

          update salaries
             set paid_amount  = v_salary,
                 payment_date = p_settled_on,
                 updated_at   = now()
           where driver_id = v_driver.id and year = v_year and month = v_month;

          v_snote := case
            when v_net < 0 then 'الصافي سالب — لم يُدفع شيء'
            else 'سُجّل الراتب مدفوعاً'
          end;
        end if;
      exception
        when others then
          v_snote := sqlerrm;
      end;
    else
      v_snote := 'لم يُطلب';
    end if;

    driver_id     := v_driver.id;
    driver_name   := v_driver.name;
    settlement_id := v_id;
    trab_amount   := coalesce(v_trab, 0);
    salary_amount := coalesce(v_salary, 0);
    trab_note     := v_tnote;
    salary_note   := v_snote;
    return next;
  end loop;
end
$fn$;

notify pgrst, 'reload schema';
