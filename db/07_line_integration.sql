-- =============================================================================
-- NP Taskwork — ระบบติดตามงาน
-- 07_line_integration.sql : ส่งแจ้งเตือนเข้ากลุ่ม LINE ของทีม
--
-- กติกาสำคัญที่สุดของไฟล์นี้
--   1 แถวใน line_outbox = 1 ข้อความที่ส่งออกไปจริง
--
--   เพราะ LINE นับข้อความที่ส่งเข้ากลุ่มเป็น "จำนวนสมาชิกในกลุ่ม" ไม่ใช่ 1
--   กลุ่ม 10 คน ส่ง 1 ครั้ง = หักโควตา 10
--   ถ้าเผลอสร้างแถวต่อผู้รับ 1 คน (แบบตาราง notifications) ประกาศเรื่องเดียว
--   ถึงคน 10 คนจะกลายเป็น 10 ข้อความ = หักโควตา 100
--
-- Channel Access Token ไม่ได้อยู่ในไฟล์นี้และไม่ได้อยู่ในฐานข้อมูล
-- อยู่ใน Edge Function secrets เท่านั้น
--
-- ไฟล์นี้รันซ้ำได้ และต้องรันหลัง 03_rls.sql
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- line_config : ค่าที่แอดมินปรับได้เอง — มีได้แถวเดียวตลอดกาล
-- -----------------------------------------------------------------------------
create table if not exists line_config (
  id          boolean primary key default true,
  enabled     boolean not null default false,
  monthly_cap integer not null default 250,
  app_url     text    not null default '',
  updated_at  timestamptz not null default now(),

  -- เคล็ดลับ: primary key เป็น boolean ที่ต้องเป็น true เสมอ = มีได้แถวเดียว
  constraint line_config_single_row  check (id),
  constraint line_config_cap_positive check (monthly_cap > 0)
);

comment on table  line_config is 'ค่าตั้งของระบบแจ้งเตือน LINE — มีแถวเดียว';
comment on column line_config.enabled is 'สวิตช์ใหญ่ ปิดแล้ว Edge Function จะไม่ส่งอะไรเลย';
comment on column line_config.monthly_cap is 'เพดานจำนวนข้อความต่อเดือน กันโควตา LINE บานปลาย';
comment on column line_config.app_url is 'URL ของระบบ ใช้ต่อท้ายข้อความให้กดกลับมาดูงานได้';

insert into line_config (id) values (true) on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- line_outbox : คิวข้อความรอส่ง
-- -----------------------------------------------------------------------------
create table if not exists line_outbox (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null,
  message    text not null,
  status     text not null default 'pending',
  attempts   integer not null default 0,
  last_error text,
  dedupe_key text unique,
  created_at timestamptz not null default now(),
  sent_at    timestamptz,

  constraint line_outbox_kind_valid   check (kind   in ('returned', 'broadcast', 'digest', 'test')),
  constraint line_outbox_status_valid check (status in ('pending', 'sent', 'failed')),
  constraint line_outbox_msg_not_blank check (btrim(message) <> ''),
  -- LINE จำกัดข้อความละ 5,000 ตัวอักษร กันไว้ที่ 4,900
  constraint line_outbox_msg_len      check (char_length(message) <= 4900)
);

comment on table  line_outbox is 'คิวข้อความ LINE — 1 แถว = 1 ข้อความที่ส่งจริง';
comment on column line_outbox.dedupe_key is 'กันสร้างซ้ำ เช่น digest:2026-08-22 หรือ returned:<notification id>';
comment on column line_outbox.attempts is 'จำนวนครั้งที่พยายามส่ง หยุดที่ 5';

-- คิวงานที่ยังไม่จบ = query ที่ Edge Function เรียกบ่อยที่สุด
create index if not exists line_outbox_pending_idx
  on line_outbox (created_at) where status <> 'sent';
-- ใช้นับโควตาที่ใช้ไปในเดือนปัจจุบัน
create index if not exists line_outbox_sent_idx
  on line_outbox (sent_at) where status = 'sent';

