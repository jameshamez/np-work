-- =============================================================================
-- NP Taskwork — ระบบติดตามงาน
-- 11_task_delete_cascade.sql : ปลดล็อกให้ลบการ์ดงานได้จริง — รันซ้ำได้
--
-- ปัญหา
--   policy tasks_delete_admin ใน 03_rls.sql เปิดสิทธิ์ให้ admin ลบการ์ดงานไว้ตั้งแต่ต้น
--   แต่ลบจริงไม่เคยสำเร็จเลยสักครั้ง เพราะ task_logs.task_id เป็น on delete cascade
--   พอสั่ง DELETE ที่ tasks แล้ว Postgres จะสั่ง DELETE ต่อไปยัง task_logs ให้อัตโนมัติ
--   คำสั่งนั้นไปโดน trigger task_logs_no_update (trg_block_write) ที่ห้าม DELETE ทุกกรณี
--   ทั้ง transaction จึง rollback พร้อม error
--     "task_logs เป็น audit log แบบ append-only: ห้าม DELETE แถวที่บันทึกแล้ว"
--
-- การแก้
--   ให้ trg_block_write ยอมให้ลบแถวได้เฉพาะตอนที่การ์ดงานแม่ถูกลบไปแล้วเท่านั้น
--
--   ระหว่าง cascade ฐานข้อมูลลบแถวใน tasks ไปก่อนแล้วค่อยไล่ลบแถวลูก ตอน trigger นี้ทำงาน
--   จึงมองไม่เห็นการ์ดงานแม่อีกต่อไป — ใช้จุดนี้แยกว่า "โดนลบตามแม่" กับ "ตั้งใจลบประวัติทิ้ง"
--
--   การรับประกันเดิมยังอยู่ครบ:
--     * UPDATE ยังห้ามทุกกรณีเหมือนเดิม
--     * DELETE ตรง ๆ ที่ task_logs ยังถูกปฏิเสธ เพราะการ์ดงานแม่ยังอยู่
--       (จริงอยู่ว่า RLS ไม่มี policy DELETE ให้ task_logs อยู่แล้ว แต่ trigger ตัวนี้คือด่าน
--        ที่กัน service_role กับคนที่ต่อฐานข้อมูลตรง ๆ ซึ่ง RLS กันไม่ได้)
--     * ประวัติกำพร้าเกิดไม่ได้ เพราะ task_id เป็น not null และผูก foreign key ไว้
--     * ลบการ์ดงานได้เฉพาะ admin ขึ้นไป ตาม policy tasks_delete_admin เหมือนเดิม
--
--   ตั้งเป็น security definer เพื่อให้การเช็คว่า "การ์ดงานแม่ยังอยู่ไหม" เชื่อถือได้เสมอ
--   ไม่ใช่คำตอบที่เปลี่ยนไปตาม RLS ของคนเรียก (ถ้าเช็คแบบ invoker คนที่มองไม่เห็นการ์ด
--   ใบนั้นจะได้คำตอบว่า "ไม่มีแม่แล้ว" ซึ่งเป็นการเปิดช่องโดยไม่ตั้งใจ)
--   ห้ามเปิด force row level security ให้ tasks มิฉะนั้นการเช็คนี้จะเพี้ยน
-- =============================================================================

begin;

create or replace function trg_block_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- ลบตามการ์ดงานแม่ที่เพิ่งถูกลบไป (on delete cascade) — ปล่อยผ่าน
  if tg_op = 'DELETE' and not exists (select 1 from tasks where id = old.task_id) then
    return old;
  end if;

  raise exception 'task_logs เป็น audit log แบบ append-only: ห้าม % แถวที่บันทึกแล้ว', tg_op
    using errcode = 'restrict_violation';
end;
$$;

-- ฐานข้อมูลที่ติดตั้งไว้ก่อนหน้านี้ผูก trigger ไว้แล้ว บรรทัดนี้เผื่อกรณีที่ยังไม่มี
drop trigger if exists task_logs_no_update on task_logs;
create trigger task_logs_no_update before update or delete on task_logs
  for each row execute function trg_block_write();

commit;
