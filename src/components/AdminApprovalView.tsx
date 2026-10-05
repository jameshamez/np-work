import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ShieldCheck,
  UserCheck,
  UserX,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Bell,
  MessageSquare,
  Zap,
  Check,
  Smartphone
} from 'lucide-react';
import { LineOutboxRow } from '../lib/lineApi';

// ช่วงที่ฐานข้อมูลยอมรับ (users_alert_hours_rng ใน db/16_alert_minutes.sql)
const MIN_ALERT_HOURS = 0.25;
const MAX_ALERT_HOURS = 168;
const PRESET_HOURS = [0.25, 0.5, 0.75, 1, 2, 4, 6, 8, 12, 24];

const sameMinutes = (a: number, b: number) => Math.round(a * 60) === Math.round(b * 60);
// ต่ำกว่า 1 ชม. หรือไม่ลงตัวเป็นชั่วโมง/ครึ่งชั่วโมง -> แสดงเป็นนาทีจะอ่านง่ายกว่า
const prefersMinutes = (hours: number) => hours < 1 || Math.round(hours * 60) % 30 !== 0;

/**
 * ช่องพิมพ์เวลาแจ้งเตือน — เก็บค่าที่กำลังพิมพ์ไว้ในช่องก่อน แล้วบันทึกตอนกด Enter หรือออกจากช่อง
 * (เดิมบันทึกทุกครั้งที่กดแป้น ช่องเลยเด้งกลับเป็นค่าเก่าระหว่างพิมพ์ และพิมพ์ทับได้ตัวเลขเพี้ยน)
 * เปลี่ยนหน่วยแค่เปลี่ยนการแสดงผล ระยะเวลาเท่าเดิม
 */
const AlertDurationInput: React.FC<{ hours: number; onCommit: (hours: number) => void }> = ({ hours, onCommit }) => {
  const [unit, setUnit] = useState<'min' | 'hr'>(() => (prefersMinutes(hours) ? 'min' : 'hr'));
  const toDisplay = useCallback(
    (h: number, u: 'min' | 'hr') => String(u === 'min' ? Math.round(h * 60) : Math.round(h * 100) / 100),
    []
  );
  const [draft, setDraft] = useState(() => toDisplay(hours, unit));

  // ค่าจากฐานข้อมูลเปลี่ยน (บันทึกสำเร็จ / เลือกจาก preset) -> แสดงตามค่าใหม่
  useEffect(() => {
    const u = prefersMinutes(hours) ? 'min' : 'hr';
    setUnit(u);
    setDraft(toDisplay(hours, u));
  }, [hours, toDisplay]);

  const commit = () => {
    const val = parseFloat(draft);
    if (isNaN(val) || val <= 0) {
      setDraft(toDisplay(hours, unit));
      return;
    }
    const next = Math.min(MAX_ALERT_HOURS, Math.max(MIN_ALERT_HOURS, unit === 'min' ? val / 60 : val));
    setDraft(toDisplay(next, unit));
    if (!sameMinutes(next, hours)) onCommit(next);
  };

  return (
    <div className="flex items-center bg-orange-50/80 border border-orange-200 rounded-xl px-2 py-1 shadow-2xs">
      <input
        type="number"
        min={unit === 'min' ? 15 : 0.25}
        max={unit === 'min' ? MAX_ALERT_HOURS * 60 : MAX_ALERT_HOURS}
        step={unit === 'min' ? 1 : 0.5}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        className="w-11 text-center font-black text-xs text-orange-950 bg-transparent focus:outline-none"
        title={`พิมพ์ตัวเลขแล้วกด Enter (ได้ตั้งแต่ 15 นาที ถึง ${MAX_ALERT_HOURS} ชม.)`}
      />
      <select
        value={unit}
        onChange={e => {
          const u = e.target.value as 'min' | 'hr';
          setUnit(u);
          setDraft(toDisplay(hours, u));
        }}
        className="text-[11px] font-black text-orange-900 bg-transparent border-0 focus:outline-none cursor-pointer pr-1"
      >
        <option value="min">นาที</option>
        <option value="hr">ชม.</option>
      </select>
    </div>
  );
};

