-- =============================================================================
-- NP Taskwork — ระบบติดตามงาน
-- 02_views_functions.sql : Business logic functions + Reporting views
--
-- Views ทั้งหมดตั้ง security_invoker = true เพื่อให้ RLS ของผู้เรียกมีผล
-- (ต้องใช้ PostgreSQL 15 ขึ้นไป — Supabase ผ่านข้อนี้อยู่แล้ว)
-- =============================================================================

begin;

-- =============================================================================
-- SECTION 0 — Identity helpers (ใช้ทั้งใน function ด้านล่างและใน RLS policies)
-- security definer + search_path คงที่ เพื่อไม่ให้ policy บนตาราง users วนลูปตัวเอง
-- =============================================================================

-- id ของผู้ใช้ในตาราง users ที่ผูกกับ session ปัจจุบันของ Supabase Auth
create or replace function app_current_user_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from users where auth_user_id = auth.uid();
$$;

create or replace function app_current_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from users where auth_user_id = auth.uid();
$$;

create or replace function app_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from users
    where auth_user_id = auth.uid()
      and status = 'approved'
      and role in ('admin', 'super_admin')
  );
$$;

create or replace function app_is_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from users where auth_user_id = auth.uid() and status = 'approved'
  );
$$;

-- =============================================================================
-- SECTION 1 — Business logic functions
-- =============================================================================

-- -----------------------------------------------------------------------------
-- app_calc_sla_status : กติกา SLA เดียวกับ AppContext.tsx
--   - งานที่อนุมัติแล้ว : ปิดทันเดดไลน์ = on_time, เลย = delayed
--   - ยังไม่เลยเดดไลน์  : on_time
--   - เลยเดดไลน์แล้ว    : ไม่อัปเดตเกิน 48 ชม. = no_update, นอกนั้น = delayed
-- -----------------------------------------------------------------------------
create or replace function app_calc_sla_status(
  p_status          task_status,
  p_deadline_at     timestamptz,
  p_last_updated_at timestamptz,
  p_completed_at    timestamptz default null,
  p_stale_hours     integer     default 48,
  p_now             timestamptz default now()
) returns sla_status
language sql immutable as $$
  select case
    when p_status = 'approved' then
      case when coalesce(p_completed_at, p_now) <= p_deadline_at
           then 'on_time'::sla_status else 'delayed'::sla_status end
    when p_now <= p_deadline_at then 'on_time'::sla_status
    when extract(epoch from (p_now - p_last_updated_at)) / 3600.0 > p_stale_hours
      then 'no_update'::sla_status
    else 'delayed'::sla_status
  end;
$$;

comment on function app_calc_sla_status is
  'คำนวณสถานะ SLA ของงาน — ตรงกับกติกาใน src/context/AppContext.tsx';

-- -----------------------------------------------------------------------------
-- app_refresh_sla_statuses : งาน batch สำหรับ pg_cron / Edge Function
-- เขียนทับเฉพาะแถวที่ค่าเปลี่ยนจริง (trigger touch จะไม่ขยับ last_updated_at)
-- -----------------------------------------------------------------------------
create or replace function app_refresh_sla_statuses()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  with recalculated as (
    select id,
           app_calc_sla_status(status, deadline_at, last_updated_at, completed_at) as new_sla
    from tasks
    where status <> 'approved'
  )
  update tasks t
     set sla_status = r.new_sla
    from recalculated r
   where t.id = r.id
     and t.sla_status is distinct from r.new_sla;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function app_refresh_sla_statuses is
  'อัปเดต sla_status ของงานที่ยังไม่ปิดทั้งหมด — ตั้ง cron เรียกทุกชั่วโมง';

-- -----------------------------------------------------------------------------
-- app_can_edit_task : ใครแตะงานนี้ได้บ้าง (ใช้ร่วมกันทั้ง function และ RLS)
-- -----------------------------------------------------------------------------
create or replace function app_can_edit_task(p_task_id uuid, p_user_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from tasks t
    join users u on u.id = p_user_id and u.status = 'approved'
    where t.id = p_task_id
      and (
        u.role in ('admin', 'super_admin')
        or p_user_id in (t.assigned_to_user_id, t.assigned_target_user_id,
                         t.reviewer_user_id, t.created_by_user_id)
      )
  );
