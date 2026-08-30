import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Task } from '../types';
import { History, UserCheck, Paperclip, Search, Filter, Trash2, AlertTriangle } from 'lucide-react';

interface AuditLogViewProps {
  onOpenDetailModal: (task: Task) => void;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ onOpenDetailModal }) => {
  const { logs, tasks, deletionLogs, currentUser } = useApp();

  const [activeTab, setActiveTab] = useState<'activity' | 'deletions'>('activity');
  const [searchQuery, setSearchQuery] = useState('');
  const [delegatedOnly, setDelegatedOnly] = useState(false);

  // ประวัติการลบเป็นข้อมูลของผู้ดูแล — ฝั่งฐานข้อมูลกันด้วย RLS อยู่แล้ว
  // ตรงนี้แค่ไม่ต้องโชว์แท็บเปล่า ๆ ให้คนที่ยังไงก็ไม่มีข้อมูล
  const canSeeDeletions = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  const filteredLogs = logs.filter(log => {
    const isDelegated = log.actionByUserId !== log.onBehalfOfUserId;
    if (delegatedOnly && !isDelegated) return false;

    const matchesSearch =
      log.actionByUserName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.onBehalfOfUserName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.comment.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  const q = searchQuery.toLowerCase();
  const filteredDeletionLogs = deletionLogs.filter(
    d =>
      d.taskCode.toLowerCase().includes(q) ||
      d.taskTitle.toLowerCase().includes(q) ||
      d.deletedByName.toLowerCase().includes(q) ||
      d.projectName.toLowerCase().includes(q)
  );

  return (
    <div className="space-y-6">
      
      {/* Header bar */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div>
          {activeTab === 'activity' ? (
            <>
              <h2 className="text-base font-extrabold text-gray-900 flex items-center space-x-2">
                <History className="w-5 h-5 text-orange-600" />
                <span>ประวัติการบันทึก Audit Log & การทำแทนกัน (Delegation Trail)</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                บันทึกการเปลี่ยนแปลงสถานะงาน ใครเป็นผู้ดำเนินการ และทำแทนใครในระบบ
              </p>
            </>
          ) : (
            <>
              <h2 className="text-base font-extrabold text-gray-900 flex items-center space-x-2">
                <Trash2 className="w-5 h-5 text-red-600" />
                <span>ประวัติการลบการ์ดงาน</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                การ์ดที่ถูกลบถาวรพร้อมข้อมูลว่าใครลบและลบเมื่อไหร่ — แก้หรือลบรายการเหล่านี้ไม่ได้
              </p>
            </>
          )}
        </div>

        {/* Filter inputs */}
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาชื่อผู้ปฏิบัติงาน หรือข้อความ..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 bg-gray-50/50"
            />
          </div>

          {activeTab === 'activity' && (
            <label className="flex items-center space-x-2 text-xs font-bold text-gray-700 bg-orange-50 border border-orange-200 px-3 py-2 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={delegatedOnly}
                onChange={e => setDelegatedOnly(e.target.checked)}
                className="rounded text-orange-600 focus:ring-orange-500 w-4 h-4"
              />
              <span>แสดงเฉพาะการส่งแทนกัน</span>
            </label>
          )}
        </div>
      </div>

      {/* สลับระหว่างประวัติการทำงานกับประวัติการลบ — โชว์เฉพาะผู้ดูแล */}
      {canSeeDeletions && (
        <div className="bg-gray-100/90 border border-gray-200/80 p-1.5 rounded-2xl flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('activity')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'activity'
                ? 'bg-white text-orange-700 shadow-2xs border border-orange-200'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>การบันทึกงาน ({logs.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('deletions')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'deletions'
                ? 'bg-white text-red-700 shadow-2xs border border-red-200'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>ประวัติการลบ ({deletionLogs.length})</span>
          </button>
        </div>
      )}

      {/* Audit Log Table */}
      {activeTab === 'activity' && (
      <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 uppercase text-[10px] font-extrabold">
                <th className="py-3 px-3">วัน-เวลา</th>
                <th className="py-3 px-3">รหัส / ชื่องาน</th>
                <th className="py-3 px-3">ผู้ปฏิบัติงาน (Action By)</th>
                <th className="py-3 px-3">เจ้าของงานจริง (On Behalf Of)</th>
                <th className="py-3 px-3">สถานะใหม่</th>
                <th className="py-3 px-3">รายละเอียดบันทึก</th>
                <th className="py-3 px-3 text-center">ไฟล์แนบ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 font-medium">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">
                    ไม่พบรายการประวัติการทำงานตามเงื่อนไข
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const isDelegated = log.actionByUserId !== log.onBehalfOfUserId;
                  const task = tasks.find(t => t.id === log.taskId);

                  return (
                    <tr key={log.id} className="hover:bg-orange-50/30 transition-colors">
                      <td className="py-3 px-3 text-gray-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('th-TH')}
                      </td>
                      <td className="py-3 px-3">
                        {task ? (
                          <button
                            onClick={() => onOpenDetailModal(task)}
                            className="font-bold text-orange-700 hover:underline text-left block"
                          >
                            #{task.code} {task.title}
                          </button>
                        ) : (
                          <span className="text-gray-400">ไม่พบงาน</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-bold text-gray-900">
                        {log.actionByUserName}
                      </td>
                      <td className="py-3 px-3">
                        {isDelegated ? (
                          <span className="bg-sky-100 text-sky-900 px-2 py-0.5 rounded-full font-bold text-[10px] inline-flex items-center space-x-1">
                            <UserCheck className="w-3 h-3 text-sky-600" />
                            <span>{log.onBehalfOfUserName}</span>
                          </span>
                        ) : (
                          <span className="text-gray-500">{log.onBehalfOfUserName}</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="bg-gray-100 text-gray-800 text-[10px] font-bold px-2 py-0.5 rounded-md">
                          {log.newStatus}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-700 max-w-xs truncate">
                        {log.comment}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {log.attachments && log.attachments.length > 0 ? (
                          <span className="text-amber-800 bg-amber-100 font-bold px-2 py-0.5 rounded-full text-[10px]">
                            <Paperclip className="w-3 h-3 inline mr-0.5" />
                            {log.attachments.length} ไฟล์
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* ตารางประวัติการลบการ์ดงาน */}
      {activeTab === 'deletions' && canSeeDeletions && (
        <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-2xs space-y-4">

          <div className="bg-red-50/70 border border-red-200/80 rounded-2xl p-3 text-[11px] text-red-900 flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>
              การ์ดที่ถูกลบไปแล้วกู้คืนไม่ได้ ตารางนี้เก็บไว้เป็นหลักฐานว่ามีอะไรหายไปบ้าง
              รายการในตารางนี้แก้ไขและลบทิ้งไม่ได้ แม้แต่จากฝั่งฐานข้อมูล
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 uppercase text-[10px] font-extrabold">
                  <th className="py-3 px-3">วัน-เวลาที่ลบ</th>
                  <th className="py-3 px-3">รหัส / ชื่องานที่ถูกลบ</th>
                  <th className="py-3 px-3">โครงการ</th>
                  <th className="py-3 px-3">ผู้รับผิดชอบเดิม</th>
                  <th className="py-3 px-3">สถานะสุดท้าย</th>
                  <th className="py-3 px-3">ผู้ลบ</th>
                  <th className="py-3 px-3">ข้อมูลที่หายไปด้วย</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 font-medium">
                {filteredDeletionLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400">
                      {deletionLogs.length === 0
                        ? 'ยังไม่มีการลบการ์ดงานในระบบ'
                        : 'ไม่พบรายการลบตามเงื่อนไขที่ค้นหา'}
                    </td>
                  </tr>
                ) : (
                  filteredDeletionLogs.map(d => (
                    <tr key={d.id} className="hover:bg-red-50/30 transition-colors">
                      <td className="py-3 px-3 text-gray-500 whitespace-nowrap">
                        {new Date(d.deletedAt).toLocaleString('th-TH')}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-gray-900 line-through decoration-red-400">
                          #{d.taskCode}
                        </span>{' '}
                        <span className="text-gray-700">{d.taskTitle}</span>
                      </td>
                      <td className="py-3 px-3 text-gray-600">{d.projectName || '-'}</td>
                      <td className="py-3 px-3 text-gray-600">{d.assignedToName || '-'}</td>
                      <td className="py-3 px-3">
                        <span className="bg-gray-100 text-gray-800 text-[10px] font-bold px-2 py-0.5 rounded-md">
                          {d.lastStatus}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {d.deletedByUserId ? (
                          <span className="font-bold text-red-800">{d.deletedByName}</span>
                        ) : (
                          <span className="text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full font-bold text-[10px]">
                            {d.deletedByName}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-gray-600 whitespace-nowrap">
                        ประวัติ {d.taskLogsRemoved} รายการ
                        {d.attachmentsRemoved > 0 && (
                          <span className="text-amber-800 ml-1">
                            <Paperclip className="w-3 h-3 inline mr-0.5" />
                            {d.attachmentsRemoved} ไฟล์
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
