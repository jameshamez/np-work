-- =============================================================================
-- NP Taskwork — ระบบติดตามงาน
-- 21_line_reviewer_digest.sql : สรุปงานรออนุมัติรายผู้อนุมัติ ส่งเข้ากลุ่ม LINE ตามเวลา — รันซ้ำได้
--
-- Super Admin ตั้งค่าเองจากหน้าการตั้งค่าระบบ: ผู้อนุมัติ, กลุ่ม LINE, เวลาส่ง, เปิด/ปิด
-- ค่าเริ่มต้นที่ใส่ให้: พี่รักษ์ (Admin_Rak) -> กลุ่ม Cd376209bfd7ffa2e32ed2d1ae413d1be ทุกวัน 17:00 น.
--
-- สิ่งที่เพิ่ม
--   * line_outbox.target_group_id — ถ้าใส่ไว้ line-dispatch ส่งเข้ากลุ่มนั้นกลุ่มเดียว
--     ถ้าว่าง (ข้อความเดิมทั้งหมด) ส่งเข้ากลุ่มหลัก + กลุ่มเพิ่มเติมเหมือนเดิม
--   * ตาราง line_reviewer_digests — การตั้งค่าแต่ละรายการ
--   * app_build_reviewer_digest(ผู้ตรวจ) — การ์ด "รอตรวจ" ที่ผู้ตรวจคือคนนั้น
--     คืน null ถ้าไม่มีงานรอ (ไม่ส่ง "วันนี้ไม่มีงาน" ให้เปลืองโควตา — กติกาเดียวกับ digest เดิม)
--   * app_run_reviewer_digests() — pg_cron เรียกทุกนาที ส่งรายการที่ถึงเวลาแล้ว วันละครั้ง
--   * app_send_reviewer_digest_now(id) — ปุ่ม "ส่งทดสอบตอนนี้" ของ Super Admin
--
-- ⚠️ ต้อง deploy Edge Function line-dispatch เวอร์ชันที่รู้จัก target_group_id ก่อนรันไฟล์นี้
--    ไม่งั้นเวอร์ชันเก่าจะส่งสรุปนี้เข้า "ทุกกลุ่ม" แทนที่จะส่งกลุ่มเดียว
--
-- ต้องรันหลัง 07, 08 และ 20
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- ส่งเฉพาะกลุ่ม
-- -----------------------------------------------------------------------------
alter table line_outbox add column if not exists target_group_id text;

alter table line_outbox drop constraint if exists line_outbox_target_group_format;
alter table line_outbox add constraint line_outbox_target_group_format
  check (target_group_id is null or target_group_id ~ '^C[0-9a-f]{32}$');

alter table line_outbox drop constraint if exists line_outbox_kind_valid;
alter table line_outbox add constraint line_outbox_kind_valid
  check (kind in ('returned', 'broadcast', 'digest', 'test', 'reviewer_digest'));

comment on column line_outbox.target_group_id is
  'ส่งเข้ากลุ่มนี้กลุ่มเดียว — ว่าง = กลุ่มหลัก + กลุ่มเพิ่มเติมทั้งหมด (line_groups)';

