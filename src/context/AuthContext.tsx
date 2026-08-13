import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
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

  /** ดึงโปรไฟล์ในระบบงานของ session ปัจจุบัน (ใช้ได้แม้สถานะยัง pending) */
  const loadProfile = useCallback(async (activeSession: Session | null) => {
    if (!supabase || !activeSession) {
      setProfile(null);
      return;
    }

    const { data, error } = await supabase.rpc('app_my_profile');
    if (error) {
      console.error('โหลดโปรไฟล์ไม่สำเร็จ:', error.message);
      setProfile(null);
      return;
    }

    // app_my_profile คืนค่าเป็นตาราง จึงได้มาเป็น array
    const row = Array.isArray(data) ? data[0] : data;
    setProfile((row as AuthProfile) ?? null);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadProfile(data.session);
      if (active) setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!active) return;
      setSession(newSession);
      await loadProfile(newSession);
      if (active) setLoading(false);
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
    setSession(null);
    setProfile(null);
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
