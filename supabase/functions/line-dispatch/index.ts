/**
 * line-dispatch — ตัวเดียวในระบบที่ถือ LINE Channel Access Token
 *
 * ถูกเรียกจากสองทาง
 *   1. Supabase Database Webhook เมื่อมีแถวใหม่ใน line_outbox (ส่งทันที)
 *   2. pg_cron ทุก 15 นาที (กวาดแถวที่ส่งไม่สำเร็จมาลองใหม่)
 *
 * ทั้งสองทางต้องแนบ header x-line-dispatch-secret ให้ตรงกับ secret ที่ตั้งไว้
 * deploy ด้วย --no-verify-jwt แล้วใช้ secret ตัวนี้คุมสิทธิ์แทน
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildPushBody, LINE_PUSH_URL, shouldRetry } from './lib.ts';

const token = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN') ?? '';
const groupId = Deno.env.get('LINE_GROUP_ID') ?? '';
const dispatchSecret = Deno.env.get('LINE_DISPATCH_SECRET') ?? '';

const db = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  if (!dispatchSecret || req.headers.get('x-line-dispatch-secret') !== dispatchSecret) {
    return json({ error: 'ไม่ได้รับอนุญาต' }, 401);
  }
  if (!token || !groupId) {
    return json({ error: 'ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN หรือ LINE_GROUP_ID' }, 500);
  }

  // 1) สวิตช์ใหญ่
  const { data: config, error: configError } = await db
    .from('line_config')
    .select('enabled, monthly_cap')
    .maybeSingle();

  if (configError) return json({ error: `อ่าน line_config ไม่ได้: ${configError.message}` }, 500);
  if (!config?.enabled) return json({ skipped: 'ปิดการส่ง LINE อยู่' });

  // 2) เพดานรายเดือน — กันโควตา LINE บานปลาย
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const { count: sentThisMonth, error: countError } = await db
    .from('line_outbox')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'sent')
    .gte('sent_at', monthStart.toISOString());

  if (countError) return json({ error: `นับโควตาไม่ได้: ${countError.message}` }, 500);

  if ((sentThisMonth ?? 0) >= config.monthly_cap) {
    // ไม่เปลี่ยนสถานะแถว ปล่อยค้างไว้ให้ส่งต่อเดือนหน้าได้
    // แต่เขียน last_error ไว้ให้แอดมินเห็นว่าทำไมเงียบ — ห้ามเงียบหายเฉย ๆ
    await db
      .from('line_outbox')
      .update({ last_error: 'ถึงเพดานข้อความรายเดือนแล้ว หยุดส่งชั่วคราว' })
      .eq('status', 'pending');
    return json({ skipped: 'ถึงเพดานรายเดือน', sentThisMonth, cap: config.monthly_cap });
  }

  // 3) ดึงคิว (ฟังก์ชันบวก attempts ให้แล้ว และกันสองรอบทำงานชนกันด้วย skip locked)
  const { data: rows, error: claimError } = await db.rpc('app_claim_line_outbox', { p_limit: 20 });
  if (claimError) return json({ error: `ดึงคิวไม่ได้: ${claimError.message}` }, 500);
  if (!rows?.length) return json({ sent: 0, failed: 0 });

  // 4) ยิงทีละแถว
  let sent = 0;
  let failed = 0;

  for (const row of rows as { id: string; message: string }[]) {
    let status = 0;
    let detail = '';

    try {
      const res = await fetch(LINE_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          // LINE ใช้ค่านี้กันข้อความซ้ำให้อีกชั้น เผื่อเรายิงซ้ำโดยไม่ตั้งใจ
          'X-Line-Retry-Key': row.id,
        },
        body: JSON.stringify(buildPushBody(groupId, row.message)),
      });
      status = res.status;
      if (!res.ok) detail = (await res.text()).slice(0, 500);
    } catch (e) {
      status = 0;
      detail = e instanceof Error ? e.message : String(e);
    }

    if (status >= 200 && status < 300) {
      await db
        .from('line_outbox')
        .update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null })
        .eq('id', row.id);
      sent++;
    } else {
      const note = shouldRetry(status) ? 'จะลองใหม่' : 'ไม่ลองใหม่ ต้องแก้ที่ต้นเหตุ';
      await db
        .from('line_outbox')
        .update({
          status: 'failed',
          last_error: `HTTP ${status} (${note}): ${detail}`,
          // ปิดโอกาสลองใหม่ทันทีสำหรับ error ที่ลองไปก็ไม่ผ่าน
          ...(shouldRetry(status) ? {} : { attempts: 99 }),
        })
        .eq('id', row.id);
      failed++;
    }
  }

  return json({ sent, failed });
});
