import React, { useState } from 'react';
import { Task } from '../types';
import { useApp } from '../context/AppContext';
import { DeleteTaskConfirmModal } from './DeleteTaskConfirmModal';
import {
  Clock,
  Paperclip,
  CheckSquare,
  Eye,
  AlertCircle,
  User,
  Copy,
  Tag,
  AlertTriangle,
  GraduationCap,
  PenTool,
  Trash2,
} from 'lucide-react';

interface TaskCardProps {
  task: Task;
  onOpenSubmitModal: (task: Task) => void;
  onOpenDetailModal: (task: Task) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onOpenSubmitModal,
  onOpenDetailModal,
}) => {
  const { currentUser, approveTask, returnTask, duplicateTask, deleteTask, logs } = useApp();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Find latest log for delegation badge info
  const taskLogs = logs.filter(l => l.taskId === task.id);
  const latestLog = taskLogs[taskLogs.length - 1];

  // SLA Color & Label Mapping matching Technical Dashboard
  const getSlaBadge = (sla: Task['slaStatus']) => {
    switch (sla) {
      case 'on_time':
        return {
          label: 'SLA: ON TIME',
          bgColor: '#72d572',
          textColor: '#ffffff',
        };
      case 'delayed':
        return {
          label: 'SLA: DELAYED',
          bgColor: '#ffa726',
          textColor: '#ffffff',
        };
      case 'no_update':
        return {
          label: 'SLA: NO UPDATE',
          bgColor: '#bf360c',
          textColor: '#ffffff',
        };
      default:
        return {
          label: 'SLA: ON TIME',
          bgColor: '#72d572',
          textColor: '#ffffff',
        };
    }
  };

  const slaBadge = getSlaBadge(task.slaStatus);

  const completedChecklistCount = task.checklists.filter(c => c.completed).length;
  const totalChecklistCount = task.checklists.length;

  const isDelegatedLastAction =
    latestLog && latestLog.actionByUserId !== latestLog.onBehalfOfUserId;

  const canReview = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  // ลบการ์ดถาวรได้เฉพาะ admin ขึ้นไป — ด่านจริงคือ policy tasks_delete_admin ที่ฐานข้อมูล
  const canDelete = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  return (
    <div className={`bg-white rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden group shadow-xs hover:shadow-md ${
      task.isDraft ? 'border-dashed border-amber-400 bg-amber-50/20' : 'border-gray-200/80'
    }`}>
      
      {/* Top Header & SLA Indicator */}
      <div className="p-4 space-y-2.5">
        
        <div className="flex items-start justify-between gap-2">
          {/* SLA Badge & Category Pill */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full inline-flex items-center space-x-1 shadow-2xs"
              style={{
                backgroundColor: slaBadge.bgColor,
                color: slaBadge.textColor,
              }}
            >
              <Clock className="w-3 h-3" />
              <span>{slaBadge.label}</span>
            </span>

            {/* Category Tag */}
            {task.category === 'ku_university' && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center space-x-1">
                <GraduationCap className="w-3 h-3 text-emerald-700" />
                <span>งานโครงการ</span>
              </span>
            )}
            {task.category === 'drawing_draft' && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300 inline-flex items-center space-x-1">
                <PenTool className="w-3 h-3 text-purple-700" />
                <span>เขียนแบบ/ภาพ</span>
              </span>
            )}
            {task.isDraft && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300">
                ร่างบันทึก
              </span>
            )}
          </div>

          {/* Task Code & Copy Button */}
          <div className="flex items-center space-x-1">
            <span className="text-xs font-mono font-bold text-gray-400 group-hover:text-gray-600 transition-colors">
              #{task.code}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                duplicateTask(task.id);
              }}
              className="p-1 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-md transition-colors"
              title="คัดลอกการ์ดงานนี้ (Copy Card)"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            {canDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(true);
                }}
                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                title="ลบการ์ดงานนี้ถาวร (เฉพาะผู้ดูแลระบบ)"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Project Tag */}
        <span className="text-[11px] font-semibold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-md inline-block max-w-full truncate">
          {task.projectName}
        </span>

        {/* Title */}
        <h4
          onClick={() => onOpenDetailModal(task)}
          className="text-sm font-bold text-gray-900 leading-snug cursor-pointer hover:text-orange-600 transition-colors line-clamp-2"
        >
          {task.title}
        </h4>

        {/* Incomplete draft warnings if any */}
        {task.incompleteWarnings && task.incompleteWarnings.length > 0 && (
          <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-[10px] text-amber-900 flex items-start space-x-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">ข้อมูลยังไม่ครบถ้วน:</span> {task.incompleteWarnings.join(', ')}
            </div>
          </div>
        )}

        {/* Checklists Progress */}
        {totalChecklistCount > 0 && (
          <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
            <span className="flex items-center space-x-1 font-medium">
              <CheckSquare className="w-3.5 h-3.5 text-orange-500" />
              <span>
                Checklist: {completedChecklistCount}/{totalChecklistCount}
              </span>
            </span>
            <div className="w-16 bg-gray-100 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-orange-500 h-full transition-all duration-300"
                style={{
                  width: `${(completedChecklistCount / totalChecklistCount) * 100}%`,
                }}
              ></div>
            </div>
          </div>
        )}

        {/* Attachment preview notice if present */}
        {task.attachments.length > 0 && (
          <div className="bg-amber-50/80 border border-amber-200/60 rounded-xl p-2.5 text-[11px] text-amber-900 space-y-1">
            <div className="font-bold flex items-center space-x-1">
              <Paperclip className="w-3.5 h-3.5 text-amber-700" />
              <span>แนบไฟล์ส่งตรวจ ({task.attachments.length} รายการ):</span>
            </div>
            <div className="text-[10px] text-amber-800 space-y-0.5 truncate">
              {task.attachments.map(att => (
                <div key={att.id} className="truncate">
                  {att.fileType === 'image' ? '🖼️' : '📄'} {att.fileName}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assigned User Badge (Matches 'บันทึกโดย' badge styling) */}
        <div className="bg-sky-50 border border-sky-200/70 rounded-xl p-2 text-[11px] text-sky-950 flex items-center space-x-1.5">
          <User className="w-3.5 h-3.5 text-sky-600 shrink-0" />
          <span className="truncate">
            ผู้รับผิดชอบ: <strong className="font-extrabold">{task.assignedToUserName?.replace(/\s*\([^)]*\)/g, '').trim()}</strong>
          </span>
        </div>

        {/* Delegation Badge info */}
        {isDelegatedLastAction && (
          <div className="bg-sky-50/70 border border-sky-200/60 rounded-xl p-2 text-[10px] text-sky-900 flex items-center space-x-1.5">
            <User className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <span className="truncate">
              บันทึกโดย: <strong className="font-bold">{latestLog.actionByUserName}</strong> (แทน {latestLog.onBehalfOfUserName})
            </span>
          </div>
        )}

      </div>

        {/* Footer Info & View Details Action */}
        <div 
          onClick={() => onOpenDetailModal(task)}
          className="flex items-center justify-between text-[11px] text-gray-500 border-t border-gray-100/80 cursor-pointer hover:bg-orange-50/50 bg-gray-50/60 px-3.5 py-2.5 transition-colors"
        >
          <span className="font-medium text-gray-600 truncate">
            แผนงาน: <strong className="text-gray-800">{task.planDays} วัน</strong>
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetailModal(task);
            }}
            className="p-1 text-gray-400 hover:text-orange-600 hover:bg-orange-100/80 rounded-lg transition-colors shrink-0"
            title="ดูรายละเอียดการ์ดงาน"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>

      {showDeleteConfirm && (
        <DeleteTaskConfirmModal
          code={task.code}
          title={task.title}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={() => {
            deleteTask(task.id);
            setShowDeleteConfirm(false);
          }}
        />
      )}

    </div>
  );
};

