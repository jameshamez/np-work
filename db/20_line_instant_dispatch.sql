-- =============================================================================
-- NP Taskwork — ระบบติดตามงาน
-- 20_line_instant_dispatch.sql : ส่ง LINE ทันทีเมื่อมีข้อความเข้าคิว — รันซ้ำได้
--
-- ปัญหา
--   ข้อความใน line_outbox ถูกส่งโดยรอบกวาด line_retry_sweep ทุก 15 นาทีเท่านั้น
--   กดทดสอบหรือมีงานถูกตีกลับ ต้องรอสูงสุด 15 นาทีกว่าจะเข้ากลุ่ม
--
-- การแก้
--   trigger after insert on line_outbox เรียก Edge Function line-dispatch ทันทีผ่าน pg_net
--   * ระดับ statement ไม่ใช่ระดับแถว — insert หลายแถวพร้อมกันเรียกฟังก์ชันครั้งเดียว
--     (line-dispatch ดึงคิวทีละ 20 แถวอยู่แล้ว)
--   * pg_net ยิงหลัง commit แบบไม่รอผล — การ insert ไม่ช้าลงและไม่พังตามถ้า LINE ล่ม
--   * เรียกซ้อนกับรอบกวาดได้ปลอดภัย app_claim_line_outbox กันเคลมแถวซ้ำไว้แล้ว
--   * รอบกวาดทุก 15 นาทียังอยู่ เป็นตาข่ายรองกรณีเรียกทันทีพลาด
--
-- URL ของ Edge Function
--   ดึงจากงาน cron line_retry_sweep ที่ติดตั้งไว้ใน 08_line_schedule.sql
--   จะได้ไม่ต้องแก้ [PROJECT_REF] ซ้ำอีกที่ และไม่มีทางชี้คนละที่กับรอบกวาด
--   ถ้ายังไม่ได้ติดตั้ง 08 ไฟล์นี้จะหยุดพร้อมบอกเหตุผล
--
-- ต้องรันหลัง 08_line_schedule.sql
-- =============================================================================

begin;

do $$
declare
  v_url text;
begin
  select substring(command from 'url\s*:=\s*''([^'']+)''')
    into v_url
    from cron.job
   where jobname = 'line_retry_sweep';

  if v_url is null or v_url like '%[PROJECT_REF]%' then
    raise exception 'ไม่พบ URL ของ line-dispatch จากงาน cron line_retry_sweep'
      using errcode = 'invalid_parameter_value',
            hint = 'รัน db/08_line_schedule.sql (แก้ [PROJECT_REF] ให้ถูกต้อง) ก่อน แล้วค่อยรันไฟล์นี้ใหม่';
  end if;

  execute format($fn$
    create or replace function trg_line_outbox_dispatch_now() returns trigger
    language plpgsql security definer set search_path = public as $body$
    begin
      perform net.http_post(
        url     := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-line-dispatch-secret',
          (select decrypted_secret from vault.decrypted_secrets where name = 'line_dispatch_secret')
        ),
        body    := jsonb_build_object('source', 'outbox_insert')
      );
      return null;
    exception when others then
      -- ห้ามให้การเรียกทันทีพลาดแล้วพาการเข้าคิวพังไปด้วย รอบกวาดทุก 15 นาทีจะเก็บให้
      raise warning 'เรียก line-dispatch ทันทีไม่สำเร็จ (รอบกวาดจะส่งแทน): %%', sqlerrm;
      return null;
    end;
    $body$;
  $fn$, v_url);
end
$$;

comment on function trg_line_outbox_dispatch_now is
  'เรียก Edge Function line-dispatch ทันทีที่มีข้อความเข้าคิว (URL ดึงจากงาน cron line_retry_sweep)';

drop trigger if exists line_outbox_dispatch_now on line_outbox;
create trigger line_outbox_dispatch_now
  after insert on line_outbox
  for each statement execute function trg_line_outbox_dispatch_now();

commit;
