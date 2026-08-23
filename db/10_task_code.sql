-- =============================================================================
-- NP Taskwork — ระบบติดตามงาน
-- 10_task_code.sql : ออกรหัสการ์ดงานจากฝั่งฐานข้อมูล
--
-- ปัญหาเดิม
--   ฝั่งหน้าเว็บคิดเลขรันเองจาก tasks.length ซึ่งเป็นจำนวนการ์ดที่อยู่ใน
--   หน่วยความจำของเบราว์เซอร์คนนั้น (CreateTaskModal.tsx) แถมคิดครั้งเดียว
--   ตอนเปิดหน้าต่าง เลขจึงค้างตั้งแต่วินาทีแรก ผลคือ
--     - สองคนเปิดพร้อมกัน ได้เลขเดียวกัน -> insert ชน unique
--     - ไม่ refresh หลังคนอื่นสร้าง -> เลขค้าง ชนของที่มีอยู่
--     - ลบการ์ดทิ้ง -> length ลดลง เลขเก่าถูกใช้ซ้ำ
--
-- กติกาใหม่
--   ฐานข้อมูลเป็นคนออกเลข เพราะเป็นที่เดียวที่รู้ความจริงว่ามีอะไรอยู่บ้าง
--   ใช้ insert ... on conflict do update ... returning ซึ่ง PostgreSQL
--   รับประกันความอะตอมมิก สองคนกดพร้อมกันคนที่สองจะรอแล้วได้เลขถัดไป
--   ชนกันไม่ได้เชิงโครงสร้าง ไม่ใช่แค่โอกาสน้อยลง
--
--   รูปแบบ #NP-MM/YY-NNN โดยเลขรันเริ่มนับใหม่ทุกเดือน แยกตามหมวดงาน
--
-- ไฟล์นี้รันซ้ำได้ และต้องรันหลัง 01_schema.sql
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- task_code_counters : ตัวนับเลขรัน แยกตาม (หมวดงาน, เดือน)
-- -----------------------------------------------------------------------------
create table if not exists task_code_counters (
  prefix     text    not null,
  period     text    not null,
  last_seq   integer not null default 0,
  updated_at timestamptz not null default now(),

  primary key (prefix, period),
  constraint task_code_counters_seq_nonneg check (last_seq >= 0)
);

comment on table task_code_counters is
  'ตัวนับเลขรันของรหัสการ์ดงาน แยกตามหมวดงานและเดือน — แตะผ่านฟังก์ชันเท่านั้น';

-- ตารางนี้ไม่มี policy เลย ฝั่งหน้าเว็บจึงอ่านและเขียนไม่ได้
-- ฟังก์ชันด้านล่างเป็น security definer จึงข้าม RLS ได้ตามปกติ
alter table task_code_counters enable row level security;

-- -----------------------------------------------------------------------------
-- app_task_code_prefix : หมวดงาน -> ตัวนำหน้ารหัส
-- -----------------------------------------------------------------------------
create or replace function app_task_code_prefix(p_category project_category)
returns text language sql immutable as $$
  select case p_category
           when 'ku_university' then 'PJ'
           when 'drawing_draft' then 'DWG'
           else 'NP'
         end;
$$;

-- -----------------------------------------------------------------------------
-- app_next_task_code : ออกรหัสถัดไปแบบอะตอมมิก
--
-- หัวใจอยู่ที่ on conflict do update — PostgreSQL ล็อกแถวตัวนับระหว่างทำงาน
-- ธุรกรรมที่สองจะรอจนธุรกรรมแรกจบ แล้วค่อยอ่านค่าที่อัปเดตแล้วไปบวกต่อ
-- จึงเป็นไปไม่ได้ที่สองคนจะได้เลขเดียวกัน
--
-- p_now รับเข้ามาเพื่อให้เทสต์กำหนดเดือนได้ ใช้งานจริงปล่อยเป็น now()
-- -----------------------------------------------------------------------------
create or replace function app_next_task_code(
  p_category project_category,
  p_now      timestamptz default now()
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_prefix text := app_task_code_prefix(p_category);
  v_period text := to_char(p_now at time zone 'Asia/Bangkok', 'MM/YY');
  v_seq    integer;
begin
  insert into task_code_counters (prefix, period, last_seq)
  values (v_prefix, v_period, 1)
  on conflict (prefix, period) do update
    set last_seq = task_code_counters.last_seq + 1,
        updated_at = now()
  returning last_seq into v_seq;

  return format('#%s-%s-%s', v_prefix, v_period, lpad(v_seq::text, 3, '0'));
end;
$$;

-- ฟังก์ชันนี้มีผลข้างเคียง (กินเลขไป 1) ให้เรียกได้เฉพาะ trigger และฝั่งเซิร์ฟเวอร์
revoke execute on function app_next_task_code(project_category, timestamptz)
  from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- app_seed_task_code_counters : ตั้งตัวนับจากรหัสที่มีอยู่แล้ว
--
-- จำเป็นตอนติดตั้งครั้งแรก และตอนนำเข้าข้อมูลเก่าที่มีรหัสรูปแบบเดียวกัน
-- ไม่งั้นตัวนับเริ่มจาก 0 แล้วออกเลขชนของเดิมทันที
-- -----------------------------------------------------------------------------
create or replace function app_seed_task_code_counters() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_rows integer;
begin
  insert into task_code_counters (prefix, period, last_seq)
  select m.prefix, m.period, max(m.seq)
    from (
      select substring(code from '^#([A-Z]+)-')                    as prefix,
             substring(code from '^#[A-Z]+-([0-9]{2}/[0-9]{2})-')  as period,
             substring(code from '-([0-9]{3})$')::integer          as seq
        from tasks
       where code ~ '^#[A-Z]+-[0-9]{2}/[0-9]{2}-[0-9]{3}$'
    ) m
   group by m.prefix, m.period
  on conflict (prefix, period) do update
    set last_seq = greatest(task_code_counters.last_seq, excluded.last_seq),
        updated_at = now();

  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

revoke execute on function app_seed_task_code_counters() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- trigger : เติมรหัสให้ตอน insert ถ้าผู้เรียกไม่ได้ส่งมา
--
-- ต้องถอด default ของคอลัมน์ออกก่อน ไม่งั้น default ('NP-' || nextval(...))
-- จะเติมค่าให้ตั้งแต่ก่อน trigger ทำงาน แล้ว trigger จะมองว่า "ส่งรหัสมาแล้ว"
-- (คอลัมน์ยังเป็น not null อยู่ ตรวจหลัง before trigger จึงไม่มีปัญหา)
-- -----------------------------------------------------------------------------
alter table tasks alter column code drop default;

create or replace function trg_tasks_assign_code() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.code is null or btrim(new.code) = '' then
    new.code := app_next_task_code(new.category, coalesce(new.created_at, now()));
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_assign_code on tasks;
create trigger tasks_assign_code before insert on tasks
  for each row execute function trg_tasks_assign_code();

-- ตั้งตัวนับจากข้อมูลที่มีอยู่ ณ ตอนติดตั้ง
select app_seed_task_code_counters();

commit;
