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
import {
  buildPushBody,
  classifyPushResult,
  combineOutcomes,
  LINE_PUSH_URL,
  MAX_ATTEMPTS,
  messagesUsed,
  type PushOutcome,
  type Recipient,
  recipientsForRow,
  retryKeyFor,
} from './lib.ts';

/**
 * ค่า attempts ที่เขียนทับเมื่อ "เลิกลองแล้ว"
 * ต้องไม่น้อยกว่าเพดานของ app_claim_line_outbox (attempts < MAX_ATTEMPTS)
 * มิฉะนั้นแถวจะถูกเคลมกลับมายิงซ้ำทั้งที่รู้อยู่แล้วว่าไม่ผ่าน
 */
const GIVE_UP_ATTEMPTS = MAX_ATTEMPTS;

const token = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN') ?? '';
// กลุ่มหลัก — กลุ่มเพิ่มเติมอยู่ในตาราง line_groups (ตั้งจากหน้าการตั้งค่าระบบ)
const primaryGroupId = Deno.env.get('LINE_GROUP_ID') ?? '';
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

/**
 * ตั้งค่า LINE ไม่ครบ — ห้ามหายเงียบสนิท แถวที่รอส่งต้องมี last_error ให้แอดมินเห็น
 * ไม่งั้นแยกไม่ออกจากตอนที่ระบบว่างงานจริง ๆ
 */
