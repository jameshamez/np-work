import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogIn,
  Mail,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

type Mode = 'login' | 'register' | 'forgot';

export const AuthScreen: React.FC = () => {
  const { configured, signIn, signUp, sendPasswordReset } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ success: boolean; text: string } | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setMsg(null);
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setMsg(null);

    if (mode === 'register') {
      if (password !== confirmPassword) {
        setMsg({ success: false, text: 'รหัสผ่านทั้งสองช่องไม่ตรงกัน' });
        return;
      }
      if (password.length < 8) {
        setMsg({ success: false, text: 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร' });
        return;
      }
    }

    setBusy(true);
    const result =
      mode === 'login'
        ? await signIn(email, password)
        : mode === 'register'
          ? await signUp(email, password, username, fullName)
          : await sendPasswordReset(email);
    setBusy(false);

    setMsg({ success: result.success, text: result.message });

    if (result.success && mode === 'register') {
      setPassword('');
      setConfirmPassword('');
    }
  };

  const inputClass =
    'w-full px-3.5 py-2.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-gray-50 disabled:text-gray-400';

  return (
    <div className="min-h-screen bg-[#fffbf2] flex items-center justify-center p-4 font-sans text-gray-900 antialiased">
      <div className="w-full max-w-md">
        {/* หัวระบบ */}
        <div className="text-center mb-6">
          <div
            className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center shadow-lg mb-3"
            style={{ backgroundColor: '#ef6c00' }}
          >
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-lg font-extrabold text-gray-900">NP Taskwork</h1>
          <p className="text-xs text-gray-500 mt-1">ระบบติดตามงานและสถานะการดำเนินงาน</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          {/* แถบสลับโหมด */}
          {mode !== 'forgot' && (
            <div className="grid grid-cols-2 border-b border-gray-100">
              <button
                onClick={() => switchMode('login')}
                className={`py-3 text-xs font-extrabold transition-colors ${
                  mode === 'login'
                    ? 'text-amber-950 border-b-2 border-[#ef6c00] bg-[#ffcc80]/40'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                เข้าสู่ระบบ
              </button>
              <button
                onClick={() => switchMode('register')}
                className={`py-3 text-xs font-extrabold transition-colors ${
                  mode === 'register'
                    ? 'text-amber-950 border-b-2 border-[#ef6c00] bg-[#ffcc80]/40'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                สมัครใช้งาน
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="inline-flex items-center space-x-1 text-xs font-bold text-gray-500 hover:text-orange-600"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>กลับไปหน้าเข้าสู่ระบบ</span>
              </button>
            )}

            {!configured && (
              <div className="p-3 rounded-2xl text-xs bg-amber-50 text-amber-900 border border-amber-200 space-y-1.5">
                <div className="flex items-center space-x-1.5 font-extrabold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>ยังไม่ได้ตั้งค่าการเชื่อมต่อฐานข้อมูล</span>
                </div>
                <p className="leading-relaxed">
                  ตั้งค่า <code className="font-mono">VITE_SUPABASE_URL</code> และ{' '}
                  <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> ในไฟล์{' '}
                  <code className="font-mono">.env.local</code> แล้วรีสตาร์ท dev server
                  จึงจะเข้าสู่ระบบได้ (ดูขั้นตอนใน <code className="font-mono">db/README.md</code>)
                </p>
              </div>
            )}

            {msg && (
              <div
                className={`p-3 rounded-2xl text-xs flex items-start space-x-2 ${
                  msg.success
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {msg.success ? (
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600 mt-px" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-px" />
                )}
                <span className="leading-relaxed">{msg.text}</span>
              </div>
            )}

            {mode === 'register' && (
              <>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-800">
                    ชื่อ-นามสกุล <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น สมชาย สายชล"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className={inputClass}
                    disabled={!configured || busy}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-800">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น User_Somchai"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className={inputClass}
                    disabled={!configured || busy}
                    minLength={3}
                    required
                  />
                </div>
              </>
            )}

            <div className="space-y-1">
              <label className="block text-xs font-bold text-gray-800">
                อีเมล <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  placeholder="somchai@company.co.th"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={`${inputClass} pl-9`}
                  disabled={!configured || busy}
                  required
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-800">
                  รหัสผ่าน <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <KeyRound className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={mode === 'register' ? 'อย่างน้อย 8 ตัวอักษร' : '••••••••'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className={`${inputClass} pl-9 pr-9`}
                    disabled={!configured || busy}
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    title={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-800">
                  ยืนยันรหัสผ่าน <span className="text-red-500">*</span>
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="พิมพ์รหัสผ่านอีกครั้ง"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className={inputClass}
                  disabled={!configured || busy}
                  autoComplete="new-password"
                  required
                />
              </div>
            )}

            {mode === 'register' && (
              <p className="text-[11px] text-gray-500 leading-relaxed bg-gray-50 rounded-xl p-3 border border-gray-100">
                บัญชีใหม่จะมีสถานะ <strong>รออนุมัติ</strong> ผู้ดูแลระบบต้องอนุมัติก่อนจึงจะเข้าใช้งานได้
                และทุกบัญชีเริ่มต้นด้วยสิทธิ์ <strong>User</strong> เสมอ
              </p>
            )}

            <button
              type="submit"
              disabled={!configured || busy}
              className="w-full py-2.5 text-xs font-extrabold text-white rounded-xl shadow-md transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center space-x-1.5"
              style={{ backgroundColor: '#ef6c00' }}
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mode === 'login' ? (
                <LogIn className="w-4 h-4" />
              ) : mode === 'register' ? (
                <UserPlus className="w-4 h-4" />
              ) : (
                <Mail className="w-4 h-4" />
              )}
              <span>
                {mode === 'login' ? 'เข้าสู่ระบบ' : mode === 'register' ? 'สมัครใช้งาน' : 'ส่งลิงก์ตั้งรหัสผ่านใหม่'}
              </span>
            </button>

            {mode === 'login' && (
              <button
                type="button"
                onClick={() => switchMode('forgot')}
                className="w-full text-center text-[11px] font-bold text-gray-500 hover:text-orange-600"
              >
                ลืมรหัสผ่าน?
              </button>
            )}
          </form>
        </div>

        <p className="text-center text-[11px] text-gray-400 mt-6">
          TASK-FLOW © 2026 • ระบบติดตามโครงการ ม.เกษตร และงานทั่วไป
        </p>
      </div>
    </div>
  );
};
