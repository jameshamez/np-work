import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ClipboardList,
  Bell,
  CheckCircle2,
  Printer,
  Plus,
  UserCheck,
  LogOut,
  X,
  MessageSquare,
  Smartphone,
} from 'lucide-react';

interface NavbarProps {
  onOpenCreateModal: () => void;
  onSignOut: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenCreateModal,
  onSignOut,
}) => {
  const {
    currentUser,
    users,
    setCurrentUserId,
    notifications,
    markNotificationRead,
    clearAllNotifications,
    lineNotifyEnabled,
    toggleLineNotify,
  } = useApp();

  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  // Filter notifications for current user or all if admin
  const userNotifications = notifications.filter(
    n => n.recipientUserId === currentUser?.id || currentUser?.role === 'super_admin'
  );
  const unreadCount = userNotifications.filter(n => !n.read).length;

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-xs print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Left: Brand Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-tight text-gray-900">
                  NP <span style={{ color: '#ef6c00' }}>TASKWORK</span>
                </span>
                <span className="bg-orange-100 text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: '#ef6c00' }}>
                  ระบบติดตามงาน
                </span>
              </div>
              <p className="text-[11px] text-gray-500 hidden sm:block">
                ระบบจัดการสถานะการดำเนินงาน & บันทึกการทำแทน
              </p>
            </div>
          </div>

          {/* Center / Right Controls */}
          <div className="flex items-center space-x-2 sm:space-x-4">

            {/* LINE Notify Status Toggle */}
            <button
              onClick={toggleLineNotify}
              className={`inline-flex items-center space-x-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg border transition-all ${
                lineNotifyEnabled
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-gray-50 text-gray-400 border-gray-200'
              }`}
              title="สลับสถานะระบบแจ้งเตือน LINE Notify"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">
                LINE: {lineNotifyEnabled ? 'เปิด' : 'ปิด'}
              </span>
            </button>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="แจ้งเตือน"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Dropdown Menu */}
              {showNotifDropdown && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Bell className="w-4 h-4 text-orange-600" />
                      <span className="font-bold text-sm text-gray-800">การแจ้งเตือน</span>
                      {unreadCount > 0 && (
                        <span className="bg-orange-100 text-orange-800 text-xs font-bold px-2 py-0.5 rounded-full">
                          {unreadCount} ใหม่
                        </span>
                      )}
                    </div>
                    {userNotifications.length > 0 && (
                      <button
                        onClick={clearAllNotifications}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        ล้างทั้งหมด
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                    {userNotifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-gray-400">
                        ไม่มีการแจ้งเตือนใหม่
                      </div>
                    ) : (
                      userNotifications.map(notif => (
                        <div
                          key={notif.id}
                          onClick={() => markNotificationRead(notif.id)}
                          className={`p-3.5 hover:bg-orange-50/50 cursor-pointer transition-colors ${
                            !notif.read ? 'bg-orange-50/30' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <h4 className="text-xs font-bold text-gray-900">{notif.title}</h4>
                            {!notif.read && (
                              <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 mt-1 line-clamp-2">{notif.message}</p>
                          <span className="text-[10px] text-gray-400 mt-1.5 block">
                            {new Date(notif.createdAt).toLocaleTimeString('th-TH', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Current User Switcher & Info */}
            <div className="flex items-center space-x-2 pl-2 border-l border-gray-200">
              <div className="hidden md:flex flex-col text-right">
                <span className="text-xs font-bold text-gray-900 truncate max-w-[120px]">
                  {currentUser?.fullName?.replace(/\s*\([^)]*\)/g, '') || 'ผู้ใช้งาน'}
                </span>
              </div>

              {/* User Select Dropdown - Only Super Admin can switch users */}
              {currentUser?.role === 'super_admin' ? (
                <select
                  value={currentUser?.id || ''}
                  onChange={e => setCurrentUserId(e.target.value)}
                  className="text-xs border border-orange-300 rounded-lg px-2 py-1.5 bg-orange-50 font-bold text-orange-900 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer max-w-[140px] shadow-2xs"
                  title="Super Admin: สลับสิทธิ์การเข้าใช้งานเพื่อทดสอบระบบ"
                >
                  {users
                    .filter(u => u.status === 'approved')
                    .map(u => (
                      <option key={u.id} value={u.id}>
                        {u.fullName?.replace(/\s*\([^)]*\)/g, '')}
                      </option>
                    ))}
                </select>
              ) : (
                <div
                  className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-100 font-bold text-gray-800 flex items-center space-x-1.5 max-w-[140px] shadow-2xs"
                  title="สิทธิ์การใช้งานประจำตัวของคุณ (เฉพาะ Super Admin จึงจะสลับสิทธิ์ได้)"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                  <span className="truncate">{currentUser?.fullName?.replace(/\s*\([^)]*\)/g, '') || 'ผู้ใช้งาน'}</span>
                </div>
              )}

              {/* Sign Out */}
              <button
                onClick={onSignOut}
                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="ออกจากระบบ"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

          </div>

        </div>
      </div>
    </header>
  );
};
