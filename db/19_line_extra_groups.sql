-- =============================================================================
-- NP Taskwork — ระบบติดตามงาน
-- 19_line_extra_groups.sql : ส่งแจ้งเตือน LINE เข้ากลุ่มเพิ่มเติม — รันซ้ำได้
--
-- เดิมส่งได้กลุ่มเดียว (secret LINE_GROUP_ID ของ Edge Function line-dispatch)
-- ตารางนี้เก็บ "กลุ่มเพิ่มเติม" ที่ Super Admin เพิ่ม/เปิด/ปิด/ลบเองได้จากหน้าการตั้งค่าระบบ
-- ทุกข้อความใน line_outbox ส่งเข้ากลุ่มหลัก + ทุกกลุ่มในตารางนี้ที่ enabled = true
--
-- โควตา LINE
--   1 แถวใน line_outbox ยังเป็น 1 ข้อความเหมือนเดิม แต่ถูกส่งออกไป N กลุ่ม
--   LINE หักโควตา = จำนวนข้อความ × สมาชิกของ "ทุกกลุ่มรวมกัน"
--   line-dispatch จึงนับเพดานรายเดือน (line_config.monthly_cap) เป็น
--   จำนวนแถวที่ส่งแล้ว × จำนวนกลุ่มปลายทางปัจจุบัน
--
-- ต้องรันหลัง 07_line_integration.sql
-- =============================================================================

begin;

create table if not exists line_groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  group_id   text not null unique,
  enabled    boolean not null default true,
  created_at timestamptz not null default now(),

  constraint line_groups_name_not_blank check (btrim(name) <> ''),
  -- Group ID ของ LINE = ตัว C ตามด้วย hex 32 ตัว (ได้จาก webhook ตอนบอทเข้ากลุ่ม)
  constraint line_groups_group_id_format check (group_id ~ '^C[0-9a-f]{32}$')
);

comment on table line_groups is
  'กลุ่ม LINE เพิ่มเติมนอกจากกลุ่มหลัก (secret LINE_GROUP_ID) — ได้รับทุกข้อความเหมือนกลุ่มหลัก';

alter table line_groups enable row level security;

drop policy if exists line_groups_super_admin on line_groups;
create policy line_groups_super_admin on line_groups
  for all using (app_is_admin() and app_current_role() = 'super_admin')
  with check (app_is_admin() and app_current_role() = 'super_admin');

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select, insert, update, delete on line_groups to authenticated;
  end if;
end
$$;

commit;
