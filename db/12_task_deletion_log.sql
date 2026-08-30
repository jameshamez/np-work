-- =============================================================================
-- NP Taskwork — ระบบติดตามงาน
-- 12_task_deletion_log.sql : ประวัติการลบการ์ดงาน — รันซ้ำได้
--
-- ปัญหา
--   11_task_delete_cascade.sql เปิดให้แอดมินลบการ์ดงานได้จริง แต่พอลบแล้วแถวใน
--   task_logs ถูกลบตามไปด้วย และ v_audit_log ก็ join กับ tasks ที่หายไปแล้ว
--   ผลคือลบเสร็จไม่เหลือร่องรอยเลยว่าใครลบ ลบเมื่อไหร่ ลบงานใบไหน
--   ระบบอุตส่าห์ทำ task_logs เป็น append-only เพื่อให้ประวัติเชื่อถือได้
--   แต่การลบการ์ดกลายเป็นช่องลบประวัติทิ้งได้อยู่ดี
--
-- การแก้
--   ตาราง task_deletion_log เก็บ snapshot ของการ์ดไว้ "นอก" วงจรการลบ
--   เขียนด้วย trigger before delete on tasks ซึ่งทำงานก่อนที่ cascade จะกวาดแถวลูก
--   จึงยังนับได้ว่าประวัติกับไฟล์แนบหายไปกี่รายการ
--
-- ทำไมไม่มี foreign key สักตัวในตารางนี้
--   * task_id ผูกไม่ได้อยู่แล้ว เพราะการ์ดถูกลบไปแล้วตอนบันทึก
--   * deleted_by_user_id ก็ไม่ผูก ถ้าผูกแบบ on delete set null การลบผู้ใช้จะกลายเป็น
--     UPDATE บนตารางนี้ แล้วไปชนกำแพง append-only ของตัวเอง ทำให้ลบผู้ใช้ไม่ได้อีกเลย
--     (เป็นกับดักตัวเดียวกับที่ทำให้ลบการ์ดงานไม่ได้มาตลอด ดู 11_task_delete_cascade.sql)
--   ตารางนี้จึงเก็บทั้ง id และ "ชื่อ ณ ตอนนั้น" เป็น text ควบคู่กัน
--   หลักฐานย้อนหลังต้องอ่านออกแม้โครงการ ผู้ใช้ หรือการ์ดจะถูกลบทิ้งไปหมดแล้ว
--
-- ล็อกแน่นกว่า task_logs
--   task_logs ยอมให้ลบตามการ์ดแม่ได้ แต่ตารางนี้ห้าม UPDATE/DELETE ทุกกรณี
--   ไม่มีข้อยกเว้น เพราะไม่มีแถวแม่ให้ cascade อีกแล้ว
-- =============================================================================

begin;

create table if not exists task_deletion_log (
  id                  uuid primary key default gen_random_uuid(),

  -- snapshot ของการ์ดงาน ณ วินาทีที่ถูกลบ (ไม่มี foreign key โดยตั้งใจ — ดูหัวไฟล์)
  task_id             uuid        not null,
  task_code           text        not null,
  task_title          text        not null,
  project_name        text        not null default '',
  assigned_to_name    text        not null default '',
  last_status         task_status not null,
  task_created_at     timestamptz not null,

  -- ใครลบ
  deleted_by_user_id  uuid,
  deleted_by_name     text        not null,
  deleted_at          timestamptz not null default now(),

  -- ลบแล้วพาอะไรหายไปด้วยบ้าง
  task_logs_removed   integer     not null default 0,
  attachments_removed integer     not null default 0
);

comment on table task_deletion_log is
  'ประวัติการลบการ์ดงาน — append-only เต็มรูปแบบ ห้ามแก้และห้ามลบทุกกรณี';

create index if not exists task_deletion_log_time_idx  on task_deletion_log (deleted_at desc);
create index if not exists task_deletion_log_actor_idx on task_deletion_log (deleted_by_user_id, deleted_at desc);

-- -----------------------------------------------------------------------------
-- บันทึกก่อนการ์ดจะหาย
--
-- before delete จำเป็น ไม่ใช่แค่สะดวก: หลังแถวใน tasks หายไป cascade จะกวาด
-- task_logs กับ attachments ทิ้งทันที ถ้าไปนับตอน after delete จะได้ 0 เสมอ
--
-- security definer เพราะ RLS ของตารางนี้ไม่มี policy สำหรับ insert เลย
-- ทางเดียวที่แถวจะเกิดได้คือผ่าน trigger ตัวนี้
-- -----------------------------------------------------------------------------
create or replace function trg_task_log_deletion() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_actor_id   uuid := app_current_user_id();
  v_actor_name text;
  v_logs       integer;
  v_atts       integer;
begin
  select full_name into v_actor_name from users where id = v_actor_id;

  select count(*) into v_logs from task_logs   where task_id = old.id;
  select count(*) into v_atts from attachments where task_id = old.id;

  insert into task_deletion_log (
    task_id, task_code, task_title, project_name, assigned_to_name,
    last_status, task_created_at,
    deleted_by_user_id, deleted_by_name,
    task_logs_removed, attachments_removed
  ) values (
    old.id, old.code, old.title,
    coalesce((select name      from projects where id = old.project_id), ''),
    coalesce((select full_name from users    where id = old.assigned_to_user_id), ''),
    old.status, old.created_at,
    v_actor_id,
    -- ไม่มี JWT = ลบมาจาก SQL Editor, service_role หรือสคริปต์ ระบุตัวคนไม่ได้
    -- แต่ต้องบันทึกไว้ให้เห็นว่ามีการลบเกิดขึ้น ห้ามเงียบ
    coalesce(nullif(v_actor_name, ''), 'ไม่ทราบผู้ลบ (ลบนอกหน้าเว็บ เช่น SQL Editor หรือ service_role)'),
    v_logs, v_atts
  );

  return old;
end;
$$;

drop trigger if exists tasks_log_deletion on tasks;
create trigger tasks_log_deletion before delete on tasks
  for each row execute function trg_task_log_deletion();

-- -----------------------------------------------------------------------------
-- append-only เต็มรูปแบบ — กันแม้แต่ service_role และคนที่ต่อฐานข้อมูลตรง ๆ
-- -----------------------------------------------------------------------------
create or replace function trg_block_write_strict() returns trigger
language plpgsql as $$
begin
  raise exception 'task_deletion_log เป็นหลักฐานการลบงาน: ห้าม % ทุกกรณี', tg_op
    using errcode = 'restrict_violation';
end;
$$;

drop trigger if exists task_deletion_log_readonly on task_deletion_log;
create trigger task_deletion_log_readonly before update or delete on task_deletion_log
  for each row execute function trg_block_write_strict();

-- -----------------------------------------------------------------------------
-- RLS — แอดมินขึ้นไปอ่านได้ ไม่มี policy เขียนเลย (เขียนผ่าน trigger เท่านั้น)
-- -----------------------------------------------------------------------------
alter table task_deletion_log enable row level security;

drop policy if exists task_deletion_log_select_admin on task_deletion_log;
create policy task_deletion_log_select_admin on task_deletion_log
  for select using (app_is_admin());

-- -----------------------------------------------------------------------------
-- Grants — ตารางนี้เกิดหลัง 03_rls.sql จึงไม่ได้รับ grant เหวี่ยงแหจากไฟล์นั้น
-- ให้แค่ select ส่วน insert/update/delete ไม่ให้ใครเลย
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select on task_deletion_log to authenticated;
    revoke insert, update, delete on task_deletion_log from authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on task_deletion_log from anon;
  end if;
end
$$;

commit;
