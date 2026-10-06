import React from 'react';
import { useApp } from '../context/AppContext';
import {
  Kanban,
  BarChart3,
  CalendarDays,
  History,
  ShieldCheck,
  Database,
  GraduationCap,
  Settings,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { currentUser, users } = useApp();
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);

  const pendingUsersCount = users.filter(u => u.status === 'pending').length;

  return (
    <aside className="w-full lg:w-72 bg-[#ffcc80] border-r border-[#ef6c00]/20 flex flex-col shrink-0 rounded-2xl shadow-lg overflow-hidden print:hidden transition-all">
      
      {/* Sidebar Header (Theme #ef6c00) with mobile expand/collapse button */}
      <div className="p-4 sm:p-5 bg-[#ef6c00] text-white flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center font-black text-[#ef6c00] shadow-xs">
            NP
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-tight leading-none">TASKWORK PRO</h1>
            <p className="text-[10px] mt-1 opacity-85 uppercase tracking-widest font-semibold">ระบบติดตามงานระดับองค์กร</p>
          </div>
        </div>

        {/* Mobile menu toggle button */}
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="lg:hidden p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
          aria-label="Toggle Navigation Menu"
        >
          <span>{isMobileOpen ? 'ซ่อนเมนู ▲' : 'เมนู ▼'}</span>
        </button>
      </div>

      {/* User Profile & Delegation Card (collapsible on mobile if closed, always visible on md+) */}
      <div className={`p-4 border-b border-[#ef6c00]/10 ${isMobileOpen ? 'block' : 'hidden lg:block'}`}>
        <div className="bg-white/50 backdrop-blur-xs p-3.5 rounded-xl border border-white/60 shadow-xs">
          <div className="flex items-center gap-3 mb-2.5">
            <div className="w-9 h-9 bg-[#ef6c00] rounded-full flex items-center justify-center text-white font-bold text-sm shadow-xs shrink-0">
              {currentUser?.fullName?.charAt(0) || 'พ'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#6a3000] truncate">{currentUser?.fullName?.replace(/\s*\([^)]*\)/g, '') || 'พี่หนึ่ง'}</p>
            </div>
          </div>
          <div className="bg-[#ef6c00]/10 p-2 rounded-lg text-[10px] text-[#6a3000] border border-[#ef6c00]/20">
            <p className="font-bold uppercase mb-0.5 text-[9px] opacity-80">🚩 สถานะการทำแทน</p>
            <p className="truncate">กำลังสลับใช้งานสิทธิ์: <span className="font-bold">{currentUser?.fullName?.replace(/\s*\([^)]*\)/g, '') || 'พี่หนึ่ง'}</span></p>
          </div>
        </div>
      </div>

      {/* Nav Menu (collapsible on mobile if closed, always visible on md+) */}
      <nav className={`p-3 flex-1 space-y-1.5 overflow-y-auto ${isMobileOpen ? 'block' : 'hidden lg:block'}`}>
        <button
          onClick={() => {
            setActiveTab('kanban');
            setIsMobileOpen(false);
          }}
          className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'kanban'
              ? 'bg-white/80 text-[#ef6c00] shadow-xs border border-white'
              : 'text-[#6a3000] hover:bg-white/30 opacity-90'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Kanban className="w-4 h-4 text-[#ef6c00]" />
            <span>บอร์ดติดตามงาน (Kanban)</span>
          </div>
        </button>

        <button
          onClick={() => {
            setActiveTab('ku_project');
            setIsMobileOpen(false);
          }}
          className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'ku_project'
              ? 'bg-emerald-800 text-white shadow-sm border border-emerald-600 ring-2 ring-emerald-400'
              : 'bg-emerald-900/10 text-emerald-950 hover:bg-emerald-900/20 font-black border border-emerald-800/20'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <GraduationCap className="w-4 h-4 text-emerald-700" />
            <span>งานโครงการ (ตามงวดงาน)</span>
          </div>
          <span className="text-[9px] bg-emerald-600 text-white font-black px-1.5 py-0.5 rounded-full">
            TOR
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab('dashboard');
            setIsMobileOpen(false);
          }}
          className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'dashboard'
              ? 'bg-white/80 text-[#ef6c00] shadow-xs border border-white'
              : 'text-[#6a3000] hover:bg-white/30 opacity-90'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <BarChart3 className="w-4 h-4 text-[#ef6c00]" />
            <span>แดชบอร์ดสรุปผล & PDF</span>
          </div>
        </button>

        <button
          onClick={() => {
            setActiveTab('calendar');
            setIsMobileOpen(false);
          }}
          className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'calendar'
              ? 'bg-white/80 text-[#ef6c00] shadow-xs border border-white'
              : 'text-[#6a3000] hover:bg-white/30 opacity-90'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <CalendarDays className="w-4 h-4 text-[#ef6c00]" />
            <span>ปฏิทินแผนงาน</span>
          </div>
        </button>

        <button
          onClick={() => {
            setActiveTab('logs');
            setIsMobileOpen(false);
          }}
          className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'logs'
              ? 'bg-white/80 text-[#ef6c00] shadow-xs border border-white'
              : 'text-[#6a3000] hover:bg-white/30 opacity-90'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <History className="w-4 h-4 text-[#ef6c00]" />
            <span>ประวัติ Log & บันทึกทำแทน</span>
          </div>
        </button>

        {currentUser?.role === 'super_admin' && (
          <button
            onClick={() => {
              setActiveTab('admin');
              setIsMobileOpen(false);
            }}
            className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'admin'
                ? 'bg-white/80 text-[#ef6c00] shadow-xs border border-white'
                : 'text-[#6a3000] hover:bg-white/30 opacity-90'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#ef6c00]" />
              <span>อนุมัติผู้สมัคร & สิทธิ์</span>
            </div>
            {pendingUsersCount > 0 && (
              <span className="bg-[#bf360c] text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full animate-bounce">
                {pendingUsersCount}
              </span>
            )}
          </button>
        )}

        {currentUser?.role === 'super_admin' && (
          <button
            onClick={() => {
              setActiveTab('settings');
              setIsMobileOpen(false);
            }}
            className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'settings'
                ? 'bg-white/80 text-[#ef6c00] shadow-xs border border-white'
                : 'text-[#6a3000] hover:bg-white/30 opacity-90'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Settings className="w-4 h-4 text-[#ef6c00]" />
              <span>การตั้งค่าระบบ</span>
            </div>
          </button>
        )}

        <button
          onClick={() => {
            setActiveTab('backup');
            setIsMobileOpen(false);
          }}
          className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'backup'
              ? 'bg-white/80 text-[#ef6c00] shadow-xs border border-white'
              : 'text-[#6a3000] hover:bg-white/30 opacity-90'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Database className="w-4 h-4 text-[#ef6c00]" />
            <span>สำรองข้อมูล & Data Policy</span>
          </div>
        </button>
      </nav>

      {/* Footer SLA Info (hidden on mobile when closed) */}
      <div className={`p-4 border-t border-[#ef6c00]/10 text-[10px] text-[#6a3000] opacity-70 text-center space-y-1 font-mono ${isMobileOpen ? 'block' : 'hidden lg:block'}`}>
        <p>Data retention: 5 Years SLA</p>
        <p>Backup scheduled: 2026-12-31</p>
      </div>

    </aside>
  );
};


