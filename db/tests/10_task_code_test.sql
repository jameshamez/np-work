-- =============================================================================
-- ทดสอบ 10_task_code.sql — การออกรหัสการ์ดงาน
-- รัน: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f db/tests/10_task_code_test.sql
--
-- ⚠️ รันกับฐานข้อมูลทดสอบเท่านั้น
--
-- ทั้งไฟล์อยู่ใน transaction เดียวที่ rollback ท้ายสุด
-- ผ่าน = รันจบโดยไม่มี error
-- =============================================================================
begin;

insert into users (id, auth_user_id, username, full_name, email, role, status)
values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000f1',
        'test_code_user', 'ทดสอบ รหัสงาน', 'test_code@example.com', 'admin', 'approved');

insert into projects (id, name) values ('00000000-0000-0000-0000-0000000000e2', 'โครงการทดสอบรหัส');

-- ล้างงานเดิมออกให้เริ่มนับจากศูนย์ (อยู่ใน transaction ที่ rollback)
delete from tasks;
delete from task_code_counters;

-- ---------------------------------------------------------------------------
-- เคส 1 : ไม่ส่ง code มา -> ระบบออกให้เป็น #NP-MM/YY-001
-- ---------------------------------------------------------------------------
do $$
declare
  v_code   text;
  v_period text := to_char(now() at time zone 'Asia/Bangkok', 'MM/YY');
begin
  insert into tasks (project_id, title, assigned_to_user_id, deadline_at, category)
  values ('00000000-0000-0000-0000-0000000000e2', 'งานใบแรก',
          '00000000-0000-0000-0000-0000000000e1', now() + interval '3 days', 'general')
  returning code into v_code;

  assert v_code = '#NP-' || v_period || '-001',
    format('เคส 1 ล้มเหลว: ควรได้ #NP-%s-001 แต่ได้ %s', v_period, v_code);
end $$;

-- ---------------------------------------------------------------------------
-- เคส 2 : ใบถัดไปต้องได้เลขถัดไป ไม่ซ้ำ
-- ---------------------------------------------------------------------------
do $$
declare
  v_code   text;
  v_period text := to_char(now() at time zone 'Asia/Bangkok', 'MM/YY');
begin
  insert into tasks (project_id, title, assigned_to_user_id, deadline_at, category)
  values ('00000000-0000-0000-0000-0000000000e2', 'งานใบสอง',
          '00000000-0000-0000-0000-0000000000e1', now() + interval '3 days', 'general')
  returning code into v_code;

  assert v_code = '#NP-' || v_period || '-002',
    format('เคส 2 ล้มเหลว: ควรได้ #NP-%s-002 แต่ได้ %s', v_period, v_code);
end $$;

-- ---------------------------------------------------------------------------
-- เคส 3 : หมวดงานต่างกัน -> ใช้ prefix ต่างกัน และนับแยกกัน
-- ---------------------------------------------------------------------------
do $$
declare
  v_ku  text;
  v_dwg text;
  v_period text := to_char(now() at time zone 'Asia/Bangkok', 'MM/YY');
begin
  insert into tasks (project_id, title, assigned_to_user_id, deadline_at, category)
  values ('00000000-0000-0000-0000-0000000000e2', 'งานโครงการ',
          '00000000-0000-0000-0000-0000000000e1', now() + interval '3 days', 'ku_university')
  returning code into v_ku;

  insert into tasks (project_id, title, assigned_to_user_id, deadline_at, category)
  values ('00000000-0000-0000-0000-0000000000e2', 'งานเขียนแบบ',
          '00000000-0000-0000-0000-0000000000e1', now() + interval '3 days', 'drawing_draft')
  returning code into v_dwg;

  assert v_ku = '#PJ-' || v_period || '-001',
    format('เคส 3 ล้มเหลว: งานโครงการควรได้ #PJ-%s-001 แต่ได้ %s', v_period, v_ku);
  assert v_dwg = '#DWG-' || v_period || '-001',
    format('เคส 3 ล้มเหลว: งานเขียนแบบควรได้ #DWG-%s-001 แต่ได้ %s', v_period, v_dwg);
end $$;

-- ---------------------------------------------------------------------------
-- เคส 4 : ส่งรหัสมาเอง -> ระบบต้องไม่แทนที่ (เผื่อนำเข้าข้อมูลเก่า)
-- ---------------------------------------------------------------------------
do $$
declare
  v_code text;
