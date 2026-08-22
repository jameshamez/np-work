# แผน Implementation — แจ้งเตือนเข้ากลุ่ม LINE

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้ NP Taskwork ส่งแจ้งเตือนเข้ากลุ่ม LINE ของทีมได้จริง โดยคุมปริมาณข้อความไม่ให้เกินโควตาของ LINE Official Account

**Architecture:** ทุกข้อความที่จะส่งเข้า LINE ผ่านตารางกลาง `line_outbox` โดยยึดกติกา **1 แถว = 1 ข้อความ** — DB trigger ป้อนแถวเมื่องานถูกตีกลับ, pg_cron ป้อนแถวสรุปรายวัน, แอดมินป้อนแถวเมื่อประกาศ จากนั้น Supabase Database Webhook เรียก Edge Function `line-dispatch` ซึ่งเป็นที่เดียวที่ถือ Channel Access Token ให้ยิงเข้า LINE Messaging API และมี pg_cron อีกตัวคอยกวาดแถวที่ส่งไม่สำเร็จมาลองใหม่

**Tech Stack:** PostgreSQL 15+ (Supabase) / pg_cron / pg_net / Supabase Vault / Supabase Edge Functions (Deno) / LINE Messaging API / React 19 + TypeScript + Vite / vitest

**Spec:** `docs/superpowers/specs/2026-08-22-line-group-notification-design.md`

## Global Constraints

- **Channel Access Token ห้ามอยู่ในโค้ดฝั่งหน้าเว็บเด็ดขาด** ห้ามตั้งชื่อ env ที่ขึ้นต้นด้วย `VITE_` สำหรับค่านี้ — Vite ยัด env ที่ขึ้นต้นด้วย `VITE_` ลงไปใน bundle ที่เบราว์เซอร์อ่านได้ทั้งหมด
- **1 แถวใน `line_outbox` = 1 ข้อความที่ส่งจริง** ห้ามสร้างแถวต่อผู้รับ 1 คน เพราะ LINE นับข้อความเข้ากลุ่มเป็นจำนวนสมาชิก การส่ง 1 ข้อความเข้ากลุ่ม 10 คนหักโควตา 10
- ไฟล์ SQL ทุกไฟล์ **ต้องรันซ้ำได้** (ใช้ `create or replace`, `if not exists`, `drop policy if exists`) ตามแบบ `db/06_patch_notifications.sql`
- คอมเมนต์และข้อความทั้งหมดในโค้ดใหม่เป็น **ภาษาไทย** ตามแบบไฟล์เดิมใน `db/` และ `src/lib/api.ts`
- ฟังก์ชัน SQL ที่ต้องข้าม RLS ใช้ `language plpgsql security definer set search_path = public` ตามแบบ `db/02_views_functions.sql`
- ข้อความ LINE ยาวได้ไม่เกิน **5,000 ตัวอักษร** โค้ดตัดที่ **4,900** เผื่อไว้
- เวลาสรุปรายวัน: **08:00 น. Asia/Bangkok** = `0 1 * * *` ใน pg_cron (pg_cron ของ Supabase รันด้วย UTC)
- เกณฑ์ "ค้างอัปเดต" ในสรุปรายวันคือ **4 ชั่วโมงตายตัว** ไม่ใช้ `users.no_update_alert_hours` รายคน
- แต่ละหมวดในข้อความสรุปแสดงไม่เกิน **10 รายการ** เกินกว่านั้นต่อท้ายว่า "และอีก N ใบ"
- จำนวนครั้งที่ลองส่งซ้ำสูงสุด: **5**

---

## โครงสร้างไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `db/07_line_integration.sql` (สร้าง) | ตาราง `line_config` / `line_outbox`, RLS, ฟังก์ชันดึงงานออกจากคิว, trigger งานตีกลับ, ฟังก์ชันสร้างข้อความสรุป |
| `db/tests/07_line_integration_test.sql` (สร้าง) | ทดสอบ SQL ทั้งหมดของไฟล์ข้างบน รันแล้ว rollback ไม่ทิ้งขยะ |
| `db/08_line_schedule.sql` (สร้าง) | ตั้ง pg_cron 2 ตัว — แยกไฟล์เพราะต้องแก้ค่า project ref ของแต่ละคน |
| `supabase/functions/line-dispatch/lib.ts` (สร้าง) | logic ล้วน ๆ ที่ทดสอบได้โดยไม่ต้องยิงเน็ต — จัดรูปข้อความ, ตัดสินใจว่าจะลองใหม่ไหม |
| `supabase/functions/line-dispatch/index.ts` (สร้าง) | ตัว handler — อ่าน secrets, ดึงคิว, ยิง LINE, บันทึกผล |
| `supabase/functions/line-dispatch/lib.test.ts` (สร้าง) | vitest ของ `lib.ts` |
| `src/lib/lineApi.ts` (สร้าง) | ชั้นเชื่อมต่อ LINE ฝั่งแอป — แยกจาก `api.ts` ที่ยาว 800 บรรทัดแล้ว |
| `src/context/AppContext.tsx` (แก้) | ประกาศให้เข้าคิว 1 แถว, ปุ่มทดสอบยิงจริง, สวิตช์ LINE ระดับระบบ |
| `src/components/Navbar.tsx` (แก้) | ปุ่ม LINE อ่าน/เขียน `line_config` และแสดงเฉพาะแอดมิน |
| `src/components/AdminApprovalView.tsx` (แก้) | ถอดคอลัมน์ LINE รายคน เหลือปุ่มทดสอบส่งเข้ากลุ่มปุ่มเดียว |
| `src/lib/api.ts`, `src/types.ts` (แก้) | ลบ `lineNotifyToken` / `lineNotifyEnabled` |
| `db/README.md` (แก้) | เพิ่มไฟล์ใหม่ในตารางลำดับการรัน |

---

## Task 1: ตาราง `line_config` และ `line_outbox`

**Files:**
- Create: `db/07_line_integration.sql`
- Test: `db/tests/07_line_integration_test.sql`

**Interfaces:**
- Consumes: `app_is_admin()`, `app_is_approved()` จาก `db/02_views_functions.sql:27,37`
- Produces:
  - ตาราง `line_config(id boolean, enabled boolean, monthly_cap integer, app_url text, updated_at timestamptz)` — มีได้แถวเดียว `id = true`
  - ตาราง `line_outbox(id uuid, kind text, message text, status text, attempts integer, last_error text, dedupe_key text, created_at timestamptz, sent_at timestamptz)`
  - `app_claim_line_outbox(p_limit integer default 20) returns setof line_outbox` — ดึงแถวที่ต้องส่งพร้อมบวก `attempts` ให้แล้ว

- [ ] **Step 1: เขียนไฟล์ทดสอบที่ยังไม่ผ่าน**

สร้าง `db/tests/07_line_integration_test.sql`:

```sql
-- =============================================================================
-- ทดสอบ 07_line_integration.sql
-- รัน: psql "<connection string>" -f db/tests/07_line_integration_test.sql
-- ทั้งไฟล์อยู่ใน transaction เดียวที่ rollback ท้ายสุด จึงไม่ทิ้งข้อมูลค้างไว้
-- ผ่าน = รันจบโดยไม่มี error ใด ๆ
--
-- ⚠️ รันกับฐานข้อมูลทดสอบเท่านั้น ห้ามรันกับฐานข้อมูลที่ใช้งานจริง
--    เคสที่ 10 มี `delete from tasks` เพื่อทดสอบกรณีไม่มีงานค้าง ถึงจะ rollback
--    ท้ายสุดแต่ระหว่างที่ transaction เปิดอยู่ ตารางจะว่างจริง ๆ และถ้า
--    connection หลุดกลางคันในจังหวะที่ไม่เหมาะสม ก็ไม่คุ้มเสี่ยง
-- =============================================================================
begin;

-- ---------------------------------------------------------------------------
-- ข้อมูลตั้งต้น
-- ---------------------------------------------------------------------------
insert into users (id, auth_user_id, username, full_name, email, role, status)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1',
   'test_line_admin', 'ทดสอบ แอดมิน', 'test_line_admin@example.com', 'admin', 'approved'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b2',
   'test_line_user', 'ทดสอบ ผู้ใช้', 'test_line_user@example.com', 'user', 'approved');

-- ---------------------------------------------------------------------------
-- เคส 1 : line_config มีได้แถวเดียวเสมอ
-- ---------------------------------------------------------------------------
do $$
begin
  assert (select count(*) from line_config) = 1,
    'เคส 1 ล้มเหลว: line_config ต้องมีแถวตั้งต้น 1 แถว';
  assert (select enabled from line_config) = false,
    'เคส 1 ล้มเหลว: ค่าตั้งต้นของ enabled ต้องเป็น false (กันส่งหลุดก่อนตั้งค่าเสร็จ)';
end $$;

do $$
begin
  begin
    insert into line_config (id, enabled) values (false, true);
    raise exception 'เคส 1 ล้มเหลว: ไม่ควร insert แถวที่สองลง line_config ได้';
  exception when check_violation then
    null;  -- ถูกต้องแล้ว
  end;
end $$;

-- ---------------------------------------------------------------------------
-- เคส 2 : dedupe_key กันแถวซ้ำ
-- ---------------------------------------------------------------------------
insert into line_outbox (kind, message, dedupe_key)
values ('digest', 'ข้อความสรุปรอบแรก', 'digest:2026-08-22');

insert into line_outbox (kind, message, dedupe_key)
values ('digest', 'ข้อความสรุปรอบสอง', 'digest:2026-08-22')
on conflict (dedupe_key) do nothing;

do $$
begin
  assert (select count(*) from line_outbox where dedupe_key = 'digest:2026-08-22') = 1,
    'เคส 2 ล้มเหลว: dedupe_key ต้องกันไม่ให้เกิดแถวซ้ำในวันเดียวกัน';
end $$;

-- ---------------------------------------------------------------------------
-- เคส 3 : app_claim_line_outbox ดึงงานพร้อมบวก attempts
-- ---------------------------------------------------------------------------
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from app_claim_line_outbox(20);
  assert v_count = 1, format('เคส 3 ล้มเหลว: ควรดึงได้ 1 แถว แต่ได้ %s', v_count);

  assert (select attempts from line_outbox where dedupe_key = 'digest:2026-08-22') = 1,
    'เคส 3 ล้มเหลว: attempts ต้องถูกบวกเป็น 1 หลังถูกดึงไปส่ง';
end $$;

-- ---------------------------------------------------------------------------
-- เคส 4 : แถวที่ส่งสำเร็จแล้วต้องไม่ถูกดึงซ้ำ
-- ---------------------------------------------------------------------------
update line_outbox set status = 'sent', sent_at = now() where dedupe_key = 'digest:2026-08-22';

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from app_claim_line_outbox(20);
  assert v_count = 0, format('เคส 4 ล้มเหลว: แถวที่ sent แล้วต้องไม่ถูกดึงอีก แต่ดึงได้ %s แถว', v_count);
end $$;

-- ---------------------------------------------------------------------------
-- เคส 5 : แถวที่ล้มเหลวครบ 5 ครั้งแล้วต้องหยุด ไม่วนลองไม่รู้จบ
-- ---------------------------------------------------------------------------
insert into line_outbox (kind, message, status, attempts, dedupe_key)
values ('test', 'ลองมาห้าครั้งแล้ว', 'failed', 5, 'test:ครบโควตาลองใหม่');

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from app_claim_line_outbox(20);
  assert v_count = 0, format('เคส 5 ล้มเหลว: แถวที่ attempts = 5 ต้องไม่ถูกดึงอีก แต่ดึงได้ %s แถว', v_count);
end $$;

-- ---------------------------------------------------------------------------
-- เคส 6 : RLS — ผู้ใช้ทั่วไปแตะ line_outbox ไม่ได้เลย
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000b2"}';

do $$
begin
  begin
    insert into line_outbox (kind, message) values ('broadcast', 'ผู้ใช้ทั่วไปไม่ควรส่งได้');
    raise exception 'เคส 6 ล้มเหลว: ผู้ใช้ทั่วไปไม่ควร insert line_outbox ได้';
  exception when insufficient_privilege then
    null;  -- ถูกต้องแล้ว
  end;
end $$;

do $$
begin
  assert (select count(*) from line_outbox) = 0,
    'เคส 6 ล้มเหลว: ผู้ใช้ทั่วไปไม่ควรเห็นแถวใน line_outbox เลย';
  assert (select count(*) from line_config) = 0,
    'เคส 6 ล้มเหลว: ผู้ใช้ทั่วไปไม่ควรเห็น line_config';
end $$;

-- ---------------------------------------------------------------------------
-- เคส 7 : RLS — แอดมินเห็นและเพิ่มแถวได้
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000b1"}';

insert into line_outbox (kind, message) values ('broadcast', 'ประกาศจากแอดมิน');

do $$
begin
  assert (select count(*) from line_outbox where kind = 'broadcast') = 1,
    'เคส 7 ล้มเหลว: แอดมินต้อง insert line_outbox ได้';
  assert (select count(*) from line_config) = 1,
    'เคส 7 ล้มเหลว: แอดมินต้องเห็น line_config';
end $$;

reset role;
rollback;

\echo 'ผ่านทุกเคส'
```

- [ ] **Step 2: รันเพื่อยืนยันว่าล้มเหลว**

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f db/tests/07_line_integration_test.sql
```

Expected: FAIL ด้วย `ERROR: relation "line_config" does not exist`

- [ ] **Step 3: เขียน `db/07_line_integration.sql`**

```sql
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

commit;
```

- [ ] **Step 4: รันไฟล์แล้วรันทดสอบให้ผ่าน**

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f db/07_line_integration.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f db/tests/07_line_integration_test.sql
```

Expected: PASS — ขึ้นบรรทัด `ผ่านทุกเคส`

- [ ] **Step 5: Commit**

```bash
git add db/07_line_integration.sql db/tests/07_line_integration_test.sql
git commit -m "feat(db): เพิ่มตาราง line_config และ line_outbox พร้อม RLS"
```

---

## Task 2: Trigger — งานถูกตีกลับเข้าคิว LINE

**Files:**
- Modify: `db/07_line_integration.sql` (ต่อท้าย ก่อน `commit;`)
- Test: `db/tests/07_line_integration_test.sql` (ต่อท้าย ก่อน `reset role;`)

**Interfaces:**
- Consumes: `line_outbox`, `line_config.app_url` จาก Task 1; ตาราง `notifications` (`db/01_schema.sql:365`), `tasks` (`db/01_schema.sql:138`)
- Produces: trigger `notifications_to_line_outbox` บนตาราง `notifications`

**บริบทที่ต้องรู้:** `app_change_task_status()` (`db/02_views_functions.sql:213`) สร้างแถวใน `notifications` ให้เจ้าของงานโดยมี `type = 'returned'` เมื่องานถูกตีกลับ เราดักตรงนั้น

*ข้อจำกัดที่ยอมรับแล้ว:* ถ้าแอดมินตีกลับงานของตัวเอง `notifications` จะไม่ถูกสร้าง (มีเงื่อนไข `assigned_to_user_id <> v_actor.id` ที่ `db/02_views_functions.sql:229`) กลุ่มจึงไม่ได้รับข้อความ — ยอมรับได้เพราะคนที่ต้องรู้คือคนเดียวกับคนที่กดเอง

- [ ] **Step 1: เขียนเคสทดสอบที่ยังไม่ผ่าน**

แทรกก่อนบรรทัด `reset role;` ในไฟล์ทดสอบ (ตอนนี้ยังอยู่ใน role `authenticated` ที่เป็นแอดมิน ต้อง `reset role` ก่อนเพื่อให้ insert notifications ได้ตรง ๆ):

```sql
-- ---------------------------------------------------------------------------
-- เคส 8 : งานถูกตีกลับ -> เข้าคิว LINE 1 แถว, สถานะอื่นไม่เข้าคิว
-- ---------------------------------------------------------------------------
reset role;

insert into projects (id, name)
values ('00000000-0000-0000-0000-0000000000c1', 'โครงการทดสอบ LINE');

insert into tasks (id, code, project_id, title, assigned_to_user_id, deadline_at)
values ('00000000-0000-0000-0000-0000000000d1', 'TEST-LINE-1',
        '00000000-0000-0000-0000-0000000000c1', 'ตรวจแบบถังไอน้ำ',
        '00000000-0000-0000-0000-0000000000a2', now() + interval '3 days');

delete from line_outbox;

-- งานถูกตีกลับ
insert into notifications (recipient_user_id, task_id, type, title, message)
values ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000d1',
        'returned', 'งานถูกตีกลับแก้ไข', 'ทดสอบ แอดมิน ได้อัปเดตงาน "ตรวจแบบถังไอน้ำ" — ขาดผลทดสอบความดัน');

do $$
declare
  v_msg text;
begin
  assert (select count(*) from line_outbox where kind = 'returned') = 1,
    'เคส 8 ล้มเหลว: งานถูกตีกลับต้องสร้างแถวในคิว LINE 1 แถว';

  select message into v_msg from line_outbox where kind = 'returned';
  assert v_msg like '%TEST-LINE-1%',
    'เคส 8 ล้มเหลว: ข้อความต้องมีรหัสงาน';
  assert v_msg like '%ตรวจแบบถังไอน้ำ%',
    'เคส 8 ล้มเหลว: ข้อความต้องมีชื่องาน';
  assert v_msg like '%ทดสอบ ผู้ใช้%',
    'เคส 8 ล้มเหลว: ข้อความต้องมีชื่อผู้รับผิดชอบ';
end $$;

-- ---------------------------------------------------------------------------
-- เคส 9 : สถานะอื่น ๆ ต้องไม่เข้าคิว LINE
-- ---------------------------------------------------------------------------
delete from line_outbox;

insert into notifications (recipient_user_id, task_id, type, title, message)
values
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000d1',
   'status_change', 'งานของคุณได้รับการอนุมัติแล้ว', 'อนุมัติเรียบร้อย'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d1',
   'approval_required', 'มีงานรอตรวจสอบ', 'รอการตรวจสอบจากคุณ'),
  ('00000000-0000-0000-0000-0000000000a1', null,
   'approval_required', 'มีคำขอสมัครใช้งานใหม่', 'ผู้ใช้ใหม่ส่งคำขออนุมัติ');

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from line_outbox;
  assert v_count = 0,
    format('เคส 9 ล้มเหลว: งานอนุมัติ/รอตรวจ/สมัครใหม่ ต้องไม่เข้าคิว LINE แต่เข้าไป %s แถว', v_count);
end $$;
```

- [ ] **Step 2: รันเพื่อยืนยันว่าล้มเหลว**

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f db/tests/07_line_integration_test.sql
```

Expected: FAIL ที่ `เคส 8 ล้มเหลว: งานถูกตีกลับต้องสร้างแถวในคิว LINE 1 แถว`

- [ ] **Step 3: เพิ่ม trigger ลง `db/07_line_integration.sql`**

แทรกก่อนบรรทัด `commit;`:

```sql
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
```

- [ ] **Step 4: รันไฟล์แล้วรันทดสอบให้ผ่าน**

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f db/07_line_integration.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f db/tests/07_line_integration_test.sql
```

Expected: PASS — `ผ่านทุกเคส`

- [ ] **Step 5: Commit**

