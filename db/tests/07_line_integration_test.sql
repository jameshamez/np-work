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

-- ---------------------------------------------------------------------------
-- เคส 11 : ไม่มีงานค้างเลย -> ไม่ส่งข้อความ (ไม่ทิ้งโควตาไปกับ "วันนี้ไม่มีงานค้าง")
-- ---------------------------------------------------------------------------
delete from line_outbox;
delete from tasks;

do $$
begin
  assert app_build_line_digest() is null,
    'เคส 11 ล้มเหลว: ไม่มีงานค้างต้องคืน null';
  assert app_enqueue_line_digest() is null,
    'เคส 11 ล้มเหลว: ไม่มีงานค้างต้องไม่สร้างแถวในคิว';
  assert (select count(*) from line_outbox) = 0,
    'เคส 11 ล้มเหลว: คิวต้องว่าง';
end $$;

-- ---------------------------------------------------------------------------
-- เคส 12 : มีงานครบสามหมวด -> ข้อความมีครบสามหัวข้อ
-- ---------------------------------------------------------------------------
-- งานเลยกำหนด (ต้องย้อน created_at ด้วย เพราะมี check deadline_at >= created_at)
insert into tasks (code, project_id, title, assigned_to_user_id,
                   created_at, deadline_at, last_updated_at, status)
values ('TEST-OVERDUE-1', '00000000-0000-0000-0000-0000000000c1', 'งานเลยกำหนด',
        '00000000-0000-0000-0000-0000000000a2',
        now() - interval '10 days', now() - interval '2 days', now(), 'pending_submission');

-- งานค้างอัปเดตเกิน 4 ชม. แต่ยังไม่เลยกำหนด
insert into tasks (code, project_id, title, assigned_to_user_id,
                   created_at, deadline_at, last_updated_at, status)
values ('TEST-STALE-1', '00000000-0000-0000-0000-0000000000c1', 'งานค้างอัปเดต',
        '00000000-0000-0000-0000-0000000000a2',
        now() - interval '2 days', now() + interval '5 days',
        now() - interval '6 hours', 'pending_submission');

-- งานรอตรวจ
insert into tasks (code, project_id, title, assigned_to_user_id,
                   created_at, deadline_at, last_updated_at, status)
values ('TEST-REVIEW-1', '00000000-0000-0000-0000-0000000000c1', 'งานรอตรวจ',
        '00000000-0000-0000-0000-0000000000a2',
        now() - interval '1 day', now() + interval '5 days', now(), 'pending_review');

do $$
declare
  v_msg text;
begin
  v_msg := app_build_line_digest();
  assert v_msg is not null, 'เคส 12 ล้มเหลว: ต้องได้ข้อความสรุป';
  assert v_msg like '%เลยกำหนด%',      'เคส 12 ล้มเหลว: ต้องมีหัวข้องานเลยกำหนด';
  assert v_msg like '%TEST-OVERDUE-1%', 'เคส 12 ล้มเหลว: ต้องมีงานเลยกำหนดในรายการ';
  assert v_msg like '%ค้างอัปเดต%',     'เคส 12 ล้มเหลว: ต้องมีหัวข้องานค้างอัปเดต';
  assert v_msg like '%TEST-STALE-1%',   'เคส 12 ล้มเหลว: ต้องมีงานค้างอัปเดตในรายการ';
  assert v_msg like '%รอตรวจ%',         'เคส 12 ล้มเหลว: ต้องมีหัวข้องานรอตรวจ';
  assert v_msg like '%TEST-REVIEW-1%',  'เคส 12 ล้มเหลว: ต้องมีงานรอตรวจในรายการ';
end $$;

-- ---------------------------------------------------------------------------
-- เคส 13 : งานอนุมัติแล้วต้องไม่โผล่ในสรุป แม้จะเลยกำหนดไปแล้ว
-- ---------------------------------------------------------------------------
insert into tasks (code, project_id, title, assigned_to_user_id,
                   created_at, deadline_at, last_updated_at, status, completed_at)
values ('TEST-DONE-1', '00000000-0000-0000-0000-0000000000c1', 'งานปิดแล้ว',
        '00000000-0000-0000-0000-0000000000a2',
        now() - interval '10 days', now() - interval '5 days', now(), 'approved', now());

do $$
begin
  assert app_build_line_digest() not like '%TEST-DONE-1%',
    'เคส 13 ล้มเหลว: งานที่อนุมัติแล้วต้องไม่โผล่ในสรุป';
end $$;

-- ---------------------------------------------------------------------------
-- เคส 14 : เกิน 10 ใบต่อหมวด -> ตัดที่ 10 แล้วบอกว่าเหลืออีกกี่ใบ
-- ---------------------------------------------------------------------------
insert into tasks (code, project_id, title, assigned_to_user_id,
                   created_at, deadline_at, last_updated_at, status)
select 'TEST-BULK-' || g, '00000000-0000-0000-0000-0000000000c1', 'งานล้นหมวด ' || g,
       '00000000-0000-0000-0000-0000000000a2',
       now() - interval '10 days', now() - interval '3 days', now(), 'pending_submission'
from generate_series(1, 14) g;

do $$
declare
  v_msg   text;
  v_lines integer;
begin
  v_msg := app_build_line_digest();
  -- รวมงานเลยกำหนด 15 ใบ (TEST-OVERDUE-1 + TEST-BULK-1..14) แสดง 10 เหลืออีก 5
  assert v_msg like '%และอีก 5 ใบ%',
    format('เคส 14 ล้มเหลว: ต้องมีข้อความ "และอีก 5 ใบ" แต่ได้ข้อความว่า %s', v_msg);

  select count(*) into v_lines
    from regexp_split_to_table(v_msg, E'\n') l
   where l like '• [TEST-%';
  assert v_lines <= 10 + 2,
    format('เคส 14 ล้มเหลว: แต่ละหมวดต้องแสดงไม่เกิน 10 รายการ แต่นับได้ %s บรรทัด', v_lines);

  assert char_length(v_msg) <= 4900,
    'เคส 14 ล้มเหลว: ข้อความต้องไม่เกิน 4,900 ตัวอักษร';
end $$;

-- ---------------------------------------------------------------------------
-- เคส 15 : เรียก enqueue ซ้ำในวันเดียวกัน -> ยังมีแถวเดียว
-- ---------------------------------------------------------------------------
delete from line_outbox;

do $$
declare
  v_first  uuid;
  v_second uuid;
begin
  v_first  := app_enqueue_line_digest();
  v_second := app_enqueue_line_digest();

  assert v_first is not null, 'เคส 15 ล้มเหลว: ครั้งแรกต้องสร้างแถวได้';
  assert v_second is null,    'เคส 15 ล้มเหลว: ครั้งที่สองต้องไม่สร้างแถวซ้ำ';
  assert (select count(*) from line_outbox where kind = 'digest') = 1,
    'เคส 15 ล้มเหลว: สรุปรายวันต้องมีแถวเดียวต่อวัน';
end $$;

rollback;

\echo 'ผ่านทุกเคส'
