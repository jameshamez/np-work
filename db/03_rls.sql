-- =============================================================================
-- NP Taskwork — ระบบติดตามงาน
-- 03_rls.sql : Row Level Security policies
--
-- โมเดลสิทธิ์
--   * ต้องเป็นผู้ใช้ที่ status = 'approved' ก่อน ถึงจะเห็นข้อมูลอะไรได้
--     (คนที่สมัครแล้วรออนุมัติ เห็นได้แค่โปรไฟล์ตัวเอง)
--   * user        : อ่านงานทั้งทีมได้ (กระดาน Kanban ร่วม) แต่แก้ได้เฉพาะงานที่ตัวเองเกี่ยวข้อง
--   * admin       : จัดการงาน/โครงการ/ผู้ใช้ได้ทั้งหมด อนุมัติและตีกลับงานได้
--   * super_admin : สิทธิ์ของ admin + ลบผู้ใช้และเปลี่ยน role ได้
--
-- ข้อควรรู้: function ใน 02_views_functions.sql เป็น security definer และเจ้าของ
-- เป็น owner ของตาราง จึงข้าม RLS ได้ (เช่น การยิงแจ้งเตือนถึงคนอื่น)
-- อย่าเปิด FORCE ROW LEVEL SECURITY มิฉะนั้น function เหล่านั้นจะพัง
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- กัน privilege escalation: ผู้ใช้ทั่วไปห้ามแก้ role / status / การผูก auth ของตัวเอง
-- (RLS จำกัดได้แค่ระดับแถว ไม่ใช่ระดับคอลัมน์ จึงต้องใช้ trigger)
-- -----------------------------------------------------------------------------
create or replace function trg_users_guard_privileged_columns() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- ไม่มี JWT = รันจากฝั่ง server (service_role, migration, SQL editor) ถือว่าเชื่อถือได้
  -- ถ้าไม่ยกเว้นตรงนี้ แม้แต่สคริปต์ของ DBA เองก็จะแก้ role/status ไม่ได้
  if auth.uid() is null then
    return new;
  end if;

  if app_is_admin() then
    -- เฉพาะ super_admin เท่านั้นที่แต่งตั้ง/ถอด admin ได้
    if new.role is distinct from old.role and app_current_role() <> 'super_admin' then
      raise exception 'เฉพาะ super_admin เท่านั้นที่เปลี่ยนสิทธิ์ผู้ใช้ได้'
        using errcode = 'insufficient_privilege';
    end if;
    return new;
  end if;

  if new.role         is distinct from old.role
     or new.status       is distinct from old.status
     or new.auth_user_id is distinct from old.auth_user_id then
    raise exception 'ไม่มีสิทธิ์แก้ไข role, status หรือการผูกบัญชี'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger users_guard_privileged_columns before update on users
  for each row execute function trg_users_guard_privileged_columns();

-- -----------------------------------------------------------------------------
-- เปิด RLS ทุกตาราง
-- -----------------------------------------------------------------------------
alter table users                enable row level security;
alter table projects             enable row level security;
alter table tasks                enable row level security;
alter table task_checklist_items enable row level security;
alter table task_milestones      enable row level security;
alter table task_financials      enable row level security;
alter table task_logs            enable row level security;
alter table attachments          enable row level security;
alter table task_annotations     enable row level security;
alter table notifications        enable row level security;
alter table flow_templates       enable row level security;
alter table flow_template_items  enable row level security;

-- =============================================================================
-- users
-- =============================================================================
create policy users_select_self on users
  for select using (auth_user_id = auth.uid());

-- สมาชิกที่อนุมัติแล้วเห็นกันเองได้ (ต้องใช้ชื่อคนรับผิดชอบงานบนการ์ด)
create policy users_select_team on users
  for select using (app_is_approved() and status = 'approved');

create policy users_select_admin on users
  for select using (app_is_admin());

-- สมัครสมาชิกด้วยตัวเอง: ผูกกับ auth ของตัวเอง และต้องเป็น user/pending เท่านั้น
create policy users_insert_self_registration on users
  for insert with check (
    auth_user_id = auth.uid() and role = 'user' and status = 'pending'
  );

create policy users_update_self on users
  for update using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

create policy users_update_admin on users
  for update using (app_is_admin()) with check (app_is_admin());

create policy users_delete_super_admin on users
  for delete using (app_current_role() = 'super_admin');

-- =============================================================================
-- projects
-- =============================================================================
create policy projects_select_approved on projects
  for select using (app_is_approved());

create policy projects_write_admin on projects
  for all using (app_is_admin()) with check (app_is_admin());

-- =============================================================================
-- tasks
-- =============================================================================
create policy tasks_select_approved on tasks
  for select using (app_is_approved());

-- สร้างงานได้ถ้าเป็นสมาชิกที่อนุมัติแล้ว และต้องเป็นคนที่เกี่ยวข้องกับงานนั้นจริง
create policy tasks_insert_member on tasks
  for insert with check (
    app_is_approved()
    and (
      app_is_admin()
      or app_current_user_id() in (assigned_to_user_id, assigned_target_user_id, created_by_user_id)
    )
  );

