import React, { useState, useMemo } from 'react';
import { X, Printer, Calendar, Filter, FileText, CheckCircle2, Clock, AlertTriangle, User as UserIcon, Building } from 'lucide-react';
import { Task, User, Project } from '../types';

interface ExportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  users: User[];
  projects: Project[];
}

export const ExportReportModal: React.FC<ExportReportModalProps> = ({
  isOpen,
  onClose,
  tasks,
  users,
  projects,
}) => {
  const [reportPeriod, setReportPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1); // 1-12
  const [selectedAssignee, setSelectedAssignee] = useState<string>('all');
  const [selectedProject, setSelectedProject] = useState<string>('all');

  if (!isOpen) return null;

  // Month names in Thai
  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  // Helper to parse date string (YYYY-MM-DD) into local date parts safely
  const parseDateParts = (dateStr: string) => {
    if (!dateStr) {
      const now = new Date();
      return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
    }
    const parts = dateStr.split('-').map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
      return { year: parts[0], month: parts[1] - 1, day: parts[2] };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
  };

  // Helper to calculate date range label and bounds
  const getDateRangeInfo = () => {
    if (reportPeriod === 'daily') {
      const { year, month, day } = parseDateParts(selectedDate);
      const startDate = new Date(year, month, day, 0, 0, 0, 0);
      const endDate = new Date(year, month, day, 23, 59, 59, 999);
      const monthName = thaiMonths[month];
      const thaiYear = year + 543;

      return {
        label: `ประจำวันที่ ${day} ${monthName} พ.ศ. ${thaiYear}`,
        startDate,
        endDate,
      };
    } else if (reportPeriod === 'weekly') {
      const { year, month, day } = parseDateParts(selectedDate);
      const baseDate = new Date(year, month, day, 12, 0, 0, 0);
      const dayOfWeek = baseDate.getDay(); // 0 is Sun, 1 is Mon...
      const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      
      const startDate = new Date(year, month, day + diffToMon, 0, 0, 0, 0);
      const endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 6, 23, 59, 59, 999);

      const formatD = (date: Date) => 
        `${date.getDate()} ${thaiMonths[date.getMonth()]} ${date.getFullYear() + 543}`;

      return {
        label: `ประจำสัปดาห์วันที่ ${formatD(startDate)} - ${formatD(endDate)}`,
        startDate,
        endDate,
      };
    } else {
      // Monthly
      const startDate = new Date(selectedYear, selectedMonth - 1, 1, 0, 0, 0, 0);
      const endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);
      const monthName = thaiMonths[selectedMonth - 1];
      const thaiYear = selectedYear + 543;

      return {
        label: `ประจำเดือน${monthName} พ.ศ. ${thaiYear}`,
        startDate,
        endDate,
      };
    }
  };

  const rangeInfo = getDateRangeInfo();

  // Filter tasks strictly based on period, assignee, project
  const displayTasks = useMemo(() => {
    return tasks.filter(task => {
      // 1. Filter by assignee
      if (selectedAssignee !== 'all') {
        const matchedUser = users.find(u => u.id === selectedAssignee);
        const nameToMatch = matchedUser ? matchedUser.fullName.replace(/\s*\([^)]*\)/g, '').trim() : '';
        const taskOwner = (task.assignedToUserName || '').replace(/\s*\([^)]*\)/g, '').trim();
        const matchesUser = task.assignedToUserId === selectedAssignee || 
                            task.assignedTargetUserId === selectedAssignee || 
                            (nameToMatch && taskOwner.includes(nameToMatch));
        if (!matchesUser) return false;
      }

      // 2. Filter by project
      if (selectedProject !== 'all' && task.projectId !== selectedProject) {
        return false;
      }

      // 3. Filter by date range (createdAt, lastUpdatedAt, completedAt, or deadlineAt)
      const tCreated = task.createdAt ? new Date(task.createdAt) : null;
      const tUpdated = task.lastUpdatedAt ? new Date(task.lastUpdatedAt) : null;
      const tCompleted = task.completedAt ? new Date(task.completedAt) : null;
      const tDeadline = task.deadlineAt ? new Date(task.deadlineAt) : null;

      const isInRange = (d: Date | null) => {
        if (!d || isNaN(d.getTime())) return false;
        return d >= rangeInfo.startDate && d <= rangeInfo.endDate;
      };

      // Matches if date falls inside the period bounds
      const matchesPeriod = isInRange(tCreated) || isInRange(tUpdated) || isInRange(tCompleted) || isInRange(tDeadline);
      
      // Or if task was active during the period
      const isTaskActive = tCreated && tCreated <= rangeInfo.endDate && (!tCompleted || tCompleted >= rangeInfo.startDate);

      return matchesPeriod || isTaskActive;
    });
  }, [tasks, selectedAssignee, selectedProject, rangeInfo.startDate, rangeInfo.endDate, users]);

  // Calculate statistics
  const totalCount = displayTasks.length;
  const approvedCount = displayTasks.filter(t => t.status === 'approved').length;
  const pendingCount = displayTasks.filter(t => t.status === 'pending_submission' || t.status === 'pending_review').length;
  const returnedOrDelayedCount = displayTasks.filter(t => t.status === 'returned' || t.slaStatus === 'delayed').length;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 md:p-6 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden print:shadow-none print:border-none print:max-h-none print:w-full">
        
        {/* Modal Header (Hidden on Print) */}
        <div className="p-4 md:p-5 bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 text-white flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">ส่งออกรายงานสรุปผลการทำงาน</h2>
              <p className="text-xs text-orange-100">
                เลือกประเภทช่วงเวลา รายวัน รายสัปดาห์ หรือรายเดือน ก่อนพิมพ์หรือส่งออกไฟล์ PDF
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Controls / Filters (Hidden on Print) */}
        <div className="p-4 bg-orange-50/50 border-b border-orange-100 space-y-4 shrink-0 print:hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            
            {/* 1. Period Selector (Daily / Weekly / Monthly) */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-orange-600" />
                <span>1. รูปแบบช่วงเวลารายงาน</span>
              </label>
              <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-xl border border-gray-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setReportPeriod('daily')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    reportPeriod === 'daily'
                      ? 'bg-orange-500 text-white shadow-2xs'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  รายวัน
                </button>
                <button
                  type="button"
                  onClick={() => setReportPeriod('weekly')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    reportPeriod === 'weekly'
                      ? 'bg-orange-500 text-white shadow-2xs'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  รายสัปดาห์
                </button>
                <button
                  type="button"
                  onClick={() => setReportPeriod('monthly')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    reportPeriod === 'monthly'
                      ? 'bg-orange-500 text-white shadow-2xs'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  รายเดือน
                </button>
              </div>
            </div>

            {/* 2. Specific Date / Range Input */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                2. {reportPeriod === 'daily' ? 'เลือกวันที่' : reportPeriod === 'weekly' ? 'เลือกสัปดาห์ (ระบุวันในสัปดาห์)' : 'เลือกเดือนและปี'}
              </label>
              {reportPeriod === 'monthly' ? (
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(Number(e.target.value))}
                    className="w-full py-2 px-3 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
                  >
                    {thaiMonths.map((m, idx) => (
                      <option key={idx + 1} value={idx + 1}>
                        เดือน {m}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedYear}
                    onChange={e => setSelectedYear(Number(e.target.value))}
                    className="w-full py-2 px-3 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
                  >
                    {[2025, 2026, 2027].map(y => (
                      <option key={y} value={y}>
                        พ.ศ. {y + 543}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="w-full py-2 px-3 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
                />
              )}
            </div>

            {/* 3. Assignee Filter */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center space-x-1">
                <Filter className="w-3.5 h-3.5 text-orange-600" />
                <span>3. กรองผู้รับผิดชอบ</span>
              </label>
              <select
                value={selectedAssignee}
                onChange={e => setSelectedAssignee(e.target.value)}
                className="w-full py-2 px-3 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
              >
                <option value="all">แสดงผู้รับผิดชอบทุกคน</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.fullName.replace(/\s*\([^)]*\)/g, '')}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Project Filter */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center space-x-1">
                <Building className="w-3.5 h-3.5 text-orange-600" />
                <span>4. กรองโครงการ</span>
              </label>
              <select
                value={selectedProject}
                onChange={e => setSelectedProject(e.target.value)}
                className="w-full py-2 px-3 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer truncate"
              >
                <option value="all">แสดงทุกโครงการ ({projects.length})</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

          </div>
        </div>

        {/* Printable Area / Report Preview */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 print:p-0 print:overflow-visible">
          
          {/* Printable Official Document Header */}
          <div className="border-b-2 border-orange-500 pb-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-xl bg-orange-600 text-white font-black text-xl flex items-center justify-center shadow-md">
                NP
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">TASKWORK PRO</h1>
                <p className="text-xs text-orange-600 font-bold">ระบบติดตามงานและวัดผลองค์กรระดับสูง</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-base font-bold text-gray-800">
                รายงานสรุปผลการปฏิบัติงาน ({reportPeriod === 'daily' ? 'รายวัน' : reportPeriod === 'weekly' ? 'รายสัปดาห์' : 'รายเดือน'})
              </h2>
              <p className="text-xs text-gray-600 font-semibold mt-0.5">{rangeInfo.label}</p>
              <p className="text-[10px] text-gray-400 mt-1">
                วันที่ออกรายงาน: {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} น.
              </p>
            </div>
          </div>

          {/* Stat Cards Summary */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-orange-50/60 p-3.5 rounded-xl border border-orange-200">
              <div className="flex items-center justify-between text-xs text-orange-800 font-bold">
                <span>งานทั้งหมด</span>
                <FileText className="w-4 h-4 text-orange-600" />
              </div>
              <div className="text-2xl font-black text-orange-950 mt-1.5">{totalCount}</div>
              <p className="text-[10px] text-orange-600 font-medium mt-0.5">รายการ</p>
            </div>

            <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200">
              <div className="flex items-center justify-between text-xs text-emerald-800 font-bold">
                <span>อนุมัติเสร็จสิ้น</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-emerald-950 mt-1.5">{approvedCount}</div>
              <p className="text-[10px] text-emerald-600 font-medium mt-0.5">
                คิดเป็น {totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0}%
              </p>
            </div>

            <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-200">
              <div className="flex items-center justify-between text-xs text-blue-800 font-bold">
                <span>อยู่ระหว่างดำเนินงาน</span>
                <Clock className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-black text-blue-950 mt-1.5">{pendingCount}</div>
              <p className="text-[10px] text-blue-600 font-medium mt-0.5">รอส่ง / รอตรวจ</p>
            </div>

            <div className="bg-red-50/60 p-3.5 rounded-xl border border-red-200">
              <div className="flex items-center justify-between text-xs text-red-800 font-bold">
                <span>ล่าช้า / ตีกลับ</span>
                <AlertTriangle className="w-4 h-4 text-red-600" />
              </div>
              <div className="text-2xl font-black text-red-950 mt-1.5">{returnedOrDelayedCount}</div>
              <p className="text-[10px] text-red-600 font-medium mt-0.5">ต้องติดตามด่วน</p>
            </div>
          </div>

          {/* Detailed Task Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center space-x-1.5">
                <Building className="w-4 h-4 text-orange-600" />
                <span>ตารางรายละเอียดงาน ({displayTasks.length} รายการ)</span>
              </h3>
              {selectedAssignee !== 'all' && (
                <span className="text-xs bg-orange-100 text-orange-800 px-2.5 py-0.5 rounded-full font-bold">
                  ผู้รับผิดชอบ: {users.find(u => u.id === selectedAssignee)?.fullName.replace(/\s*\([^)]*\)/g, '')}
                </span>
              )}
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-2xs">
              <table className="w-full text-left text-xs text-gray-700">
                <thead className="bg-gray-100 text-gray-600 font-extrabold uppercase text-[10px] border-b border-gray-200">
                  <tr>
                    <th className="py-2.5 px-3">รหัส / ชื่องาน</th>
                    <th className="py-2.5 px-3">โครงการ</th>
                    <th className="py-2.5 px-3">ผู้รับผิดชอบ</th>
                    <th className="py-2.5 px-3 text-center">สถานะ</th>
                    <th className="py-2.5 px-3 text-center">สถานะ SLA</th>
                    <th className="py-2.5 px-3 text-right">กำหนดส่ง</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {displayTasks.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400 font-medium">
                        ไม่พบรายการงานตามเงื่อนไขช่วงเวลาที่เลือก
                      </td>
                    </tr>
                  ) : (
                    displayTasks.map(t => {
                      const ownerName = t.assignedToUserName?.replace(/\s*\([^)]*\)/g, '');
                      return (
                        <tr key={t.id} className="hover:bg-gray-50/50">
                          <td className="py-2.5 px-3 font-bold text-gray-900 max-w-[220px] truncate">
                            <span className="text-[10px] font-extrabold text-orange-600 block">{t.code}</span>
                            {t.title}
                          </td>
                          <td className="py-2.5 px-3 text-gray-600 font-semibold max-w-[150px] truncate">
                            {t.projectName}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-gray-800">
                            <div className="flex items-center space-x-1.5">
                              <UserIcon className="w-3 h-3 text-gray-400" />
                              <span>{ownerName}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              t.status === 'approved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : t.status === 'returned'
                                ? 'bg-red-100 text-red-800'
                                : t.status === 'pending_review'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {t.status === 'approved'
                                ? 'อนุมัติแล้ว'
                                : t.status === 'returned'
                                ? 'ตีกลับ'
                                : t.status === 'pending_review'
                                ? 'รอตรวจ'
                                : 'รอส่งงาน'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                              t.slaStatus === 'on_time'
                                ? 'bg-emerald-50 text-emerald-700'
                                : t.slaStatus === 'delayed'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-orange-100 text-orange-800'
                            }`}>
                              {t.slaStatus === 'on_time' ? 'ON TIME' : t.slaStatus === 'delayed' ? 'DELAYED' : 'NO UPDATE'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-[11px] text-gray-600">
                            {t.deadlineAt ? new Date(t.deadlineAt).toLocaleDateString('th-TH') : '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Official Signatures for Printed Document */}
          <div className="hidden print:grid grid-cols-2 gap-8 pt-8 border-t border-gray-200 mt-8">
            <div className="text-center space-y-8">
              <p className="text-xs font-bold text-gray-700">ผู้จัดทำรายงาน</p>
              <div className="border-b border-gray-400 w-48 mx-auto"></div>
              <p className="text-xs text-gray-500">(...................................................)</p>
            </div>
            <div className="text-center space-y-8">
              <p className="text-xs font-bold text-gray-700">ผู้อนุมัติรายงาน (Super Admin)</p>
              <div className="border-b border-gray-400 w-48 mx-auto"></div>
              <p className="text-xs text-gray-500">(...................................................)</p>
            </div>
          </div>

        </div>

        {/* Modal Footer / Action Buttons (Hidden on Print) */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between shrink-0 print:hidden">
          <p className="text-xs text-gray-500 font-medium">
            * คลิก "พิมพ์ / บันทึก PDF" เพื่อดาวน์โหลดเอกสารรายงานในรูปแบบ PDF
          </p>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2 text-white rounded-xl text-xs font-extrabold shadow-md transition-all hover:opacity-90 active:scale-95 cursor-pointer flex items-center space-x-2"
              style={{ backgroundColor: '#ef6c00' }}
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์ / บันทึก PDF ({reportPeriod === 'daily' ? 'รายวัน' : reportPeriod === 'weekly' ? 'รายสัปดาห์' : 'รายเดือน'})</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
