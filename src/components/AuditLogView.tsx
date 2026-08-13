import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Task } from '../types';
import { History, UserCheck, Paperclip, Search, Filter } from 'lucide-react';

interface AuditLogViewProps {
  onOpenDetailModal: (task: Task) => void;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ onOpenDetailModal }) => {
  const { logs, tasks } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [delegatedOnly, setDelegatedOnly] = useState(false);

  const filteredLogs = logs.filter(log => {
    const isDelegated = log.actionByUserId !== log.onBehalfOfUserId;
    if (delegatedOnly && !isDelegated) return false;

    const matchesSearch =
      log.actionByUserName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.onBehalfOfUserName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.comment.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      
      {/* Header bar */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-gray-900 flex items-center space-x-2">
            <History className="w-5 h-5 text-orange-600" />
            <span>ประวัติการบันทึก Audit Log & การทำแทนกัน (Delegation Trail)</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            บันทึกการเปลี่ยนแปลงสถานะงาน ใครเป็นผู้ดำเนินการ และทำแทนใครในระบบ
          </p>
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

          <label className="flex items-center space-x-2 text-xs font-bold text-gray-700 bg-orange-50 border border-orange-200 px-3 py-2 rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={delegatedOnly}
              onChange={e => setDelegatedOnly(e.target.checked)}
              className="rounded text-orange-600 focus:ring-orange-500 w-4 h-4"
            />
            <span>แสดงเฉพาะการส่งแทนกัน</span>
          </label>
        </div>
      </div>

      {/* Audit Log Table */}
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

    </div>
  );
};