-- -----------------------------------------------------------------------------
-- app_claim_line_outbox : ดึงงานออกจากคิวมาส่ง
--
-- for update skip locked = ถ้ามี Edge Function สองรอบทำงานพร้อมกัน
-- รอบที่สองจะข้ามแถวที่รอบแรกจองไว้ ไม่ส่งข้อความซ้ำ
--
-- บวก attempts ตั้งแต่ตอนดึง (ไม่ใช่ตอนส่งเสร็จ) เพื่อว่าถ้า Edge Function
-- ตายกลางคัน แถวนั้นก็ยังนับครั้งไปแล้ว ไม่วนลองไม่รู้จบ
--
-- เพดาน attempts < 5 ต้องครอบทั้งสถานะ pending และ failed เพราะแถวที่ค้าง
-- pending ก็อาจเป็นแถวที่เคยถูกเคลมไปแล้ว (attempts บวกแล้ว) แต่ Edge Function
-- ตายก่อนอัปเดตสถานะกลับ — ถ้าเช็กเพดานเฉพาะกิ่ง failed แถวแบบนี้จะถูกเคลม
-- (และยิง LINE จริง กินโควตา) ซ้ำไม่รู้จบ
-- -----------------------------------------------------------------------------
create or replace function app_claim_line_outbox(p_limit integer default 20)
returns setof line_outbox
language sql security definer set search_path = public as $$
  with claimed as (
    select id
      from line_outbox
     where (status = 'pending' or status = 'failed')
       and attempts < 5
     order by created_at
       for update skip locked
     limit p_limit
  )
  update line_outbox o
     set attempts = o.attempts + 1
    from claimed c
   where o.id = c.id
  returning o.*;
$$;

-- ฟังก์ชันนี้ให้เรียกได้เฉพาะ Edge Function (service role) เท่านั้น
revoke execute on function app_claim_line_outbox(integer) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- RLS
--   line_config : แอดมินเท่านั้น (ทั้งอ่านและเขียน) — ผู้ใช้ทั่วไปไม่ต้องรู้
--   line_outbox : แอดมินอ่านและเพิ่มได้ แต่ "แก้ไม่ได้"
--                 การอัปเดตสถานะเป็นหน้าที่ของ Edge Function ที่ใช้ service role
--                 (service role ข้าม RLS อยู่แล้ว จึงไม่ต้องมี policy ให้)
-- -----------------------------------------------------------------------------
alter table line_config enable row level security;
alter table line_outbox enable row level security;

drop policy if exists line_config_select_admin on line_config;
create policy line_config_select_admin on line_config
  for select using (app_is_admin());

drop policy if exists line_config_update_admin on line_config;
create policy line_config_update_admin on line_config
  for update using (app_is_admin()) with check (app_is_admin());

drop policy if exists line_outbox_select_admin on line_outbox;
create policy line_outbox_select_admin on line_outbox
  for select using (app_is_admin());

drop policy if exists line_outbox_insert_admin on line_outbox;
create policy line_outbox_insert_admin on line_outbox
  for insert with check (app_is_admin());

-- -----------------------------------------------------------------------------
-- trg_notification_to_line_outbox : งานถูกตีกลับ -> เข้าคิวส่ง LINE
--
-- ดักที่ตาราง notifications เพราะ app_change_task_status() สร้างแถว
-- type = 'returned' ให้เจ้าของงานอยู่แล้ว จึงไม่ต้องไปแก้ฟังก์ชันนั้น
--
-- แจ้งเตือนชนิดอื่น (อนุมัติ / รอตรวจ / สมัครสมาชิก) ไม่เข้าคิว LINE โดยตั้งใจ
-- ดูเหตุผลใน docs/superpowers/specs/2026-08-22-line-group-notification-design.md
-- -----------------------------------------------------------------------------
create or replace function trg_notification_to_line_outbox() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_code   text;
  v_title  text;
  v_owner  text;
  v_url    text;
  v_msg    text;
begin
  if new.type <> 'returned' or new.task_id is null then
    return new;
  end if;

  select t.code, t.title, u.full_name
    into v_code, v_title, v_owner
    from tasks t
    left join users u on u.id = t.assigned_to_user_id
   where t.id = new.task_id;

  if v_code is null then
    return new;  -- งานถูกลบไปแล้วระหว่างทาง ไม่มีอะไรให้แจ้ง
  end if;

  select app_url into v_url from line_config;

  v_msg := format(E'🔴 งานถูกตีกลับแก้ไข\n[%s] %s\nผู้รับผิดชอบ: %s\nรายละเอียด: %s',
                  v_code, v_title, coalesce(v_owner, 'ไม่ระบุ'),
                  coalesce(nullif(btrim(new.message), ''), 'ไม่ระบุรายละเอียด'));

  if coalesce(btrim(v_url), '') <> '' then
    v_msg := v_msg || E'\nเปิดระบบ: ' || v_url;
  end if;

  insert into line_outbox (kind, message, dedupe_key)
  values ('returned', left(v_msg, 4900), 'returned:' || new.id)
  on conflict (dedupe_key) do nothing;

  return new;
end;
$$;

drop trigger if exists notifications_to_line_outbox on notifications;
create trigger notifications_to_line_outbox
  after insert on notifications
  for each row execute function trg_notification_to_line_outbox();

commit;
