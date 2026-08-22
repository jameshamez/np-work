-- =============================================================================
-- NP Taskwork — ระบบติดตามงาน
-- 05_auth.sql : เชื่อม Supabase Auth (auth.users) เข้ากับโปรไฟล์ในตาราง users
--
-- หลักการ
--   * Supabase Auth ดูแลอีเมล/รหัสผ่าน/session (เก็บใน auth.users)
--   * ตาราง public.users เก็บโปรไฟล์ในระบบงาน ผูกกันด้วย auth_user_id
--   * สมัครใหม่ -> โปรไฟล์ถูกสร้างอัตโนมัติด้วย trigger สถานะ 'pending' รอ admin อนุมัติ
--   * ถ้าอีเมลตรงกับโปรไฟล์เดิมที่มีอยู่แล้ว (เช่นข้อมูลที่ย้ายมาจาก localStorage)
--     จะ "ผูกเข้ากับโปรไฟล์เดิม" แทนการสร้างใหม่ — งานเก่าทั้งหมดจึงยังอยู่กับเจ้าของเดิม
--   * คนแรกที่สมัครเข้าระบบจะได้เป็น super_admin อัตโนมัติ (ไม่งั้นจะไม่มีใครอนุมัติใครได้)
--
-- ต้องรันหลัง 01-03 (04 seed จะรันหรือไม่รันก็ได้)
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- สร้างโปรไฟล์เมื่อมีผู้สมัครใหม่ผ่าน Supabase Auth
-- -----------------------------------------------------------------------------
create or replace function handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_username  text;
  v_full_name text;
  v_is_first  boolean;
  v_linked    uuid;
begin
  -- 1) มีโปรไฟล์เดิมที่อีเมลตรงกันและยังไม่ถูกผูกไหม -> ผูกเข้าด้วยกัน
  update users
     set auth_user_id = new.id
   where email = new.email::citext
     and auth_user_id is null
  returning id into v_linked;

  if v_linked is not null then
    return new;
  end if;

  -- 2) ไม่มีโปรไฟล์เดิม -> สร้างใหม่
  v_username := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'username'), ''),
    split_part(new.email, '@', 1)
  );
  v_full_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    v_username
  );

  -- username ต้องไม่ซ้ำ และต้องยาวอย่างน้อย 3 ตัวตาม constraint
  if char_length(v_username) < 3 then
    v_username := v_username || '_user';
  end if;
  if exists (select 1 from users where username = v_username::citext) then
    v_username := v_username || '_' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;

  -- คนแรกของระบบได้เป็น super_admin และใช้งานได้ทันที
  select not exists (select 1 from users where role = 'super_admin') into v_is_first;

  insert into users (auth_user_id, username, full_name, email, role, status)
  values (
    new.id, v_username, v_full_name, new.email,
    case when v_is_first then 'super_admin'::user_role else 'user'::user_role end,
    case when v_is_first then 'approved'::user_status else 'pending'::user_status end
  );

  -- 3) แจ้งผู้ดูแลระบบว่ามีคำขอใหม่รออนุมัติ
  if not v_is_first then
    insert into notifications (recipient_user_id, type, title, message)
    select u.id, 'approval_required', 'มีคำขอสมัครใช้งานใหม่',
           format('ผู้ใช้ %s (%s) ส่งคำขออนุมัติสมัครใช้งาน', v_full_name, v_username)
    from users u
    where u.role in ('admin', 'super_admin')
      and u.status = 'approved';
  end if;

  return new;
end;
$$;

comment on function handle_new_auth_user is
  'สร้าง/ผูกโปรไฟล์ใน public.users เมื่อมีผู้สมัครใหม่ใน Supabase Auth';

-- -----------------------------------------------------------------------------
-- อีเมลใน Auth เปลี่ยน -> ให้โปรไฟล์เปลี่ยนตาม
-- -----------------------------------------------------------------------------
create or replace function handle_auth_user_email_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is distinct from old.email then
    update users set email = new.email::citext where auth_user_id = new.id;
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- ลบบัญชีใน Auth -> ไม่ลบโปรไฟล์ทิ้ง (งานเก่ายังอ้างถึงอยู่) แค่ตัดสิทธิ์เข้าระบบ
-- -----------------------------------------------------------------------------
create or replace function handle_deleted_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update users
     set auth_user_id = null,
         status       = 'rejected'
   where auth_user_id = old.id;
  return old;
end;
$$;

-- -----------------------------------------------------------------------------
-- ติดตั้ง trigger บน auth.users
-- ข้ามให้อัตโนมัติถ้ารันบน Postgres ธรรมดาที่ไม่มีตาราง auth.users
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'auth' and table_name = 'users'
  ) then
    raise notice 'ข้ามการสร้าง trigger: ไม่พบตาราง auth.users (ไม่ได้รันบน Supabase)';
    return;
  end if;

  drop trigger if exists on_auth_user_created      on auth.users;
  drop trigger if exists on_auth_user_email_change on auth.users;
  drop trigger if exists on_auth_user_deleted      on auth.users;

  create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function handle_new_auth_user();

  create trigger on_auth_user_email_change
    after update of email on auth.users
    for each row execute function handle_auth_user_email_change();

  create trigger on_auth_user_deleted
    after delete on auth.users
    for each row execute function handle_deleted_auth_user();
end
$$;

-- -----------------------------------------------------------------------------
-- app_my_profile : โปรไฟล์ของ session ปัจจุบัน (ฝั่งหน้าเว็บเรียกหลังล็อกอิน)
-- ต้องเป็น security definer เพราะผู้ใช้สถานะ pending ยังอ่านตารางไม่ได้ตาม RLS
--
-- ต้อง drop ก่อน create เพราะ create or replace function เปลี่ยน return type ไม่ได้
-- (คอลัมน์ line_notify_enabled ถูกลบไปพร้อม LINE Notify — ดู 09_line_cleanup.sql)
-- -----------------------------------------------------------------------------
drop function if exists app_my_profile();
create function app_my_profile()
returns table (
  id                    uuid,
  username              text,
  full_name             text,
  email                 text,
  role                  user_role,
  status                user_status,
  avatar_url            text,
  no_update_alert_hours integer,
  created_at            timestamptz
)
language sql stable security definer set search_path = public as $$
  select u.id, u.username::text, u.full_name, u.email::text, u.role, u.status,
         u.avatar_url, u.no_update_alert_hours, u.created_at
  from users u
  where u.auth_user_id = auth.uid();
$$;

comment on function app_my_profile is
  'คืนโปรไฟล์ของผู้ใช้ที่ล็อกอินอยู่ ใช้ได้แม้สถานะยัง pending (เพื่อแสดงหน้ารออนุมัติ)';

-- -----------------------------------------------------------------------------
-- app_pending_users : รายชื่อคำขอที่รออนุมัติ สำหรับหน้า AdminApprovalView
-- -----------------------------------------------------------------------------
create or replace function app_pending_users()
returns setof users
language sql stable security definer set search_path = public as $$
  select * from users
  where status = 'pending' and app_is_admin()
  order by created_at;
$$;

-- -----------------------------------------------------------------------------
-- สิทธิ์เรียกใช้
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function app_my_profile()    to authenticated;
    grant execute on function app_pending_users() to authenticated;
  end if;
end
$$;

commit;
