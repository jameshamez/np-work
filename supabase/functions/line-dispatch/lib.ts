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

/**
 * X-Line-Retry-Key ของการส่ง 1 แถวเข้า 1 กลุ่ม
 *
 * LINE กันซ้ำด้วยคีย์นี้ทั้ง channel ถ้าใช้ row.id เดียวกันกับทุกกลุ่ม กลุ่มที่สอง
 * จะได้ 409 ทั้งที่ยังไม่เคยได้รับข้อความ จึงต้องมีคีย์แยกต่อกลุ่ม และต้อง "คงที่"
 * (ได้ค่าเดิมทุกครั้ง) เพื่อให้ตอนลองส่งแถวเดิมใหม่ กลุ่มที่ได้รับไปแล้วตอบ 409
 * แทนการได้ข้อความซ้ำ
 *
 * กลุ่มหลักใช้ row.id ตรง ๆ เหมือนเดิม — แถวที่ค้างลองใหม่จากก่อนอัปเดตจะไม่ซ้ำ
 * กลุ่มเพิ่มเติมใช้ SHA-256(row.id:groupId) จัดรูปเป็น UUID (LINE บังคับรูปแบบ UUID)
 */
export async function retryKeyFor(rowId: string, groupId: string, isPrimary: boolean): Promise<string> {
  if (isPrimary) return rowId;
  const bytes = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${rowId}:${groupId}`)),
  ).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant RFC 4122
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * รวมผลการส่ง 1 แถวเข้าหลายกลุ่มเป็นผลเดียวของแถวนั้น
 *   ทุกกลุ่มถึงแล้ว (sent / deduped)  -> sent (deduped ถ้ามีกลุ่มไหนเป็น deduped)
 *   มีกลุ่มที่ล้มเหลวชั่วคราว         -> retry  (รอบหน้าส่งใหม่ทุกกลุ่ม กลุ่มที่ถึงแล้วจะได้ 409)
 *   ที่เหลือล้มเหลวถาวรอย่างน้อย 1 กลุ่ม -> giveup
 * ให้ retry ชนะ giveup เพราะกลุ่มที่ล้มเหลวชั่วคราวยังมีโอกาสได้รับ
 */
export function combineOutcomes(outcomes: PushOutcome[]): PushOutcome {
  if (outcomes.includes('retry')) return 'retry';
  if (outcomes.includes('giveup')) return 'giveup';
  return outcomes.includes('deduped') ? 'deduped' : 'sent';
}

export interface Recipient {
  groupId: string;
  isPrimary: boolean;
}

/**
 * กลุ่มปลายทางของ 1 แถว
 *   แถวที่ระบุ target_group_id (เช่น สรุปงานรออนุมัติของผู้ตรวจ) -> กลุ่มนั้นกลุ่มเดียว
 *   แถวทั่วไป -> กลุ่มหลัก + กลุ่มเพิ่มเติมทั้งหมด
 * กลุ่มเป้าหมายที่บังเอิญเป็นกลุ่มหลักใช้คีย์กันซ้ำแบบกลุ่มหลัก (ดู retryKeyFor)
 */
export function recipientsForRow(
  targetGroupId: string | null | undefined,
  allRecipients: Recipient[],
  primaryGroupId: string,
): Recipient[] {
  if (!targetGroupId) return allRecipients;
  return [{ groupId: targetGroupId, isPrimary: targetGroupId === primaryGroupId }];
}

/** จำนวนข้อความที่ใช้ไปเดือนนี้ — แถวทั่วไปนับคูณจำนวนกลุ่ม แถวระบุกลุ่มนับ 1 */
export function messagesUsed(sentBroadcastRows: number, sentTargetedRows: number, groupCount: number): number {
  return sentBroadcastRows * groupCount + sentTargetedRows;
}
