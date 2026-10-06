-- =============================================================================
-- ทดสอบ 18_project_delete_super_admin.sql — ลบโครงการได้เฉพาะ Super Admin
-- รัน: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f db/tests/18_project_delete_super_admin_test.sql
--
-- ⚠️ รันกับฐานข้อมูลทดสอบเท่านั้น — ทั้งไฟล์ rollback ท้ายสุด ผ่าน = รันจบโดยไม่มี error
-- RLS ไม่มีผลกับ superuser จึงสลับไปใช้ role authenticated ก่อนลบ
-- =============================================================================
begin;

insert into users (id, auth_user_id, username, full_name, email, role, status) values
 ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000d8',
  'proj_super','ซุปเปอร์ โครงการ','proj_super@example.com','super_admin','approved'),
 ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000d9',
  'proj_admin','แอดมิน โครงการ','proj_admin@example.com','admin','approved');

insert into projects (id, name) values
 ('00000000-0000-0000-0000-0000000000d3','โครงการว่างที่จะลบ');

grant select, insert, update, delete on projects to authenticated;
set local role authenticated;

-- เคส 1 : admin ธรรมดาลบไม่ได้ (RLS กรองจนเหลือ 0 แถว)
set local request.jwt.claim.sub to '00000000-0000-0000-0000-0000000000d9';
set local request.jwt.claims   to '{"sub":"00000000-0000-0000-0000-0000000000d9"}';
delete from projects where id = '00000000-0000-0000-0000-0000000000d3';

-- admin ยังเพิ่ม/แก้โครงการได้เหมือนเดิม
insert into projects (id, name) values ('00000000-0000-0000-0000-0000000000d4','โครงการที่ admin สร้าง');
update projects set description = 'แก้โดย admin' where id = '00000000-0000-0000-0000-0000000000d4';

do $$
begin
  assert exists (select 1 from projects where id = '00000000-0000-0000-0000-0000000000d3'),
    'เคส 1 ล้มเหลว: admin ธรรมดาลบโครงการได้';
  assert (select description from projects where id = '00000000-0000-0000-0000-0000000000d4') = 'แก้โดย admin',
    'เคส 1 ล้มเหลว: admin แก้โครงการไม่ได้';
end
$$;

-- เคส 2 : super_admin ลบได้
set local request.jwt.claim.sub to '00000000-0000-0000-0000-0000000000d8';
set local request.jwt.claims   to '{"sub":"00000000-0000-0000-0000-0000000000d8"}';
delete from projects where id = '00000000-0000-0000-0000-0000000000d3';

do $$
begin
  assert not exists (select 1 from projects where id = '00000000-0000-0000-0000-0000000000d3'),
    'เคส 2 ล้มเหลว: super_admin ลบโครงการไม่ได้';
end
$$;

\echo 'ผ่านทุกเคส: 18_project_delete_super_admin'
rollback;
