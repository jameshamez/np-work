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
comment on column line_config.monthly_cap is
  'เพดาน "จำนวนข้อความ" ต่อเดือน ไม่ใช่ "จำนวนโควตา" ที่ LINE แสดงในหน้า Dashboard — '
  'LINE หักโควตา = จำนวนข้อความ × จำนวนสมาชิกในกลุ่ม เช่น กลุ่ม 10 คน ตั้ง 250 '
  'จะกินโควตาถึง 2,500 หน่วย (แผนฟรีมี 200 หน่วย) ตั้งค่าเป็น '
  'โควตาที่ LINE ให้ ÷ จำนวนสมาชิกในกลุ่ม เสมอ';
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
  claimed_at timestamptz,

  constraint line_outbox_kind_valid   check (kind   in ('returned', 'broadcast', 'digest', 'test')),
  constraint line_outbox_status_valid check (status in ('pending', 'sent', 'failed')),
  constraint line_outbox_msg_not_blank check (btrim(message) <> ''),
  -- LINE จำกัดข้อความละ 5,000 ตัวอักษร กันไว้ที่ 4,900
  constraint line_outbox_msg_len      check (char_length(message) <= 4900)
);

-- เพิ่มทีหลังสำหรับฐานข้อมูลที่เคยรันไฟล์นี้ไปแล้ว (ไฟล์นี้ต้องรันซ้ำได้)
alter table line_outbox add column if not exists claimed_at timestamptz;

comment on table  line_outbox is 'คิวข้อความ LINE — 1 แถว = 1 ข้อความที่ส่งจริง';
comment on column line_outbox.dedupe_key is 'กันสร้างซ้ำ เช่น digest:2026-08-22 หรือ returned:<notification id>';
comment on column line_outbox.attempts is 'จำนวนครั้งที่พยายามส่ง หยุดที่ 5';
comment on column line_outbox.claimed_at is
  'เวลาที่ถูกเคลมไปส่งครั้งล่าสุด — กันสองรอบทำงานเคลมแถวเดียวกันพร้อมกัน '
  'ค้างเกิน 5 นาทีถือว่ารอบนั้นตายไปแล้ว ปล่อยให้เคลมใหม่ได้';

-- คิวงานที่ยังไม่จบ = query ที่ Edge Function เรียกบ่อยที่สุด
create index if not exists line_outbox_pending_idx
  on line_outbox (created_at) where status <> 'sent';
-- ใช้นับโควตาที่ใช้ไปในเดือนปัจจุบัน
create index if not exists line_outbox_sent_idx
  on line_outbox (sent_at) where status = 'sent';

-- -----------------------------------------------------------------------------
-- app_claim_line_outbox : ดึงงานออกจากคิวมาส่ง
--
-- claimed_at = ตัวจองแถวจริง ๆ ห้ามพึ่ง for update skip locked อย่างเดียว
--   ล็อกของ skip locked มีอายุแค่ในทรานแซกชันของ RPC ตัวเอง ซึ่ง PostgREST
--   commit ทิ้งทันทีที่ฟังก์ชันคืนค่า ทั้งที่ Edge Function ยังรอ LINE ตอบอยู่
--   อีกไม่กี่มิลลิวินาทีถัดมาแถวเดิมจึงถูกเคลมซ้ำได้ = กลุ่มได้ข้อความซ้ำและเสียโควตาซ้ำ
--   เรื่องนี้ไม่ใช่กรณีหายาก: line_daily_digest (0 1 * * *) กับ line_retry_sweep
--   (*/15 * * * *) ยิงในนาทีเดียวกันทุกวัน — ตัวหนึ่งเข้าคิวจน webhook เรียก
--   Edge Function อีกตัวเรียก Edge Function ตัวเดียวกันพอดี
--
-- ทำไมปล่อยให้เคลมใหม่ได้เมื่อพ้น 5 นาที
--   ถ้า Edge Function ตายกลางคันหลังเคลม แถวนั้นจะค้าง claimed_at ไว้ตลอดกาล
--   และไม่มีใครมาเก็บอีกเลย 5 นาทีนานพอที่รอบปกติ (timeout ของ push ไม่กี่วินาที)
--   จะทำงานจบไปแล้ว แต่สั้นพอที่รอบกวาดทุก 15 นาทีจะเก็บงานค้างได้ทัน
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
       and (claimed_at is null or claimed_at < now() - interval '5 minutes')
     order by created_at
       for update skip locked
     limit p_limit
  )
  update line_outbox o
     set attempts   = o.attempts + 1,
         claimed_at = now()
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
--
-- ⚠️ ต้องตรวจ "ผู้ลงมือ" ที่หัว trigger ด้วย ห้ามพึ่ง RLS ของ line_outbox อย่างเดียว
--    ฟังก์ชันนี้เป็น security definer การ insert ลง line_outbox จึงรันในนามเจ้าของ
--    ตารางและข้าม policy line_outbox_insert_admin ไปทั้งดุ้น ส่วน policy
--    notifications_insert_task_scope (03_rls.sql / 06_patch_notifications.sql)
--    ก็เปิดให้ผู้ใช้ที่ approved แล้ว insert แจ้งเตือนของงานที่ตัวเองแก้ได้
--    ถ้าไม่ตรวจตรงนี้ ผู้ใช้ทั่วไปจะ insert type = 'returned' เองแล้วยิงข้อความ
--    ที่ตัวเองแต่งเข้ากลุ่ม LINE ได้ วนซ้ำได้จนชนเพดาน monthly_cap
--
--    app_is_admin() อ่าน auth.uid() จาก JWT ซึ่ง security definer ไม่ได้เปลี่ยน
--    จึงใช้ได้ทั้งตอนถูกเรียกจาก app_change_task_status() และตอนถูก insert ตรง ๆ
--    เส้นทางที่ถูกต้องไม่เสียหาย เพราะตีกลับงานได้เฉพาะ admin อยู่แล้ว
--    (db/02_views_functions.sql — "เฉพาะผู้ดูแลระบบเท่านั้นที่อนุมัติหรือตีกลับงานได้")
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
  if new.type <> 'returned' or new.task_id is null or not app_is_admin() then
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

