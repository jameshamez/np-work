-- =============================================================================
-- ทดสอบ 07_line_integration.sql
-- รัน: psql "<connection string>" -f db/tests/07_line_integration_test.sql
-- ทั้งไฟล์อยู่ใน transaction เดียวที่ rollback ท้ายสุด จึงไม่ทิ้งข้อมูลค้างไว้
-- ผ่าน = รันจบโดยไม่มี error ใด ๆ
--
-- ⚠️ รันกับฐานข้อมูลทดสอบเท่านั้น ห้ามรันกับฐานข้อมูลที่ใช้งานจริง
--    มีเคสที่ต้อง `delete from tasks` เพื่อทดสอบกรณีไม่มีงานค้าง ถึงจะ rollback
--    ท้ายสุดแต่ระหว่างที่ transaction เปิดอยู่ ตารางจะว่างจริง ๆ และถ้า connection
--    หลุดกลางคันในจังหวะที่ไม่เหมาะสม ก็ไม่คุ้มเสี่ยง
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
-- เคส 6 : แถวที่ค้าง pending แต่ attempts ครบ 5 แล้วต้องหยุดเช่นกัน
--         (จำลอง worker ตายกลางคัน: เคลมไปแล้วบวก attempts แต่ตายก่อนอัปเดต
--         สถานะกลับ แถวจึงค้างที่ pending ตลอดไป ถ้าไม่เช็กเพดานที่นี่ด้วย
--         จะเคลม-ยิง LINE ซ้ำไม่รู้จบ)
-- ---------------------------------------------------------------------------
insert into line_outbox (kind, message, status, attempts, dedupe_key)
values ('test', 'ค้าง pending เพราะ worker ตายกลางคัน', 'pending', 5, 'test:pending ค้างครบโควตา');

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from app_claim_line_outbox(20);
  assert v_count = 0, format('เคส 6 ล้มเหลว: แถว pending ที่ attempts = 5 ต้องไม่ถูกดึงอีก แต่ดึงได้ %s แถว', v_count);
end $$;

-- ---------------------------------------------------------------------------
-- เคส 7 : RLS — ผู้ใช้ทั่วไปแตะ line_outbox ไม่ได้เลย
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000b2"}';

do $$
begin
  begin
    insert into line_outbox (kind, message) values ('broadcast', 'ผู้ใช้ทั่วไปไม่ควรส่งได้');
    raise exception 'เคส 7 ล้มเหลว: ผู้ใช้ทั่วไปไม่ควร insert line_outbox ได้';
  exception when insufficient_privilege then
    null;  -- ถูกต้องแล้ว
  end;
end $$;

do $$
begin
  assert (select count(*) from line_outbox) = 0,
    'เคส 7 ล้มเหลว: ผู้ใช้ทั่วไปไม่ควรเห็นแถวใน line_outbox เลย';
  assert (select count(*) from line_config) = 0,
    'เคส 7 ล้มเหลว: ผู้ใช้ทั่วไปไม่ควรเห็น line_config';
end $$;

-- ---------------------------------------------------------------------------
-- เคส 8 : RLS — แอดมินเห็นและเพิ่มแถวได้
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000b1"}';

insert into line_outbox (kind, message) values ('broadcast', 'ประกาศจากแอดมิน');

do $$
begin
  assert (select count(*) from line_outbox where kind = 'broadcast') = 1,
    'เคส 8 ล้มเหลว: แอดมินต้อง insert line_outbox ได้';
  assert (select count(*) from line_config) = 1,
    'เคส 8 ล้มเหลว: แอดมินต้องเห็น line_config';
end $$;

-- ---------------------------------------------------------------------------
-- เคส 9 : งานถูกตีกลับ -> เข้าคิว LINE 1 แถว, สถานะอื่นไม่เข้าคิว
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
    'เคส 9 ล้มเหลว: งานถูกตีกลับต้องสร้างแถวในคิว LINE 1 แถว';

  select message into v_msg from line_outbox where kind = 'returned';
  assert v_msg like '%TEST-LINE-1%',
    'เคส 9 ล้มเหลว: ข้อความต้องมีรหัสงาน';
  assert v_msg like '%ตรวจแบบถังไอน้ำ%',
    'เคส 9 ล้มเหลว: ข้อความต้องมีชื่องาน';
  assert v_msg like '%ทดสอบ ผู้ใช้%',
    'เคส 9 ล้มเหลว: ข้อความต้องมีชื่อผู้รับผิดชอบ';
end $$;

-- ---------------------------------------------------------------------------
-- เคส 10 : สถานะอื่น ๆ ต้องไม่เข้าคิว LINE
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
    format('เคส 10 ล้มเหลว: งานอนุมัติ/รอตรวจ/สมัครใหม่ ต้องไม่เข้าคิว LINE แต่เข้าไป %s แถว', v_count);
end $$;

reset role;
rollback;

\echo 'ผ่านทุกเคส'
