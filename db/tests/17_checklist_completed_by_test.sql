-- =============================================================================
-- ทดสอบ 17_checklist_completed_by.sql — บันทึกผู้ติ๊ก checklist
-- รัน: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f db/tests/17_checklist_completed_by_test.sql
--
-- ⚠️ รันกับฐานข้อมูลทดสอบเท่านั้น — ทั้งไฟล์ rollback ท้ายสุด ผ่าน = รันจบโดยไม่มี error
-- (ตั้ง request.jwt ทั้งสองแบบ ดูเหตุผลใน 12_task_deletion_log_test.sql)
-- =============================================================================
begin;

insert into users (id, auth_user_id, username, full_name, email, role, status) values
 ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000c8',
  'helper_person','คน ช่วยทำ','helper@example.com','admin','approved'),
 ('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-0000000000c9',
  'card_owner','เจ้าของ การ์ด','card_owner@example.com','user','approved');

insert into projects (id, name) values ('00000000-0000-0000-0000-0000000000c3','โครงการทดสอบผู้ติ๊ก');

insert into tasks (id, project_id, title, assigned_to_user_id, deadline_at, category, status)
values ('00000000-0000-0000-0000-0000000000c4','00000000-0000-0000-0000-0000000000c3',
        'งานทดสอบผู้ติ๊ก','00000000-0000-0000-0000-0000000000c2',
        now() + interval '3 days','general','pending_submission');

insert into task_checklist_items (id, task_id, title)
values ('00000000-0000-0000-0000-0000000000c5','00000000-0000-0000-0000-0000000000c4','รายการ 1');

set local request.jwt.claim.sub to '00000000-0000-0000-0000-0000000000c8';
set local request.jwt.claims   to '{"sub":"00000000-0000-0000-0000-0000000000c8"}';

-- เคส 1 : ติ๊กแล้วบันทึกผู้ติ๊กเป็นคนที่ล็อกอิน แม้หน้าเว็บจะส่งชื่อคนอื่นมา
update task_checklist_items
   set completed = true, result_status = 'success',
       completed_by_user_id = '00000000-0000-0000-0000-0000000000c2'
 where id = '00000000-0000-0000-0000-0000000000c5';

do $$
declare r task_checklist_items;
begin
  select * into r from task_checklist_items where id = '00000000-0000-0000-0000-0000000000c5';
  assert r.completed_by_user_id = '00000000-0000-0000-0000-0000000000c1',
    format('เคส 1 ล้มเหลว: ผู้ติ๊กผิด ได้ %s', r.completed_by_user_id);
  assert r.completed_at is not null, 'เคส 1 ล้มเหลว: ไม่มีเวลาที่ติ๊ก';
end
$$;

-- เคส 2 : เอาติ๊กออก -> ล้างผู้ติ๊ก
update task_checklist_items set completed = false, result_status = null
 where id = '00000000-0000-0000-0000-0000000000c5';

do $$
declare r task_checklist_items;
begin
  select * into r from task_checklist_items where id = '00000000-0000-0000-0000-0000000000c5';
  assert r.completed_by_user_id is null and r.completed_at is null,
    'เคส 2 ล้มเหลว: เอาติ๊กออกแล้วผู้ติ๊กยังค้าง';
end
$$;

\echo 'ผ่านทุกเคส: 17_checklist_completed_by'
rollback;
