-- =============================================================================
-- NP Taskwork — ระบบติดตามงาน
-- 08_line_schedule.sql : ตารางเวลาของระบบแจ้งเตือน LINE
--
-- ก่อนรัน ต้องแก้ 2 จุดในไฟล์นี้
--   1. [PROJECT_REF]  -> project ref ของคุณ (ดูใน Supabase Dashboard > Settings)
--   2. รัน vault.create_secret ด้านล่างด้วยค่า LINE_DISPATCH_SECRET ตัวเดียวกับ
--      ที่ตั้งไว้ใน Edge Function secrets
--
-- ทำไม secret ต้องอยู่ใน Vault ไม่ใช่ในตาราง line_config
--   line_config เปิดให้แอดมินอ่านผ่าน RLS ถ้าเก็บ secret ไว้ที่นั่น
--   แอดมินทุกคนจะอ่านค่าไปเรียก Edge Function ตรง ๆ ได้
--
-- ไฟล์นี้รันซ้ำได้
-- =============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- เก็บ secret ครั้งแรกครั้งเดียว (รันซ้ำจะ error ว่าชื่อซ้ำ ให้ข้ามได้)
-- select vault.create_secret('[ค่า LINE_DISPATCH_SECRET]', 'line_dispatch_secret');

-- -----------------------------------------------------------------------------
-- ต้องมี secret ใน Vault ก่อน ไม่งั้นห้ามติดตั้ง job กวาดคิว
--
-- ถ้าไม่มี ค่า subquery จะเป็น null -> header x-line-dispatch-secret เป็น null ->
-- Edge Function ตอบ 401 ทุกครั้ง แต่ตัว net.http_post เองสำเร็จ cron.job_run_details
-- จึงขึ้นว่า "succeeded" ทุกรอบ = ตาข่ายกันข้อความตกหายตายสนิทโดยไม่มีใครรู้
-- จึงต้องพังเสียงดังตั้งแต่ตอนติดตั้ง ไม่ใช่เงียบไปตลอดกาล
-- -----------------------------------------------------------------------------
do $$
begin
  if coalesce(btrim((select decrypted_secret
                       from vault.decrypted_secrets
                      where name = 'line_dispatch_secret')), '') = '' then
    raise exception 'ไม่พบ secret ชื่อ line_dispatch_secret ใน Vault — job กวาดคิวจะยิง 401 เงียบ ๆ ตลอดไป'
      using errcode = 'invalid_parameter_value',
            hint = 'รัน select vault.create_secret(''<ค่า LINE_DISPATCH_SECRET เดียวกับใน Edge Function secrets>'', ''line_dispatch_secret''); ก่อน แล้วค่อยรันไฟล์นี้ใหม่';
  end if;
end
$$;

-- ลบตารางเวลาเดิมก่อน เพื่อให้รันไฟล์ซ้ำได้
select cron.unschedule('line_daily_digest') where exists (
  select 1 from cron.job where jobname = 'line_daily_digest');
select cron.unschedule('line_retry_sweep') where exists (
  select 1 from cron.job where jobname = 'line_retry_sweep');

-- -----------------------------------------------------------------------------
-- สรุปรายวัน 08:00 น. เวลาไทย
-- pg_cron ของ Supabase รันด้วย UTC จึงตั้งไว้ 01:00 UTC
-- -----------------------------------------------------------------------------
select cron.schedule(
  'line_daily_digest',
  '0 1 * * *',
  $cron$ select app_enqueue_line_digest() $cron$
);

-- -----------------------------------------------------------------------------
-- กวาดแถวที่ส่งไม่สำเร็จมาลองใหม่ทุก 15 นาที
-- เผื่อกรณี Database Webhook ยิงพลาด หรือ LINE ล่มตอนนั้นพอดี
-- -----------------------------------------------------------------------------
select cron.schedule(
  'line_retry_sweep',
  '*/15 * * * *',
  $cron$
  select net.http_post(
    url     := 'https://[PROJECT_REF].functions.supabase.co/line-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-line-dispatch-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'line_dispatch_secret')
    ),
    body    := jsonb_build_object('source', 'cron')
  )
  $cron$
);
