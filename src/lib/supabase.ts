import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

/**
 * ระบบจะเข้าสู่โหมดล็อกอินจริงก็ต่อเมื่อตั้งค่า env ครบทั้งสองตัวแล้ว
 * ถ้ายังไม่ตั้ง แอปจะยังใช้งานได้ในโหมดสาธิต (ข้อมูลอยู่ใน localStorage เหมือนเดิม)
 */
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/** โปรไฟล์ในระบบงาน (แถวจากตาราง public.users) ที่ผูกกับบัญชี Auth */
export interface AuthProfile {
  id: string;
  username: string;
  full_name: string;
  email: string;
  role: 'user' | 'admin' | 'super_admin';
  status: 'pending' | 'approved' | 'rejected';
  avatar_url: string | null;
  no_update_alert_hours: number;
  created_at: string;
}
