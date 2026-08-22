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
