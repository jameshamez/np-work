-- =============================================================================
-- NP Taskwork — ระบบติดตามงาน
-- 17_checklist_completed_by.sql : เก็บว่าใครติ๊ก checklist — รันซ้ำได้
--
-- ปัญหา
--   หน้ารายละเอียดการ์ดแสดง "ผู้ร่วมทำงานแทน" (คนที่มาทำการ์ดนอกจากผู้รับผิดชอบหลัก
--   และผู้ที่ถูกส่งงานต่อ) แต่การติ๊ก checklist ไม่ได้บันทึกว่าใครเป็นคนติ๊ก
--   คนที่เข้ามาติ๊กงานแทนจึงไม่ขึ้นชื่อ
--
-- การแก้
--   เพิ่ม completed_by_user_id / completed_at แล้วให้ trigger เป็นคนเติม
--   ไม่เชื่อค่าที่ส่งมาจากหน้าเว็บ — ไม่งั้นใครก็ใส่ชื่อคนอื่นเป็นผู้ติ๊กได้
--     * ติ๊กสำเร็จ / เปลี่ยนผลเป็นสำเร็จ–ไม่สำเร็จ -> ผู้ติ๊ก = ผู้ใช้ที่ล็อกอินอยู่
--     * เอาติ๊กออก                              -> ล้างผู้ติ๊ก
--   ถ้าไม่มี JWT (รันจาก SQL editor / service_role) ยอมรับค่าที่ส่งมาตรง ๆ
--   เหมือนหลักใน trg_users_guard_privileged_columns (03_rls.sql)
--
-- ต้องรันหลัง 03_rls.sql
-- =============================================================================

begin;

alter table task_checklist_items
  add column if not exists completed_by_user_id uuid references users (id) on delete set null,
  add column if not exists completed_at         timestamptz;

comment on column task_checklist_items.completed_by_user_id is
  'ผู้ติ๊กรายการนี้ล่าสุด — trigger เติมให้จาก session ไม่รับค่าจากหน้าเว็บ';

create or replace function trg_checklist_completed_by() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if not new.completed then
    new.completed_by_user_id := null;
    new.completed_at         := null;
  elsif tg_op = 'INSERT'
     or not old.completed
     or new.result_status is distinct from old.result_status then
    new.completed_by_user_id := app_current_user_id();
    new.completed_at         := now();
  else
    -- แก้อย่างอื่น (เช่น ชื่อรายการ) ไม่เปลี่ยนผู้ติ๊ก และห้ามแก้ผู้ติ๊กเอง
    new.completed_by_user_id := old.completed_by_user_id;
    new.completed_at         := old.completed_at;
  end if;

  return new;
end;
$$;

drop trigger if exists checklist_completed_by on task_checklist_items;
create trigger checklist_completed_by
  before insert or update on task_checklist_items
  for each row execute function trg_checklist_completed_by();

commit;