```bash
git add db/07_line_integration.sql db/tests/07_line_integration_test.sql
git commit -m "feat(db): งานถูกตีกลับเข้าคิวส่ง LINE อัตโนมัติ"
```

---

## Task 3: ข้อความสรุปรายวัน

**Files:**
- Modify: `db/07_line_integration.sql` (ต่อท้าย ก่อน `commit;`)
- Test: `db/tests/07_line_integration_test.sql` (ต่อท้าย ก่อน `rollback;`)

**Interfaces:**
- Consumes: `line_outbox`, `line_config` จาก Task 1; ตาราง `tasks`, `users`
- Produces:
  - `app_build_line_digest() returns text` — คืน `null` เมื่อไม่มีอะไรต้องรายงาน
  - `app_enqueue_line_digest() returns uuid` — คืน id ของแถวที่สร้าง หรือ `null` เมื่อไม่ได้สร้าง

- [ ] **Step 1: เขียนเคสทดสอบที่ยังไม่ผ่าน**

แทรกก่อนบรรทัด `rollback;`:

```sql
-- ---------------------------------------------------------------------------
-- เคส 10 : ไม่มีงานค้างเลย -> ไม่ส่งข้อความ (ไม่ทิ้งโควตาไปกับ "วันนี้ไม่มีงานค้าง")
-- ---------------------------------------------------------------------------
delete from line_outbox;
delete from tasks;

do $$
begin
  assert app_build_line_digest() is null,
    'เคส 10 ล้มเหลว: ไม่มีงานค้างต้องคืน null';
  assert app_enqueue_line_digest() is null,
    'เคส 10 ล้มเหลว: ไม่มีงานค้างต้องไม่สร้างแถวในคิว';
  assert (select count(*) from line_outbox) = 0,
    'เคส 10 ล้มเหลว: คิวต้องว่าง';
end $$;

-- ---------------------------------------------------------------------------
-- เคส 11 : มีงานครบสามหมวด -> ข้อความมีครบสามหัวข้อ
-- ---------------------------------------------------------------------------
-- งานเลยกำหนด (ต้องย้อน created_at ด้วย เพราะมี check deadline_at >= created_at)
insert into tasks (code, project_id, title, assigned_to_user_id,
                   created_at, deadline_at, last_updated_at, status)
values ('TEST-OVERDUE-1', '00000000-0000-0000-0000-0000000000c1', 'งานเลยกำหนด',
        '00000000-0000-0000-0000-0000000000a2',
        now() - interval '10 days', now() - interval '2 days', now(), 'pending_submission');

-- งานค้างอัปเดตเกิน 4 ชม. แต่ยังไม่เลยกำหนด
insert into tasks (code, project_id, title, assigned_to_user_id,
                   created_at, deadline_at, last_updated_at, status)
values ('TEST-STALE-1', '00000000-0000-0000-0000-0000000000c1', 'งานค้างอัปเดต',
        '00000000-0000-0000-0000-0000000000a2',
        now() - interval '2 days', now() + interval '5 days',
        now() - interval '6 hours', 'pending_submission');

-- งานรอตรวจ
insert into tasks (code, project_id, title, assigned_to_user_id,
                   created_at, deadline_at, last_updated_at, status)
values ('TEST-REVIEW-1', '00000000-0000-0000-0000-0000000000c1', 'งานรอตรวจ',
        '00000000-0000-0000-0000-0000000000a2',
        now() - interval '1 day', now() + interval '5 days', now(), 'pending_review');

do $$
declare
  v_msg text;
begin
  v_msg := app_build_line_digest();
  assert v_msg is not null, 'เคส 11 ล้มเหลว: ต้องได้ข้อความสรุป';
  assert v_msg like '%เลยกำหนด%',      'เคส 11 ล้มเหลว: ต้องมีหัวข้องานเลยกำหนด';
  assert v_msg like '%TEST-OVERDUE-1%', 'เคส 11 ล้มเหลว: ต้องมีงานเลยกำหนดในรายการ';
  assert v_msg like '%ค้างอัปเดต%',     'เคส 11 ล้มเหลว: ต้องมีหัวข้องานค้างอัปเดต';
  assert v_msg like '%TEST-STALE-1%',   'เคส 11 ล้มเหลว: ต้องมีงานค้างอัปเดตในรายการ';
  assert v_msg like '%รอตรวจ%',         'เคส 11 ล้มเหลว: ต้องมีหัวข้องานรอตรวจ';
  assert v_msg like '%TEST-REVIEW-1%',  'เคส 11 ล้มเหลว: ต้องมีงานรอตรวจในรายการ';
end $$;

-- ---------------------------------------------------------------------------
-- เคส 12 : งานอนุมัติแล้วต้องไม่โผล่ในสรุป แม้จะเลยกำหนดไปแล้ว
-- ---------------------------------------------------------------------------
insert into tasks (code, project_id, title, assigned_to_user_id,
                   created_at, deadline_at, last_updated_at, status, completed_at)
values ('TEST-DONE-1', '00000000-0000-0000-0000-0000000000c1', 'งานปิดแล้ว',
        '00000000-0000-0000-0000-0000000000a2',
        now() - interval '10 days', now() - interval '5 days', now(), 'approved', now());

do $$
begin
  assert app_build_line_digest() not like '%TEST-DONE-1%',
    'เคส 12 ล้มเหลว: งานที่อนุมัติแล้วต้องไม่โผล่ในสรุป';
end $$;

-- ---------------------------------------------------------------------------
-- เคส 13 : เกิน 10 ใบต่อหมวด -> ตัดที่ 10 แล้วบอกว่าเหลืออีกกี่ใบ
-- ---------------------------------------------------------------------------
insert into tasks (code, project_id, title, assigned_to_user_id,
                   created_at, deadline_at, last_updated_at, status)
select 'TEST-BULK-' || g, '00000000-0000-0000-0000-0000000000c1', 'งานล้นหมวด ' || g,
       '00000000-0000-0000-0000-0000000000a2',
       now() - interval '10 days', now() - interval '3 days', now(), 'pending_submission'
from generate_series(1, 14) g;

do $$
declare
  v_msg   text;
  v_lines integer;
begin
  v_msg := app_build_line_digest();
  -- รวมงานเลยกำหนด 15 ใบ (TEST-OVERDUE-1 + TEST-BULK-1..14) แสดง 10 เหลืออีก 5
  assert v_msg like '%และอีก 5 ใบ%',
    format('เคส 13 ล้มเหลว: ต้องมีข้อความ "และอีก 5 ใบ" แต่ได้ข้อความว่า %s', v_msg);

  select count(*) into v_lines
    from regexp_split_to_table(v_msg, E'\n') l
   where l like '• [TEST-%';
  assert v_lines <= 10 + 2,
    format('เคส 13 ล้มเหลว: แต่ละหมวดต้องแสดงไม่เกิน 10 รายการ แต่นับได้ %s บรรทัด', v_lines);

  assert char_length(v_msg) <= 4900,
    'เคส 13 ล้มเหลว: ข้อความต้องไม่เกิน 4,900 ตัวอักษร';
end $$;

-- ---------------------------------------------------------------------------
-- เคส 14 : เรียก enqueue ซ้ำในวันเดียวกัน -> ยังมีแถวเดียว
-- ---------------------------------------------------------------------------
delete from line_outbox;

do $$
declare
  v_first  uuid;
  v_second uuid;
begin
  v_first  := app_enqueue_line_digest();
  v_second := app_enqueue_line_digest();

  assert v_first is not null, 'เคส 14 ล้มเหลว: ครั้งแรกต้องสร้างแถวได้';
  assert v_second is null,    'เคส 14 ล้มเหลว: ครั้งที่สองต้องไม่สร้างแถวซ้ำ';
  assert (select count(*) from line_outbox where kind = 'digest') = 1,
    'เคส 14 ล้มเหลว: สรุปรายวันต้องมีแถวเดียวต่อวัน';
end $$;
```

- [ ] **Step 2: รันเพื่อยืนยันว่าล้มเหลว**

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f db/tests/07_line_integration_test.sql
```

Expected: FAIL ด้วย `ERROR: function app_build_line_digest() does not exist`

- [ ] **Step 3: เพิ่มฟังก์ชันลง `db/07_line_integration.sql`**

แทรกก่อนบรรทัด `commit;`:

```sql
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
  select count(*) into v_n_over
    from tasks where status <> 'approved' and deadline_at < v_now;

  select count(*) into v_n_stale
    from tasks
   where status <> 'approved'
     and deadline_at >= v_now
     and last_updated_at < v_now - make_interval(hours => c_stale_hrs);

  select count(*) into v_n_review
    from tasks where status = 'pending_review';

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
     where t.status <> 'approved' and t.deadline_at < v_now
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
     where t.status = 'pending_review'
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
```

- [ ] **Step 4: รันไฟล์แล้วรันทดสอบให้ผ่าน**

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f db/07_line_integration.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f db/tests/07_line_integration_test.sql
```

Expected: PASS — `ผ่านทุกเคส`

- [ ] **Step 5: Commit**

```bash
git add db/07_line_integration.sql db/tests/07_line_integration_test.sql
git commit -m "feat(db): สร้างข้อความสรุปงานรายวันสำหรับส่งเข้ากลุ่ม LINE"
```

---

## Task 4: Edge Function `line-dispatch`

**Files:**
- Create: `supabase/functions/line-dispatch/lib.ts`
- Create: `supabase/functions/line-dispatch/index.ts`
- Test: `supabase/functions/line-dispatch/lib.test.ts`
- Modify: `package.json` (เพิ่ม devDependency `vitest` และ script `test`)

