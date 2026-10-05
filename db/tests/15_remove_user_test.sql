-- =============================================================================
-- ทดสอบ 15_remove_user.sql — ลบผู้ใช้งานที่ลาออก
-- รัน: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f db/tests/15_remove_user_test.sql
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
 ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000b8',
  'super_remover','ซุปเปอร์ แอดมิน','super_rm@example.com','super_admin','approved'),
 ('00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000b9',
  'leaving_user','คน ลาออก','leaving@example.com','user','approved'),
 ('00000000-0000-0000-0000-0000000000b3','00000000-0000-0000-0000-0000000000ba',
  'plain_admin','แอดมิน ธรรมดา','plain_admin@example.com','admin','approved');

insert into projects (id, name) values
 ('00000000-0000-0000-0000-0000000000b4','โครงการทดสอบลบผู้ใช้');

-- คนที่ลาออกเป็นเจ้าของงานอยู่ (assigned_to_user_id เป็น on delete restrict)
insert into tasks (id, project_id, title, assigned_to_user_id, deadline_at, category, status)
values ('00000000-0000-0000-0000-0000000000b5','00000000-0000-0000-0000-0000000000b4',
        'งานของคนที่ลาออก','00000000-0000-0000-0000-0000000000b2',
        now() + interval '3 days','general','pending_submission');

-- ---------------------------------------------------------------------------
-- เคส 1 : admin ธรรมดาลบผู้ใช้ไม่ได้
-- ---------------------------------------------------------------------------
set local request.jwt.claim.sub to '00000000-0000-0000-0000-0000000000ba';
set local request.jwt.claims   to '{"sub":"00000000-0000-0000-0000-0000000000ba"}';

do $$
begin
  perform app_remove_user('00000000-0000-0000-0000-0000000000b2');
  raise exception 'เคส 1 ล้มเหลว: admin ธรรมดาลบผู้ใช้ได้';
exception when insufficient_privilege then
  null;
end
$$;

-- ---------------------------------------------------------------------------
-- เคส 2 : super_admin ลบตัวเองไม่ได้
-- ---------------------------------------------------------------------------
set local request.jwt.claim.sub to '00000000-0000-0000-0000-0000000000b8';
set local request.jwt.claims   to '{"sub":"00000000-0000-0000-0000-0000000000b8"}';

do $$
begin
  perform app_remove_user('00000000-0000-0000-0000-0000000000b1');
  raise exception 'เคส 2 ล้มเหลว: super_admin ลบบัญชีตัวเองได้';
exception when check_violation then
  null;
end
$$;

-- ---------------------------------------------------------------------------
-- เคส 3 : super_admin ลบคนที่ลาออกได้ แม้เป็นเจ้าของงาน — โปรไฟล์และงานยังอยู่
-- ---------------------------------------------------------------------------
select app_remove_user('00000000-0000-0000-0000-0000000000b2');

do $$
declare r users;
begin
  select * into r from users where id = '00000000-0000-0000-0000-0000000000b2';
  assert r.id is not null,            'เคส 3 ล้มเหลว: โปรไฟล์ถูกลบทิ้ง';
  assert r.status = 'rejected',       format('เคส 3 ล้มเหลว: status ผิด ได้ %s', r.status);
  assert r.auth_user_id is null,      'เคส 3 ล้มเหลว: ยังผูกบัญชีล็อกอินอยู่';
  assert exists (select 1 from tasks
                  where id = '00000000-0000-0000-0000-0000000000b5'
                    and assigned_to_user_id = '00000000-0000-0000-0000-0000000000b2'),
    'เคส 3 ล้มเหลว: งานเดิมหายหรือเปลี่ยนเจ้าของ';
end
$$;

-- ---------------------------------------------------------------------------
-- เคส 4 : กลับมาสมัครด้วยอีเมลเดิม -> ผูกโปรไฟล์เดิม และกลับไปรออนุมัติ
-- (เรียก trigger function ตรง ๆ เพราะ Postgres ธรรมดาไม่มีตาราง auth.users)
-- ---------------------------------------------------------------------------
create temp table fake_auth (id uuid, email text, raw_user_meta_data jsonb);
create trigger fake_auth_created after insert on fake_auth
  for each row execute function handle_new_auth_user();
insert into fake_auth values
  ('00000000-0000-0000-0000-0000000000bb', 'leaving@example.com', '{}');

do $$
declare r users;
begin
  select * into r from users where id = '00000000-0000-0000-0000-0000000000b2';
  assert r.auth_user_id = '00000000-0000-0000-0000-0000000000bb',
    'เคส 4 ล้มเหลว: ไม่ได้ผูกกลับเข้าโปรไฟล์เดิม';
  assert r.status = 'pending', format('เคส 4 ล้มเหลว: status ผิด ได้ %s', r.status);
  assert (select count(*) from users where email = 'leaving@example.com') = 1,
    'เคส 4 ล้มเหลว: สร้างโปรไฟล์ซ้ำ';
  assert exists (select 1 from notifications
                  where recipient_user_id = '00000000-0000-0000-0000-0000000000b1'
                    and type = 'approval_required'),
    'เคส 4 ล้มเหลว: ไม่แจ้ง admin ว่ามีคำขอรออนุมัติ';
end
$$;

\echo 'ผ่านทุกเคส: 15_remove_user'
rollback;