create policy tasks_update_stakeholder on tasks
  for update using (app_can_edit_task(id, app_current_user_id()))
  with check (app_can_edit_task(id, app_current_user_id()));

create policy tasks_delete_admin on tasks
  for delete using (app_is_admin());

-- =============================================================================
-- ตารางลูกของ task — อ่านได้ถ้าเป็นสมาชิก, แก้ได้ถ้าแก้งานแม่ได้
-- =============================================================================
create policy checklist_select on task_checklist_items
  for select using (app_is_approved());
create policy checklist_write on task_checklist_items
  for all using (app_can_edit_task(task_id, app_current_user_id()))
  with check (app_can_edit_task(task_id, app_current_user_id()));

create policy milestones_select on task_milestones
  for select using (app_is_approved());
create policy milestones_write on task_milestones
  for all using (app_can_edit_task(task_id, app_current_user_id()))
  with check (app_can_edit_task(task_id, app_current_user_id()));

-- ข้อมูลการเงินเป็นข้อมูลอ่อนไหว: จำกัดให้เฉพาะผู้เกี่ยวข้องกับงานและ admin
create policy financials_select on task_financials
  for select using (app_can_edit_task(task_id, app_current_user_id()));
create policy financials_write on task_financials
  for all using (app_can_edit_task(task_id, app_current_user_id()))
  with check (app_can_edit_task(task_id, app_current_user_id()));

create policy annotations_select on task_annotations
  for select using (app_is_approved());
create policy annotations_insert on task_annotations
  for insert with check (
    app_is_approved() and author_user_id = app_current_user_id()
  );
create policy annotations_update_own on task_annotations
  for update using (author_user_id = app_current_user_id() or app_is_admin())
  with check (author_user_id = app_current_user_id() or app_is_admin());
create policy annotations_delete_own on task_annotations
  for delete using (author_user_id = app_current_user_id() or app_is_admin());

create policy attachments_select on attachments
  for select using (app_is_approved());
create policy attachments_insert on attachments
  for insert with check (
    app_can_edit_task(task_id, app_current_user_id())
    and uploaded_by = app_current_user_id()
  );
create policy attachments_delete on attachments
  for delete using (uploaded_by = app_current_user_id() or app_is_admin());

-- =============================================================================
-- task_logs — append-only
-- ไม่มี policy สำหรับ UPDATE/DELETE โดยตั้งใจ (และมี trigger กันไว้อีกชั้น)
-- =============================================================================
create policy task_logs_select on task_logs
  for select using (app_is_approved());

create policy task_logs_insert_own_action on task_logs
  for insert with check (
    app_is_approved()
    and action_by_user_id = app_current_user_id()
    and app_can_edit_task(task_id, app_current_user_id())
  );

-- =============================================================================
-- notifications — เห็นและจัดการได้เฉพาะของตัวเอง
-- การสร้างแจ้งเตือนถึงคนอื่นทำผ่าน app_change_task_status() เท่านั้น
-- =============================================================================
create policy notifications_select_own on notifications
  for select using (recipient_user_id = app_current_user_id());

create policy notifications_update_own on notifications
  for update using (recipient_user_id = app_current_user_id())
  with check (recipient_user_id = app_current_user_id());

create policy notifications_delete_own on notifications
  for delete using (recipient_user_id = app_current_user_id());

create policy notifications_insert_admin on notifications
  for insert with check (app_is_admin());

-- ผู้เกี่ยวข้องกับงานส่งแจ้งเตือนหากันได้ เฉพาะเรื่องที่อ้างถึงงานใบนั้นจริง ๆ
-- (ทั้งผู้ส่งและผู้รับต้องอยู่ในวงงานเดียวกัน จึงส่งหาใครมั่ว ๆ ไม่ได้)
create policy notifications_insert_task_scope on notifications
  for insert with check (
    app_is_approved()
    and task_id is not null
    and app_can_edit_task(task_id, app_current_user_id())
    and app_can_edit_task(task_id, recipient_user_id)
  );

-- =============================================================================
-- flow_templates
-- =============================================================================
create policy flow_templates_select on flow_templates
  for select using (app_is_approved());
create policy flow_templates_write_admin on flow_templates
  for all using (app_is_admin()) with check (app_is_admin());

create policy flow_items_select on flow_template_items
  for select using (app_is_approved());
create policy flow_items_write_admin on flow_template_items
  for all using (app_is_admin()) with check (app_is_admin());

-- =============================================================================
-- Grants — Supabase ให้ default privileges กับ anon/authenticated อยู่แล้ว
-- แต่เขียนไว้ชัด ๆ เผื่อรันบน Postgres ธรรมดา
-- =============================================================================
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant usage on schema public to authenticated;
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant usage, select on all sequences in schema public to authenticated;
    grant execute on all functions in schema public to authenticated;
  end if;

  -- anon (ยังไม่ล็อกอิน) ไม่ให้แตะข้อมูลอะไรเลย
  -- การสมัครสมาชิกทำหลัง supabase.auth.signUp() ซึ่งตอนนั้นเป็น authenticated แล้ว
  -- จึงเข้าเงื่อนไข policy users_insert_self_registration ได้พอดี
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon;
  end if;
end
$$;

commit;