-- -----------------------------------------------------------------------------
-- app_build_line_digest : ประกอบข้อความสรุปประจำวัน
--
-- คืน null เมื่อไม่มีอะไรต้องรายงาน — จงใจไม่ส่ง "วันนี้ไม่มีงานค้าง"
-- เพราะข้อความเข้ากลุ่มหักโควตาตามจำนวนสมาชิก ไม่ควรเปลืองไปกับข่าวที่ไม่ต้องรู้
--
-- เกณฑ์ "ค้างอัปเดต" ใช้ 4 ชั่วโมงตายตัวสำหรับทั้งกลุ่ม ไม่ใช้ค่ารายคนใน
-- users.no_update_alert_hours เพราะข้อความสรุปมีใบเดียวส่งเข้ากลุ่มรวม
-- (ค่ารายคนยังใช้กับกระดิ่งบนเว็บเหมือนเดิม)
-- -----------------------------------------------------------------------------
create or replace function app_build_line_digest() returns text
language plpgsql stable security definer set search_path = public as $$
declare
  c_limit      constant integer := 10;
  c_stale_hrs  constant integer := 4;

  v_now        timestamptz := now();
  v_bkk        timestamp   := v_now at time zone 'Asia/Bangkok';
  v_thai_date  text;
  v_url        text;

  v_n_over     integer;
  v_n_stale    integer;
  v_n_review   integer;
  v_over       text;
  v_stale      text;
  v_review     text;
  v_msg        text;