**Interfaces:**
- Consumes: `app_claim_line_outbox(p_limit integer)`, ตาราง `line_config`, `line_outbox` จาก Task 1
- Produces:
  - `lib.ts` export: `LINE_PUSH_URL: string`, `MAX_ATTEMPTS: number`, `clampMessage(text: string, limit?: number): string`, `buildPushBody(groupId: string, message: string): { to: string; messages: { type: 'text'; text: string }[] }`, `shouldRetry(status: number): boolean`
  - HTTP endpoint `POST /line-dispatch` ที่ต้องมี header `x-line-dispatch-secret` ตรงกับ secret `LINE_DISPATCH_SECRET`

- [ ] **Step 1: ติดตั้ง vitest**

```bash
npm install --save-dev vitest@^3
```

แก้ `package.json` เพิ่มใน `"scripts"`:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 2: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `supabase/functions/line-dispatch/lib.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildPushBody, clampMessage, MAX_ATTEMPTS, shouldRetry } from './lib';

describe('clampMessage', () => {
  it('ข้อความสั้นผ่านไปเหมือนเดิม', () => {
    expect(clampMessage('สวัสดี')).toBe('สวัสดี');
  });

  it('ข้อความยาวเกินขีดจำกัดถูกตัดและต่อท้ายด้วยจุดไข่ปลา', () => {
    const long = 'ก'.repeat(5000);
    const result = clampMessage(long);
    expect(result).toHaveLength(4900);
    expect(result.endsWith('…')).toBe(true);
  });

  it('ข้อความยาวเท่าขีดจำกัดพอดีไม่ถูกตัด', () => {
    const exact = 'ก'.repeat(4900);
    expect(clampMessage(exact)).toBe(exact);
  });
});

describe('buildPushBody', () => {
  it('ประกอบ payload ตามรูปแบบของ LINE Messaging API', () => {
    expect(buildPushBody('Cxxxxxxxx', 'ทดสอบ')).toEqual({
      to: 'Cxxxxxxxx',
      messages: [{ type: 'text', text: 'ทดสอบ' }],
    });
  });

  it('ตัดข้อความยาวให้อยู่ในขีดจำกัดก่อนส่ง', () => {
    const body = buildPushBody('Cxxxxxxxx', 'ก'.repeat(5000));
    expect(body.messages[0].text).toHaveLength(4900);
  });
});

describe('shouldRetry', () => {
  it('โควตาหมด (429) ไม่ลองใหม่ — ลองไปก็ไม่ผ่าน', () => {
    expect(shouldRetry(429)).toBe(false);
  });

  it('token ผิดหรือหมดสิทธิ์ (401/403) ไม่ลองใหม่ — ต้องคนไปแก้ค่า', () => {
    expect(shouldRetry(401)).toBe(false);
    expect(shouldRetry(403)).toBe(false);
  });

  it('ส่ง payload ผิด (400) ไม่ลองใหม่ — ส่งซ้ำก็ผิดเหมือนเดิม', () => {
    expect(shouldRetry(400)).toBe(false);
  });

  it('ฝั่ง LINE ล่ม (5xx) ลองใหม่ได้', () => {
    expect(shouldRetry(500)).toBe(true);
    expect(shouldRetry(503)).toBe(true);
  });

  it('ยิงไม่ออกเลย (status 0 = เน็ตหลุด/timeout) ลองใหม่ได้', () => {
    expect(shouldRetry(0)).toBe(true);
  });
});

describe('MAX_ATTEMPTS', () => {
  it('ต้องตรงกับเงื่อนไข attempts < 5 ใน app_claim_line_outbox', () => {
    expect(MAX_ATTEMPTS).toBe(5);
  });
});
```

- [ ] **Step 3: รันเทสต์เพื่อยืนยันว่าล้มเหลว**

```bash
npm test
```

Expected: FAIL ด้วย `Failed to resolve import "./lib"`

- [ ] **Step 4: เขียน `lib.ts`**

สร้าง `supabase/functions/line-dispatch/lib.ts`:

```ts
/**
 * ส่วน logic ล้วน ๆ ของ line-dispatch — ไม่แตะ Deno API และไม่ยิงเน็ต
 * แยกไว้ที่นี่เพื่อให้ vitest ทดสอบได้โดยไม่ต้องมี Supabase หรือ LINE จริง
 */

export const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push';

/** ต้องตรงกับเงื่อนไข attempts < 5 ใน app_claim_line_outbox() */
export const MAX_ATTEMPTS = 5;

/** LINE จำกัดข้อความละ 5,000 ตัวอักษร กันไว้ที่ 4,900 */
export function clampMessage(text: string, limit = 4900): string {
  return text.length <= limit ? text : text.slice(0, limit - 1) + '…';
}

export function buildPushBody(groupId: string, message: string) {
  return {
    to: groupId,
    messages: [{ type: 'text' as const, text: clampMessage(message) }],
  };
}

/**
 * ตัดสินใจว่าความล้มเหลวครั้งนี้ควรลองส่งใหม่ไหม
 *
 * 4xx = ปัญหาอยู่ที่ฝั่งเรา (token ผิด / โควตาหมด / payload ผิด) ลองซ้ำก็ได้ผลเดิม
 *       ต้องให้คนเข้าไปแก้ จึงหยุดทันทีและเก็บ error ไว้ให้แอดมินเห็น
 * 5xx = ฝั่ง LINE มีปัญหาชั่วคราว ลองใหม่มีโอกาสผ่าน
 * 0   = ยิงไม่ออกเลย (เน็ตหลุด / timeout) ลองใหม่ได้
 */
export function shouldRetry(status: number): boolean {
  if (status === 0) return true;
  return status >= 500;
}
```

- [ ] **Step 5: รันเทสต์ให้ผ่าน**

```bash
npm test
```

Expected: PASS ทั้ง 11 เคส

- [ ] **Step 6: เขียน `index.ts`**

สร้าง `supabase/functions/line-dispatch/index.ts`:

```ts
/**
 * line-dispatch — ตัวเดียวในระบบที่ถือ LINE Channel Access Token
 *
 * ถูกเรียกจากสองทาง
 *   1. Supabase Database Webhook เมื่อมีแถวใหม่ใน line_outbox (ส่งทันที)
 *   2. pg_cron ทุก 15 นาที (กวาดแถวที่ส่งไม่สำเร็จมาลองใหม่)
 *
 * ทั้งสองทางต้องแนบ header x-line-dispatch-secret ให้ตรงกับ secret ที่ตั้งไว้
 * deploy ด้วย --no-verify-jwt แล้วใช้ secret ตัวนี้คุมสิทธิ์แทน
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildPushBody, LINE_PUSH_URL, shouldRetry } from './lib.ts';

const token = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN') ?? '';
const groupId = Deno.env.get('LINE_GROUP_ID') ?? '';
const dispatchSecret = Deno.env.get('LINE_DISPATCH_SECRET') ?? '';

const db = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  if (!dispatchSecret || req.headers.get('x-line-dispatch-secret') !== dispatchSecret) {
    return json({ error: 'ไม่ได้รับอนุญาต' }, 401);
  }
  if (!token || !groupId) {
    // ทาง config หายเงียบสนิทไม่ได้ — แถวที่รอส่งต้องมี last_error ให้แอดมินเห็น
    // ไม่งั้นแยกไม่ออกจากตอนที่ระบบว่างงานจริง ๆ
    const msg = 'ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN หรือ LINE_GROUP_ID';
    try {
      const { error: markError } = await db
        .from('line_outbox')
        .update({ last_error: msg })
        .eq('status', 'pending');
      if (markError) {
        console.error(`[line-dispatch] เขียน last_error ไม่ลง (ตั้งค่า LINE ไม่ครบ): ${markError.message}`);
      }
    } catch (e) {
      // ถ้า SUPABASE_URL/SERVICE_ROLE_KEY หายไปด้วย db client เองอาจใช้งานไม่ได้
      // กันไว้ไม่ให้ throw ทับ response 500 ที่ตั้งใจจะคืนอยู่แล้ว
      console.error(
        `[line-dispatch] เขียน last_error ไม่ลง (ตั้งค่า LINE ไม่ครบ): ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    return json({ error: msg }, 500);
  }

  // 1) สวิตช์ใหญ่
  const { data: config, error: configError } = await db
    .from('line_config')
    .select('enabled, monthly_cap')
    .maybeSingle();

  if (configError) return json({ error: `อ่าน line_config ไม่ได้: ${configError.message}` }, 500);
  if (!config?.enabled) return json({ skipped: 'ปิดการส่ง LINE อยู่' });

  // 2) เพดานรายเดือน — กันโควตา LINE บานปลาย
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const { count: sentThisMonth, error: countError } = await db
    .from('line_outbox')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'sent')
    .gte('sent_at', monthStart.toISOString());

  if (countError) return json({ error: `นับโควตาไม่ได้: ${countError.message}` }, 500);

  if ((sentThisMonth ?? 0) >= config.monthly_cap) {
    // ไม่เปลี่ยนสถานะแถว ปล่อยค้างไว้ให้ส่งต่อเดือนหน้าได้
    // แต่เขียน last_error ไว้ให้แอดมินเห็นว่าทำไมเงียบ — ห้ามเงียบหายเฉย ๆ
    const { error: markError } = await db
      .from('line_outbox')
      .update({ last_error: 'ถึงเพดานข้อความรายเดือนแล้ว หยุดส่งชั่วคราว' })
      .eq('status', 'pending');
    if (markError) {
      console.error(`[line-dispatch] เขียน last_error ไม่ลง (ถึงเพดานรายเดือน): ${markError.message}`);
    }
    return json({ skipped: 'ถึงเพดานรายเดือน', sentThisMonth, cap: config.monthly_cap });
  }

  // 3) ดึงคิว (ฟังก์ชันบวก attempts ให้แล้ว และกันสองรอบทำงานชนกันด้วย skip locked)
  const { data: rows, error: claimError } = await db.rpc('app_claim_line_outbox', { p_limit: 20 });
  if (claimError) return json({ error: `ดึงคิวไม่ได้: ${claimError.message}` }, 500);
  if (!rows?.length) return json({ sent: 0, failed: 0 });

  // 4) ยิงทีละแถว
  let sent = 0;
  let failed = 0;

  for (const row of rows as { id: string; message: string }[]) {
    let status = 0;
    let detail = '';

    try {
      const res = await fetch(LINE_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          // LINE ใช้ค่านี้กันข้อความซ้ำให้อีกชั้น เผื่อเรายิงซ้ำโดยไม่ตั้งใจ
          'X-Line-Retry-Key': row.id,
        },
        body: JSON.stringify(buildPushBody(groupId, row.message)),
      });
      status = res.status;
      if (!res.ok) detail = (await res.text()).slice(0, 500);
    } catch (e) {
      status = 0;
      detail = e instanceof Error ? e.message : String(e);
    }

    if (status >= 200 && status < 300) {
      const { error: markError } = await db
        .from('line_outbox')
        .update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null })
        .eq('id', row.id);
      if (markError) {
        // อันตรายที่สุดในไฟล์นี้: ส่งเข้า LINE ไปแล้วแต่บันทึกไม่ลง
        // แถวจะถูกเคลมซ้ำรอบหน้าและกลุ่มจะได้ข้อความซ้ำ ต้องเห็นใน log ให้ได้
        console.error(`[line-dispatch] ส่งสำเร็จแต่บันทึกสถานะไม่ลง row=${row.id}: ${markError.message}`);
      }
      sent++;
    } else {
      const note = shouldRetry(status) ? 'จะลองใหม่' : 'ไม่ลองใหม่ ต้องแก้ที่ต้นเหตุ';
      const { error: markError } = await db
        .from('line_outbox')
        .update({
          status: 'failed',
          last_error: `HTTP ${status} (${note}): ${detail}`,
          // ปิดโอกาสลองใหม่ทันทีสำหรับ error ที่ลองไปก็ไม่ผ่าน
          ...(shouldRetry(status) ? {} : { attempts: 99 }),
        })
        .eq('id', row.id);
      if (markError) {
        console.error(`[line-dispatch] บันทึกสถานะ failed ไม่ลง row=${row.id}: ${markError.message}`);
      }
      failed++;
    }
  }

  return json({ sent, failed });
});
```

- [ ] **Step 7: ตรวจว่า TypeScript ของโปรเจกต์ไม่พัง**

`index.ts` ใช้ Deno API ที่ `tsconfig.json` ของแอปไม่รู้จัก จึงต้องกันไม่ให้ `npm run lint` ไปแตะ แก้ `tsconfig.json` เพิ่ม `"exclude"` ระดับบนสุด (ถ้ามี `exclude` อยู่แล้วให้เพิ่มเข้าไปในรายการเดิม):

```json
  "exclude": ["node_modules", "dist", "supabase/functions"]
