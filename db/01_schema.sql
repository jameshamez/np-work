-- =============================================================================
-- NP Taskwork — ระบบติดตามงาน
-- 01_schema.sql : Extensions, Enums, Tables, Constraints, Indexes, Triggers
--
-- Target: PostgreSQL 15+ / Supabase
-- Order  : 01_schema.sql -> 02_views_functions.sql -> 03_rls.sql -> 04_seed.sql
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists citext;     -- case-insensitive username / email
create extension if not exists pg_trgm;    -- fuzzy search บนชื่องาน

-- auth.uid() shim: บน Supabase มีให้อยู่แล้ว, บน Postgres ธรรมดาสร้างตัวจำลองไว้
-- เพื่อให้ไฟล์นี้รันผ่านทั้งสองที่ (policies ใน 03_rls.sql เรียกใช้ auth.uid())
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    create schema auth;
    execute $fn$
      create function auth.uid() returns uuid
      language sql stable
      as $body$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $body$;
    $fn$;
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- Enums  (ตรงกับ src/types.ts)
-- -----------------------------------------------------------------------------
create type user_role          as enum ('user', 'admin', 'super_admin');
create type user_status        as enum ('pending', 'approved', 'rejected');

create type task_status        as enum ('pending_submission', 'pending_review', 'returned', 'approved');
create type sla_status         as enum ('on_time', 'delayed', 'no_update');

create type project_category   as enum (
  'general',        -- งานประจำ (Routine / Maintenance)
  'ku_university',  -- งานโครงการ (ทุกแหล่งทุน: เกษตร, บพข., ทอพ., ปากเลา, ส้มป่อย, พ็อก)
  'rd_project',     -- R&D Project
  'sales_presale',  -- งานเสนอราคา & ประเมินหน้างาน
  'drawing_draft'   -- งานเขียนแบบ / ตรวจภาพแปลน
);

create type ku_proposal_status as enum (
  '1_draft_proposal',
  '2_aj_nui_open',
  '3_ploy_revision',
  '4_wait_aj_nui_approval',
  '5_ploy_system_submit',
  '6_agency_review',
  '7_passed_with_revision',
  '8_approved_run_terms'
);

create type milestone_status       as enum ('pending', 'submitted', 'approved');
create type project_payout_status  as enum ('รอเบิก', 'กำลังดำเนินการ', 'เบิกสำเร็จ');
create type holder_payout_status   as enum ('รออนุมัติ', 'กำลังดำเนินการ', 'เบิกสำเร็จ');

create type checklist_result       as enum ('success', 'fail');
create type attachment_file_type   as enum ('image', 'file');

create type notification_type as enum (
  'status_change', 'approval_required', 'returned', 'sla_warning',
  'line_notify_sent', 'hourly_reminder', 'ku_status_update'
);

-- -----------------------------------------------------------------------------
-- users
-- legacy_id เก็บ id เดิมจาก localStorage (เช่น 'usr-ploy') ไว้ใช้ตอน migrate
-- auth_user_id ผูกกับ Supabase Auth (ปล่อย null ได้ถ้ายังไม่ใช้ Auth)
-- -----------------------------------------------------------------------------
create table users (
  id                     uuid primary key default gen_random_uuid(),
  legacy_id              text unique,
  auth_user_id           uuid unique,
  username               citext not null unique,
  full_name              text   not null,
  email                  citext not null unique,
  role                   user_role   not null default 'user',
  status                 user_status not null default 'pending',
  avatar_url             text,
  no_update_alert_hours  integer not null default 4,
  line_notify_enabled    boolean not null default true,
  line_notify_token      text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint users_username_len   check (char_length(username) between 3 and 64),
  constraint users_email_format   check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint users_alert_hours_rng check (no_update_alert_hours between 1 and 168)
);

comment on table  users is 'ผู้ใช้งานระบบ — สมัครแล้วต้องรอ admin อนุมัติ (status = pending)';
comment on column users.legacy_id is 'id เดิมจาก localStorage สำหรับ migrate ข้อมูล';
comment on column users.no_update_alert_hours is 'ชั่วโมงที่ไม่มีอัปเดตแล้วให้เตือน (default 4)';

