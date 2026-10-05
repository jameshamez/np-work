-- =============================================================================
-- NP Taskwork — ระบบติดตามงาน
-- 09_line_cleanup.sql : ลบร่องรอยของ LINE Notify ที่ปิดบริการไปแล้ว
--
-- LINE Notify ปิดบริการถาวรเมื่อ 31 มี.ค. 2025
-- คอลัมน์ line_notify_token จึงใช้ไม่ได้อีก และไม่เคยมีโค้ดไหนอ่านไปใช้ส่งจริง
--
-- line_notify_enabled ก็ไม่มีความหมายแล้วเมื่อส่งเข้ากลุ่มรวม
-- เพราะทุกคนในกลุ่มเห็นข้อความเดียวกันอยู่ดี
-- สวิตช์เปิด/ปิดย้ายไปอยู่ที่ line_config.enabled ระดับระบบแทน
--
-- ค่า 'line_notify_sent' ใน enum notification_type ยังไม่ลบ
-- เพราะข้อมูลเดิมใน 04_seed.sql อ้างถึงอยู่ และ PostgreSQL ลบค่า enum ไม่ได้
-- แต่ไม่มีโค้ดใหม่สร้างค่านี้อีกแล้ว
--
-- มีของสองอย่างพึ่งพาคอลัมน์ users.line_notify_enabled อยู่ ต้อง drop ก่อน
-- แล้วสร้างใหม่ในรูปแบบที่ตัดคอลัมน์นี้ออก (ตรงกับที่แก้ไว้แล้วใน 02/05):
--   1) view v_tasks_needing_alert (02_views_functions.sql)
--      -- drop column จะ error ทันทีถ้าไม่ drop view นี้ก่อน
--   2) function app_my_profile() (05_auth.sql)
--      -- postgres ไม่ track dependency ของ function จึง drop column ผ่านได้
--      -- โดยไม่ error แต่ฟังก์ชันจะพังตอนรันไทม์ และหน้าเว็บเรียกฟังก์ชันนี้
--      -- ทุกครั้งที่ล็อกอิน (AuthContext.tsx) — ถ้าพลาดจะไม่มีใครล็อกอินได้เลย
--
-- ไฟล์นี้ยึด pattern เดียวกับ 06_patch_notifications.sql (drop+create ของที่ซ้ำ
-- กับไฟล์ก่อนหน้า) นิยาม view/function ด้านล่างต้องตรงกับใน 02/05 เป๊ะ
-- (ยกเว้นคอลัมน์ที่ถูกลบ) ไม่งั้นการติดตั้งใหม่กับการอัปเกรดจะได้ schema ต่างกัน
--
-- รันไฟล์นี้ "หลังจาก" deploy โค้ดฝั่งแอปเวอร์ชันใหม่แล้วเท่านั้น
-- ไฟล์นี้รันซ้ำได้
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1) drop ของที่พึ่งพาคอลัมน์ก่อน
-- -----------------------------------------------------------------------------
drop view if exists v_tasks_needing_alert;
drop function if exists app_my_profile();

-- -----------------------------------------------------------------------------
-- 2) drop คอลัมน์ที่ตายแล้ว
-- -----------------------------------------------------------------------------
alter table users drop column if exists line_notify_token;
alter table users drop column if exists line_notify_enabled;

-- -----------------------------------------------------------------------------
-- 3) สร้างของที่ drop ไปกลับคืน ตัดคอลัมน์ line_notify_enabled ออก
--    (ต้องตรงกับนิยามใน 02_views_functions.sql / 05_auth.sql เป๊ะ)
-- -----------------------------------------------------------------------------
create view v_tasks_needing_alert
with (security_invoker = true) as
select
  t.id as task_id,
  t.code,
  t.title,
  t.deadline_at,
  t.last_updated_at,
  t.last_inactivity_alert_at,
  u.id   as owner_user_id,
  u.full_name as owner_name,
  u.no_update_alert_hours,
  round(extract(epoch from (now() - t.last_updated_at)) / 3600.0, 1) as hours_since_update
from tasks t
join users u on u.id = t.assigned_to_user_id
where t.status <> 'approved'
  and t.is_draft = false
  and extract(epoch from (now() - t.last_updated_at)) / 3600.0 >= u.no_update_alert_hours
  and (t.last_inactivity_alert_at is null
       or t.last_inactivity_alert_at < now() - u.no_update_alert_hours * interval '1 hour');

create function app_my_profile()
returns table (
  id                    uuid,
  username              text,
  full_name             text,
  email                 text,
  role                  user_role,
  status                user_status,
  avatar_url            text,
  no_update_alert_hours numeric,
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

-- drop function ล้าง grant เดิมไปด้วย ต้องให้สิทธิ์ authenticated ใหม่
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function app_my_profile() to authenticated;
  end if;
end
$$;

commit;
