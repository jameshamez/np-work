import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Task } from '../types';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  User, 
  ExternalLink, 
  X, 
  Folder, 
  Printer, 
  ArrowRight
} from 'lucide-react';

interface CalendarViewProps {
  onOpenDetailModal: (task: Task) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ onOpenDetailModal }) => {
  const { tasks } = useApp();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [driveUrl, setDriveUrl] = useState('');

  // Generate calendar days for current month
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const daysInMonth = lastDayOfMonth.getDate();
  const startingDay = firstDayOfMonth.getDay(); // 0 is Sunday

  const monthNamesThai = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตูลายม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Build calendar matrix
  const calendarCells = [];
  for (let i = 0; i < startingDay; i++) {
    calendarCells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push(new Date(year, month, d));
  }

  // Get tasks for a given date (placed on creation date createdAt as requested, or deadline)
  const getTasksForDate = (date: Date) => {
    const yearStr = date.getFullYear();
    const monthStr = String(date.getMonth() + 1).padStart(2, '0');
    const dayStr = String(date.getDate()).padStart(2, '0');
    const targetDateStr = `${yearStr}-${monthStr}-${dayStr}`;

    return tasks.filter(t => {
      const createdDateStr = t.createdAt ? t.createdAt.slice(0, 10) : '';
      const deadlineDateStr = t.deadlineAt ? t.deadlineAt.slice(0, 10) : '';
      return createdDateStr === targetDateStr || deadlineDateStr === targetDateStr;
    });
  };

  const handleCardClick = (task: Task) => {
    setSelectedTask(task);
    setDriveUrl(task.googleDriveUrl || 'https://drive.google.com/drive/folders/1A2b3C4d5E6f7G8h9I0j-np_taskwork');
  };

  const formatThaiDate = (dateStr?: string) => {
    if (!dateStr) return 'ไม่ระบุ';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`;
  };

  const getStatusText = (task: Task) => {
    if (task.status === 'approved') return 'อนุมัติ';
    if (task.status === 'returned') return 'ตีกลับ';
    if (task.status === 'pending_review') return 'รอตรวจ';
    return 'รอส่งงาน';
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-2xs space-y-4">
      
      {/* Calendar Header Nav */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-gray-100 gap-2">
        <div className="flex items-center space-x-3">
          <CalendarIcon className="w-5 h-5 text-orange-600" />
          <h2 className="text-base font-extrabold text-gray-900">
            {monthNamesThai[month]} {year + 543}
          </h2>
        </div>

        {/* Status Legend */}
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-extrabold">
          <span className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
            <span>เขียว = เสร็จ</span>
          </span>
          <span className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-yellow-100 text-yellow-900 border border-yellow-300">
            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
            <span>เหลือง = อยู่ระหว่างดำเนินการ</span>
          </span>
          <span className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-orange-100 text-orange-900 border border-orange-300">
            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
            <span>ส้ม = ล่าช้า</span>
          </span>
          <span className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-red-100 text-red-900 border border-red-300">
            <span className="w-2 h-2 rounded-full bg-red-600"></span>
            <span>สีแดง = ตีกลับ</span>
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={prevMonth}
            className="p-1.5 border border-gray-200 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer"
          >
            วันนี้
          </button>
          <button
            onClick={nextMonth}
            className="p-1.5 border border-gray-200 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 gap-2 text-center text-xs font-extrabold text-gray-400 uppercase">
        <div className="py-1 text-red-500">อา</div>
        <div className="py-1">จ</div>
        <div className="py-1">อ</div>
        <div className="py-1">พ</div>
        <div className="py-1">พฤ</div>
        <div className="py-1">ศ</div>
        <div className="py-1 text-sky-600">ส</div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {calendarCells.map((cellDate, idx) => {
          if (!cellDate) {
            return <div key={idx} className="min-h-[90px] bg-gray-50/30 rounded-2xl border border-transparent"></div>;
          }

          const dayTasks = getTasksForDate(cellDate);
          const isToday = cellDate.toDateString() === new Date().toDateString();

          return (
            <div
              key={idx}
              className={`min-h-[100px] p-2 rounded-2xl border transition-all flex flex-col justify-between ${
                isToday
                  ? 'bg-orange-50/50 border-orange-400 ring-2 ring-orange-200'
                  : 'bg-white border-gray-200 hover:border-orange-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-extrabold ${isToday ? 'text-orange-600' : 'text-gray-700'}`}>
                  {cellDate.getDate()}
                </span>
                {dayTasks.length > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-orange-100 text-orange-800">
                    {dayTasks.length} งาน
                  </span>
                )}
              </div>

              {/* Task badges */}
              <div className="space-y-1 mt-1 overflow-y-auto max-h-20">
                {dayTasks.map(task => {
                  const isApproved = task.status === 'approved';
                  const isReturned = task.status === 'returned';
                  const isDelayed = task.slaStatus === 'delayed' || task.slaStatus === 'no_update';

                  let bg = '#fde047'; // เหลือง = อยู่ระหว่างดำเนินการ
                  let textColor = '#713f12';

                  if (isApproved) {
                    bg = '#86efac'; // เขียว = เสร็จ
                    textColor = '#064e3b';
                  } else if (isReturned) {
                    bg = '#f87171'; // สีแดง = ตีกลับ
                    textColor = '#ffffff';
                  } else if (isDelayed) {
                    bg = '#fb923c'; // ส้ม = ล่าช้า
                    textColor = '#ffffff';
                  }

                  return (
                    <button
                      key={task.id}
                      onClick={() => handleCardClick(task)}
                      className="w-full text-left p-1 rounded-lg text-[10px] font-extrabold truncate transition-transform hover:scale-[1.02] block shadow-2xs cursor-pointer"
                      style={{
                        backgroundColor: bg,
                        color: textColor,
                      }}
                    >
                      #{task.code} {task.title}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Simplified Quick Task Modal for Calendar View */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            
            {/* Header */}
            <div className="p-4 bg-amber-100/90 border-b border-amber-200/80 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="font-black text-xs text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded">
                    #{selectedTask.code}
                  </span>
                  <span className="font-extrabold text-xs text-amber-900">
                    {selectedTask.projectName || 'โปรเจกต์ทั่วไป'}
                  </span>
                </div>
                <h3 className="font-black text-sm text-gray-900 leading-snug">
                  {selectedTask.title}
                </h3>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={() => window.print()}
                  className="px-2.5 py-1.5 bg-white hover:bg-gray-50 text-gray-800 rounded-lg text-xs font-bold border border-gray-200 shadow-2xs flex items-center space-x-1 cursor-pointer"
                  title="พิมพ์ / ออกรายงาน"
                >
                  <Printer className="w-3.5 h-3.5 text-orange-600" />
                  <span>ส่งออก Report รายวัน</span>
                </button>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-white/60 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
              
              {/* Meta Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs">
                <div>
                  <div className="text-[11px] text-gray-500 flex items-center space-x-1 font-bold">
                    <User className="w-3.5 h-3.5 text-orange-500" />
                    <span>ผู้รับผิดชอบงาน</span>
                  </div>
                  <div className="font-extrabold text-gray-800 mt-1">
                    {selectedTask.assignedTargetUserName || selectedTask.assignedToUserName || 'พี่หนึ่ง (User A)'}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-gray-500 flex items-center space-x-1 font-bold">
                    <CalendarIcon className="w-3.5 h-3.5 text-orange-500" />
                    <span>กำหนดส่ง (Deadline)</span>
                  </div>
                  <div className="font-extrabold text-gray-800 mt-1">
                    {formatThaiDate(selectedTask.deadlineAt)}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-gray-500 flex items-center space-x-1 font-bold">
                    <Clock className="w-3.5 h-3.5 text-orange-500" />
                    <span>เวลาดำเนินการจริง (Lead Time)</span>
                  </div>
                  <div className="font-extrabold text-emerald-700 mt-1 flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-emerald-600" />
                    <span>แผน {selectedTask.planDays || selectedTask.leadTimeDays || 7} วัน</span>
                  </div>
                </div>
              </div>

              {/* Scope / Description Section */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-gray-800">
                  รายละเอียดขอบเขตงาน:
                </span>

                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-700 leading-relaxed min-h-[50px] whitespace-pre-wrap">
                  {selectedTask.description || 'ไม่มีรายละเอียดเพิ่มเติม'}
                </div>
              </div>

              {/* Status Banner */}
              <div className={`p-3.5 border-2 rounded-xl text-center shadow-2xs ${
                selectedTask.status === 'approved' 
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-800' 
                  : selectedTask.status === 'returned'
                  ? 'bg-red-50 border-red-500 text-red-800'
                  : selectedTask.slaStatus === 'delayed' || selectedTask.slaStatus === 'no_update'
                  ? 'bg-orange-50 border-orange-500 text-orange-900'
                  : 'bg-amber-50 border-amber-500 text-amber-900'
              }`}>
                <span className="text-sm sm:text-base font-black tracking-wide">
                  สถานะงาน : {getStatusText(selectedTask)}
                </span>
              </div>

              {/* Google Drive Section */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-gray-800">
                  <span className="flex items-center space-x-1.5">
                    <Folder className="w-4 h-4 text-sky-600" />
                    <span>คลังเก็บไฟล์กลาง (Google Drive URL Link):</span>
                  </span>
                  <span className="text-[10px] text-sky-600 font-bold bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                    Cloud Drive Integration
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={driveUrl}
                    onChange={e => setDriveUrl(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50 text-gray-700 font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <button
                    type="button"
                    onClick={() => window.open(driveUrl, '_blank')}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-2xs transition-colors shrink-0 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>เปิด Drive</span>
                  </button>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200/80 rounded-xl transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>

              <button
                type="button"
                onClick={() => {
                  const taskToOpen = selectedTask;
                  setSelectedTask(null);
                  onOpenDetailModal(taskToOpen);
                }}
                className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black flex items-center space-x-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                <span>ไปที่การ์ด</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
