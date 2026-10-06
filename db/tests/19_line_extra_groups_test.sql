-- =============================================================================
-- ทดสอบ 19_line_extra_groups.sql — กลุ่ม LINE เพิ่มเติม
-- รัน: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f db/tests/19_line_extra_groups_test.sql
--
-- ⚠️ รันกับฐานข้อมูลทดสอบเท่านั้น — ทั้งไฟล์ rollback ท้ายสุด ผ่าน = รันจบโดยไม่มี error
-- RLS ไม่มีผลกับ superuser จึงสลับไปใช้ role authenticated
-- =============================================================================
begin;

insert into users (id, auth_user_id, username, full_name, email, role, status) values
 ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000e8',
  'line_super','ซุปเปอร์ ไลน์','line_super@example.com','super_admin','approved'),
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-0000000000e9',
  'line_admin','แอดมิน ไลน์','line_admin@example.com','admin','approved');

-- เคส 1 : Group ID ผิดรูปแบบถูกปฏิเสธ
do $$
begin
  insert into line_groups (name, group_id) values ('ผิดรูปแบบ', 'U1234');
  raise exception 'เคส 1 ล้มเหลว: รับ Group ID ผิดรูปแบบ';
exception when check_violation then
  null;
end
$$;

set local role authenticated;

-- เคส 2 : admin ธรรมดาเพิ่มกลุ่มไม่ได้
set local request.jwt.claim.sub to '00000000-0000-0000-0000-0000000000e9';
set local request.jwt.claims   to '{"sub":"00000000-0000-0000-0000-0000000000e9"}';
do $$
begin
  insert into line_groups (name, group_id) values ('ของ admin', 'C' || repeat('a', 32));
  raise exception 'เคส 2 ล้มเหลว: admin ธรรมดาเพิ่มกลุ่มได้';
exception when insufficient_privilege then
  null;
end
$$;

-- เคส 3 : super_admin เพิ่ม ปิด และลบได้
set local request.jwt.claim.sub to '00000000-0000-0000-0000-0000000000e8';
set local request.jwt.claims   to '{"sub":"00000000-0000-0000-0000-0000000000e8"}';
insert into line_groups (name, group_id) values ('ทีมผู้บริหาร', 'C' || repeat('b', 32));
update line_groups set enabled = false where group_id = 'C' || repeat('b', 32);

do $$
begin
  assert (select enabled from line_groups where group_id = 'C' || repeat('b', 32)) = false,
    'เคส 3 ล้มเหลว: super_admin ปิดกลุ่มไม่ได้';
end
$$;

delete from line_groups where group_id = 'C' || repeat('b', 32);
do $$
begin
  assert not exists (select 1 from line_groups where group_id = 'C' || repeat('b', 32)),
    'เคส 3 ล้มเหลว: super_admin ลบกลุ่มไม่ได้';
end
$$;

\echo 'ผ่านทุกเคส: 19_line_extra_groups'
rollback;