export const AdminApprovalView: React.FC = () => {
  const {
    users,
    approveUser,
    rejectUser,
    removeUser,
    currentUser,
    tasks,
    updateUserNotificationSettings,
    checkNoUpdateTasksAndNotify,
    sendTestLineMessage,
    fetchLineQueue
  } = useApp();

  const [activeTab, setActiveTab] = useState<'approvals' | 'notifications'>('approvals');
  const [testSuccessMsg, setTestSuccessMsg] = useState<string | null>(null);
  const [lineQueue, setLineQueue] = useState<LineOutboxRow[]>([]);
  const [lineQueueError, setLineQueueError] = useState<string | null>(null);

  // โหลดคิวตอนเปิดหน้า และหลังกดปุ่มทดสอบ
  // เจตนาไม่กลืน error เงียบ ๆ — แผงนี้มีไว้เพื่อให้ความล้มเหลวของ LINE มองเห็นได้
  const reloadLineQueue = useCallback(() => {
    void fetchLineQueue()
      .then(rows => {
        setLineQueue(rows);
        setLineQueueError(null);
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        console.error('โหลดคิวข้อความ LINE ไม่สำเร็จ:', message);
        setLineQueue([]);
        setLineQueueError(message);
      });
  }, [fetchLineQueue]);

  useEffect(reloadLineQueue, [reloadLineQueue]);

  if (currentUser?.role !== 'super_admin') {
    return (
      <div className="bg-white rounded-2xl p-8 border border-gray-200 text-center space-y-3">
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
        <h3 className="text-sm font-bold text-gray-800">ไม่มีสิทธิ์เข้าถึงหน้านี้</h3>
        <p className="text-xs text-gray-500">
          หน้านี้สงวนไว้สำหรับผู้ดูแลระบบสูงสุด (Super Admin) เพื่ออนุมัติผู้ขอสมัคร User ใหม่และตั้งค่าระบบเท่านั้น
        </p>
      </div>
    );
  }

  const pendingUsers = users.filter(u => u.status === 'pending');
  const approvedUsers = users.filter(u => u.status === 'approved');

  const handleRemoveUser = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    const openTasks = tasks.filter(t => t.assignedToUserId === userId && t.status !== 'approved' && !t.isDraft).length;
    const warning = openTasks > 0
      ? `\n\n⚠️ ผู้ใช้นี้ยังเป็นเจ้าของงานที่ยังไม่ปิด ${openTasks} งาน ควรโอนงานให้ผู้อื่นก่อนหรือหลังลบ`
      : '';
    if (
      confirm(
        `ลบผู้ใช้งาน "${user.fullName}" ออกจากระบบใช่หรือไม่?\n\nผู้ใช้นี้จะเข้าสู่ระบบไม่ได้อีก แต่ประวัติงานเดิมยังอยู่ครบ` +
          ` หากกลับมาทำงานใหม่ ให้สมัครด้วยอีเมลเดิมแล้วอนุมัติอีกครั้ง${warning}`
      )
    ) {
      removeUser(userId);
    }
  };

  const handleManualCheckTrigger = () => {
    const count = checkNoUpdateTasksAndNotify();
    setTestSuccessMsg(`ส่งการแจ้งเตือนเตือนความจำบนเว็บสำเร็จ ${count} รายการ`);
    setTimeout(() => setTestSuccessMsg(null), 5000);
  };

  const handleTestLine = () => {
    sendTestLineMessage();
    setTestSuccessMsg('หย่อนข้อความทดสอบเข้าคิวแล้ว — ดูในกลุ่ม LINE ของทีมภายในไม่กี่วินาที');
    setTimeout(() => { setTestSuccessMsg(null); reloadLineQueue(); }, 5000);
  };

  return (
    <div className="space-y-6">
      
      {/* Header Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200/80 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-gray-900 flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-orange-600" />
              <span>อนุมัติผู้สมัคร & กำหนดสิทธิ์การแจ้งเตือน (Super Admin Panel)</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              จัดการพิจารณาอนุมัติผู้สมัคร และตั้งค่าระบบการแจ้งเตือนการ์ดงานรายบุคคล
            </p>
          </div>

          {/* Tab Selection */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-gray-100 rounded-xl self-start lg:self-auto lg:shrink-0">
            <button
              onClick={() => setActiveTab('approvals')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center space-x-1.5 transition-all cursor-pointer ${
                activeTab === 'approvals'
                  ? 'bg-white text-orange-700 shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>1. อนุมัติผู้สมัคร</span>
              {pendingUsers.length > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                  {pendingUsers.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('notifications')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center space-x-1.5 transition-all cursor-pointer ${
                activeTab === 'notifications'
                  ? 'bg-white text-orange-700 shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Bell className="w-3.5 h-3.5 text-orange-600" />
              <span>2. กำหนดค่าการแจ้งเตือนรายบุคคล</span>
            </button>
          </div>
        </div>

        {testSuccessMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center space-x-2 animate-in fade-in duration-200">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{testSuccessMsg}</span>
          </div>
        )}
      </div>

      {/* Tab 1: User Approval & Permissions */}
      {activeTab === 'approvals' && (
        <div className="space-y-6">
          {/* Pending Approval Table */}
          <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-gray-900 uppercase tracking-wide flex items-center space-x-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <span>คำขอสมัครสิทธิ์ที่รอการอนุมัติ ({pendingUsers.length} รายการ)</span>
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 uppercase text-[10px] font-extrabold">
                    <th className="py-2.5 px-3">ชื่อ-นามสกุล</th>
                    <th className="py-2.5 px-3">Username</th>
                    <th className="py-2.5 px-3">อีเมล</th>
                    <th className="py-2.5 px-3">ระดับสิทธิ์ที่ขอ</th>
                    <th className="py-2.5 px-3">วันที่ยื่นขอ</th>
                    <th className="py-2.5 px-3 text-right">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 font-medium">
                  {pendingUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400">
                        ไม่มีคำขอสมัครสิทธิ์ค้างอนุมัติในขณะนี้
                      </td>
                    </tr>
                  ) : (
                    pendingUsers.map(u => (
                      <tr key={u.id} className="hover:bg-orange-50/30 transition-colors">
                        <td className="py-3 px-3 font-bold text-gray-900">{u.fullName}</td>
                        <td className="py-3 px-3 text-gray-600">{u.username}</td>
                        <td className="py-3 px-3 text-gray-600">{u.email}</td>
                        <td className="py-3 px-3 capitalize font-bold text-orange-700">{u.role}</td>
                        <td className="py-3 px-3 text-gray-400">
                          {new Date(u.createdAt).toLocaleDateString('th-TH')}
                        </td>
                        <td className="py-3 px-3 text-right space-x-2">
                          <button
                            onClick={() => rejectUser(u.id)}
                            className="px-3 py-1.5 text-[11px] font-bold text-red-700 bg-red-100 hover:bg-red-200 rounded-xl transition-colors cursor-pointer"
                          >
                            <UserX className="w-3.5 h-3.5 inline mr-1" />
                            ปฏิเสธ
                          </button>
                          <button
                            onClick={() => approveUser(u.id)}
                            className="px-3 py-1.5 text-[11px] font-bold text-emerald-950 bg-emerald-300 hover:bg-emerald-400 rounded-xl transition-colors shadow-2xs cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5 inline mr-1" />
                            อนุมัติเปิดสิทธิ์
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Approved Users List */}
          <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-2xs space-y-4">
            <h3 className="text-xs font-extrabold text-gray-900 uppercase tracking-wide flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>รายชื่อผู้ใช้งานที่ได้รับการอนุมัติแล้วในระบบ ({approvedUsers.length} ท่าน)</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 uppercase text-[10px] font-extrabold">
                    <th className="py-2.5 px-3">ชื่อ-นามสกุล</th>
                    <th className="py-2.5 px-3">Username</th>
                    <th className="py-2.5 px-3">อีเมล</th>
                    <th className="py-2.5 px-3">ระดับสิทธิ์</th>
                    <th className="py-2.5 px-3">สถานะ</th>
                    <th className="py-2.5 px-3 text-right">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 font-medium">
                  {approvedUsers.map(u => (
                    <tr key={u.id}>
                      <td className="py-2.5 px-3 font-bold text-gray-800">{u.fullName}</td>
                      <td className="py-2.5 px-3 text-gray-600">{u.username}</td>
                      <td className="py-2.5 px-3 text-gray-600">{u.email}</td>
                      <td className="py-2.5 px-3 capitalize font-bold text-orange-800">{u.role}</td>
                      <td className="py-2.5 px-3">
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          อนุมัติแล้ว
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {u.id !== currentUser?.id && (
                          <button
                            onClick={() => handleRemoveUser(u.id)}
                            className="px-3 py-1.5 text-[11px] font-bold text-red-700 bg-red-100 hover:bg-red-200 rounded-xl transition-colors cursor-pointer"
                            title="ลบผู้ใช้งานที่ลาออก (เก็บประวัติงานเดิมไว้)"
                          >
                            <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                            ลบผู้ใช้
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Individual Notification Settings */}
      {activeTab === 'notifications' && (
        <div className="space-y-6">
          
          {/* Rules Banner & Manual Trigger */}
          <div className="bg-orange-50/60 border border-orange-200 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-sm font-black text-gray-900 flex items-center space-x-2">
                  <Bell className="w-4 h-4 text-orange-600" />
                  <span>เงื่อนไขและช่องทางการแจ้งเตือนอัตโนมัติ</span>
                </h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  ระบบจะทำการแจ้งเตือนผ่าน <span className="font-bold text-gray-900">กระดิ่งใน Web App</span> ทันทีตาม 2 เงื่อนไข
                  (ส่วนข้อความเข้ากลุ่ม <span className="font-bold text-emerald-700">LINE</span> ส่งเป็นสรุปรายวันแยกต่างหาก):
                </p>
                <ul className="text-xs text-gray-700 space-y-1 mt-1 font-medium list-disc list-inside">
                  <li><span className="font-bold text-orange-800">เมื่อมีคนกดส่งงาน</span> → ระบบส่งแจ้งเตือนถึงผู้ตรวจและผู้เกี่ยวข้องทันที</li>
                  <li><span className="font-bold text-orange-800">เมื่อการ์ดงานขาดการอัปเดตเกินกำหนด</span> → ระบบส่งแจ้งเตือนตามรอบเวลาที่ Super Admin กำหนดให้การ์ดที่คนนั้นสร้าง</li>
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                <button
                  onClick={handleManualCheckTrigger}
                  className="px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center space-x-2 cursor-pointer"
                >
                  <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                  <span>ตรวจสอบ & ส่งแจ้งเตือนการ์ดค้างอัปเดตทันที</span>
                </button>

                <button
                  type="button"
                  onClick={handleTestLine}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 transition-colors"
                >
                  ทดสอบส่งเข้ากลุ่ม LINE
                </button>
              </div>
            </div>

            {(lineQueue.length > 0 || lineQueueError) && (
              <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-3 py-2 bg-gray-50 text-xs font-bold text-gray-700 flex items-center justify-between">
                  <span>คิวข้อความ LINE ล่าสุด</span>
                  <button type="button" onClick={reloadLineQueue} className="text-[11px] font-bold text-orange-600">
                    รีเฟรช
                  </button>
                </div>
                {lineQueueError ? (
                  <div className="p-3 bg-red-50 text-red-700 text-xs font-bold flex items-center space-x-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>โหลดคิวข้อความ LINE ไม่สำเร็จ: {lineQueueError}</span>
                  </div>
                ) : (
                  <table className="w-full text-[11px]">
                    <thead className="text-left text-gray-500">
                      <tr className="border-t border-gray-100">
                        <th className="py-1.5 px-3">เวลา</th>
                        <th className="py-1.5 px-3">ประเภท</th>
                        <th className="py-1.5 px-3">สถานะ</th>
                        <th className="py-1.5 px-3">รายละเอียดข้อผิดพลาด</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {lineQueue.map(row => (
                        <tr key={row.id}>
                          <td className="py-1.5 px-3 text-gray-500">
                            {new Date(row.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="py-1.5 px-3">{row.kind}</td>
                          <td className="py-1.5 px-3">
                            <span className={
                              row.status === 'sent'   ? 'text-emerald-700 font-bold' :
                              row.status === 'failed' ? 'text-red-700 font-bold'     :
                                                        'text-gray-500 font-bold'
                            }>
                              {row.status === 'sent' ? 'ส่งแล้ว' : row.status === 'failed' ? `ล้มเหลว (${row.attempts} ครั้ง)` : 'รอส่ง'}
                            </span>
                          </td>
                          {/* แถวที่ status = 'sent' แต่มีหมายเหตุ = กรณี LINE ตอบ 409
                              (ข้อความถูกส่งไปแล้ว) ไม่ใช่ความล้มเหลว จึงห้ามแสดงเป็นสีแดง */}
                          <td className={`py-1.5 px-3 ${row.status === 'sent' ? 'text-gray-500' : 'text-red-600'}`}>
                            {row.lastError ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          {/* User Notification Rules Table */}
          <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-gray-900 uppercase tracking-wide flex items-center space-x-2">
                <Smartphone className="w-4 h-4 text-emerald-600" />
                <span>กำหนดการแจ้งเตือนการ์ดงานรายบุคคล ({approvedUsers.length} รายชื่อ)</span>
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 uppercase text-[10px] font-extrabold">
                    <th className="py-2.5 px-3">ผู้รับผิดชอบ / ผู้สร้างการ์ด</th>
                    <th className="py-2.5 px-3">ระดับสิทธิ์</th>
                    <th className="py-2.5 px-3">แจ้งเตือนขาดการอัปเดต (กำหนดเวลา)</th>
                    <th className="py-2.5 px-3">การ์ดค้างอัปเดตขณะนี้</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 font-medium">
                  {approvedUsers.map(u => {
                    const alertHours = u.noUpdateAlertHours ?? 4;
                    const displayInMinutes = prefersMinutes(alertHours);

                    // Calculate pending cards for this user
                    const now = new Date();
                    const pendingNoUpdateTasks = tasks.filter(t => {
                      if (t.status === 'approved') return false;
                      const isTarget = t.assignedToUserId === u.id || t.createdById === u.id;
                      if (!isTarget) return false;
                      const lastUpd = new Date(t.lastUpdatedAt || t.createdAt);
                      const diffH = (now.getTime() - lastUpd.getTime()) / (1000 * 60 * 60);
                      return diffH >= alertHours;
                    });

                    return (
                      <tr key={u.id} className="hover:bg-orange-50/20 transition-colors">
                        
                        {/* User Profile */}
                        <td className="py-3 px-3">
                          <div className="font-bold text-gray-900">{u.fullName}</div>
                          <div className="text-[10px] text-gray-400">@{u.username} • {u.email}</div>
                        </td>

                        {/* Role */}
                        <td className="py-3 px-3 capitalize">
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                            u.role === 'super_admin'
                              ? 'bg-purple-100 text-purple-900 border border-purple-200'
                              : u.role === 'admin'
                              ? 'bg-blue-100 text-blue-900 border border-blue-200'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {u.role}
                          </span>
                        </td>

                        {/* Alert Hours Selector (Minutes + Hours) */}
                        <td className="py-3 px-3">
                          <div className="flex items-center space-x-1.5">
                            
                            {/* Number Input + Unit Toggle */}
                            <AlertDurationInput
                              hours={alertHours}
                              onCommit={hours => updateUserNotificationSettings(u.id, { noUpdateAlertHours: hours })}
                            />

                            {/* Preset Dropdown */}
                            <select
                              value={PRESET_HOURS.find(h => sameMinutes(h, alertHours)) ?? 'custom'}
                              onChange={e => {
                                if (e.target.value !== 'custom') {
                                  updateUserNotificationSettings(u.id, {
                                    noUpdateAlertHours: Number(e.target.value)
                                  });
                                }
                              }}
                              className="py-1.5 px-2 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer shadow-2xs"
                            >
                              <option value={0.25}>⚡ 15 นาที</option>
                              <option value={0.5}>⚡ 30 นาที</option>
                              <option value={0.75}>⚡ 45 นาที</option>
                              <option value={1}>1 ชม.</option>
                              <option value={2}>2 ชม.</option>
                              <option value={4}>4 ชม. (ปกติ)</option>
                              <option value={6}>6 ชม.</option>
                              <option value={8}>8 ชม.</option>
                              <option value={12}>12 ชม.</option>
                              <option value={24}>24 ชม.</option>
                              {!PRESET_HOURS.some(h => sameMinutes(h, alertHours)) && (
                                <option value="custom">
                                  กำหนดเอง ({displayInMinutes ? `${Math.round(alertHours * 60)} นาที` : `${Math.round(alertHours * 100) / 100} ชม.`})
                                </option>
                              )}
                            </select>

                          </div>
                        </td>

                        {/* Count of No Update Tasks */}
                        <td className="py-3 px-3">
                          {pendingNoUpdateTasks.length > 0 ? (
                            <span className="bg-red-100 text-red-700 border border-red-300 text-[11px] font-black px-2.5 py-0.5 rounded-lg inline-flex items-center space-x-1">
                              <AlertCircle className="w-3 h-3 text-red-600" />
                              <span>{pendingNoUpdateTasks.length} การ์ดค้างอัปเดต</span>
                            </span>
                          ) : (
                            <span className="text-gray-400 text-[11px] font-bold">
                              ไม่มีการ์ดค้าง
                            </span>
                          )}
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