```

Run: `npm run lint`
Expected: ผ่าน ไม่มี error

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/line-dispatch package.json package-lock.json tsconfig.json
git commit -m "feat(edge): เพิ่ม Edge Function line-dispatch สำหรับยิงข้อความเข้ากลุ่ม LINE"
```

---

## Task 5: ต่อสายและทดสอบกับ LINE จริง

**Files:**
- Create: `db/08_line_schedule.sql`
- Modify: `db/README.md`

**Interfaces:**
- Consumes: `app_enqueue_line_digest()` จาก Task 3, Edge Function `line-dispatch` จาก Task 4
- Produces: cron job `line_daily_digest` และ `line_retry_sweep`; ระบบที่ส่งข้อความเข้ากลุ่ม LINE ได้จริง

**สำคัญ:** Task นี้มีขั้นตอนที่ต้องทำด้วยมือในหน้าเว็บของ LINE และ Supabase ทำแทนด้วยโค้ดไม่ได้ ให้ทำตามลำดับ

- [ ] **Step 1: เตรียม LINE Official Account**

1. สร้าง LINE Official Account ที่ https://manager.line.biz
2. ไปที่ **Settings > Response settings** ปิด **Auto-response** และ **Greeting message** (ไม่งั้น bot จะตอบรกกลุ่ม)
3. เข้า https://developers.line.biz เลือก Provider > เลือก channel ของ OA นี้ > แท็บ **Messaging API**
4. กด **Issue** ที่ **Channel access token (long-lived)** คัดลอกเก็บไว้
5. เชิญ OA เข้า **กลุ่ม LINE ทดสอบ** ก่อน (ยังไม่ใช่กลุ่มจริง)

- [ ] **Step 2: หา groupId ของกลุ่ม**

ค่านี้ไม่มีหน้า UI ให้ดู ต้องดักจาก event เท่านั้น:

1. ที่ LINE Developers แท็บ Messaging API เปิด **Use webhook** และใส่ Webhook URL ชั่วคราวเป็นบริการอย่าง https://webhook.site (กด "New" แล้วคัดลอก URL มาวาง)
2. พิมพ์ข้อความอะไรก็ได้ในกลุ่มทดสอบ 1 ครั้ง
3. กลับไปดูที่ webhook.site จะเห็น JSON — คัดลอกค่า `events[0].source.groupId` (ขึ้นต้นด้วย `C`)
4. **ปิด Use webhook กลับ** — ไม่ต้องใช้อีกแล้ว

- [ ] **Step 3: ตั้ง secrets แล้ว deploy Edge Function**

สุ่มค่า `LINE_DISPATCH_SECRET` ขึ้นมาเอง:

```bash
openssl rand -hex 32
```

ตั้งค่า (แทนที่ค่าในวงเล็บเหลี่ยมด้วยของจริง):

```bash
supabase secrets set \
  LINE_CHANNEL_ACCESS_TOKEN='[token จาก Step 1]' \
  LINE_GROUP_ID='[groupId จาก Step 2]' \
  LINE_DISPATCH_SECRET='[ค่าที่สุ่มได้]'

supabase functions deploy line-dispatch --no-verify-jwt
```

- [ ] **Step 4: ตั้ง Database Webhook**

ใน Supabase Dashboard > **Database > Webhooks** > Create a new hook:

| ช่อง | ค่า |
|---|---|
| Name | `line_outbox_dispatch` |
| Table | `public.line_outbox` |
| Events | `Insert` เท่านั้น |
| Type | HTTP Request |
| Method | `POST` |
| URL | `https://[PROJECT_REF].functions.supabase.co/line-dispatch` |
| HTTP Headers | `x-line-dispatch-secret` = ค่าที่สุ่มไว้ใน Step 3 |

- [ ] **Step 5: เขียน `db/08_line_schedule.sql`**

```sql
-- =============================================================================
-- NP Taskwork — ระบบติดตามงาน
-- 08_line_schedule.sql : ตารางเวลาของระบบแจ้งเตือน LINE
--
-- ก่อนรัน ต้องแก้ 2 จุดในไฟล์นี้
--   1. [PROJECT_REF]  -> project ref ของคุณ (ดูใน Supabase Dashboard > Settings)
--   2. รัน vault.create_secret ด้านล่างด้วยค่า LINE_DISPATCH_SECRET ตัวเดียวกับ
--      ที่ตั้งไว้ใน Edge Function secrets
--
-- ทำไม secret ต้องอยู่ใน Vault ไม่ใช่ในตาราง line_config
--   line_config เปิดให้แอดมินอ่านผ่าน RLS ถ้าเก็บ secret ไว้ที่นั่น
--   แอดมินทุกคนจะอ่านค่าไปเรียก Edge Function ตรง ๆ ได้
--
-- ไฟล์นี้รันซ้ำได้
-- =============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- เก็บ secret ครั้งแรกครั้งเดียว (รันซ้ำจะ error ว่าชื่อซ้ำ ให้ข้ามได้)
-- select vault.create_secret('[ค่า LINE_DISPATCH_SECRET]', 'line_dispatch_secret');

-- ลบตารางเวลาเดิมก่อน เพื่อให้รันไฟล์ซ้ำได้
select cron.unschedule('line_daily_digest') where exists (
  select 1 from cron.job where jobname = 'line_daily_digest');
select cron.unschedule('line_retry_sweep') where exists (
  select 1 from cron.job where jobname = 'line_retry_sweep');

-- -----------------------------------------------------------------------------
-- สรุปรายวัน 08:00 น. เวลาไทย
-- pg_cron ของ Supabase รันด้วย UTC จึงตั้งไว้ 01:00 UTC
-- -----------------------------------------------------------------------------
select cron.schedule(
  'line_daily_digest',
  '0 1 * * *',
  $cron$ select app_enqueue_line_digest() $cron$
);

-- -----------------------------------------------------------------------------
-- กวาดแถวที่ส่งไม่สำเร็จมาลองใหม่ทุก 15 นาที
-- เผื่อกรณี Database Webhook ยิงพลาด หรือ LINE ล่มตอนนั้นพอดี
-- -----------------------------------------------------------------------------
select cron.schedule(
  'line_retry_sweep',
  '*/15 * * * *',
  $cron$
  select net.http_post(
    url     := 'https://[PROJECT_REF].functions.supabase.co/line-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-line-dispatch-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'line_dispatch_secret')
    ),
    body    := jsonb_build_object('source', 'cron')
  )
  $cron$
);
```

- [ ] **Step 6: ตั้งค่า `app_url` และเปิดสวิตช์**

```sql
update line_config
   set app_url = 'https://[URL ของระบบคุณ]',
       enabled = true,
       updated_at = now();
```

- [ ] **Step 7: ทดสอบกับกลุ่มทดสอบจริง 6 ข้อ**

