-- ============================================================================
-- 0023 — بوليصة الشحن
-- ============================================================================
--
-- مستند يُطبع ويُسلَّم مع الشحنة. بيتولّد مرة واحدة لكل رحلة برقم مميز ثابت،
-- عشان لو اتطبع تاني يطلع بنفس الرقم — البوليصة وثيقة، مش صفحة عرض.
--
-- 🔒 قاعدتا #3 و#11: البوليصة **ما فيهاش أي مبلغ إطلاقاً** — لا سعر رحلة ولا
-- ترب ولا ربح ولا ديزل. دي وثيقة تسليم بتخرج مع السائق وممكن توصل للعميل أو
-- لأي حد على الطريق. الأعمدة المالية مش بتتطلب من قاعدة البيانات من الأساس
-- في صفحة البوليصة.
--
-- الملف قابل لإعادة التشغيل بأمان.
-- ----------------------------------------------------------------------------

create table if not exists waybills (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null unique references trips(id) on delete cascade,
  waybill_no  text not null unique,
  issued_at   timestamptz not null default now(),
  issued_by   uuid references profiles(id) on delete set null,
  notes       text
);

create index if not exists idx_waybills_trip on waybills(trip_id);

alter table waybills enable row level security;

drop policy if exists "waybills_admin_all" on waybills;
create policy "waybills_admin_all" on waybills
  for all using (is_admin()) with check (is_admin());

-- ترقيم تلقائي: WB-<السنة>-<تسلسل>
create sequence if not exists waybill_number_seq start 1;

create or replace function fn_generate_waybill_number()
returns trigger
language plpgsql
as $$
begin
  if new.waybill_no is null or btrim(new.waybill_no) = '' then
    new.waybill_no := 'WB-' || to_char(current_date, 'YYYY') || '-'
      || lpad(nextval('waybill_number_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_generate_waybill_number on waybills;
create trigger trg_generate_waybill_number
  before insert on waybills
  for each row execute function fn_generate_waybill_number();

-- ----------------------------------------------------------------------------
-- إصدار بوليصة الرحلة، أو إرجاع الموجودة
--
-- unique على trip_id هو الضمانة إن الرحلة مالهاش غير بوليصة واحدة مهما
-- اتطبعت. on conflict do nothing + select بترجّع القديمة بدل ما ترمي خطأ.
-- ----------------------------------------------------------------------------
create or replace function fn_issue_waybill(p_trip_id uuid, p_issued_by uuid default null)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  select id into v_id from waybills where trip_id = p_trip_id;
  if v_id is not null then
    return v_id;
  end if;

  insert into waybills (trip_id, issued_by)
  values (p_trip_id, p_issued_by)
  on conflict (trip_id) do nothing
  returning id into v_id;

  -- تعارض متزامن: بوليصة اتعملت بين الـ select والـ insert
  if v_id is null then
    select id into v_id from waybills where trip_id = p_trip_id;
  end if;

  return v_id;
end;
$$;
