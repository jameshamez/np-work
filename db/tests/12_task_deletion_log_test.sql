-- =============================================================================
-- ทดสอบ 12_task_deletion_log.sql — ประวัติการลบการ์ดงาน
-- รัน: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f db/tests/12_task_deletion_log_test.sql
--
-- ⚠️ รันกับฐานข้อมูลทดสอบเท่านั้น
--
-- ทั้งไฟล์อยู่ใน transaction เดียวที่ rollback ท้ายสุด
-- ผ่าน = รันจบโดยไม่มี error
--
-- หมายเหตุเรื่องการปลอมตัวเป็นผู้ใช้: ตั้ง request.jwt ทั้งสองแบบ เพราะ auth.uid()
-- ตัวจริงของ Supabase อ่าน request.jwt.claims (JSON) ส่วน stub ใน 01_schema.sql
-- ที่ใช้ตอนรันบน Postgres ธรรมดาอ่าน request.jwt.claim.sub — ตั้งคู่กันแล้วผ่านทั้งสองที่
-- =============================================================================
begin;

insert into users (id, auth_user_id, username, full_name, email, role, status) values
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a8',
  'admin_deleter','แอดมิน ผู้ลบ','admin_del@example.com','admin','approved'),
 ('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a9',
  'owner_person','เจ้าของ งาน','owner_del@example.com','user','approved');

insert into projects (id, name) values
 ('00000000-0000-0000-0000-0000000000a3','โครงการทดสอบประวัติการลบ');

insert into tasks (id, project_id, title, assigned_to_user_id, deadline_at, category, status)
values ('00000000-0000-0000-0000-0000000000a4','00000000-0000-0000-0000-0000000000a3',
        'งานที่จะถูกลบทิ้ง','00000000-0000-0000-0000-0000000000a2',
        now() + interval '3 days','general','returned');

insert into task_logs (task_id, action_by_user_id, action_by_user_name,
                       on_behalf_of_user_id, on_behalf_of_user_name, new_status)
values ('00000000-0000-0000-0000-0000000000a4','00000000-0000-0000-0000-0000000000a2','เจ้าของ งาน',
        '00000000-0000-0000-0000-0000000000a2','เจ้าของ งาน','pending_review'),
       ('00000000-0000-0000-0000-0000000000a4','00000000-0000-0000-0000-0000000000a1','แอดมิน ผู้ลบ',
        '00000000-0000-0000-0000-0000000000a2','เจ้าของ งาน','returned');

-- ---------------------------------------------------------------------------
-- เคส 1 : ลบการ์ดงาน -> มีประวัติการลบ 1 แถว เก็บ snapshot ครบและรู้ว่าใครลบ
-- ---------------------------------------------------------------------------
set local request.jwt.claim.sub to '00000000-0000-0000-0000-0000000000a8';
set local request.jwt.claims   to '{"sub":"00000000-0000-0000-0000-0000000000a8"}';

delete from tasks where id = '00000000-0000-0000-0000-0000000000a4';

do $$
declare r record;
begin
  select * into r from task_deletion_log
   where task_id = '00000000-0000-0000-0000-0000000000a4';

  assert r.id is not null,          'เคส 1 ล้มเหลว: ไม่มีแถวประวัติการลบเลย';
  assert r.task_title = 'งานที่จะถูกลบทิ้ง',
    format('เคส 1 ล้มเหลว: task_title ผิด ได้ %s', r.task_title);
  assert r.project_name = 'โครงการทดสอบประวัติการลบ',
    format('เคส 1 ล้มเหลว: project_name ผิด ได้ %s', r.project_name);
  assert r.assigned_to_name = 'เจ้าของ งาน',
    format('เคส 1 ล้มเหลว: assigned_to_name ผิด ได้ %s', r.assigned_to_name);
  assert r.last_status = 'returned',
    format('เคส 1 ล้มเหลว: last_status ผิด ได้ %s', r.last_status);
  assert r.deleted_by_user_id = '00000000-0000-0000-0000-0000000000a1',
    format('เคส 1 ล้มเหลว: ระบุคนลบผิด ได้ %s', r.deleted_by_user_id);
  assert r.deleted_by_name = 'แอดมิน ผู้ลบ',
    format('เคส 1 ล้มเหลว: ชื่อคนลบผิด ได้ %s', r.deleted_by_name);
  assert r.task_logs_removed = 2,
    format('เคส 1 ล้มเหลว: ควรนับประวัติที่หายไป 2 แถว ได้ %s', r.task_logs_removed);