async function failMisconfigured(msg: string): Promise<Response> {
  try {
    const { error: markError } = await db
      .from('line_outbox')
      .update({ last_error: msg })
      .eq('status', 'pending');
    if (markError) {
      console.error(`[line-dispatch] เขียน last_error ไม่ลง (ตั้งค่า LINE ไม่ครบ): ${markError.message}`);
    }
  } catch (e) {
    // ถ้า SUPABASE_URL/SERVICE_ROLE_KEY หายไปด้วย db client เองอาจใช้งานไม่ได้
    // กันไว้ไม่ให้ throw ทับ response 500 ที่ตั้งใจจะคืนอยู่แล้ว
    console.error(
      `[line-dispatch] เขียน last_error ไม่ลง (ตั้งค่า LINE ไม่ครบ): ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  return json({ error: msg }, 500);
}

Deno.serve(async (req: Request) => {
  if (!dispatchSecret || req.headers.get('x-line-dispatch-secret') !== dispatchSecret) {
    return json({ error: 'ไม่ได้รับอนุญาต' }, 401);
  }
  if (!token) {
    return await failMisconfigured('ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN');
  }

  // 1) สวิตช์ใหญ่
  const { data: config, error: configError } = await db
    .from('line_config')
    .select('enabled, monthly_cap')
    .maybeSingle();

  if (configError) return json({ error: `อ่าน line_config ไม่ได้: ${configError.message}` }, 500);
  if (!config?.enabled) return json({ skipped: 'ปิดการส่ง LINE อยู่' });

  // กลุ่มปลายทาง = กลุ่มหลัก + กลุ่มเพิ่มเติมที่เปิดอยู่ (ไม่ซ้ำกัน)
  const { data: extraGroups, error: groupsError } = await db
    .from('line_groups')
    .select('group_id')
    .eq('enabled', true);
  // อ่านไม่ได้ (เช่น deploy ฟังก์ชันนี้ก่อนรัน db/19 ตาราง line_groups ยังไม่มี) ต้องไม่ทำให้กลุ่มหลักเงียบไปด้วย
  // ส่งเข้ากลุ่มหลักต่อ แล้วทิ้งร่องรอยไว้ใน log
  if (groupsError) {
    console.error(`[line-dispatch] อ่าน line_groups ไม่ได้ ส่งเฉพาะกลุ่มหลัก: ${groupsError.message}`);
  }

  const recipients: Recipient[] = [];
  if (primaryGroupId) recipients.push({ groupId: primaryGroupId, isPrimary: true });
  for (const g of (extraGroups ?? []) as { group_id: string }[]) {
    if (!recipients.some(r => r.groupId === g.group_id)) recipients.push({ groupId: g.group_id, isPrimary: false });
  }
  if (recipients.length === 0) {
    return await failMisconfigured('ยังไม่มีกลุ่ม LINE ปลายทาง (ตั้ง LINE_GROUP_ID หรือเพิ่มกลุ่มในหน้าการตั้งค่าระบบ)');
  }

  // 2) เพดานรายเดือน — กันโควตา LINE บานปลาย
  // แถวทั่วไปถูกส่งออกไปทุกกลุ่ม นับ × จำนวนกลุ่ม ส่วนแถวที่ระบุกลุ่ม (target_group_id) นับ 1
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [broadcastRes, targetedRes] = await Promise.all([
    db.from('line_outbox').select('id', { count: 'exact', head: true })
      .eq('status', 'sent').gte('sent_at', monthStart.toISOString()).is('target_group_id', null),
    db.from('line_outbox').select('id', { count: 'exact', head: true })
      .eq('status', 'sent').gte('sent_at', monthStart.toISOString()).not('target_group_id', 'is', null),
  ]);
  const countError = broadcastRes.error ?? targetedRes.error;
  if (countError) return json({ error: `นับโควตาไม่ได้: ${countError.message}` }, 500);

  const sentThisMonth = messagesUsed(broadcastRes.count ?? 0, targetedRes.count ?? 0, recipients.length);
  if (sentThisMonth >= config.monthly_cap) {
    // ไม่เปลี่ยนสถานะแถว ปล่อยค้างไว้ให้ส่งต่อเดือนหน้าได้
    // แต่เขียน last_error ไว้ให้แอดมินเห็นว่าทำไมเงียบ — ห้ามเงียบหายเฉย ๆ
    const { error: markError } = await db
      .from('line_outbox')
      .update({ last_error: 'ถึงเพดานข้อความรายเดือนแล้ว หยุดส่งชั่วคราว' })
      .eq('status', 'pending');
    if (markError) {
      console.error(`[line-dispatch] เขียน last_error ไม่ลง (ถึงเพดานรายเดือน): ${markError.message}`);
    }
    return json({ skipped: 'ถึงเพดานรายเดือน', sentThisMonth, cap: config.monthly_cap });
  }

  // 3) ดึงคิว (ฟังก์ชันบวก attempts ให้แล้ว และกันสองรอบทำงานชนกันด้วย skip locked)
  const { data: rows, error: claimError } = await db.rpc('app_claim_line_outbox', { p_limit: 20 });
  if (claimError) return json({ error: `ดึงคิวไม่ได้: ${claimError.message}` }, 500);
  if (!rows?.length) return json({ sent: 0, failed: 0 });

  // 4) ยิงทีละแถว ทีละกลุ่ม
  let sent = 0;
  let failed = 0;

  for (const row of rows as { id: string; message: string; target_group_id: string | null }[]) {
    const outcomes: PushOutcome[] = [];
    const problems: string[] = [];

    for (const recipient of recipientsForRow(row.target_group_id, recipients, primaryGroupId)) {
      let status = 0;
      let detail = '';

      try {
        const res = await fetch(LINE_PUSH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            // LINE ใช้ค่านี้กันข้อความซ้ำให้อีกชั้น — คีย์แยกต่อกลุ่ม ดู retryKeyFor()
            'X-Line-Retry-Key': await retryKeyFor(row.id, recipient.groupId, recipient.isPrimary),
          },
          body: JSON.stringify(buildPushBody(recipient.groupId, row.message)),
        });
        status = res.status;
        if (!res.ok) detail = (await res.text()).slice(0, 300);
      } catch (e) {
        status = 0;
        detail = e instanceof Error ? e.message : String(e);
      }

      const outcome = classifyPushResult(status);
      outcomes.push(outcome);
      if (outcome !== 'sent') {
        const label = recipient.isPrimary ? 'กลุ่มหลัก' : `กลุ่ม ${recipient.groupId.slice(0, 9)}…`;
        problems.push(`${label} HTTP ${status}${detail ? `: ${detail}` : ''}`);
      }
    }

    const outcome = combineOutcomes(outcomes);
    // รายละเอียดของกลุ่มที่ไม่ได้ตอบ 2xx — ใช้เป็น last_error ให้แอดมินเห็นว่าติดที่กลุ่มไหน
    const detail = problems.join(' | ');

    if (outcome === 'sent' || outcome === 'deduped') {
      // 409 = LINE เคยรับ X-Line-Retry-Key นี้ไปแล้ว แปลว่าข้อความถึงกลุ่มแล้ว
      // ต้องบันทึกเป็น sent ไม่ใช่ failed — ไม่งั้นข้อความที่ส่งถึงจริงจะกลายเป็น
      // ความล้มเหลวถาวรที่แยกไม่ออกจากของจริงในหน้าแอดมิน และเกิดประจำทุกเช้า
      // ตอนสรุปรายวัน (digest ยิงตอน 01:00 UTC ชนกับรอบกวาดพอดี)
      // แต่ยังเก็บหมายเหตุไว้ใน last_error ให้เห็นว่าเส้นทางนี้ไม่ใช่เส้นทางปกติ
      const dedupeNote =
        outcome === 'deduped'
          ? `${detail} — LINE แจ้งว่าข้อความนี้ถูกส่งไปแล้ว (X-Line-Retry-Key ซ้ำ) ` +
            'จึงนับเป็นส่งสำเร็จและไม่ยิงซ้ำ'
          : null;

      const { error: markError } = await db
        .from('line_outbox')
        .update({ status: 'sent', sent_at: new Date().toISOString(), last_error: dedupeNote })
        .eq('id', row.id);
      if (markError) {
        // อันตรายที่สุดในไฟล์นี้: ส่งเข้า LINE ไปแล้วแต่บันทึกไม่ลง
        // แถวจะถูกเคลมซ้ำรอบหน้าและกลุ่มจะได้ข้อความซ้ำ ต้องเห็นใน log ให้ได้
        console.error(`[line-dispatch] ส่งสำเร็จแต่บันทึกสถานะไม่ลง row=${row.id}: ${markError.message}`);
      }
      sent++;
    } else {
      const note = outcome === 'retry' ? 'จะลองใหม่' : 'ไม่ลองใหม่ ต้องแก้ที่ต้นเหตุ';
      const { error: markError } = await db
        .from('line_outbox')
        .update({
          status: 'failed',
          last_error: `(${note}) ${detail}`,
          // ปิดโอกาสลองใหม่ทันทีสำหรับ error ที่ลองไปก็ไม่ผ่าน
          ...(outcome === 'retry' ? {} : { attempts: GIVE_UP_ATTEMPTS }),
        })
        .eq('id', row.id);
      if (markError) {
        console.error(`[line-dispatch] บันทึกสถานะ failed ไม่ลง row=${row.id}: ${markError.message}`);
      }
      failed++;
    }
  }

  return json({ sent, failed });
});