begin
  insert into tasks (project_id, title, assigned_to_user_id, deadline_at, category, code)
  values ('00000000-0000-0000-0000-0000000000e2', 'งานรหัสกำหนดเอง',
          '00000000-0000-0000-0000-0000000000e1', now() + interval '3 days', 'general',
          'LEGACY-999')
  returning code into v_code;

  assert v_code = 'LEGACY-999',
    format('เคส 4 ล้มเหลว: รหัสที่ส่งมาเองต้องคงไว้ แต่ได้ %s', v_code);
end $$;

-- ---------------------------------------------------------------------------
-- เคส 5 : ลบงานทิ้งแล้วสร้างใหม่ -> ต้องไม่ใช้เลขซ้ำ
--         (นี่คือหัวใจ — บั๊กเดิมนับจาก tasks.length เลขจึงถอยหลังเมื่อมีการลบ)
-- ---------------------------------------------------------------------------
do $$
declare
  v_code   text;
  v_period text := to_char(now() at time zone 'Asia/Bangkok', 'MM/YY');
begin
  delete from tasks where title = 'งานใบสอง';

  insert into tasks (project_id, title, assigned_to_user_id, deadline_at, category)
  values ('00000000-0000-0000-0000-0000000000e2', 'งานหลังลบ',
          '00000000-0000-0000-0000-0000000000e1', now() + interval '3 days', 'general')
  returning code into v_code;

  assert v_code = '#NP-' || v_period || '-003',
    format('เคส 5 ล้มเหลว: ลบงานแล้วเลขต้องเดินหน้าต่อเป็น -003 แต่ได้ %s (เลขถอยหลัง = บั๊กเดิม)', v_code);
end $$;

-- ---------------------------------------------------------------------------
-- เคส 6 : คนละเดือน -> นับแยกกัน เริ่ม 001 ใหม่
-- ---------------------------------------------------------------------------
do $$
declare
  v_a text;
  v_b text;
begin
  v_a := app_next_task_code('general', '2027-01-15 10:00:00+07'::timestamptz);
  v_b := app_next_task_code('general', '2027-02-15 10:00:00+07'::timestamptz);

  assert v_a = '#NP-01/27-001',
    format('เคส 6 ล้มเหลว: ม.ค. 2027 ควรได้ #NP-01/27-001 แต่ได้ %s', v_a);
  assert v_b = '#NP-02/27-001',
    format('เคส 6 ล้มเหลว: ก.พ. 2027 ต้องเริ่มนับใหม่เป็น #NP-02/27-001 แต่ได้ %s', v_b);
end $$;

-- ---------------------------------------------------------------------------
-- เคส 7 : ตัวนับต้องต่อจากรหัสเดิมที่มีอยู่ ไม่ชนของเก่า
-- ---------------------------------------------------------------------------
do $$
declare
  v_code text;
begin
  delete from task_code_counters where prefix = 'NP' and period = '03/27';

  insert into tasks (project_id, title, assigned_to_user_id, deadline_at, category, code)
  values ('00000000-0000-0000-0000-0000000000e2', 'งานเก่าที่นำเข้ามา',
          '00000000-0000-0000-0000-0000000000e1', now() + interval '3 days', 'general',
          '#NP-03/27-042');

  perform app_seed_task_code_counters();

  v_code := app_next_task_code('general', '2027-03-20 10:00:00+07'::timestamptz);
  assert v_code = '#NP-03/27-043',
    format('เคส 7 ล้มเหลว: ต้องนับต่อจาก 042 เป็น 043 แต่ได้ %s', v_code);
end $$;

-- ---------------------------------------------------------------------------
-- เคส 8 : ผู้ใช้ทั่วไปเรียกฟังก์ชันออกเลขเองไม่ได้ (กันเผาเลขทิ้ง)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f1"}';

do $$
begin
  begin
    perform app_next_task_code('general');
    raise exception 'เคส 8 ล้มเหลว: ผู้ใช้ทั่วไปไม่ควรเรียก app_next_task_code ได้';
  exception when insufficient_privilege then
    null;  -- ถูกต้องแล้ว
  end;
end $$;

reset role;
rollback;

\echo 'ผ่านทุกเคส'
