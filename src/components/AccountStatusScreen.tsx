import React, { useState } from 'react';
import { Clock, LogOut, RefreshCw, ShieldAlert, ShieldX, WifiOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

type Variant = 'pending' | 'rejected' | 'missing' | 'error';

const CONTENT: Record<Variant, { icon: React.ElementType; color: string; title: string; body: string }> = {
  pending: {
    icon: Clock,
    color: '#ef6c00',
    title: 'บัญชีของคุณรอการอนุมัติ',
    body: 'คำขอใช้งานถูกส่งให้ผู้ดูแลระบบแล้ว เมื่ออนุมัติเรียบร้อยคุณจะเข้าใช้งานได้ทันที ลองกดปุ่มตรวจสอบสถานะอีกครั้งได้ตลอดเวลา',
  },
  rejected: {
    icon: ShieldX,
    color: '#dc2626',
    title: 'บัญชีนี้ไม่ได้รับอนุมัติให้ใช้งาน',
    body: 'ผู้ดูแลระบบยังไม่อนุมัติหรือได้ระงับสิทธิ์บัญชีนี้ กรุณาติดต่อผู้ดูแลระบบเพื่อสอบถามรายละเอียดเพิ่มเติม',
  },
  missing: {
    icon: ShieldAlert,
    color: '#dc2626',
    title: 'ไม่พบโปรไฟล์ผู้ใช้ในระบบงาน',
    body: 'บัญชีเข้าสู่ระบบใช้งานได้ แต่ยังไม่มีโปรไฟล์ผูกอยู่ในฐานข้อมูล กรุณาแจ้งผู้ดูแลระบบให้ตรวจสอบว่าได้รัน db/05_auth.sql เรียบร้อยแล้วหรือยัง',
  },
  error: {
    icon: WifiOff,
    color: '#ef6c00',
    title: 'โหลดข้อมูลผู้ใช้ไม่สำเร็จ',
    body: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ชั่วคราว กรุณาตรวจสอบอินเทอร์เน็ตแล้วกดตรวจสอบสถานะอีกครั้ง',
  },
};

export const AccountStatusScreen: React.FC<{ variant: Variant }> = ({ variant }) => {
  const { profile, session, signOut, refreshProfile } = useAuth();
  const [checking, setChecking] = useState(false);

  const { icon: Icon, color, title, body } = CONTENT[variant];

  const handleRefresh = async () => {
    setChecking(true);
    await refreshProfile();
    setChecking(false);
  };

  return (
    <div className="min-h-screen bg-[#fffbf2] flex items-center justify-center p-4 font-sans text-gray-900 antialiased">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 p-8 text-center">
        <div
          className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center shadow-lg mb-4"
          style={{ backgroundColor: color }}
        >
          <Icon className="w-7 h-7 text-white" />
        </div>

        <h1 className="text-base font-extrabold text-gray-900">{title}</h1>
        <p className="text-xs text-gray-500 leading-relaxed mt-2">{body}</p>

        <div className="mt-5 p-3 rounded-2xl bg-gray-50 border border-gray-100 text-left space-y-1">
          <div className="flex justify-between text-[11px]">
            <span className="text-gray-500 font-bold">อีเมล</span>
            <span className="font-bold text-gray-800 truncate ml-2">{session?.user.email}</span>
          </div>
          {profile && (
            <>
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-500 font-bold">ชื่อผู้ใช้</span>
                <span className="font-bold text-gray-800 truncate ml-2">{profile.username}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-500 font-bold">สถานะ</span>
                <span className="font-bold text-gray-800">
                  {profile.status === 'pending' ? 'รออนุมัติ' : profile.status === 'rejected' ? 'ไม่อนุมัติ' : 'อนุมัติแล้ว'}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="mt-5 flex items-center justify-center space-x-2">
          <button
            onClick={handleRefresh}
            disabled={checking}
            className="px-4 py-2 text-xs font-extrabold text-white rounded-xl shadow-md hover:opacity-90 disabled:opacity-50 inline-flex items-center space-x-1.5"
            style={{ backgroundColor: '#ef6c00' }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
            <span>ตรวจสอบสถานะอีกครั้ง</span>
          </button>

          <button
            onClick={signOut}
            className="px-4 py-2 text-xs font-bold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 inline-flex items-center space-x-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </div>
    </div>
  );
};