$$;

-- -----------------------------------------------------------------------------
-- app_change_task_status : เปลี่ยนสถานะงานแบบครบวงจร
--   ตรวจสิทธิ์ -> ตรวจ transition -> อัปเดตงาน -> เขียน audit log -> ยิงแจ้งเตือน
--   ทำในทรานแซกชันเดียว เพื่อไม่ให้เกิดกรณีสถานะเปลี่ยนแต่ log หาย
--
--   p_on_behalf_of_user_id : ใส่เมื่อ "ทำแทน" คนอื่น (default = เจ้าของงาน)
-- -----------------------------------------------------------------------------
create or replace function app_change_task_status(
  p_task_id              uuid,
  p_new_status           task_status,
  p_comment              text default '',
  p_on_behalf_of_user_id uuid default null,
  p_actor_user_id        uuid default null
) returns task_logs
language plpgsql security definer set search_path = public as $$
declare
  v_actor    users;
  v_behalf   users;
  v_task     tasks;
  v_log      task_logs;
  v_allowed  task_status[];
  v_prev     task_status;
begin
  -- ผู้ลงมือ: ระบุมาเอง (ฝั่ง server) หรือดึงจาก session ของ Supabase Auth
  select * into v_actor from users
   where id = coalesce(p_actor_user_id, app_current_user_id());
  if v_actor.id is null then
    raise exception 'ไม่พบผู้ใช้ที่ลงมือทำรายการ' using errcode = 'no_data_found';
  end if;
  if v_actor.status <> 'approved' then
    raise exception 'บัญชี % ยังไม่ได้รับอนุมัติให้ใช้งาน', v_actor.username
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_task from tasks where id = p_task_id for update;
  if v_task.id is null then
    raise exception 'ไม่พบงาน id = %', p_task_id using errcode = 'no_data_found';
  end if;

  if not app_can_edit_task(p_task_id, v_actor.id) then
    raise exception 'ผู้ใช้ % ไม่มีสิทธิ์แก้ไขงาน %', v_actor.username, v_task.code
      using errcode = 'insufficient_privilege';
  end if;

  -- เฉพาะ admin เท่านั้นที่อนุมัติหรือตีกลับได้
  if p_new_status in ('approved', 'returned') and v_actor.role not in ('admin', 'super_admin') then
    raise exception 'เฉพาะผู้ดูแลระบบเท่านั้นที่อนุมัติหรือตีกลับงานได้'
      using errcode = 'insufficient_privilege';
  end if;

  -- ตรวจเส้นทางการเปลี่ยนสถานะ
  v_allowed := case v_task.status
    when 'pending_submission' then array['pending_review']::task_status[]
    when 'pending_review'     then array['approved', 'returned', 'pending_submission']::task_status[]
    when 'returned'           then array['pending_review', 'pending_submission']::task_status[]
    when 'approved'           then array['pending_review']::task_status[]  -- เปิดงานกลับ
  end;

  if p_new_status <> v_task.status and not (p_new_status = any (v_allowed)) then
    raise exception 'เปลี่ยนสถานะจาก % ไปเป็น % ไม่ได้', v_task.status, p_new_status
      using errcode = 'check_violation';
  end if;

  -- ทำแทนใคร: ไม่ระบุ = ทำในนามเจ้าของงาน
  select * into v_behalf from users
   where id = coalesce(p_on_behalf_of_user_id, v_task.assigned_to_user_id);

  v_prev := v_task.status;   -- เก็บสถานะเดิมไว้ก่อน เพราะ update จะเขียนทับ v_task

  update tasks
     set status = p_new_status
   where id = p_task_id
  returning * into v_task;

  insert into task_logs (
    task_id, action_by_user_id, action_by_user_name,
    on_behalf_of_user_id, on_behalf_of_user_name,
    previous_status, new_status, comment
  ) values (
    p_task_id, v_actor.id, v_actor.full_name,
    v_behalf.id, coalesce(v_behalf.full_name, v_actor.full_name),
    nullif(v_prev, p_new_status),
    p_new_status, coalesce(p_comment, '')
  )
  returning * into v_log;

  -- แจ้งเตือนเจ้าของงาน (ไม่ต้องเตือนตัวเองเวลาทำงานของตัวเอง)
  insert into notifications (recipient_user_id, task_id, type, title, message)
  select v_task.assigned_to_user_id, v_task.id,
         case p_new_status
           when 'approved'       then 'status_change'::notification_type
           when 'returned'       then 'returned'::notification_type
           when 'pending_review' then 'approval_required'::notification_type
           else 'status_change'::notification_type
         end,
         case p_new_status
           when 'approved'       then 'งานของคุณได้รับการอนุมัติแล้ว'
           when 'returned'       then 'งานถูกตีกลับแก้ไข'
           when 'pending_review' then 'งานของคุณถูกส่งตรวจ'
           else 'สถานะงานเปลี่ยนแปลง'
         end,
         format('%s ได้อัปเดตงาน "%s"%s', v_actor.full_name, v_task.title,
                case when coalesce(p_comment, '') = '' then '' else ' — ' || p_comment end)
  where v_task.assigned_to_user_id <> v_actor.id;

  -- ส่งตรวจ = แจ้ง admin ทุกคนให้มาตรวจ
  if p_new_status = 'pending_review' then
    insert into notifications (recipient_user_id, task_id, type, title, message)
    select u.id, v_task.id, 'approval_required',
           'มีงานรอตรวจสอบ',
           format('งาน "%s" (%s) รอการตรวจสอบจากคุณ', v_task.title, v_task.code)
    from users u
    where u.role in ('admin', 'super_admin')
      and u.status = 'approved'
      and u.id <> v_actor.id;
  end if;

  return v_log;
