-- =============================================================================
-- NP Taskwork — ระบบติดตามงาน
-- 16_alert_minutes.sql : ให้ตั้งเวลาแจ้งเตือนขาดการอัปเดตเป็นนาทีได้จริง — รันซ้ำได้
--
-- ปัญหา
--   หน้า "กำหนดการแจ้งเตือนการ์ดงานรายบุคคล" มีตัวเลือก 15 / 30 / 45 นาที และพิมพ์เป็นนาทีได้
--   แต่คอลัมน์ users.no_update_alert_hours เป็น integer ช่วง 1–168 ชั่วโมง
--   ค่าอย่าง 0.25 (15 นาที) หรือ 1.5 ชม. จึงถูกฐานข้อมูลปฏิเสธ ตั้งค่าแล้วไม่ติด
--
-- การแก้
--   เปลี่ยนเป็น numeric(8,4) หน่วยยังเป็น "ชั่วโมง" เหมือนเดิม (หน้าเว็บไม่ต้องแปลงหน่วย)
--   ทศนิยม 4 ตำแหน่งพอให้ทุกนาทีแปลงกลับเป็นนาทีเดิมได้ตรง (1 นาที = 0.0167 ชม.)
--   ช่วงที่ยอมรับ: 15 นาที – 168 ชั่วโมง (7 วัน)
--
-- ของที่อ้างคอลัมน์นี้และต้องสร้างใหม่ตามชนิดใหม่
--   * view v_tasks_needing_alert — เปลี่ยนชนิดคอลัมน์ที่ view ใช้อยู่ไม่ได้ ต้อง drop ก่อน
--     และ make_interval(hours => …) รับแค่ integer จึงเปลี่ยนเป็น ค่า * interval '1 hour'
--   * ฟังก์ชัน app_my_profile — return type เปลี่ยน ต้อง drop แล้วสร้างใหม่
--
-- ต้องรันหลัง 09_line_cleanup.sql
-- =============================================================================

begin;

drop view if exists v_tasks_needing_alert;

alter table users drop constraint if exists users_alert_hours_rng;
alter table users alter column no_update_alert_hours type numeric(8,4);
alter table users add constraint users_alert_hours_rng
  check (no_update_alert_hours between 0.25 and 168);

comment on column users.no_update_alert_hours is
  'ชั่วโมงที่ไม่มีอัปเดตแล้วให้เตือน (default 4, ทศนิยมได้ เช่น 0.25 = 15 นาที)';

-- -----------------------------------------------------------------------------
-- v_tasks_needing_alert : เหมือน 09_line_cleanup.sql ยกเว้นการคำนวณช่วงเวลา
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

-- -----------------------------------------------------------------------------
-- app_my_profile : เหมือนเดิม เปลี่ยนแค่ชนิดของ no_update_alert_hours
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

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function app_my_profile() to authenticated;
    grant select on v_tasks_needing_alert to authenticated;
  end if;
end
$$;

commit;