รันทีละข้อ ต้องผ่านครบก่อนไปต่อ:

```sql
-- 7.1 ส่งข้อความทดสอบ — ต้องเห็นข้อความในกลุ่มทดสอบภายในไม่กี่วินาที
insert into line_outbox (kind, message) values ('test', 'ทดสอบระบบแจ้งเตือน NP Taskwork');
select status, attempts, last_error from line_outbox order by created_at desc limit 1;
-- คาดหวัง: status = 'sent'
```

```sql
-- 7.2 สรุปรายวัน — ตรวจหน้าตาข้อความก่อนปล่อยของจริง
select app_build_line_digest();
select app_enqueue_line_digest();
-- คาดหวัง: ข้อความเข้ากลุ่ม อ่านรู้เรื่อง วันที่ถูกต้อง
```

7.3 ตีกลับงานจริง 1 ใบผ่านหน้าเว็บ → ต้องเห็นข้อความ "🔴 งานถูกตีกลับแก้ไข" ในกลุ่ม

```sql
-- 7.4 ทดสอบว่าความล้มเหลวไม่เงียบหาย
-- ตั้ง token ผิดชั่วคราวแล้ว deploy ใหม่ จากนั้น:
insert into line_outbox (kind, message) values ('test', 'ทดสอบกรณี token ผิด');
select status, attempts, last_error from line_outbox order by created_at desc limit 1;
-- คาดหวัง: status = 'failed' และ last_error ขึ้น HTTP 401 พร้อมข้อความจาก LINE
-- อย่าลืมตั้ง token กลับให้ถูกแล้ว deploy ใหม่
```

```sql
-- 7.5 ทดสอบสวิตช์ปิด
update line_config set enabled = false;
insert into line_outbox (kind, message) values ('test', 'ไม่ควรถูกส่ง');
select status from line_outbox order by created_at desc limit 1;
-- คาดหวัง: status ยังเป็น 'pending' และไม่มีข้อความเข้ากลุ่ม
update line_config set enabled = true;
```

```sql
-- 7.6 ตรวจว่า cron ถูกตั้งจริง
select jobname, schedule, active from cron.job where jobname like 'line_%';
-- คาดหวัง: 2 แถว active = true
```

- [ ] **Step 8: ย้ายไปกลุ่มจริง**

```bash
supabase secrets set LINE_GROUP_ID='[groupId ของกลุ่มจริง]'
supabase functions deploy line-dispatch --no-verify-jwt
```

เชิญ OA เข้ากลุ่มจริง แล้วรันข้อ 7.1 ซ้ำเพื่อยืนยันว่าเข้ากลุ่มจริง

- [ ] **Step 9: อัปเดต `db/README.md`**

เพิ่ม 2 บรรทัดในตารางไฟล์ ต่อจากบรรทัด `06_patch_notifications.sql`:

```markdown
| `07_line_integration.sql` | แจ้งเตือนเข้ากลุ่ม LINE — ตาราง `line_config` / `line_outbox`, trigger งานตีกลับ, ข้อความสรุปรายวัน — รันซ้ำได้ |
| `08_line_schedule.sql` | ตารางเวลา pg_cron ของระบบ LINE — **ต้องแก้ `[PROJECT_REF]` ในไฟล์ก่อนรัน** |
```

- [ ] **Step 10: Commit**

```bash
git add db/08_line_schedule.sql db/README.md
git commit -m "feat(db): ตั้งตารางเวลา pg_cron สำหรับสรุปรายวันและการส่งซ้ำ"
```

---

## Task 6: ต่อฝั่งแอปเข้ากับคิว LINE

**Files:**
- Create: `src/lib/lineApi.ts`
- Modify: `src/context/AppContext.tsx:29,53,104,107,146,516,524,583,609,633,747,756,779`
- Modify: `src/components/Navbar.tsx:29-33,72-86`
- Modify: `src/components/AdminApprovalView.tsx:25,27,48,54,265-270,276,388-405`

**Interfaces:**
- Consumes: ตาราง `line_config`, `line_outbox` จาก Task 1
- Produces:
  - `src/lib/lineApi.ts` export: `LineConfig` interface `{ enabled: boolean; monthlyCap: number; appUrl: string }`, `LineOutboxRow` interface, `fetchLineConfig(db: SupabaseClient): Promise<LineConfig | null>`, `setLineEnabled(db: SupabaseClient, enabled: boolean): Promise<void>`, `enqueueLineMessage(db: SupabaseClient, kind: 'broadcast' | 'test', message: string): Promise<void>`, `fetchLineOutbox(db: SupabaseClient, limit?: number): Promise<LineOutboxRow[]>`
  - AppContext export: `lineEnabled: boolean`, `toggleLineEnabled: () => void`, `sendTestLineMessage: () => void` (แทน `lineNotifyEnabled` / `toggleLineNotify` / `sendTestLineNotify`)

- [ ] **Step 1: สร้าง `src/lib/lineApi.ts`**

```ts
/**
 * ชั้นเชื่อมต่อระบบแจ้งเตือน LINE ฝั่งแอป
 *
 * แยกจาก api.ts เพราะไฟล์นั้นยาวเกิน 800 บรรทัดแล้ว และเรื่อง LINE
 * เป็นคนละความรับผิดชอบกับการอ่าน/เขียนข้อมูลงาน
 *
 * กติกาเดียวกับ api.ts — โยน error ออกมา ให้ผู้เรียกตัดสินใจว่าจะแสดงผลอย่างไร
 *
 * สำคัญ: ฝั่งนี้ทำได้แค่ "หย่อนข้อความลงคิว" เท่านั้น
 * การยิงเข้า LINE จริงเป็นหน้าที่ของ Edge Function ที่ถือ token อยู่ฝั่งเซิร์ฟเวอร์
 */
import { SupabaseClient } from '@supabase/supabase-js';

export interface LineConfig {
  enabled: boolean;
  monthlyCap: number;
  appUrl: string;
}

export async function fetchLineConfig(db: SupabaseClient): Promise<LineConfig | null> {
  const { data, error } = await db
    .from('line_config')
    .select('enabled, monthly_cap, app_url')
    .maybeSingle();

  // ผู้ใช้ทั่วไปมองไม่เห็นตารางนี้ตาม RLS — ไม่ใช่ error ให้คืน null ไปเงียบ ๆ
  if (error) throw new Error(`อ่านการตั้งค่า LINE ไม่สำเร็จ: ${error.message}`);
  if (!data) return null;

  return { enabled: data.enabled, monthlyCap: data.monthly_cap, appUrl: data.app_url ?? '' };
}

export async function setLineEnabled(db: SupabaseClient, enabled: boolean): Promise<void> {
  const { error } = await db
    .from('line_config')
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('id', true);
  if (error) throw new Error(`บันทึกสถานะ LINE ไม่สำเร็จ: ${error.message}`);
}

/**
 * หย่อนข้อความ 1 ข้อความลงคิว
 *
 * ย้ำ: 1 การเรียก = 1 แถว = 1 ข้อความที่ส่งจริง
 * ห้ามวนเรียกทีละผู้ใช้เด็ดขาด เพราะข้อความเข้ากลุ่มหักโควตาตามจำนวนสมาชิกอยู่แล้ว
 */
export async function enqueueLineMessage(
  db: SupabaseClient,
  kind: 'broadcast' | 'test',
  message: string
): Promise<void> {
  const { error } = await db.from('line_outbox').insert({ kind, message: message.slice(0, 4900) });
  if (error) throw new Error(`ส่งข้อความเข้าคิว LINE ไม่สำเร็จ: ${error.message}`);
}
```

- [ ] **Step 2: แก้ AppContext — ประกาศให้เข้าคิวแถวเดียว**

ที่ `src/context/AppContext.tsx` แทนที่ `sendCustomNotificationToUsers` ทั้งฟังก์ชัน (บรรทัด 605-631) ด้วย:

```tsx
  const sendCustomNotificationToUsers = (userIds: string[], title: string, customMessage: string) => {
    if (!userIds?.length) return;

    void run(async () => {
      // กระดิ่งบนเว็บ — 1 แถวต่อผู้รับ 1 คน (ตั้งใจ เพราะแต่ละคนต้องกดอ่านของตัวเอง)
      await api.insertNotifications(
        db,
        userIds.map(uid => ({
          recipientUserId: uid,
          title: title || '📢 ประกาศแจ้งเตือนพิเศษจาก Super Admin',
          message: customMessage,
          type: 'sla_warning' as const,
        }))
      );

      // LINE — 1 แถวเท่านั้นสำหรับประกาศทั้งก้อน
      // ถ้าวนสร้างทีละคน ประกาศเรื่องเดียวถึง 10 คนจะกลายเป็น 10 ข้อความ
      // และหักโควตา LINE ไป 100 (10 ข้อความ x สมาชิกกลุ่ม 10 คน)
      await lineApi.enqueueLineMessage(
        db,
        'broadcast',
        `📢 ${title || 'ประกาศจากผู้ดูแลระบบ'}\n${customMessage}`
      );

      setNotifications(await api.fetchNotifications(db));
    });
  };
```

เพิ่ม import ที่หัวไฟล์ ถัดจากบรรทัดที่ import `api`:

```tsx
import * as lineApi from '../lib/lineApi';
```

- [ ] **Step 3: แก้ AppContext — ถอดแถวปลอมออกจาก SLA**

ที่ `src/context/AppContext.tsx` ลบบล็อกนี้ทั้งก้อน (บรรทัด 582-590):

