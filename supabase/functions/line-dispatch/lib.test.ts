import { describe, expect, it } from 'vitest';
import {
  buildPushBody,
  clampMessage,
  classifyPushResult,
  LINE_DUPLICATE_STATUS,
  MAX_ATTEMPTS,
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
