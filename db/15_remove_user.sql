-- =============================================================================
-- NP Taskwork — ระบบติดตามงาน
-- 15_remove_user.sql : ลบผู้ใช้งานที่ลาออก — รันซ้ำได้
--
-- ปัญหา
--   มีคนเข้าใหม่และลาออกอยู่เสมอ แต่หน้า Super Admin ไม่มีทางเอาคนที่ออกไปแล้วออกจากระบบ
--
-- ทำไมไม่ DELETE แถวใน users ตรง ๆ
--   tasks.assigned_to_user_id ผูกแบบ on delete restrict — ถ้าคนนั้นเคยเป็นเจ้าของงาน
--   จะลบไม่ผ่าน และถึงลบได้ ประวัติงาน / รายงานย้อนหลังก็จะหาเจ้าของไม่เจอ
--   จึงใช้หลักเดียวกับ handle_deleted_auth_user (05_auth.sql) คือ
--   "ตัดสิทธิ์เข้าระบบ แต่เก็บโปรไฟล์ไว้ให้งานเก่าอ้างถึง"
--     * status = 'rejected'  -> หายจากรายชื่อผู้ใช้ / dropdown มอบหมายงาน / รายงาน
--     * ลบบัญชีใน auth.users -> ล็อกอินไม่ได้อีก และ session ที่ค้างอยู่ใช้ต่อไม่ได้
--
-- ถ้าคนเดิมกลับมาทำงานใหม่
--   สมัครด้วยอีเมลเดิม -> handle_new_auth_user ผูกกลับเข้าโปรไฟล์เดิม (งานเก่ากลับมาครบ)
--   ไฟล์นี้แก้ให้โปรไฟล์ที่ถูกลบไปแล้วกลับไปเป็น 'pending' รอ admin อนุมัติใหม่
--   (เดิมจะค้างเป็น 'rejected' ตลอดไป สมัครใหม่กี่ครั้งก็เข้าไม่ได้)
--
-- ต้องรันหลัง 05_auth.sql
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- app_remove_user : super_admin ลบผู้ใช้ที่ลาออก
-- -----------------------------------------------------------------------------
create or replace function app_remove_user(p_user_id uuid) returns users
language plpgsql security definer set search_path = public as $$
declare
  v_user users;
begin
  if app_current_role() is distinct from 'super_admin' or not app_is_admin() then
    raise exception 'เฉพาะ Super Admin เท่านั้นที่ลบผู้ใช้งานได้'
      using errcode = 'insufficient_privilege';
  end if;

  -- กันลบตัวเอง — ผู้เรียกเป็น super_admin อยู่แล้ว จึงรับประกันว่าระบบยังเหลือ super_admin เสมอ
  if p_user_id = app_current_user_id() then
    raise exception 'ไม่สามารถลบบัญชีของตัวเองได้'
      using errcode = 'check_violation';
  end if;

  select * into v_user from users where id = p_user_id;
  if v_user.id is null then
    raise exception 'ไม่พบผู้ใช้ id = %', p_user_id using errcode = 'no_data_found';
  end if;

  -- ลบบัญชีล็อกอินก่อน (ถ้ารันบน Supabase) — trigger on_auth_user_deleted จะตั้ง
  -- status = 'rejected' และล้าง auth_user_id ให้เอง
  if v_user.auth_user_id is not null and to_regclass('auth.users') is not null then
    execute 'delete from auth.users where id = $1' using v_user.auth_user_id;
  end if;

  -- เผื่อไม่มี auth.users / ไม่มี trigger (Postgres ธรรมดา) หรือโปรไฟล์ไม่เคยผูกบัญชี
  update users
     set status       = 'rejected',
         auth_user_id = null
   where id = p_user_id
  returning * into v_user;

  return v_user;
end;
$$;

comment on function app_remove_user is
  'super_admin ลบผู้ใช้ที่ลาออก: ลบบัญชีล็อกอิน + ตั้ง status = rejected โดยเก็บโปรไฟล์ไว้ให้งานเก่าอ้างถึง';

-- -----------------------------------------------------------------------------
-- handle_new_auth_user : เหมือน 05_auth.sql ทุกอย่าง ยกเว้นขั้นที่ 1
-- ผูกกลับเข้าโปรไฟล์เดิมที่ถูกลบไปแล้ว -> กลับไปรออนุมัติใหม่ + แจ้ง admin
-- -----------------------------------------------------------------------------
create or replace function handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_username  text;
  v_full_name text;
  v_is_first  boolean;
  v_linked    users;
begin
  -- 1) มีโปรไฟล์เดิมที่อีเมลตรงกันและยังไม่ถูกผูกไหม -> ผูกเข้าด้วยกัน
  update users
     set auth_user_id = new.id,
         status       = case when status = 'rejected' then 'pending'::user_status else status end
   where email = new.email::citext
     and auth_user_id is null
  returning * into v_linked;

  if v_linked.id is not null then
    if v_linked.status = 'pending' then
      insert into notifications (recipient_user_id, type, title, message)
      select u.id, 'approval_required', 'มีคำขอสมัครใช้งานใหม่',
             format('ผู้ใช้ %s (%s) ส่งคำขออนุมัติสมัครใช้งาน', v_linked.full_name, v_linked.username)
      from users u
      where u.role in ('admin', 'super_admin')
        and u.status = 'approved';
    end if;
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

-- -----------------------------------------------------------------------------
-- สิทธิ์เรียกใช้
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function app_remove_user(uuid) to authenticated;
  end if;
end
$$;

commit;