begin
  -- นับก่อน (นับทั้งหมด ไม่ใช่แค่ 10 ใบที่จะแสดง)
  --
  -- is_draft = false ทุกหมวด — งานร่างคือการ์ดที่คนยังเขียนไม่เสร็จ ไม่ควรถูก
  -- ป่าวประกาศทั้งกลุ่ม และไม่ควรทำให้วันที่มีแต่ร่างค้างเสียโควตาไปกับข้อความ
  -- ที่ไม่มีใครต้องทำอะไรต่อ (ทางแจ้งเตือนอื่นกันร่างไว้หมดแล้ว เช่น
  -- v_tasks_needing_alert ใน 02_views_functions.sql และ src/lib/api.ts)
  --
  -- จงใจ: งานที่ status = 'pending_review' และเลยกำหนดไปแล้ว จะโผล่ทั้งหมวด
  -- "เลยกำหนด" และหมวด "รอตรวจ" พร้อมกัน เพราะเป็นคนละเรื่องที่ต้องทำคนละอย่าง
  -- (เลยกำหนด = คนทำต้องเร่ง / รอตรวจ = แอดมินต้องเข้ามาตรวจ) ผลข้างเคียงคือ
  -- ตัวเลขหัวข้อทั้งสองหมวดนับใบเดียวกันซ้ำ — ตั้งใจให้เป็นแบบนี้ อย่า "แก้"
  select count(*) into v_n_over
    from tasks where status <> 'approved' and deadline_at < v_now and is_draft = false;

  select count(*) into v_n_stale
    from tasks
   where status <> 'approved'
     and is_draft = false
     and deadline_at >= v_now
     and last_updated_at < v_now - make_interval(hours => c_stale_hrs);

  select count(*) into v_n_review
    from tasks where status = 'pending_review' and is_draft = false;

  if v_n_over = 0 and v_n_stale = 0 and v_n_review = 0 then
    return null;
  end if;

  select app_url into v_url from line_config;

  v_thai_date := to_char(v_bkk, 'DD') || ' '
    || (array['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.',
              'ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'])[extract(month from v_bkk)::int]
    || ' ' || (extract(year from v_bkk)::int + 543);

  -- หมวด 1 : เลยกำหนด
  select string_agg(s.line, E'\n') into v_over from (
    select format('• [%s] %s — %s (เลย %s วัน)',
                  t.code, t.title, coalesce(u.full_name, 'ไม่ระบุ'),
                  greatest(1, floor(extract(epoch from v_now - t.deadline_at) / 86400)::int)) as line
      from tasks t
      left join users u on u.id = t.assigned_to_user_id
     where t.status <> 'approved' and t.deadline_at < v_now and t.is_draft = false
     order by t.deadline_at
     limit c_limit
  ) s;

  -- หมวด 2 : ค้างอัปเดต
  select string_agg(s.line, E'\n') into v_stale from (
    select format('• [%s] %s — %s (นิ่งมา %s ชม.)',
                  t.code, t.title, coalesce(u.full_name, 'ไม่ระบุ'),
                  floor(extract(epoch from v_now - t.last_updated_at) / 3600)::int) as line
      from tasks t
      left join users u on u.id = t.assigned_to_user_id
     where t.status <> 'approved'
       and t.is_draft = false
       and t.deadline_at >= v_now
       and t.last_updated_at < v_now - make_interval(hours => c_stale_hrs)
     order by t.last_updated_at
     limit c_limit
  ) s;

  -- หมวด 3 : รอตรวจ
  select string_agg(s.line, E'\n') into v_review from (
    select format('• [%s] %s — %s',
                  t.code, t.title, coalesce(u.full_name, 'ไม่ระบุ')) as line
      from tasks t
      left join users u on u.id = t.assigned_to_user_id
     where t.status = 'pending_review' and t.is_draft = false
     order by t.deadline_at
     limit c_limit
  ) s;

  v_msg := format('📋 สรุปงาน NP Taskwork — %s', v_thai_date);

  if v_n_over > 0 then
    v_msg := v_msg || format(E'\n\n🔴 เลยกำหนด %s ใบ\n%s', v_n_over, v_over);
    if v_n_over > c_limit then
      v_msg := v_msg || format(E'\n… และอีก %s ใบ', v_n_over - c_limit);
    end if;
  end if;

  if v_n_stale > 0 then
    v_msg := v_msg || format(E'\n\n⏰ ค้างอัปเดตเกิน %s ชม. %s ใบ\n%s', c_stale_hrs, v_n_stale, v_stale);
    if v_n_stale > c_limit then
      v_msg := v_msg || format(E'\n… และอีก %s ใบ', v_n_stale - c_limit);
    end if;
  end if;

  if v_n_review > 0 then
    v_msg := v_msg || format(E'\n\n📝 รอตรวจ %s ใบ\n%s', v_n_review, v_review);
    if v_n_review > c_limit then
      v_msg := v_msg || format(E'\n… และอีก %s ใบ', v_n_review - c_limit);
    end if;
  end if;

  if coalesce(btrim(v_url), '') <> '' then
    v_msg := v_msg || E'\n\nเปิดระบบ: ' || v_url;
  end if;

  return left(v_msg, 4900);
end;
$$;

-- -----------------------------------------------------------------------------
-- app_enqueue_line_digest : สร้างแถวสรุปรายวันเข้าคิว (pg_cron เรียกตัวนี้)
-- dedupe_key ผูกกับวันที่แบบเวลาไทย เรียกซ้ำกี่ครั้งก็ได้แถวเดียว
-- -----------------------------------------------------------------------------
create or replace function app_enqueue_line_digest() returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_msg text;
  v_id  uuid;
begin
  v_msg := app_build_line_digest();
  if v_msg is null then
    return null;
  end if;

  insert into line_outbox (kind, message, dedupe_key)
  values ('digest', v_msg,
          'digest:' || to_char((now() at time zone 'Asia/Bangkok')::date, 'YYYY-MM-DD'))
  on conflict (dedupe_key) do nothing
  returning id into v_id;

  return v_id;
end;
$$;

-- สองฟังก์ชันนี้ข้าม RLS และอ่าน/สร้างข้อมูลของทั้งระบบ ให้เรียกได้เฉพาะ pg_cron
-- (ที่ทำงานเป็น service role) เท่านั้น ห้าม anon/authenticated เรียกผ่าน RPC โดยตรง
revoke execute on function app_build_line_digest()   from public, anon, authenticated;
revoke execute on function app_enqueue_line_digest() from public, anon, authenticated;

commit;
