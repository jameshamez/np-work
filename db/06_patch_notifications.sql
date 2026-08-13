-- =============================================================================
-- NP Taskwork — ระบบติดตามงาน
-- 06_patch_notifications.sql : เปิดให้ผู้เกี่ยวข้องกับงานส่งแจ้งเตือนหากันได้
--
-- ปัญหาเดิม
--   policy เดิมอนุญาตให้เฉพาะ admin เท่านั้นที่ insert แจ้งเตือนถึงคนอื่นได้
--   ผลคือเวลา user ธรรมดามอบหมายงานให้เพื่อน เพื่อนจะไม่ได้รับแจ้งเตือนเลย
--   (ระบบข้ามเงียบ ๆ เพราะ RLS ปฏิเสธ)
--
-- กติกาใหม่
--   ส่งแจ้งเตือน "เกี่ยวกับงานใบหนึ่ง" ได้ ถ้าทั้งผู้ส่งและผู้รับเป็นคนที่เกี่ยวข้อง
--   กับงานใบนั้น (เจ้าของงาน / ผู้รับงานต่อ / ผู้ตรวจ / ผู้สร้าง หรือเป็น admin)
--   จึงส่งหาใครมั่ว ๆ ไม่ได้ ต้องอยู่ในวงงานเดียวกันเท่านั้น
--
--   ส่วนประกาศที่ไม่ผูกกับงาน (task_id เป็น null) ยังจำกัดไว้ที่ admin เหมือนเดิม
--
-- ไฟล์นี้รันซ้ำได้ และรันตอนไหนก็ได้หลัง 03_rls.sql
-- =============================================================================

begin;

drop policy if exists notifications_insert_admin       on notifications;
drop policy if exists notifications_insert_task_scope  on notifications;

-- admin ส่งได้ทุกกรณี รวมถึงประกาศที่ไม่ผูกกับงาน
create policy notifications_insert_admin on notifications
  for insert with check (app_is_admin());

-- ผู้เกี่ยวข้องกับงานส่งหากันได้ เฉพาะแจ้งเตือนที่อ้างถึงงานใบนั้นจริง ๆ
create policy notifications_insert_task_scope on notifications
  for insert with check (
    app_is_approved()
    and task_id is not null
    and app_can_edit_task(task_id, app_current_user_id())
    and app_can_edit_task(task_id, recipient_user_id)
  );

commit;
