import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AuthProfile, isSupabaseConfigured, supabase } from '../lib/supabase';

export interface AuthResult {
  success: boolean;
  message: string;
}

interface AuthContextType {
  /** ตั้งค่า Supabase ครบหรือยัง ถ้ายังจะเข้าใช้งานไม่ได้ */
  configured: boolean;
  loading: boolean;
  session: Session | null;
  profile: AuthProfile | null;
  /** โหลดโปรไฟล์ไม่สำเร็จ (เช่น เน็ตหลุด) — แยกจากกรณีไม่มีโปรไฟล์จริง */
  profileError: string | null;

  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, username: string, fullName: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<AuthResult>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** แปลข้อความ error ของ Supabase เป็นภาษาไทยที่ผู้ใช้เข้าใจได้ */
function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
  if (m.includes('email not confirmed')) return 'ยังไม่ได้ยืนยันอีเมล กรุณาเปิดลิงก์ยืนยันในกล่องจดหมายของคุณ';
  if (m.includes('user already registered')) return 'อีเมลนี้สมัครไว้แล้ว กรุณาเข้าสู่ระบบแทน';
  if (m.includes('password should be at least')) return 'รหัสผ่านสั้นเกินไป ต้องมีอย่างน้อย 6 ตัวอักษร';
  if (m.includes('unable to validate email address') || m.includes('invalid email')) return 'รูปแบบอีเมลไม่ถูกต้อง';
  if (m.includes('email rate limit') || m.includes('too many requests')) return 'ส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองใหม่';
  if (m.includes('failed to fetch') || m.includes('network')) return 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตหรือค่า VITE_SUPABASE_URL';
  return message;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  // โหลดซ้อนกันได้ (event มาติด ๆ กัน) — ให้ผลของรอบล่าสุดชนะเสมอ
  const loadSeq = useRef(0);
  // ผู้ใช้ที่โหลดโปรไฟล์ไว้แล้ว — TOKEN_REFRESHED ของคนเดิมไม่ต้องโหลดใหม่
  const loadedUserId = useRef<string | null>(null);

  /** ดึงโปรไฟล์ในระบบงานของ session ปัจจุบัน (ใช้ได้แม้สถานะยัง pending) */
  const loadProfile = useCallback(async (activeSession: Session | null) => {
    const seq = ++loadSeq.current;
    if (!supabase || !activeSession) {
      loadedUserId.current = null;
      setProfile(null);
      setProfileError(null);
      return;
    }

    // ลองซ้ำเผื่อเน็ตสะดุดชั่วคราว — ไม่งั้นผู้ใช้ที่ไม่ได้ผิดอะไรจะเจอหน้า "ไม่พบโปรไฟล์"
    let lastError = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 500 * attempt));
      const { data, error } = await supabase.rpc('app_my_profile');
      if (seq !== loadSeq.current) return;
      if (!error) {
        // app_my_profile คืนค่าเป็นตาราง จึงได้มาเป็น array
        const row = Array.isArray(data) ? data[0] : data;
        loadedUserId.current = activeSession.user.id;
        setProfile((row as AuthProfile) ?? null);
        setProfileError(null);
        return;
      }
      lastError = error.message;
    }

    console.error('โหลดโปรไฟล์ไม่สำเร็จ:', lastError);
    setProfile(null);
    setProfileError(lastError);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;

    // ไม่ต้องเรียก getSession() แยก — onAuthStateChange ส่ง INITIAL_SESSION ให้ทันทีที่ subscribe
    // ถ้าโหลดสองทางพร้อมกัน ทางที่เสร็จก่อนจะปิดหน้าโหลดทั้งที่โปรไฟล์ยังไม่มา
    // ห้าม await การเรียก supabase ใน callback นี้ตรง ๆ — callback ทำงานขณะถือ lock ของ auth
    // แล้ว rpc ต้องรอ lock เดียวกัน จะค้าง (deadlock) จนผู้ใช้เห็นหน้า "ไม่พบโปรไฟล์"
    // จึงเลื่อนไปทำหลัง callback คืนค่าแล้ว (ตามคำแนะนำของ supabase-js)
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!active) return;
      setSession(newSession);

      const userId = newSession?.user.id ?? null;
      if (userId && userId === loadedUserId.current) return;

      // แสดงหน้าโหลดระหว่างดึงโปรไฟล์ ไม่ให้หน้า "ไม่พบโปรไฟล์" โผล่แวบขึ้นมาก่อน
      if (newSession) setLoading(true);
      setTimeout(() => {
        const seq = loadSeq.current + 1;
        void loadProfile(newSession).then(() => {
          // รอบที่ถูกรอบใหม่แซงไปแล้วห้ามปิดหน้าโหลด
          if (active && seq === loadSeq.current) setLoading(false);
        });
      }, 0);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    if (!supabase) return { success: false, message: 'ยังไม่ได้ตั้งค่าการเชื่อมต่อ Supabase' };

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) return { success: false, message: translateAuthError(error.message) };
    return { success: true, message: 'เข้าสู่ระบบสำเร็จ' };
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, username: string, fullName: string): Promise<AuthResult> => {
      if (!supabase) return { success: false, message: 'ยังไม่ได้ตั้งค่าการเชื่อมต่อ Supabase' };

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        // trigger handle_new_auth_user ฝั่ง DB จะอ่านสองค่านี้ไปสร้างโปรไฟล์
        options: { data: { username: username.trim(), full_name: fullName.trim() } },
      });
      if (error) return { success: false, message: translateAuthError(error.message) };

      // ถ้าเปิดยืนยันอีเมลไว้ Supabase จะยังไม่คืน session มาให้
      if (!data.session) {
        return {
          success: true,
          message: 'สมัครเรียบร้อยแล้ว กรุณาเปิดลิงก์ยืนยันในอีเมลของคุณ จากนั้นรอผู้ดูแลระบบอนุมัติสิทธิ์',
        };
      }
      return {
        success: true,
        message: 'สมัครเรียบร้อยแล้ว รอผู้ดูแลระบบอนุมัติสิทธิ์เข้าใช้งาน',
      };
    },
    []
  );

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    loadedUserId.current = null;
    setSession(null);
    setProfile(null);
    setProfileError(null);
  }, []);

  const sendPasswordReset = useCallback(async (email: string): Promise<AuthResult> => {
    if (!supabase) return { success: false, message: 'ยังไม่ได้ตั้งค่าการเชื่อมต่อ Supabase' };

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    if (error) return { success: false, message: translateAuthError(error.message) };
    return { success: true, message: 'ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลของคุณแล้ว' };
  }, []);

  const refreshProfile = useCallback(async () => {
    await loadProfile(session);
  }, [loadProfile, session]);

  return (
    <AuthContext.Provider
      value={{
        configured: isSupabaseConfigured,
        loading,
        session,
        profile,
        profileError,
        signIn,
        signUp,
        signOut,
        sendPasswordReset,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth ต้องอยู่ภายใน AuthProvider');
  return ctx;
};