end;
$$;

comment on function app_change_task_status is
  'เปลี่ยนสถานะงาน + เขียน audit log + แจ้งเตือน ในทรานแซกชันเดียว';

-- -----------------------------------------------------------------------------
-- app_apply_flow_template : เติม checklist จากเทมเพลต Flow ลงในงาน
-- -----------------------------------------------------------------------------
create or replace function app_apply_flow_template(
  p_task_id       uuid,
  p_template_id   uuid,
  p_replace       boolean default false,
  p_actor_user_id uuid    default null
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_offset integer;
  v_count  integer;
begin
  -- ผู้ลงมือ: ระบุมาเอง (ฝั่ง server) หรือดึงจาก session ของ Supabase Auth
  if not app_can_edit_task(p_task_id, coalesce(p_actor_user_id, app_current_user_id())) then
    raise exception 'ไม่มีสิทธิ์แก้ไขงานนี้' using errcode = 'insufficient_privilege';
  end if;

  if p_replace then
    delete from task_checklist_items where task_id = p_task_id;
  end if;

  select coalesce(max(sort_order), 0) into v_offset
    from task_checklist_items where task_id = p_task_id;

  insert into task_checklist_items (task_id, sort_order, title)
  select p_task_id, v_offset + i.sort_order, i.title
  from flow_template_items i
  where i.template_id = p_template_id
  order by i.sort_order;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- app_approve_user : admin อนุมัติผู้ใช้ที่สมัครเข้ามา
-- -----------------------------------------------------------------------------
create or replace function app_approve_user(
  p_user_id  uuid,
  p_approve  boolean default true
) returns users
language plpgsql security definer set search_path = public as $$
declare
  v_user users;
begin
  if not app_is_admin() then
    raise exception 'เฉพาะผู้ดูแลระบบเท่านั้นที่อนุมัติผู้ใช้ได้'
      using errcode = 'insufficient_privilege';
  end if;

  update users
     set status = case when p_approve then 'approved'::user_status else 'rejected'::user_status end
   where id = p_user_id
  returning * into v_user;

  if v_user.id is null then
    raise exception 'ไม่พบผู้ใช้ id = %', p_user_id using errcode = 'no_data_found';
  end if;

  insert into notifications (recipient_user_id, type, title, message)
  values (v_user.id, 'status_change',
          case when p_approve then 'บัญชีของคุณได้รับการอนุมัติ' else 'บัญชีของคุณไม่ได้รับการอนุมัติ' end,
          case when p_approve then 'คุณสามารถเข้าใช้งานระบบติดตามงานได้แล้ว'
               else 'กรุณาติดต่อผู้ดูแลระบบเพื่อสอบถามรายละเอียด' end);

  return v_user;
end;
$$;

-- =============================================================================
-- SECTION 2 — Reporting views
--
-- ลบ view เดิมทิ้งก่อนเสมอ เพราะ create or replace view เพิ่มคอลัมน์ได้เฉพาะ
-- ต่อท้ายรายการเท่านั้น ถ้าแทรกคอลัมน์ตรงกลางจะขึ้น error 42P16
-- (cascade เพื่อให้ v_tasks ที่อ้าง v_task_progress ถูกลบตามไปด้วยตามลำดับ)
-- =============================================================================
drop view if exists
  v_audit_log,
  v_tasks_needing_alert,
  v_ku_project_financials,
  v_ku_milestones,
  v_user_workload,
  v_project_dashboard,
  v_tasks,
  v_task_progress
cascade;

-- -----------------------------------------------------------------------------
-- v_task_progress : ความคืบหน้า checklist ของแต่ละงาน
-- -----------------------------------------------------------------------------
create or replace view v_task_progress
with (security_invoker = true) as
select
  t.id as task_id,
  count(c.id)                                          as checklist_total,
  count(c.id) filter (where c.completed)                as checklist_done,
  count(c.id) filter (where c.result_status = 'fail')   as checklist_failed,
  case when count(c.id) = 0 then 0
       else round(100.0 * count(c.id) filter (where c.completed) / count(c.id), 1)
  end as progress_percent
from tasks t
left join task_checklist_items c on c.task_id = t.id
group by t.id;

-- -----------------------------------------------------------------------------
-- v_tasks : งานพร้อมชื่อทุกฝ่าย + SLA สดจากเวลาปัจจุบัน
-- ใช้แทน tasks ในหน้าจอทั้งหมด — คืนรูปทรงใกล้เคียง interface Task ใน types.ts
-- -----------------------------------------------------------------------------
create or replace view v_tasks
with (security_invoker = true) as
select
  t.id,
  t.code,
  t.project_id,
  p.name  as project_name,
  p.color as project_color,
  t.title,
  t.description,
  t.assigned_to_user_id,
  owner.full_name    as assigned_to_user_name,
  t.assigned_target_user_id,
  target.full_name   as assigned_target_user_name,
  t.reviewer_user_id,
  reviewer.full_name as reviewer_user_name,
  t.created_by_user_id,
  t.status,
  -- sla_status ในตารางคือค่าที่ batch เขียนไว้; live_sla_status คำนวณ ณ เวลาที่ query
  t.sla_status,
  app_calc_sla_status(t.status, t.deadline_at, t.last_updated_at, t.completed_at) as live_sla_status,
  t.plan_days,
  t.created_at,
  t.deadline_at,
  t.completed_at,
  t.lead_time_days,
  t.last_updated_at,
  t.last_inactivity_alert_at,
  t.category,
  t.ku_proposal_status,
  t.ku_deadline,
  t.tor_document_name,
  t.tor_document_url,
  t.google_drive_url,
  t.delay_reason,
  t.voice_memo_url,
  t.holder_name,
  t.is_draft,
  t.incomplete_warnings,
  pr.checklist_total,
  pr.checklist_done,
  pr.progress_percent,
  -- ตัวเลขที่หน้าจอใช้บ่อย คำนวณให้เลยจะได้ไม่ต้องคิดซ้ำในหลาย component
  greatest(0, ceil(extract(epoch from (t.deadline_at - now())) / 86400.0))::int
    as days_remaining,
  case when t.status <> 'approved' and now() > t.deadline_at
       then ceil(extract(epoch from (now() - t.deadline_at)) / 86400.0)::int
       else 0 end as days_overdue,
  round(extract(epoch from (now() - t.last_updated_at)) / 3600.0, 1) as hours_since_update,
  (select count(*) from attachments a where a.task_id = t.id) as attachment_count,
  (select count(*) from task_annotations an where an.task_id = t.id) as annotation_count
from tasks t
join projects p           on p.id = t.project_id
join users owner          on owner.id = t.assigned_to_user_id
left join users target    on target.id = t.assigned_target_user_id
left join users reviewer  on reviewer.id = t.reviewer_user_id
left join v_task_progress pr on pr.task_id = t.id;

-- -----------------------------------------------------------------------------
-- v_project_dashboard : สรุปรายโครงการสำหรับหน้า Dashboard
-- -----------------------------------------------------------------------------
create or replace view v_project_dashboard
with (security_invoker = true) as
select
  p.id   as project_id,
  p.name as project_name,
  p.color,
  p.category,
  count(t.id)                                                    as total_tasks,
  count(t.id) filter (where t.status = 'pending_submission')      as pending_submission,
  count(t.id) filter (where t.status = 'pending_review')          as pending_review,
  count(t.id) filter (where t.status = 'returned')                as returned,
  count(t.id) filter (where t.status = 'approved')                as approved,
  count(t.id) filter (where t.status <> 'approved' and now() > t.deadline_at) as overdue,
  count(t.id) filter (where t.sla_status = 'no_update')           as stale,
  case when count(t.id) = 0 then 0
       else round(100.0 * count(t.id) filter (where t.status = 'approved') / count(t.id), 1)
  end as completion_percent,
  round(avg(t.lead_time_days) filter (where t.status = 'approved'), 1) as avg_lead_time_days,
  max(t.last_updated_at) as last_activity_at
from projects p
left join tasks t on t.project_id = p.id
group by p.id, p.name, p.color, p.category;

-- -----------------------------------------------------------------------------
-- v_user_workload : ภาระงานรายคน + อัตราตรงเวลา
-- -----------------------------------------------------------------------------
create or replace view v_user_workload
with (security_invoker = true) as
select
  u.id   as user_id,
  u.full_name,
  u.role,
  count(t.id) filter (where t.status <> 'approved')               as open_tasks,
  count(t.id) filter (where t.status = 'pending_review')          as awaiting_review,
  count(t.id) filter (where t.status = 'returned')                as returned_tasks,
  count(t.id) filter (where t.status <> 'approved' and now() > t.deadline_at) as overdue_tasks,
  count(t.id) filter (where t.status = 'approved')                as completed_tasks,
  count(t.id) filter (where t.status = 'approved' and t.sla_status = 'on_time') as completed_on_time,
  case when count(t.id) filter (where t.status = 'approved') = 0 then null
       else round(100.0 * count(t.id) filter (where t.status = 'approved' and t.sla_status = 'on_time')
                  / count(t.id) filter (where t.status = 'approved'), 1)
  end as on_time_rate_percent,
  round(avg(t.lead_time_days) filter (where t.status = 'approved'), 1) as avg_lead_time_days
from users u
left join tasks t on t.assigned_to_user_id = u.id
where u.status = 'approved'
group by u.id, u.full_name, u.role;

-- -----------------------------------------------------------------------------
-- v_ku_milestones : งวดงานโครงการ + สถานะเบิกจ่าย 2 ระดับ
-- -----------------------------------------------------------------------------
create or replace view v_ku_milestones
with (security_invoker = true) as
select
  m.id as milestone_id,
  m.task_id,
  t.code   as task_code,
  t.title  as task_title,
  t.ku_proposal_status,
  p.name   as project_name,
  m.milestone_number,
  m.title  as milestone_title,
  m.deliverables,
  m.amount,
  m.due_date,
  m.status,
  m.project_payout_status,
  m.project_payout_date,
  m.holder_payout_status,
  m.holder_payout_date,
  coalesce(m.holder_name, t.holder_name) as holder_name,
  m.evidence_file_url,
  m.evidence_file_name,
  (m.due_date < current_date and m.status <> 'approved') as is_overdue,
  (m.due_date - current_date) as days_to_due
from task_milestones m
join tasks t    on t.id = m.task_id
join projects p on p.id = t.project_id;

-- -----------------------------------------------------------------------------
-- v_ku_project_financials : ยอดเงินรวมรายโครงการ (ระดับงาน)
-- -----------------------------------------------------------------------------
create or replace view v_ku_project_financials
with (security_invoker = true) as
select
  t.id     as task_id,
  t.code   as task_code,
  t.title  as task_title,
  p.name   as project_name,
  t.holder_name,
  count(m.id)                                          as milestone_count,
  coalesce(sum(m.amount), 0)                           as total_contract_amount,
  coalesce(sum(m.amount) filter (where m.status = 'approved'), 0)      as approved_amount,
  coalesce(sum(m.amount) filter (where m.project_payout_status = 'เบิกสำเร็จ'), 0) as project_paid_amount,
  coalesce(sum(m.amount) filter (where m.holder_payout_status  = 'เบิกสำเร็จ'), 0) as holder_paid_amount,
  coalesce(sum(m.amount) filter (where coalesce(m.project_payout_status, 'รอเบิก') <> 'เบิกสำเร็จ'), 0)
    as outstanding_amount,
  -- ระดับ Two-Tier ของตัวงานเอง (ถ้ากรอกไว้)
  f.project_installment,
  f.approved_remuneration,
  f.approved_materials,
  f.approved_expenses,
  f.remaining_balance
from tasks t
join projects p on p.id = t.project_id
left join task_milestones m on m.task_id = t.id
left join task_financials f on f.task_id = t.id
where t.category = 'ku_university' or m.id is not null or f.task_id is not null
group by t.id, t.code, t.title, p.name, t.holder_name,
         f.project_installment, f.approved_remuneration, f.approved_materials,
         f.approved_expenses, f.remaining_balance;

-- -----------------------------------------------------------------------------
-- v_tasks_needing_alert : งานที่เงียบเกินเกณฑ์ของเจ้าของงาน (no_update_alert_hours)
-- ใช้ป้อน job แจ้งเตือน LINE — กรองงานที่เพิ่งเตือนไปแล้วออก
-- -----------------------------------------------------------------------------
create or replace view v_tasks_needing_alert
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
  u.line_notify_enabled,
  round(extract(epoch from (now() - t.last_updated_at)) / 3600.0, 1) as hours_since_update
from tasks t
join users u on u.id = t.assigned_to_user_id
where t.status <> 'approved'
  and t.is_draft = false
  and extract(epoch from (now() - t.last_updated_at)) / 3600.0 >= u.no_update_alert_hours
  and (t.last_inactivity_alert_at is null
       or t.last_inactivity_alert_at < now() - make_interval(hours => u.no_update_alert_hours));

-- -----------------------------------------------------------------------------
-- v_audit_log : ประวัติทั้งหมด พร้อมธง "ทำแทน" สำหรับหน้า AuditLogView
-- -----------------------------------------------------------------------------
create or replace view v_audit_log
with (security_invoker = true) as
select
  l.id as log_id,
  l.created_at,
  l.task_id,
  t.code  as task_code,
  t.title as task_title,
  p.name  as project_name,
  l.action_by_user_id,
  l.action_by_user_name,
  l.on_behalf_of_user_id,
  l.on_behalf_of_user_name,
  (l.action_by_user_id is distinct from l.on_behalf_of_user_id) as is_proxy_action,
  l.previous_status,
  l.new_status,
  l.comment,
  (select count(*) from attachments a where a.log_id = l.id) as attachment_count
from task_logs l
join tasks t    on t.id = l.task_id
join projects p on p.id = t.project_id;

commit;