create index users_role_status_idx on users (role, status);
create index users_status_idx      on users (status) where status = 'pending';

-- -----------------------------------------------------------------------------
-- projects
-- -----------------------------------------------------------------------------
create table projects (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   text unique,
  name        text not null,
  description text not null default '',
  color       text not null default '#64748b',
  category    project_category,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint projects_name_not_blank check (btrim(name) <> ''),
  constraint projects_color_hex      check (color ~* '^#[0-9a-f]{6}$')
);

create index projects_category_idx on projects (category);
create index projects_name_trgm_idx on projects using gin (name gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- task_code_seq : ออกรหัสงานอัตโนมัติ NP-xxx
-- -----------------------------------------------------------------------------
create sequence task_code_seq start with 400 increment by 1;

-- -----------------------------------------------------------------------------
-- tasks
-- หมายเหตุ: ตัดฟิลด์ชื่อซ้ำซ้อน (projectName / assignedToUserName ฯลฯ) ออก
--           ให้ join เอาจาก view v_tasks แทน เพื่อไม่ให้ข้อมูลชื่อหลุด sync
-- -----------------------------------------------------------------------------
create table tasks (
  id                       uuid primary key default gen_random_uuid(),
  legacy_id                text unique,
  code                     text not null unique default ('NP-' || nextval('task_code_seq')),
  project_id               uuid not null references projects (id) on delete restrict,
  title                    text not null,
  description              text not null default '',

  -- ผู้เกี่ยวข้อง
  assigned_to_user_id      uuid not null references users (id) on delete restrict, -- เจ้าของงานตัวจริง
  assigned_target_user_id  uuid references users (id) on delete set null,          -- ผู้รับงานต่อ (เช่น พลอย -> พี่ฟ้อง)
  reviewer_user_id         uuid references users (id) on delete set null,          -- ผู้ตรวจงาน
  created_by_user_id       uuid references users (id) on delete set null,

  -- สถานะและเวลา
  status                   task_status not null default 'pending_submission',
  sla_status               sla_status  not null default 'on_time',
  plan_days                integer     not null default 1,
  created_at               timestamptz not null default now(),
  deadline_at              timestamptz not null,
  completed_at             timestamptz,
  lead_time_days           integer,
  last_updated_at          timestamptz not null default now(),
  last_inactivity_alert_at timestamptz,

  -- ข้อมูลเสริมตามประเภทงาน
  category                 project_category,
  ku_proposal_status       ku_proposal_status,
  ku_deadline              date,
  tor_document_name        text,
  tor_document_url         text,
  google_drive_url         text,
  delay_reason             text,
  voice_memo_url           text,
  holder_name              text,
  is_draft                 boolean not null default false,
  incomplete_warnings      text[]  not null default '{}',

  constraint tasks_title_not_blank  check (btrim(title) <> ''),
  constraint tasks_plan_days_pos    check (plan_days > 0),
  constraint tasks_deadline_after_create check (deadline_at >= created_at),
  constraint tasks_lead_time_nonneg check (lead_time_days is null or lead_time_days >= 0),
  -- งานที่อนุมัติแล้วต้องมีเวลาปิดงานเสมอ และงานที่ยังไม่อนุมัติต้องไม่มี
  constraint tasks_completed_matches_status check (
    (status = 'approved' and completed_at is not null)
    or (status <> 'approved' and completed_at is null)
  ),
  -- ku_proposal_status ใช้ได้เฉพาะงานหมวดโครงการ
  constraint tasks_ku_status_requires_category check (
    ku_proposal_status is null or category = 'ku_university'
  )
);

comment on table  tasks is 'การ์ดงานหลัก';
comment on column tasks.assigned_to_user_id is 'เจ้าของงานตัวจริง (Original owner)';
comment on column tasks.assigned_target_user_id is 'ผู้ที่ถูกส่งงานให้ทำต่อ';
comment on column tasks.last_updated_at is 'อัปเดตอัตโนมัติโดย trigger เมื่อเนื้อหางานเปลี่ยน (ไม่นับการ refresh SLA)';

create index tasks_project_idx        on tasks (project_id);
create index tasks_assigned_idx       on tasks (assigned_to_user_id);
create index tasks_target_idx         on tasks (assigned_target_user_id) where assigned_target_user_id is not null;
create index tasks_reviewer_idx       on tasks (reviewer_user_id)        where reviewer_user_id is not null;
create index tasks_status_idx         on tasks (status);
create index tasks_category_idx       on tasks (category);
create index tasks_ku_status_idx      on tasks (ku_proposal_status) where ku_proposal_status is not null;
create index tasks_deadline_idx       on tasks (deadline_at);
-- งานที่ยังไม่ปิด = query ที่ใช้บ่อยที่สุด (Kanban / Dashboard)
create index tasks_open_deadline_idx  on tasks (deadline_at) where status <> 'approved';
create index tasks_open_assignee_idx  on tasks (assigned_to_user_id, status) where status <> 'approved';
create index tasks_title_trgm_idx     on tasks using gin (title gin_trgm_ops);
create index tasks_code_trgm_idx      on tasks using gin (code  gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- task_checklist_items
-- -----------------------------------------------------------------------------
create table task_checklist_items (
  id             uuid primary key default gen_random_uuid(),
  legacy_id      text unique,
  task_id        uuid not null references tasks (id) on delete cascade,
  sort_order     integer not null default 0,
  title          text not null,
  completed      boolean not null default false,
  result_status  checklist_result,
  result_reason  text,
  created_at     timestamptz not null default now(),

  constraint checklist_title_not_blank check (btrim(title) <> ''),
  -- ถ้าผลเป็น fail ต้องระบุเหตุผล
  constraint checklist_fail_needs_reason check (
    result_status is distinct from 'fail' or btrim(coalesce(result_reason, '')) <> ''
  )
);

create index checklist_task_idx on task_checklist_items (task_id, sort_order);

-- -----------------------------------------------------------------------------
-- task_milestones : งวดงาน / งวดเงิน (Two-tier payout tracking)
-- -----------------------------------------------------------------------------
create table task_milestones (
  id                    uuid primary key default gen_random_uuid(),
  legacy_id             text unique,
  task_id               uuid not null references tasks (id) on delete cascade,
  milestone_number      integer not null,
  title                 text not null,
  deliverables          text not null default '',
  amount                numeric(14,2) not null default 0,
  due_date              date not null,
  status                milestone_status not null default 'pending',

  -- ระดับที่ 1: เบิกจากโครงการ
  project_payout_status project_payout_status,
  project_payout_date   date,
  -- ระดับที่ 2: จ่ายผู้ถือเงิน
  holder_payout_status  holder_payout_status,
  holder_payout_date    date,
  holder_name           text,

  evidence_file_url     text,
  evidence_file_name    text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint milestone_amount_nonneg check (amount >= 0),
  constraint milestone_number_pos    check (milestone_number > 0),
  unique (task_id, milestone_number)
);

create index milestones_task_idx      on task_milestones (task_id, milestone_number);
create index milestones_due_idx       on task_milestones (due_date);
create index milestones_payout_idx    on task_milestones (project_payout_status, holder_payout_status);

-- -----------------------------------------------------------------------------
-- task_financials : Two-Tier Financials (1 ต่อ 1 กับ task)
-- remaining_balance คำนวณอัตโนมัติ = ยอดงวดสัญญา - ค่าใช้จ่ายที่อนุมัติเบิกจริง
-- -----------------------------------------------------------------------------
create table task_financials (
  task_id               uuid primary key references tasks (id) on delete cascade,
  project_installment   numeric(14,2) not null default 0,  -- ยอดเงินงวดสัญญาโครงการหลัก
  approved_remuneration numeric(14,2) not null default 0,  -- ค่าตอบแทน
  approved_materials    numeric(14,2) not null default 0,  -- ค่าวัสดุ
  approved_expenses     numeric(14,2) not null default 0,  -- ค่าใช้สอย
  remaining_balance     numeric(14,2) generated always as
    (project_installment - (approved_remuneration + approved_materials + approved_expenses)) stored,
  updated_at            timestamptz not null default now(),

  constraint financials_nonneg check (
    project_installment >= 0 and approved_remuneration >= 0
    and approved_materials >= 0 and approved_expenses >= 0
  )
);

-- -----------------------------------------------------------------------------
-- task_logs : ประวัติการทำงาน / ทำแทน  (append-only — ห้ามแก้/ลบ)
-- เก็บ snapshot ชื่อผู้ใช้ไว้ด้วย เพราะเป็นหลักฐานย้อนหลัง ชื่อ ณ ตอนนั้นต้องไม่เปลี่ยน
-- -----------------------------------------------------------------------------
create table task_logs (
  id                       uuid primary key default gen_random_uuid(),
  legacy_id                text unique,
  task_id                  uuid not null references tasks (id) on delete cascade,
  action_by_user_id        uuid references users (id) on delete set null,
  action_by_user_name      text not null,
  on_behalf_of_user_id     uuid references users (id) on delete set null,
  on_behalf_of_user_name   text not null,
  previous_status          task_status,
  new_status               task_status not null,
  comment                  text not null default '',
  created_at               timestamptz not null default now()
);

comment on table task_logs is 'Audit log แบบ append-only — ถูกล็อกด้วย trigger + RLS';

create index task_logs_task_idx    on task_logs (task_id, created_at desc);
create index task_logs_actor_idx   on task_logs (action_by_user_id, created_at desc);
create index task_logs_behalf_idx  on task_logs (on_behalf_of_user_id, created_at desc);
-- รายการ "ทำแทนคนอื่น" ที่ใช้ในหน้า AuditLogView
create index task_logs_proxy_idx   on task_logs (created_at desc)
  where action_by_user_id is distinct from on_behalf_of_user_id;

-- -----------------------------------------------------------------------------
-- attachments : ไฟล์แนบของงาน (ผูก log ได้ถ้าแนบตอนอัปเดตสถานะ)
-- -----------------------------------------------------------------------------
create table attachments (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       text unique,
  task_id         uuid not null references tasks (id) on delete cascade,
  log_id          uuid references task_logs (id) on delete set null,
  file_name       text not null,
  file_url        text not null,
  file_type       attachment_file_type not null default 'file',
  file_size       bigint not null default 0,   -- bytes
  uploaded_by     uuid references users (id) on delete set null,
  uploaded_by_name text not null default '',
  uploaded_at     timestamptz not null default now(),

  constraint attachments_size_nonneg check (file_size >= 0)
);

create index attachments_task_idx on attachments (task_id, uploaded_at desc);
create index attachments_log_idx  on attachments (log_id) where log_id is not null;

-- -----------------------------------------------------------------------------
-- task_annotations : จุดมาร์กบนภาพแปลน (Drawing Review)
-- x, y เป็นเปอร์เซ็นต์ของขนาดภาพ (0-100) เพื่อให้ zoom แล้วตำแหน่งไม่เพี้ยน
-- -----------------------------------------------------------------------------
create table task_annotations (
  id            uuid primary key default gen_random_uuid(),
  legacy_id     text unique,
  task_id       uuid not null references tasks (id) on delete cascade,
  image_url     text not null,
  x             numeric(6,3) not null,
  y             numeric(6,3) not null,
  radius        numeric(6,3),
  comment       text not null default '',
  author_user_id uuid references users (id) on delete set null,
  author_name   text not null default '',
  created_at    timestamptz not null default now(),

  constraint annotation_x_pct check (x between 0 and 100),
  constraint annotation_y_pct check (y between 0 and 100),
  constraint annotation_radius_pos check (radius is null or radius > 0)
);

create index annotations_task_idx on task_annotations (task_id, created_at);

-- -----------------------------------------------------------------------------
-- notifications
-- -----------------------------------------------------------------------------
create table notifications (
  id                uuid primary key default gen_random_uuid(),
  legacy_id         text unique,
  recipient_user_id uuid not null references users (id) on delete cascade,
  task_id           uuid references tasks (id) on delete cascade,
  type              notification_type not null,
  title             text not null,
  message           text not null default '',
  read              boolean not null default false,
  created_at        timestamptz not null default now()
);

create index notifications_recipient_idx on notifications (recipient_user_id, created_at desc);
-- badge นับเลขแจ้งเตือนที่ยังไม่อ่าน
create index notifications_unread_idx on notifications (recipient_user_id)
  where read = false;

-- -----------------------------------------------------------------------------
-- flow_templates : เทมเพลตขั้นตอนงาน (Flow RD 10 ข้อ, Flow ทุน ม.เกษตร 9 ข้อ ฯลฯ)
-- -----------------------------------------------------------------------------
create table flow_templates (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   text unique,
  name        text not null,
  category    project_category,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint flow_name_not_blank check (btrim(name) <> '')
);

create table flow_template_items (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references flow_templates (id) on delete cascade,
  sort_order  integer not null,
  title       text not null,

  unique (template_id, sort_order)
);

create index flow_items_template_idx on flow_template_items (template_id, sort_order);

-- =============================================================================
-- Triggers
-- =============================================================================

-- อัปเดต updated_at ทุกครั้งที่แก้แถว
create or replace function trg_set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger users_set_updated_at      before update on users
  for each row execute function trg_set_updated_at();
create trigger projects_set_updated_at   before update on projects
  for each row execute function trg_set_updated_at();
create trigger milestones_set_updated_at before update on task_milestones
  for each row execute function trg_set_updated_at();
create trigger financials_set_updated_at before update on task_financials
  for each row execute function trg_set_updated_at();
create trigger flows_set_updated_at      before update on flow_templates
  for each row execute function trg_set_updated_at();

-- -----------------------------------------------------------------------------
-- tasks: last_updated_at ต้องขยับเฉพาะตอน "เนื้องานเปลี่ยน"
-- การ refresh sla_status หรือยิงแจ้งเตือนไม่นับ ไม่งั้นงานค้างจะดูเหมือนมีอัปเดตตลอด
-- -----------------------------------------------------------------------------
create or replace function trg_task_touch_last_updated() returns trigger
language plpgsql as $$
declare
  ignored constant text[] := array['sla_status', 'last_updated_at', 'last_inactivity_alert_at'];
begin
  if (to_jsonb(new) - ignored) is distinct from (to_jsonb(old) - ignored) then
    new.last_updated_at := now();
  end if;
  return new;
end;
$$;

create trigger tasks_touch_last_updated before update on tasks
  for each row execute function trg_task_touch_last_updated();

-- -----------------------------------------------------------------------------
-- tasks: ปิดงาน -> เก็บ completed_at / lead_time_days / SLA สุดท้าย
-- เปิดงานกลับ (ตีกลับหลังอนุมัติ) -> ล้างค่าออก
-- -----------------------------------------------------------------------------
create or replace function trg_task_on_status_change() returns trigger
language plpgsql as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    new.completed_at   := coalesce(new.completed_at, now());
    new.lead_time_days := greatest(
      0, ceil(extract(epoch from (new.completed_at - new.created_at)) / 86400.0)::int
    );
    new.sla_status := case when new.completed_at <= new.deadline_at
                           then 'on_time'::sla_status
                           else 'delayed'::sla_status end;

  elsif new.status <> 'approved' and old.status = 'approved' then
    new.completed_at   := null;
    new.lead_time_days := null;
  end if;

  return new;
end;
$$;

create trigger tasks_on_status_change before update of status on tasks
  for each row execute function trg_task_on_status_change();

-- -----------------------------------------------------------------------------
-- task_logs: append-only  (กัน UPDATE/DELETE แม้แต่จาก service role)
-- -----------------------------------------------------------------------------
create or replace function trg_block_write() returns trigger
language plpgsql as $$
begin
  raise exception 'task_logs เป็น audit log แบบ append-only: ห้าม % แถวที่บันทึกแล้ว', tg_op
    using errcode = 'restrict_violation';
end;
$$;

create trigger task_logs_no_update before update or delete on task_logs
  for each row execute function trg_block_write();

commit;
