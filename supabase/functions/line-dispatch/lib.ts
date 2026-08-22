/**
 * ส่วน logic ล้วน ๆ ของ line-dispatch — ไม่แตะ Deno API และไม่ยิงเน็ต
 * แยกไว้ที่นี่เพื่อให้ vitest ทดสอบได้โดยไม่ต้องมี Supabase หรือ LINE จริง
 */

export const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push';

/** ต้องตรงกับเงื่อนไข attempts < 5 ใน app_claim_line_outbox() */
export const MAX_ATTEMPTS = 5;

/** LINE จำกัดข้อความละ 5,000 ตัวอักษร กันไว้ที่ 4,900 */
export function clampMessage(text: string, limit = 4900): string {
  return text.length <= limit ? text : text.slice(0, limit - 1) + '…';
}

export function buildPushBody(groupId: string, message: string) {
  return {
    to: groupId,
    messages: [{ type: 'text' as const, text: clampMessage(message) }],
  };
}

/**
 * ตัดสินใจว่าความล้มเหลวครั้งนี้ควรลองส่งใหม่ไหม
 *
 * 4xx = ปัญหาอยู่ที่ฝั่งเรา (token ผิด / โควตาหมด / payload ผิด) ลองซ้ำก็ได้ผลเดิม
 *       ต้องให้คนเข้าไปแก้ จึงหยุดทันทีและเก็บ error ไว้ให้แอดมินเห็น
 * 5xx = ฝั่ง LINE มีปัญหาชั่วคราว ลองใหม่มีโอกาสผ่าน
 * 0   = ยิงไม่ออกเลย (เน็ตหลุด / timeout) ลองใหม่ได้
 */
export function shouldRetry(status: number): boolean {
  if (status === 0) return true;
  return status >= 500;
}

/**
 * LINE ตอบ 409 เมื่อ X-Line-Retry-Key ซ้ำกับที่เคยรับไปแล้ว
 * = ข้อความ "ถูกส่งเข้ากลุ่มไปเรียบร้อยแล้ว" ไม่ใช่ความล้มเหลว
 */
export const LINE_DUPLICATE_STATUS = 409;

/** ผลของการยิง 1 แถว */
export type PushOutcome =
  /** LINE รับไว้แล้ว */
  | 'sent'
  /** LINE เคยรับแถวนี้ไปแล้ว (409 จาก X-Line-Retry-Key) — ถือว่าส่งสำเร็จ */
  | 'deduped'
  /** ล้มเหลวชั่วคราว ให้รอบกวาดมาลองใหม่ */
  | 'retry'
  /** ล้มเหลวถาวร ลองไปก็ไม่ผ่าน ต้องให้คนเข้ามาแก้ */
  | 'giveup';

/**
 * แปลง HTTP status ของ LINE เป็นสิ่งที่ต้องทำกับแถวนั้น
 *
 * แยกออกจาก shouldRetry() เพราะ 409 ไม่ใช่คำถามว่า "ควรลองใหม่ไหม" (คำตอบคือไม่
 * ทั้งคู่) แต่เป็นคำถามว่า "ข้อความถึงกลุ่มหรือยัง" ถ้าเอา 409 ไปเข้ากิ่ง
 * ไม่ลองใหม่ตรง ๆ แถวที่ส่งถึงแล้วจะถูกบันทึกเป็น failed ถาวร แยกไม่ออกจาก
 * ความล้มเหลวของจริงในหน้าแอดมิน และจะเกิดเป็นประจำทุกเช้าตอนสรุปรายวัน
 */
export function classifyPushResult(status: number): PushOutcome {
  if (status >= 200 && status < 300) return 'sent';
  if (status === LINE_DUPLICATE_STATUS) return 'deduped';
  return shouldRetry(status) ? 'retry' : 'giveup';
}