```tsx
      if (owner?.lineNotifyEnabled ?? true) {
        pending.push({
          recipientUserId: recipientId,
          title: '📲 LINE Notify: เตือนความจำงานค้างอัปเดต',
          message: `LINE Notify ถึง ${owner?.fullName || 'ผู้รับผิดชอบ'}: การ์ดงาน [${task.code}] ${task.title} ยังไม่มีการอัปเดตเกิน ${durationText} โปรดเข้าตรวจสอบในระบบ`,
          type: 'line_notify_sent',
          taskId: task.id,
        });
      }
```

แล้วแก้บรรทัด 601 (ที่กรองนับเฉพาะแจ้งเตือนบนเว็บ) เพราะตอนนี้ไม่มีแถว LINE ปนแล้ว:

```tsx
    return pending.length;
```

พร้อมลบคอมเมนต์บรรทัดเหนือมันที่เขียนว่า `// นับเฉพาะการแจ้งเตือนบนเว็บ (ไม่นับคู่ LINE ที่ส่งควบไปด้วย)`

*หมายเหตุ:* งานค้างอัปเดตยังเตือนบนเว็บเหมือนเดิม ส่วนช่องทาง LINE ย้ายไปอยู่กับสรุปรายวันของ Task 3 แล้ว

- [ ] **Step 4: แก้ AppContext — ปุ่มทดสอบยิงของจริง**

แทนที่ `sendTestLineNotify` ทั้งฟังก์ชัน (บรรทัด 633-651) ด้วย:

```tsx
  const sendTestLineMessage = () => {
    void run(async () => {
      await lineApi.enqueueLineMessage(
        db,
        'test',
        '🧪 ทดสอบระบบแจ้งเตือน NP Taskwork — ถ้าเห็นข้อความนี้แปลว่าเชื่อมต่อกลุ่มสำเร็จแล้ว'
      );
    });
  };
```

- [ ] **Step 5: แก้ AppContext — สวิตช์ LINE ระดับระบบ**

แทนที่ `const lineNotifyEnabled = ...` (บรรทัด 146) และ `toggleLineNotify` (บรรทัด 524-531) ด้วย:

```tsx
  const [lineEnabled, setLineEnabled] = useState(false);

  // อ่านค่าสวิตช์ LINE ตอนเข้าระบบ — ผู้ใช้ทั่วไปอ่านไม่ได้ตาม RLS จึงได้ false ไป
  useEffect(() => {
    if (!db) return;
    void (async () => {
      try {
        const config = await lineApi.fetchLineConfig(db);
        setLineEnabled(config?.enabled ?? false);
      } catch {
        setLineEnabled(false);
      }
    })();
  }, [db, currentUser?.id]);

  const toggleLineEnabled = () => {
    const next = !lineEnabled;
    setLineEnabled(next);  // ตอบสนองทันที
    void run(async () => {
      try {
        await lineApi.setLineEnabled(db, next);
      } catch (e) {
        setLineEnabled(!next);  // ย้อนกลับถ้าบันทึกไม่ผ่าน
        throw e;
      }
    });
  };
```

แก้ interface ของ context (บรรทัด 29, 53, 107) จาก `lineNotifyEnabled` / `toggleLineNotify` / `sendTestLineNotify: (userId: string) => void` เป็น:

```tsx
  lineEnabled: boolean;
  toggleLineEnabled: () => void;
  sendTestLineMessage: () => void;
```

และแก้ค่าที่ส่งเข้า provider (บรรทัด 747, 756, 779) ให้ตรงกับชื่อใหม่

- [ ] **Step 6: แก้ Navbar — ปุ่ม LINE เฉพาะแอดมิน**

ที่ `src/components/Navbar.tsx` แก้ที่ดึงค่าจาก context (บรรทัด 32-33):

```tsx
    lineEnabled,
    toggleLineEnabled,
```

แทนที่ปุ่ม LINE (บรรทัด 72-86) ด้วย:

```tsx
            {/* สวิตช์ระบบแจ้งเตือน LINE — แอดมินเท่านั้น เพราะเป็นค่าระดับระบบ ไม่ใช่ค่าส่วนตัว */}
            {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && (
              <button
                onClick={toggleLineEnabled}
                className={`inline-flex items-center space-x-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg border transition-all ${
                  lineEnabled
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : 'bg-gray-50 text-gray-400 border-gray-200'
                }`}
                title="เปิด/ปิดการส่งแจ้งเตือนเข้ากลุ่ม LINE ของทีม"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">
                  LINE: {lineEnabled ? 'เปิด' : 'ปิด'}
                </span>
              </button>
            )}
```

ตรวจว่า `currentUser` ถูกดึงมาจาก context แล้วที่บรรทัด 29-35 ถ้ายังไม่มีให้เพิ่มเข้าไป

- [ ] **Step 7: แก้ AdminApprovalView — เหลือปุ่มทดสอบกลุ่มปุ่มเดียว**

ที่ `src/components/AdminApprovalView.tsx`:

1. แก้ที่ดึงจาก context (บรรทัด 25, 27) — ลบ `updateUserNotificationSettings` ออกจากรายการเฉพาะส่วนที่ใช้กับ LINE (ยังต้องใช้กับ `noUpdateAlertHours` อยู่) และเปลี่ยน `sendTestLineNotify` เป็น `sendTestLineMessage`

2. แทนที่ `handleTestLine` (บรรทัด 53-57) ด้วย:

```tsx
  const handleTestLine = () => {
    sendTestLineMessage();
    setTestSuccessMsg('หย่อนข้อความทดสอบเข้าคิวแล้ว — ดูในกลุ่ม LINE ของทีมภายในไม่กี่วินาที');
    setTimeout(() => setTestSuccessMsg(null), 5000);
  };
```

3. แก้ข้อความใน `handleManualCheckTrigger` (บรรทัด 49) ให้เลิกอ้าง LINE Notify:

```tsx
    setTestSuccessMsg(`ส่งการแจ้งเตือนเตือนความจำบนเว็บสำเร็จ ${count} รายการ`);
```

4. ลบคอลัมน์ `<th>สถานะ LINE Notify</th>` (บรรทัด 268) และ `<td>` ของปุ่ม LINE รายคนทั้งก้อน (บรรทัด 388-405) พร้อมตัวแปร `isLineActive` (บรรทัด 276)

5. เพิ่มปุ่มทดสอบระดับกลุ่ม 1 ปุ่มไว้เหนือตาราง (วางถัดจากปุ่มตรวจงานค้างที่มีอยู่แล้ว):

```tsx
          <button
            type="button"
            onClick={handleTestLine}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 transition-colors"
          >
            ทดสอบส่งเข้ากลุ่ม LINE
          </button>
```

- [ ] **Step 8: เพิ่มหน้าสถานะคิว LINE ให้แอดมินเห็น**

ถ้าข้อความส่งไม่ออก ต้องมีที่ให้แอดมินเห็นว่าเกิดอะไรขึ้น ไม่งั้นระบบจะเงียบหายโดยไม่มีใครรู้

เพิ่มใน `src/lib/lineApi.ts`:

```ts
export interface LineOutboxRow {
  id: string;
  kind: string;
  message: string;
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  lastError?: string;
  createdAt: string;
  sentAt?: string;
}

/** ดึงคิวล่าสุดมาแสดงให้แอดมินตรวจ — ผู้ใช้ทั่วไปเรียกแล้วจะได้ลิสต์ว่างตาม RLS */
export async function fetchLineOutbox(db: SupabaseClient, limit = 20): Promise<LineOutboxRow[]> {
  const { data, error } = await db
    .from('line_outbox')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`อ่านคิวข้อความ LINE ไม่สำเร็จ: ${error.message}`);

  return (data ?? []).map(r => ({
    id: r.id,
    kind: r.kind,
    message: r.message,
    status: r.status,
    attempts: r.attempts,
    lastError: r.last_error ?? undefined,
    createdAt: r.created_at,
    sentAt: r.sent_at ?? undefined,
  }));
}
```

เพิ่มแผงแสดงผลใน `src/components/AdminApprovalView.tsx` วางใต้ปุ่ม "ทดสอบส่งเข้ากลุ่ม LINE":

```tsx
  const [lineQueue, setLineQueue] = useState<LineOutboxRow[]>([]);

  // โหลดคิวตอนเปิดหน้า และหลังกดปุ่มทดสอบ
  const reloadLineQueue = useCallback(() => {
    if (!db) return;
    void lineApi.fetchLineOutbox(db).then(setLineQueue).catch(() => setLineQueue([]));
  }, [db]);

  useEffect(reloadLineQueue, [reloadLineQueue]);
```

```tsx
        {lineQueue.length > 0 && (
          <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 text-xs font-bold text-gray-700 flex items-center justify-between">
              <span>คิวข้อความ LINE ล่าสุด</span>
              <button type="button" onClick={reloadLineQueue} className="text-[11px] font-bold text-orange-600">
                รีเฟรช
              </button>
            </div>
            <table className="w-full text-[11px]">
              <thead className="text-left text-gray-500">
                <tr className="border-t border-gray-100">
                  <th className="py-1.5 px-3">เวลา</th>
                  <th className="py-1.5 px-3">ประเภท</th>
                  <th className="py-1.5 px-3">สถานะ</th>
                  <th className="py-1.5 px-3">รายละเอียดข้อผิดพลาด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lineQueue.map(row => (
                  <tr key={row.id}>
                    <td className="py-1.5 px-3 text-gray-500">
                      {new Date(row.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="py-1.5 px-3">{row.kind}</td>
                    <td className="py-1.5 px-3">
                      <span className={
                        row.status === 'sent'   ? 'text-emerald-700 font-bold' :
                        row.status === 'failed' ? 'text-red-700 font-bold'     :
                                                  'text-gray-500 font-bold'
                      }>
                        {row.status === 'sent' ? 'ส่งแล้ว' : row.status === 'failed' ? `ล้มเหลว (${row.attempts} ครั้ง)` : 'รอส่ง'}
                      </span>
                    </td>
                    <td className="py-1.5 px-3 text-red-600">{row.lastError ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
```

