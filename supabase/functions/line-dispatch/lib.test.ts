import { describe, expect, it } from 'vitest';
import {
  buildPushBody,
  clampMessage,
  classifyPushResult,
  combineOutcomes,
  LINE_DUPLICATE_STATUS,
  MAX_ATTEMPTS,
  retryKeyFor,
  shouldRetry,
} from './lib';

describe('clampMessage', () => {
  it('ข้อความสั้นผ่านไปเหมือนเดิม', () => {
    expect(clampMessage('สวัสดี')).toBe('สวัสดี');
  });

  it('ข้อความยาวเกินขีดจำกัดถูกตัดและต่อท้ายด้วยจุดไข่ปลา', () => {
    const long = 'ก'.repeat(5000);
    const result = clampMessage(long);
    expect(result).toHaveLength(4900);
    expect(result.endsWith('…')).toBe(true);
  });

  it('ข้อความยาวเท่าขีดจำกัดพอดีไม่ถูกตัด', () => {
    const exact = 'ก'.repeat(4900);
    expect(clampMessage(exact)).toBe(exact);
  });
});

describe('buildPushBody', () => {
  it('ประกอบ payload ตามรูปแบบของ LINE Messaging API', () => {
    expect(buildPushBody('Cxxxxxxxx', 'ทดสอบ')).toEqual({
      to: 'Cxxxxxxxx',
      messages: [{ type: 'text', text: 'ทดสอบ' }],
    });
  });

  it('ตัดข้อความยาวให้อยู่ในขีดจำกัดก่อนส่ง', () => {
    const body = buildPushBody('Cxxxxxxxx', 'ก'.repeat(5000));
    expect(body.messages[0].text).toHaveLength(4900);
  });
});

describe('shouldRetry', () => {
  it('โควตาหมด (429) ไม่ลองใหม่ — ลองไปก็ไม่ผ่าน', () => {
    expect(shouldRetry(429)).toBe(false);
  });

  it('token ผิดหรือหมดสิทธิ์ (401/403) ไม่ลองใหม่ — ต้องคนไปแก้ค่า', () => {
    expect(shouldRetry(401)).toBe(false);
    expect(shouldRetry(403)).toBe(false);
  });

  it('ส่ง payload ผิด (400) ไม่ลองใหม่ — ส่งซ้ำก็ผิดเหมือนเดิม', () => {
    expect(shouldRetry(400)).toBe(false);
  });

  it('ฝั่ง LINE ล่ม (5xx) ลองใหม่ได้', () => {
    expect(shouldRetry(500)).toBe(true);
    expect(shouldRetry(503)).toBe(true);
  });

  it('ยิงไม่ออกเลย (status 0 = เน็ตหลุด/timeout) ลองใหม่ได้', () => {
    expect(shouldRetry(0)).toBe(true);
  });
});

describe('MAX_ATTEMPTS', () => {
  it('ต้องตรงกับเงื่อนไข attempts < 5 ใน app_claim_line_outbox', () => {
    expect(MAX_ATTEMPTS).toBe(5);
  });
});

describe('classifyPushResult', () => {
  it('2xx = ส่งสำเร็จ', () => {
    expect(classifyPushResult(200)).toBe('sent');
    expect(classifyPushResult(201)).toBe('sent');
  });

  it('409 = LINE เคยรับข้อความนี้ไปแล้ว ต้องนับเป็นส่งสำเร็จ ไม่ใช่ล้มเหลว', () => {
    // แถวถูกยิงซ้ำด้วย X-Line-Retry-Key เดิม ข้อความถึงกลุ่มไปแล้ว
    // ถ้าบันทึกเป็น failed แอดมินจะแยกไม่ออกจากความล้มเหลวของจริง
    expect(classifyPushResult(LINE_DUPLICATE_STATUS)).toBe('deduped');
    expect(LINE_DUPLICATE_STATUS).toBe(409);
  });

  it('4xx อื่น ๆ = หยุด ต้องให้คนไปแก้ต้นเหตุ', () => {
    expect(classifyPushResult(400)).toBe('giveup');
    expect(classifyPushResult(401)).toBe('giveup');
    expect(classifyPushResult(403)).toBe('giveup');
    expect(classifyPushResult(429)).toBe('giveup');
  });

  it('5xx และเน็ตหลุด = ลองใหม่', () => {
    expect(classifyPushResult(500)).toBe('retry');
    expect(classifyPushResult(503)).toBe('retry');
    expect(classifyPushResult(0)).toBe('retry');
  });

  it('409 ไม่ควรลองใหม่เช่นกัน — แต่เหตุผลคนละเรื่องกับ giveup', () => {
    expect(shouldRetry(LINE_DUPLICATE_STATUS)).toBe(false);
  });
});

describe('retryKeyFor', () => {
  const rowId = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';
  const groupA = 'C' + 'a'.repeat(32);
  const groupB = 'C' + 'b'.repeat(32);

  it('กลุ่มหลักใช้ id ของแถวตรง ๆ เหมือนก่อนมีหลายกลุ่ม', async () => {
    expect(await retryKeyFor(rowId, groupA, true)).toBe(rowId);
  });

  it('กลุ่มเพิ่มเติมได้คีย์รูปแบบ UUID ที่คงที่ และไม่ซ้ำกันระหว่างกลุ่ม', async () => {
    const a1 = await retryKeyFor(rowId, groupA, false);
    const a2 = await retryKeyFor(rowId, groupA, false);
    const b = await retryKeyFor(rowId, groupB, false);
    expect(a1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a1).toBe(a2);
    expect(a1).not.toBe(b);
    expect(a1).not.toBe(rowId);
  });
});

describe('combineOutcomes', () => {
  it('ทุกกลุ่มถึงแล้วนับเป็นส่งสำเร็จ', () => {
    expect(combineOutcomes(['sent', 'sent'])).toBe('sent');
    expect(combineOutcomes(['sent', 'deduped'])).toBe('deduped');
  });

  it('มีกลุ่มล้มเหลวชั่วคราวให้ลองใหม่ แม้อีกกลุ่มจะล้มเหลวถาวร', () => {
    expect(combineOutcomes(['sent', 'retry'])).toBe('retry');
    expect(combineOutcomes(['giveup', 'retry'])).toBe('retry');
  });

  it('กลุ่มที่ล้มเหลวถาวรทำให้ทั้งแถวเลิกลอง', () => {
    expect(combineOutcomes(['sent', 'giveup'])).toBe('giveup');
  });
});
