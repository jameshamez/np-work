/**
 * ชั้นเชื่อมต่อระบบแจ้งเตือน LINE ฝั่งแอป
 *
 * แยกจาก api.ts เพราะไฟล์นั้นยาวเกิน 800 บรรทัดแล้ว และเรื่อง LINE
 * เป็นคนละความรับผิดชอบกับการอ่าน/เขียนข้อมูลงาน
 *
 * กติกาเดียวกับ api.ts — โยน error ออกมา ให้ผู้เรียกตัดสินใจว่าจะแสดงผลอย่างไร
 *
 * สำคัญ: ฝั่งนี้ทำได้แค่ "หย่อนข้อความลงคิว" เท่านั้น
 * การยิงเข้า LINE จริงเป็นหน้าที่ของ Edge Function ที่ถือ token อยู่ฝั่งเซิร์ฟเวอร์
 */
import { SupabaseClient } from '@supabase/supabase-js';

export interface LineConfig {
  enabled: boolean;
  monthlyCap: number;
  appUrl: string;
}

export async function fetchLineConfig(db: SupabaseClient): Promise<LineConfig | null> {
  const { data, error } = await db
    .from('line_config')
    .select('enabled, monthly_cap, app_url')
    .maybeSingle();

  if (error) throw new Error(`อ่านการตั้งค่า LINE ไม่สำเร็จ: ${error.message}`);
  // ผู้ใช้ทั่วไปมองไม่เห็นตารางนี้ตาม RLS จึงได้ผลลัพธ์ว่าง (ไม่ใช่ error) — คืน null ไปเงียบ ๆ
  if (!data) return null;

  return { enabled: data.enabled, monthlyCap: data.monthly_cap, appUrl: data.app_url ?? '' };
}

export async function setLineEnabled(db: SupabaseClient, enabled: boolean): Promise<void> {
  const { error } = await db
    .from('line_config')
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('id', true);
  if (error) throw new Error(`บันทึกสถานะ LINE ไม่สำเร็จ: ${error.message}`);
}

/**
 * หย่อนข้อความ 1 ข้อความลงคิว
 *
 * ย้ำ: 1 การเรียก = 1 แถว = 1 ข้อความที่ส่งจริง
 * ห้ามวนเรียกทีละผู้ใช้เด็ดขาด เพราะข้อความเข้ากลุ่มหักโควตาตามจำนวนสมาชิกอยู่แล้ว
 */
export async function enqueueLineMessage(
  db: SupabaseClient,
  kind: 'broadcast' | 'test',
  message: string
): Promise<void> {
  const { error } = await db.from('line_outbox').insert({ kind, message: message.slice(0, 4900) });
  if (error) throw new Error(`ส่งข้อความเข้าคิว LINE ไม่สำเร็จ: ${error.message}`);
}

export interface LineOutboxRow {
  id: string;
  kind: string;
  message: string;
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  lastError?: string;
  createdAt: string;
  sentAt?: string;
}

/** ดึงคิวล่าสุดมาแสดงให้แอดมินตรวจ — ผู้ใช้ทั่วไปเรียกแล้วจะได้ลิสต์ว่างตาม RLS */
export async function fetchLineOutbox(db: SupabaseClient, limit = 20): Promise<LineOutboxRow[]> {
  const { data, error } = await db
    .from('line_outbox')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`อ่านคิวข้อความ LINE ไม่สำเร็จ: ${error.message}`);

  return (data ?? []).map(r => ({
    id: r.id,
    kind: r.kind,
    message: r.message,
    status: r.status,
    attempts: r.attempts,
    lastError: r.last_error ?? undefined,
    createdAt: r.created_at,
    sentAt: r.sent_at ?? undefined,
  }));
}

// =============================================================================
// กลุ่ม LINE เพิ่มเติม (db/19_line_extra_groups.sql) — เฉพาะ Super Admin
// ทุกข้อความส่งเข้ากลุ่มหลัก (secret LINE_GROUP_ID) + ทุกกลุ่มที่เปิดไว้ในตารางนี้
// =============================================================================

export interface LineGroup {
  id: string;
  name: string;
  groupId: string;
  enabled: boolean;
  createdAt: string;
}

/** Group ID ของ LINE = ตัว C ตามด้วย hex 32 ตัว — ตรงกับ constraint line_groups_group_id_format */
export const LINE_GROUP_ID_PATTERN = /^C[0-9a-f]{32}$/;

export async function fetchLineGroups(db: SupabaseClient): Promise<LineGroup[]> {
  const { data, error } = await db.from('line_groups').select('*').order('created_at');
  if (error) throw new Error(`อ่านรายชื่อกลุ่ม LINE ไม่สำเร็จ: ${error.message}`);
  return (data ?? []).map(r => ({
    id: r.id,
    name: r.name,
    groupId: r.group_id,
    enabled: r.enabled,
    createdAt: r.created_at,
  }));
}

export async function addLineGroup(db: SupabaseClient, name: string, groupId: string): Promise<void> {
  const { error } = await db.from('line_groups').insert({ name: name.trim(), group_id: groupId.trim() });
  if (error) {
    if (error.code === '23505') throw new Error('เพิ่มกลุ่ม LINE ไม่สำเร็จ: มี Group ID นี้อยู่แล้ว');
    throw new Error(`เพิ่มกลุ่ม LINE ไม่สำเร็จ: ${error.message}`);
  }
}

export async function setLineGroupEnabled(db: SupabaseClient, id: string, enabled: boolean): Promise<void> {
  const { data, error } = await db.from('line_groups').update({ enabled }).eq('id', id).select('id');
  if (error) throw new Error(`บันทึกสถานะกลุ่ม LINE ไม่สำเร็จ: ${error.message}`);
  if (!data || data.length === 0) throw new Error('บันทึกสถานะกลุ่ม LINE ไม่สำเร็จ: เฉพาะ Super Admin เท่านั้น');
}

export async function deleteLineGroup(db: SupabaseClient, id: string): Promise<void> {
  const { data, error } = await db.from('line_groups').delete().eq('id', id).select('id');
  if (error) throw new Error(`ลบกลุ่ม LINE ไม่สำเร็จ: ${error.message}`);
  if (!data || data.length === 0) throw new Error('ลบกลุ่ม LINE ไม่สำเร็จ: เฉพาะ Super Admin เท่านั้น');
}
