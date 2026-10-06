-- =============================================================================
-- NP Taskwork — ระบบติดตามงาน
-- 18_project_delete_super_admin.sql : ลบโครงการได้เฉพาะ Super Admin — รันซ้ำได้
--
-- เดิม policy projects_write_admin เป็น "for all" ให้ admin ทุกคนลบโครงการได้
-- แยกเป็น insert / update สำหรับ admin เหมือนเดิม ส่วน delete เหลือแค่ super_admin
--
-- โครงการที่ยังมีการ์ดงานอยู่ลบไม่ได้อยู่แล้ว (tasks.project_id เป็น on delete restrict)
-- ตั้งใจไม่เปลี่ยนเป็น cascade — ลบโครงการไม่ควรพาการ์ดงานและประวัติทั้งหมดหายไปด้วย
--
-- ต้องรันหลัง 03_rls.sql
-- =============================================================================

begin;

drop policy if exists projects_write_admin         on projects;
drop policy if exists projects_insert_admin        on projects;
drop policy if exists projects_update_admin        on projects;
drop policy if exists projects_delete_super_admin  on projects;

create policy projects_insert_admin on projects
  for insert with check (app_is_admin());

create policy projects_update_admin on projects
  for update using (app_is_admin()) with check (app_is_admin());

create policy projects_delete_super_admin on projects
  for delete using (app_is_admin() and app_current_role() = 'super_admin');

commit;