end $$;

-- ---------------------------------------------------------------------------
-- เคส 2 : ลบนอกหน้าเว็บ (ไม่มี JWT เช่น SQL Editor / service_role)
--         -> ยังต้องบันทึกไว้ แต่ระบุชัดว่าไม่ทราบตัวคนลบ
-- ---------------------------------------------------------------------------
do $$ begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims',    '', true);
end $$;

insert into tasks (id, project_id, title, assigned_to_user_id, deadline_at, category)
values ('00000000-0000-0000-0000-0000000000a5','00000000-0000-0000-0000-0000000000a3',
        'งานที่ถูกลบนอกหน้าเว็บ','00000000-0000-0000-0000-0000000000a2',
        now() + interval '3 days','general');

delete from tasks where id = '00000000-0000-0000-0000-0000000000a5';

do $$
declare r record;
begin
  select * into r from task_deletion_log
   where task_id = '00000000-0000-0000-0000-0000000000a5';

  assert r.id is not null, 'เคส 2 ล้มเหลว: ลบนอกหน้าเว็บแล้วไม่บันทึกประวัติ';
  assert r.deleted_by_user_id is null,
    format('เคส 2 ล้มเหลว: ไม่ควรระบุตัวคนลบได้ แต่ได้ %s', r.deleted_by_user_id);
  assert r.deleted_by_name <> '',
    'เคส 2 ล้มเหลว: ต้องมีข้อความบอกว่าลบมาจากนอกหน้าเว็บ';
end $$;

-- ---------------------------------------------------------------------------
-- เคส 3 : ห้ามแก้ประวัติการลบ
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    update task_deletion_log set deleted_by_name = 'คนอื่น'
     where task_id = '00000000-0000-0000-0000-0000000000a4';
    raise exception 'เคส 3 ล้มเหลว: แก้ประวัติการลบได้ ทั้งที่ต้องถูกปฏิเสธ';
  exception when restrict_violation then
    null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- เคส 4 : ห้ามลบประวัติการลบ — ไม่มีข้อยกเว้นใด ๆ ต่างจาก task_logs
--         (การ์ดงานแม่หายไปแล้ว แต่ก็ยังลบแถวนี้ทิ้งไม่ได้)
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    delete from task_deletion_log where task_id = '00000000-0000-0000-0000-0000000000a4';
    raise exception 'เคส 4 ล้มเหลว: ลบประวัติการลบทิ้งได้ ทั้งที่ต้องถูกปฏิเสธ';
  exception when restrict_violation then
    null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- เคส 5 : ลบ users ที่เคยลบงาน -> ต้องไม่พัง และชื่อคนลบต้องยังอยู่
--         (ประวัติการลบห้ามผูก foreign key กับ users มิฉะนั้น on delete set null
--          จะกลายเป็น UPDATE แล้วชนกำแพง append-only ของตัวเอง)
-- ---------------------------------------------------------------------------
do $$
declare v_name text;
begin
  delete from users where id = '00000000-0000-0000-0000-0000000000a1';

  select deleted_by_name into v_name from task_deletion_log
   where task_id = '00000000-0000-0000-0000-0000000000a4';

  assert v_name = 'แอดมิน ผู้ลบ',
    format('เคส 5 ล้มเหลว: ชื่อคนลบหายหรือเพี้ยน ได้ %s', v_name);
end $$;

rollback;
