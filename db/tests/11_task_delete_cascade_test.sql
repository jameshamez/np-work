-- =============================================================================
-- ทดสอบ 11_task_delete_cascade.sql — ลบการ์ดงานแล้วประวัติต้องถูกลบตามไปด้วย
-- รัน: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f db/tests/11_task_delete_cascade_test.sql
--
-- ⚠️ รันกับฐานข้อมูลทดสอบเท่านั้น
--
-- ทั้งไฟล์อยู่ใน transaction เดียวที่ rollback ท้ายสุด
-- ผ่าน = รันจบโดยไม่มี error
-- =============================================================================
begin;

insert into users (id, auth_user_id, username, full_name, email, role, status)
values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d9',
        'test_del_user', 'ทดสอบ ลบงาน', 'test_del@example.com', 'admin', 'approved');

insert into projects (id, name) values ('00000000-0000-0000-0000-0000000000d2', 'โครงการทดสอบการลบ');

insert into tasks (id, project_id, title, assigned_to_user_id, deadline_at, category)
values ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000d2',
        'งานที่จะถูกลบ', '00000000-0000-0000-0000-0000000000d1',
        now() + interval '3 days', 'general');

insert into task_logs (id, task_id, action_by_user_id, action_by_user_name,
                       on_behalf_of_user_id, on_behalf_of_user_name, new_status, comment)
values ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000d3',
        '00000000-0000-0000-0000-0000000000d1', 'ทดสอบ ลบงาน',
        '00000000-0000-0000-0000-0000000000d1', 'ทดสอบ ลบงาน', 'pending_review', 'ส่งตรวจ');

insert into task_checklist_items (task_id, title, sort_order)
values ('00000000-0000-0000-0000-0000000000d3', 'รายการตรวจ 1', 1);

-- ---------------------------------------------------------------------------
-- เคส 1 : ห้าม UPDATE ประวัติ (การรับประกันเดิมต้องยังอยู่)
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    update task_logs set comment = 'แก้ประวัติย้อนหลัง'
     where id = '00000000-0000-0000-0000-0000000000d4';
    raise exception 'เคส 1 ล้มเหลว: แก้ประวัติย้อนหลังได้ ทั้งที่ต้องถูกปฏิเสธ';
  exception when restrict_violation then
    null; -- ถูกปฏิเสธตามที่ควรเป็น
  end;
end $$;

-- ---------------------------------------------------------------------------
-- เคส 2 : ห้าม DELETE ประวัติตรง ๆ ตอนที่การ์ดงานแม่ยังอยู่
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    delete from task_logs where id = '00000000-0000-0000-0000-0000000000d4';
    raise exception 'เคส 2 ล้มเหลว: ลบประวัติทิ้งตรง ๆ ได้ ทั้งที่การ์ดงานแม่ยังอยู่';
  exception when restrict_violation then
    null; -- ถูกปฏิเสธตามที่ควรเป็น
  end;
end $$;

-- ---------------------------------------------------------------------------
-- เคส 3 : ลบการ์ดงาน -> สำเร็จ และประวัติ/ตารางลูกถูกลบตามไปด้วย
--         (นี่คือเคสที่พังก่อนแพตช์ 11 — ตัว DELETE จะโยน restrict_violation)
-- ---------------------------------------------------------------------------
do $$
declare
  v_logs      integer;
  v_checklist integer;
  v_tasks     integer;
begin
  delete from tasks where id = '00000000-0000-0000-0000-0000000000d3';

  select count(*) into v_tasks     from tasks
   where id = '00000000-0000-0000-0000-0000000000d3';
  select count(*) into v_logs      from task_logs
   where task_id = '00000000-0000-0000-0000-0000000000d3';
  select count(*) into v_checklist from task_checklist_items
   where task_id = '00000000-0000-0000-0000-0000000000d3';

  assert v_tasks = 0,     format('เคส 3 ล้มเหลว: การ์ดงานยังอยู่ %s แถว', v_tasks);
  assert v_logs = 0,      format('เคส 3 ล้มเหลว: ประวัติเหลือค้าง %s แถว', v_logs);
  assert v_checklist = 0, format('เคส 3 ล้มเหลว: รายการตรวจเหลือค้าง %s แถว', v_checklist);
end $$;

rollback;
