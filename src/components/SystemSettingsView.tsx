import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { AlertCircle, FolderKanban, Search, Settings, Trash2 } from 'lucide-react';
import { LineGroupsSettings } from './LineGroupsSettings';
import { ReviewerDigestSettings } from './ReviewerDigestSettings';

/**
 * การตั้งค่าระบบ — เฉพาะ Super Admin
 *   จัดการโครงการ: ลบโครงการที่ไม่ใช้แล้ว (ด่านจริงคือ policy projects_delete_super_admin ใน db/18)
 *   กลุ่ม LINE: เพิ่มกลุ่มที่รับแจ้งเตือนนอกจากกลุ่มหลัก (db/19)
 *   สรุปงานรออนุมัติ: ส่งงานรอตรวจของผู้อนุมัติแต่ละคนเข้ากลุ่มที่กำหนดตามเวลา (db/21)
 */
export const SystemSettingsView: React.FC = () => {
  const { currentUser, projects, tasks, deleteProject } = useApp();
  const [query, setQuery] = useState('');

  // นับการ์ดต่อโครงการ (รวมร่าง) — โครงการที่ยังมีการ์ดลบไม่ได้
  const taskCountByProject = useMemo(() => {
    const counts = new Map<string, number>();
    tasks.forEach(t => counts.set(t.projectId, (counts.get(t.projectId) ?? 0) + 1));
    return counts;
  }, [tasks]);

  if (currentUser?.role !== 'super_admin') {
    return (
      <div className="bg-white rounded-2xl p-8 border border-gray-200 text-center space-y-3">
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
        <h3 className="text-sm font-bold text-gray-800">ไม่มีสิทธิ์เข้าถึงหน้านี้</h3>
        <p className="text-xs text-gray-500">หน้าการตั้งค่าระบบสงวนไว้สำหรับผู้ดูแลระบบสูงสุด (Super Admin) เท่านั้น</p>
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const visibleProjects = projects
    .filter(p => !q || p.name.toLowerCase().includes(q) || (p.code ?? '').toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name, 'th'));

  const handleDelete = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    if (confirm(`ลบโครงการ "${project.name}" ออกจากระบบใช่หรือไม่?\n\nการลบนี้ย้อนกลับไม่ได้`)) {
      deleteProject(projectId);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-2xs">
        <h2 className="text-base font-black text-gray-900 flex items-center space-x-2">
          <Settings className="w-5 h-5 text-[#ef6c00]" />
          <span>การตั้งค่าระบบ (System Settings)</span>
        </h2>
        <p className="text-xs text-gray-500 mt-1">จัดการข้อมูลหลักของระบบ — เฉพาะ Super Admin</p>
      </div>

      <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-xs font-extrabold text-gray-900 uppercase tracking-wide flex items-center space-x-2">
            <FolderKanban className="w-4 h-4 text-[#ef6c00]" />
            <span>จัดการโครงการ ({projects.length} โครงการ)</span>
          </h3>
          <div className="relative sm:w-64">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="ค้นหาชื่อโครงการ..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder:text-gray-400"
            />
          </div>
        </div>

        <p className="text-[11px] text-gray-500">
          โครงการที่ยังมีการ์ดงานอยู่ (รวมร่าง) จะลบไม่ได้ เพื่อไม่ให้การ์ดงานและประวัติหายไปด้วย — ย้ายหรือลบการ์ดงานก่อน
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 uppercase text-[10px] font-extrabold">
                <th className="py-2.5 px-3">ชื่อโครงการ</th>
                <th className="py-2.5 px-3">วันที่สร้าง</th>
                <th className="py-2.5 px-3 text-center">การ์ดงาน</th>
                <th className="py-2.5 px-3 text-right">ดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 font-medium">
              {visibleProjects.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-400">
                    {q ? 'ไม่พบโครงการที่ค้นหา' : 'ยังไม่มีโครงการในระบบ'}
                  </td>
                </tr>
              ) : (
                visibleProjects.map(p => {
                  const count = taskCountByProject.get(p.id) ?? 0;
                  return (
                    <tr key={p.id} className="hover:bg-orange-50/20 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center space-x-2 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                          <span className="font-bold text-gray-800 truncate">{p.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-gray-500">
                        {new Date(p.createdAt).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })}
                      </td>
                      <td className="py-2.5 px-3 text-center text-gray-700 font-bold">{count}</td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleDelete(p.id)}
                          disabled={count > 0}
                          title={count > 0 ? `ยังมีการ์ดงาน ${count} ใบ ลบไม่ได้` : 'ลบโครงการนี้'}
                          className="px-3 py-1.5 text-[11px] font-bold text-red-700 bg-red-100 hover:bg-red-200 rounded-xl transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-red-100"
                        >
                          <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                          ลบโครงการ
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <LineGroupsSettings />

      <ReviewerDigestSettings />
    </div>
  );
};