เพิ่ม import ที่หัวไฟล์:

```tsx
import * as lineApi from '../lib/lineApi';
import { LineOutboxRow } from '../lib/lineApi';
```

และแก้ `handleTestLine` ให้เรียก `reloadLineQueue()` หลังหย่อนข้อความเข้าคิว 2 วินาที เพื่อให้เห็นผลว่าส่งสำเร็จไหม:

```tsx
  const handleTestLine = () => {
    sendTestLineMessage();
    setTestSuccessMsg('หย่อนข้อความทดสอบเข้าคิวแล้ว — ดูในกลุ่ม LINE ของทีมภายในไม่กี่วินาที');
    setTimeout(() => { setTestSuccessMsg(null); reloadLineQueue(); }, 5000);
  };
```

- [ ] **Step 9: ตรวจว่าคอมไพล์ผ่าน**

```bash
npm run lint
```

Expected: ผ่าน ไม่มี error — ถ้ายังฟ้องเรื่อง `lineNotifyEnabled` ให้ไปทำ Task 7 ต่อ

- [ ] **Step 10: ทดสอบด้วยมือ**

รัน `npm run dev` แล้วเข้าด้วยบัญชีแอดมิน:

1. ปุ่ม "LINE: เปิด" โผล่บน Navbar → กดสลับ → รีเฟรชหน้า → ค่าต้องคงอยู่
2. เข้าหน้าจัดการผู้ใช้ กด "ทดสอบส่งเข้ากลุ่ม LINE" → ต้องเห็นข้อความในกลุ่ม
3. ส่งประกาศถึงผู้ใช้ 3 คน → ตรวจว่าเข้ากลุ่ม **1 ข้อความ** ไม่ใช่ 3
   ```sql
   select kind, count(*) from line_outbox where kind = 'broadcast' group by kind;
   ```
4. แผง "คิวข้อความ LINE ล่าสุด" แสดงแถวที่เพิ่งส่ง พร้อมสถานะ "ส่งแล้ว"
5. เข้าด้วยบัญชี user ธรรมดา → ปุ่ม LINE และแผงคิวต้องไม่โผล่ และหน้าเว็บต้องไม่มี error ใน console

- [ ] **Step 11: Commit**

```bash
git add src/lib/lineApi.ts src/context/AppContext.tsx src/components/Navbar.tsx src/components/AdminApprovalView.tsx
git commit -m "feat(app): ต่อฝั่งแอปเข้ากับคิวข้อความ LINE"
```

---

## Task 7: ลบของตายที่เหลือจากยุค LINE Notify

**Files:**
- Modify: `src/types.ts:14-15`
- Modify: `src/lib/api.ts:56-57,720-731`
- Modify: `src/lib/supabase.ts:33`
- Modify: `src/context/AppContext.tsx:104,516`
- Modify: `src/components/AdminApprovalView.tsx`
- Create: `db/09_line_cleanup.sql`

**Interfaces:**
- Consumes: ไม่มี (เป็นการลบล้วน)
- Produces: `updateUserSettings(db, userId, settings: { noUpdateAlertHours?: number })` — เหลือพารามิเตอร์เดียว

**ทำไมต้องลบ:** `line_notify_token` ผูกกับ LINE Notify ที่ปิดบริการไปเมื่อ 31 มี.ค. 2025 เก็บไว้มีแต่จะหลอกให้คนเอา token ไปใส่แล้วรอข้อความที่ไม่มีวันมา ส่วน `line_notify_enabled` ไม่มีความหมายเมื่อส่งเข้ากลุ่มรวม เพราะทุกคนในกลุ่มเห็นข้อความเดียวกันอยู่ดี

- [ ] **Step 1: ลบออกจาก `src/types.ts`**

ลบสองบรรทัดนี้ออกจาก interface `User` (บรรทัด 14-15):

```ts
  lineNotifyEnabled?: boolean; // default true
  lineNotifyToken?: string;
```

- [ ] **Step 2: ลบออกจาก `src/lib/api.ts`**

ลบสองบรรทัดใน `mapUser` (บรรทัด 56-57):

```ts
  lineNotifyEnabled: opt(r.line_notify_enabled),
  lineNotifyToken: opt(r.line_notify_token),
```

แก้ `updateUserSettings` (บรรทัด 720-731) ให้เหลือ:

```ts
export async function updateUserSettings(
  db: SupabaseClient,
  userId: string,
  settings: { noUpdateAlertHours?: number }
): Promise<void> {
  const fields: Row = {};
  if (settings.noUpdateAlertHours !== undefined) fields.no_update_alert_hours = settings.noUpdateAlertHours;
  if (Object.keys(fields).length === 0) return;

  const { error } = await db.from('users').update(fields).eq('id', userId);
  if (error) throw new Error(`บันทึกการตั้งค่าไม่สำเร็จ: ${error.message}`);
}
```

- [ ] **Step 3: ลบออกจาก `src/lib/supabase.ts`**

ลบบรรทัด 33 ใน interface `AuthProfile`:

```ts
  line_notify_enabled: boolean;
```

- [ ] **Step 4: ลบออกจาก `src/context/AppContext.tsx`**

แก้ signature ของ `updateUserNotificationSettings` ทั้งใน interface (บรรทัด 104) และตัวฟังก์ชัน (บรรทัด 516) ให้เหลือ:

```tsx
  updateUserNotificationSettings: (
    userId: string,
    settings: { noUpdateAlertHours?: number }
  ) => void;
```

- [ ] **Step 5: ลบออกจาก `src/components/AdminApprovalView.tsx`**

ค้นหาการเรียกที่ยังส่ง `lineNotifyEnabled` เข้าไปแล้วลบทิ้ง:

```bash
grep -n "lineNotifyEnabled\|isLineActive" src/components/AdminApprovalView.tsx
```

ทุกจุดที่เจอควรถูกลบไปแล้วใน Task 6 ถ้ายังเหลือให้ลบให้หมด

- [ ] **Step 6: ตรวจว่าไม่มีของเก่าหลงเหลือ**

```bash
grep -rn "lineNotifyToken\|lineNotifyEnabled\|line_notify_token\|line_notify_sent\|LINE Notify" src/
```

Expected: ไม่เจออะไรเลย

```bash
npm run lint && npm test
```

Expected: ผ่านทั้งคู่

- [ ] **Step 7: เขียน `db/09_line_cleanup.sql`**

```sql
-- =============================================================================
-- NP Taskwork — ระบบติดตามงาน
-- 09_line_cleanup.sql : ลบร่องรอยของ LINE Notify ที่ปิดบริการไปแล้ว
--
-- LINE Notify ปิดบริการถาวรเมื่อ 31 มี.ค. 2025
-- คอลัมน์ line_notify_token จึงใช้ไม่ได้อีก และไม่เคยมีโค้ดไหนอ่านไปใช้ส่งจริง
--
-- line_notify_enabled ก็ไม่มีความหมายแล้วเมื่อส่งเข้ากลุ่มรวม
-- เพราะทุกคนในกลุ่มเห็นข้อความเดียวกันอยู่ดี
-- สวิตช์เปิด/ปิดย้ายไปอยู่ที่ line_config.enabled ระดับระบบแทน
--
-- ค่า 'line_notify_sent' ใน enum notification_type ยังไม่ลบ
-- เพราะข้อมูลเดิมใน 04_seed.sql อ้างถึงอยู่ และ PostgreSQL ลบค่า enum ไม่ได้
-- แต่ไม่มีโค้ดใหม่สร้างค่านี้อีกแล้ว
--
-- รันไฟล์นี้ "หลังจาก" deploy โค้ดฝั่งแอปเวอร์ชันใหม่แล้วเท่านั้น
-- ไฟล์นี้รันซ้ำได้
-- =============================================================================

begin;

alter table users drop column if exists line_notify_token;
alter table users drop column if exists line_notify_enabled;

commit;
```

- [ ] **Step 8: รันแล้วตรวจว่าแอปยังทำงานได้**

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f db/09_line_cleanup.sql
npm run dev
```

เข้าเว็บ ล็อกอิน เปิดกระดาน Kanban และหน้าจัดการผู้ใช้ — ต้องไม่มี error ใน console

- [ ] **Step 9: เพิ่มไฟล์ใหม่ใน `db/README.md`**

เพิ่มบรรทัดต่อจาก `08_line_schedule.sql`:

```markdown
| `09_line_cleanup.sql` | ลบคอลัมน์ `line_notify_token` / `line_notify_enabled` ที่ตายไปพร้อม LINE Notify — รันหลัง deploy แอปเวอร์ชันใหม่ |
```

- [ ] **Step 10: Commit**

```bash
git add src/types.ts src/lib/api.ts src/lib/supabase.ts src/context/AppContext.tsx src/components/AdminApprovalView.tsx db/09_line_cleanup.sql db/README.md
git commit -m "refactor: ลบร่องรอย LINE Notify ที่ปิดบริการไปแล้ว"
```

---

## ตรวจครั้งสุดท้ายก่อนปิดงาน

- [ ] `npm run lint` ผ่าน
- [ ] `npm test` ผ่าน
- [ ] `psql -f db/tests/07_line_integration_test.sql` ขึ้น `ผ่านทุกเคส`
- [ ] `grep -rn "LINE Notify" src/` ไม่เจออะไร
- [ ] ตีกลับงานจริง → ข้อความเข้ากลุ่ม LINE จริง
- [ ] `select jobname, active from cron.job where jobname like 'line_%'` ได้ 2 แถว active
- [ ] เฝ้าดู `select status, count(*) from line_outbox group by status` ไปอีก 1 สัปดาห์ — ต้องไม่มี `failed` ค้าง
