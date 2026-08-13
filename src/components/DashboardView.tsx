import React from 'react';
import { useApp } from '../context/AppContext';
import {
  Printer,
  BarChart3,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users,
  Briefcase,
  TrendingUp,
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const { tasks, users, projects } = useApp();

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'approved').length;
  const pendingReviewTasks = tasks.filter(t => t.status === 'pending_review').length;
  const delayedTasks = tasks.filter(t => t.slaStatus === 'delayed' || t.slaStatus === 'no_update').length;

  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Calculate average lead time
  const completedList = tasks.filter(t => t.status === 'approved' && t.leadTimeDays);
  const avgLeadTime =
    completedList.length > 0
      ? (
          completedList.reduce((acc, t) => acc + (t.leadTimeDays || 0), 0) /
          completedList.length
        ).toFixed(1)
      : '0.0';

  // Individual performance breakdown
  const approvedUsers = users.filter(u => u.status === 'approved');
  const userStats = approvedUsers.map(user => {
    const userTasks = tasks.filter(t => t.assignedToUserId === user.id);
    const userCompleted = userTasks.filter(t => t.status === 'approved').length;
    const userPending = userTasks.filter(t => t.status === 'pending_submission' || t.status === 'pending_review' || t.status === 'returned').length;
    const userDelayed = userTasks.filter(t => t.slaStatus === 'delayed' || t.slaStatus === 'no_update').length;

    const userCompletedList = userTasks.filter(t => t.status === 'approved' && t.leadTimeDays);
    const userAvgLead =
      userCompletedList.length > 0
        ? (
            userCompletedList.reduce((acc, t) => acc + (t.leadTimeDays || 0), 0) /
            userCompletedList.length
          ).toFixed(1)
        : '-';

    return {
      user,
      total: userTasks.length,
      completed: userCompleted,
      pending: userPending,
      delayed: userDelayed,
      avgLeadTime: userAvgLead,
    };
  });

  return (
    <div className="space-y-6">
      
      {/* Header bar */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-2xs flex items-center justify-between">
        <div>
          <h2 className="text-base font-extrabold text-gray-900 flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-orange-600" />
            <span>Dashboard สรุปผลการดำเนินงาน & รายงานสรุป</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            รายงานสถานะการทำงานรายบุคคล โครงการ และค่าเฉลี่ยระยะเวลาดำเนินการ (Lead Time)
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-all hover:opacity-90 inline-flex items-center space-x-1.5 print:hidden"
          style={{ backgroundColor: '#ef6c00' }}
        >
          <Printer className="w-4 h-4" />
          <span>พิมพ์รายงาน PDF</span>
        </button>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        
        {/* Total Tasks */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>งานทั้งหมดในระบบ</span>
            <Briefcase className="w-4 h-4 text-orange-500" />
          </div>
          <div className="text-2xl font-extrabold text-gray-900 mt-2">{totalTasks}</div>
          <p className="text-[10px] text-gray-400 mt-1">จาก {projects.length} โครงการหลัก</p>
        </div>

        {/* Completed */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>อนุมัติเสร็จสมบูรณ์</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-2">{completedTasks}</div>
          <p className="text-[10px] text-emerald-700 font-semibold mt-1">คิดเป็น {completionRate}% ของงานทั้งหมด</p>
        </div>

        {/* Pending Review */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>รอการตรวจอนุมัติ</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-amber-600 mt-2">{pendingReviewTasks}</div>
          <p className="text-[10px] text-amber-800 font-semibold mt-1">รอ Admin ตรวจสอบข้อความและไฟล์แนบ</p>
        </div>

        {/* Average Lead Time */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>เฉลี่ย Lead Time วันทำงาน</span>
            <TrendingUp className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-extrabold text-sky-700 mt-2">{avgLeadTime} วัน</div>
          <p className="text-[10px] text-gray-400 mt-1">นับรวมวันหยุดเสาร์-อาทิตย์</p>
        </div>

        {/* Total Withdrawals Summary (Pages 15 & 16 Requirement) */}
        <div className="bg-gradient-to-br from-emerald-900 to-teal-950 text-white rounded-2xl p-4 border border-emerald-800 shadow-2xs col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-xs text-emerald-200 font-bold">
            <span>สรุปยอดเบิกจ่าย</span>
            <span className="text-[9px] bg-emerald-800 px-1.5 py-0.5 rounded text-amber-300">KU Budget</span>
          </div>
          <div className="text-lg font-black text-amber-300 mt-1">100,000 บาท</div>
          <div className="text-[10px] text-emerald-200 space-y-0.5 mt-1 border-t border-emerald-800/80 pt-1">
            <p>• เบิกโครงการ: <span className="font-extrabold text-white">100,000 บาท</span></p>
            <p>• เบิกอาจารย์หนุ่ย: <span className="font-extrabold text-amber-300">50,000 บาท (อนุมัติ)</span></p>
          </div>
        </div>

      </div>

      {/* Individual User Performance Table */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-gray-900 uppercase tracking-wide flex items-center space-x-2">
            <Users className="w-4 h-4 text-orange-600" />
            <span>รายงานสรุปผลการดำเนินงานรายบุคคล (Individual Metrics)</span>
          </h3>
          <span className="text-[11px] text-gray-400 font-medium">รวมทั้งหมด {approvedUsers.length} ท่าน</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 uppercase text-[10px] font-extrabold">
                <th className="py-2.5 px-3">ผู้รับผิดชอบงาน</th>
                <th className="py-2.5 px-3 text-center">งานทั้งหมด</th>
                <th className="py-2.5 px-3 text-center">เสร็จสิ้น (อนุมัติ)</th>
                <th className="py-2.5 px-3 text-center">กำลังดำเนินงาน</th>
                <th className="py-2.5 px-3 text-center">ล่าช้า/ขาดอัปเดต</th>
                <th className="py-2.5 px-3 text-center">เฉลี่ย Lead Time (วัน)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 font-medium">
              {userStats.map((stat, idx) => (
                <tr key={stat.user.id} className="hover:bg-orange-50/30 transition-colors">
                  <td className="py-3 px-3 font-bold text-gray-900 flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-800 font-bold flex items-center justify-center text-xs">
                      {stat.user.fullName?.charAt(0)}
                    </div>
                    <span>{stat.user.fullName?.replace(/\s*\([^)]*\)/g, '')}</span>
                  </td>
                  <td className="py-3 px-3 text-center font-bold text-gray-800">{stat.total}</td>
                  <td className="py-3 px-3 text-center font-bold text-emerald-600">{stat.completed}</td>
                  <td className="py-3 px-3 text-center font-bold text-sky-600">{stat.pending}</td>
                  <td className="py-3 px-3 text-center font-bold text-red-600">{stat.delayed}</td>
                  <td className="py-3 px-3 text-center font-bold text-gray-800">{stat.avgLeadTime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Project Breakdown Table */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-2xs space-y-4">
        <h3 className="text-xs font-extrabold text-gray-900 uppercase tracking-wide flex items-center space-x-2">
          <Briefcase className="w-4 h-4 text-orange-600" />
          <span>สรุปสถานะการ์ดงานจำแนกตามโครงการ (Project Breakdown)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {projects.map(prj => {
            const prjTasks = tasks.filter(t => t.projectId === prj.id);
            const prjCompleted = prjTasks.filter(t => t.status === 'approved').length;
            const pct = prjTasks.length > 0 ? Math.round((prjCompleted / prjTasks.length) * 100) : 0;

            return (
              <div key={prj.id} className="p-4 border border-gray-200/80 rounded-2xl bg-gray-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-gray-900 truncate">{prj.name}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-gray-200">
                    {prjTasks.length} งาน
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 line-clamp-2">{prj.description}</p>
                <div className="pt-2">
                  <div className="flex items-center justify-between text-[10px] font-bold text-gray-600 mb-1">
                    <span>ความคืบหน้า</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