-- -----------------------------------------------------------------------------
-- app_build_reviewer_digest : การ์ดที่รอผู้ตรวจคนนี้อนุมัติ
-- -----------------------------------------------------------------------------
create or replace function app_build_reviewer_digest(p_reviewer_user_id uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  c_limit     constant integer := 15;
  v_now       timestamptz := now();
  v_bkk       timestamp   := v_now at time zone 'Asia/Bangkok';
  v_reviewer  text;
  v_thai_date text;
  v_url       text;
  v_count     integer;
  v_lines     text;
  v_msg       text;
begin
  select full_name into v_reviewer from users where id = p_reviewer_user_id;
  if v_reviewer is null then
    return null;
  end if;

  select count(*) into v_count
    from tasks
   where status = 'pending_review' and is_draft = false and reviewer_user_id = p_reviewer_user_id;

  if v_count = 0 then
    return null;
  end if;

  -- รอนานสุดขึ้นก่อน — นับจากเวลาส่งตรวจครั้งล่าสุดใน task_logs
  -- (ไม่ใช้ last_updated_at เพราะถูกเลื่อนทุกครั้งที่มีคนแตะการ์ด เช่น แนบรูปเพิ่มตอนรอตรวจ)
  select string_agg(s.line, E'\n') into v_lines from (
    select format('• [%s] %s — %s (รอ %s)',
                  t.code, t.title, coalesce(u.full_name, 'ไม่ระบุ'),
                  case
                    when v_now - w.since < interval '1 day'
                      then floor(extract(epoch from v_now - w.since) / 3600)::int || ' ชม.'
                    else floor(extract(epoch from v_now - w.since) / 86400)::int || ' วัน'
                  end) as line
      from tasks t
      left join users u on u.id = t.assigned_to_user_id
      cross join lateral (
        select coalesce(
                 (select max(l.created_at) from task_logs l
                   where l.task_id = t.id and l.new_status = 'pending_review'),
                 t.last_updated_at) as since
      ) w
     where t.status = 'pending_review' and t.is_draft = false and t.reviewer_user_id = p_reviewer_user_id
     order by w.since
     limit c_limit
  ) s;

  select app_url into v_url from line_config;

  v_thai_date := to_char(v_bkk, 'DD') || ' '
    || (array['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.',
              'ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'])[extract(month from v_bkk)::int]
    || ' ' || (extract(year from v_bkk)::int + 543);

  v_msg := format(E'📝 งานรออนุมัติ — %s\nผู้อนุมัติ: %s\n\nรอตรวจ %s ใบ\n%s',
                  v_thai_date, regexp_replace(v_reviewer, '\s*\([^)]*\)', '', 'g'), v_count, v_lines);
  if v_count > c_limit then
    v_msg := v_msg || format(E'\n… และอีก %s ใบ', v_count - c_limit);
  end if;
  if coalesce(btrim(v_url), '') <> '' then
    v_msg := v_msg || E'\n\nเปิดระบบ: ' || v_url;
  end if;

  return left(v_msg, 4900);
end;
$$;

-- -----------------------------------------------------------------------------
-- line_reviewer_digests : การตั้งค่าที่ Super Admin แก้ได้จากหน้าเว็บ
--   send_time      เวลาไทย
--   last_sent_date วันที่ (เวลาไทย) ที่ประมวลผลรายการนี้ไปแล้ว — กันส่งซ้ำในวันเดียวกัน
-- -----------------------------------------------------------------------------
create table if not exists line_reviewer_digests (
  id               uuid primary key default gen_random_uuid(),
  reviewer_user_id uuid not null references users (id) on delete cascade,
  group_id         text not null,
  send_time        time not null default '17:00',
  enabled          boolean not null default true,
  last_sent_date   date,
  created_at       timestamptz not null default now(),

  constraint line_reviewer_digests_group_format check (group_id ~ '^C[0-9a-f]{32}$'),
  constraint line_reviewer_digests_unique unique (reviewer_user_id, group_id)
);

comment on table line_reviewer_digests is
  'สรุปงานรออนุมัติของผู้ตรวจแต่ละคน ส่งเข้ากลุ่ม LINE ที่กำหนด วันละครั้งตามเวลา (เวลาไทย)';

alter table line_reviewer_digests enable row level security;

drop policy if exists line_reviewer_digests_super_admin on line_reviewer_digests;
create policy line_reviewer_digests_super_admin on line_reviewer_digests
  for all using (app_is_admin() and app_current_role() = 'super_admin')
  with check (app_is_admin() and app_current_role() = 'super_admin');

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select, insert, update, delete on line_reviewer_digests to authenticated;
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- app_enqueue_reviewer_digest : เข้าคิวหนึ่งข้อความ
--   p_dedupe = true  -> วันละครั้งต่อผู้ตรวจต่อกลุ่ม (รอบตามเวลา)
--   p_dedupe = false -> ไม่กันซ้ำ (ปุ่มส่งทดสอบ)
-- เวอร์ชันแรกของไฟล์นี้มีแค่ 2 พารามิเตอร์ — ลบทิ้งก่อนเพื่อไม่ให้มีสองตัวซ้อนกัน
-- -----------------------------------------------------------------------------
drop function if exists app_enqueue_reviewer_digest(uuid, text);

create or replace function app_enqueue_reviewer_digest(
  p_reviewer_user_id uuid,
  p_group_id         text,
  p_dedupe           boolean default true
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_msg text;
  v_id  uuid;
begin
  v_msg := app_build_reviewer_digest(p_reviewer_user_id);
  if v_msg is null then
    return null;
  end if;

  insert into line_outbox (kind, message, target_group_id, dedupe_key)
  values ('reviewer_digest', v_msg, p_group_id,
          case when p_dedupe then
            format('reviewer_digest:%s:%s:%s', p_reviewer_user_id, p_group_id,
                   to_char((now() at time zone 'Asia/Bangkok')::date, 'YYYY-MM-DD'))
          end)
  on conflict (dedupe_key) do nothing
  returning id into v_id;

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- app_run_reviewer_digests : pg_cron เรียกทุกนาที
--   ส่งเฉพาะช่วง 1 ชั่วโมงหลังเวลาที่ตั้ง — เพิ่มรายการใหม่ตอน 18:00 ที่ตั้งเวลา 17:00
--   จะไม่ยิงทันที แต่รอพรุ่งนี้ 17:00 แทน (กันข้อความโผล่เข้ากลุ่มแบบไม่คาดคิด)
--   ประมวลผลแล้วบันทึก last_sent_date แม้วันนั้นไม่มีงานรอ (ไม่มีข้อความ)
-- -----------------------------------------------------------------------------
create or replace function app_run_reviewer_digests() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_bkk   timestamp := now() at time zone 'Asia/Bangkok';
  v_today date      := v_bkk::date;
  v_now_t time      := v_bkk::time;
  r       record;
  v_count integer   := 0;
begin
  for r in
    select * from line_reviewer_digests
     where enabled
       and (last_sent_date is null or last_sent_date < v_today)
       and v_now_t >= send_time
       -- ลบกันแทนบวก — send_time + 1 ชม. ของ 23:30 วนเป็น 00:30 แล้วเงื่อนไขจะไม่จริงเลย
       and v_now_t - send_time < interval '1 hour'
     for update skip locked
  loop
    if app_enqueue_reviewer_digest(r.reviewer_user_id, r.group_id) is not null then
      v_count := v_count + 1;
    end if;
    update line_reviewer_digests set last_sent_date = v_today where id = r.id;
  end loop;
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- app_send_reviewer_digest_now : ปุ่ม "ส่งทดสอบตอนนี้" (Super Admin)
-- คืนข้อความบอกผลให้หน้าเว็บแสดง
-- -----------------------------------------------------------------------------
create or replace function app_send_reviewer_digest_now(p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  r line_reviewer_digests;
begin
  if not app_is_admin() or app_current_role() is distinct from 'super_admin' then
    raise exception 'เฉพาะ Super Admin เท่านั้น' using errcode = 'insufficient_privilege';
  end if;

  select * into r from line_reviewer_digests where id = p_id;
  if r.id is null then
    raise exception 'ไม่พบรายการนี้' using errcode = 'no_data_found';
  end if;

  if app_enqueue_reviewer_digest(r.reviewer_user_id, r.group_id, false) is null then
    return 'ตอนนี้ไม่มีงานรออนุมัติของผู้อนุมัตินี้ จึงไม่ได้ส่งข้อความ';
  end if;
  return 'ส่งเข้าคิวแล้ว ข้อความจะเข้ากลุ่มภายในไม่กี่วินาที';
end;
$$;

-- อ่าน/สร้างข้อมูลข้าม RLS ให้เรียกได้เฉพาะ pg_cron เหมือน digest เดิม
revoke execute on function app_build_reviewer_digest(uuid)                  from public, anon, authenticated;
revoke execute on function app_enqueue_reviewer_digest(uuid, text, boolean) from public, anon, authenticated;
revoke execute on function app_run_reviewer_digests()                       from public, anon, authenticated;
-- ปุ่มส่งทดสอบเรียกจากหน้าเว็บ — ตรวจสิทธิ์ Super Admin ในตัวฟังก์ชันเอง
revoke execute on function app_send_reviewer_digest_now(uuid) from public, anon;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function app_send_reviewer_digest_now(uuid) to authenticated;
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- ค่าเริ่มต้น: พี่รักษ์ -> กลุ่มผู้อนุมัติ 17:00 น. (ถ้าหาบัญชีไม่เจอก็ข้าม ไปเพิ่มเองในหน้าเว็บได้)
-- -----------------------------------------------------------------------------
insert into line_reviewer_digests (reviewer_user_id, group_id, send_time)
select id, 'Cd376209bfd7ffa2e32ed2d1ae413d1be', '17:00'
  from users where username = 'Admin_Rak'
on conflict (reviewer_user_id, group_id) do nothing;

-- -----------------------------------------------------------------------------
-- ตารางเวลา: เช็คทุกนาที (งานเบา — อ่านตารางเล็ก ๆ ตารางเดียว)
-- ลบงานแบบตายตัวของเวอร์ชันแรก (line_reviewer_digest_rak) ถ้าเคยติดตั้งไว้
-- -----------------------------------------------------------------------------
select cron.unschedule('line_reviewer_digest_rak')
 where exists (select 1 from cron.job where jobname = 'line_reviewer_digest_rak');
select cron.unschedule('line_reviewer_digests')
 where exists (select 1 from cron.job where jobname = 'line_reviewer_digests');
select cron.schedule('line_reviewer_digests', '* * * * *', $cron$ select app_run_reviewer_digests() $cron$);

commit;
