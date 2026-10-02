import React, { useState } from 'react';
import { Attachment, Task } from '../types';
import { useApp } from '../context/AppContext';
import { KUMilestonesView } from './KUMilestonesView';
import { ImageAnnotationViewer } from './ImageAnnotationViewer';
import { VoiceInputButton } from './VoiceInputButton';
import { DeleteTaskConfirmModal } from './DeleteTaskConfirmModal';
import { isLate as isTaskLate } from '../lib/report';
import {
  X,
  Upload,
  Clock,
  CheckSquare,
  Paperclip,
  History,
  User,
  CheckCircle,
  RotateCcw,
  Calendar,
  Layers,
  FileText,
  ExternalLink,
  ShieldCheck,
  GraduationCap,
  PenTool,
  Printer,
  Edit3,
  Trash2,
  Plus,
  AlertTriangle,
  AlertCircle,
  Send,
  Sparkles,
  DollarSign,
  Mic,
  Volume2,
} from 'lucide-react';

interface TaskDetailModalProps {
  task: Task | null;
  onClose: () => void;
  onOpenSubmitModal: (task: Task) => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  onClose,
  onOpenSubmitModal,
}) => {
  const { currentUser, updateChecklist, logs, approveTask, returnTask, addAnnotation, users, updateTaskFinancials, deleteTask, addTaskImages, deleteAttachment } = useApp();

  const [activeTab, setActiveTab] = useState<'info' | 'ku_flow' | 'annotation' | 'financials' | 'attachments' | 'history'>(
    task?.category === 'ku_university' ? 'ku_flow' : 'info'
  );

  // Editable description state (Page 8)
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descText, setDescText] = useState(task?.description || '');

  // Delay reason free text state (Page 19)
  const [delayReason, setDelayReason] = useState(task?.delayReason || '');
  // แสดงช่องหมายเหตุเฉพาะงานที่ล่าช้า — งานส่งตรงเวลาหรือการ์ดเปิดใหม่ไม่ต้องกรอก
  const isLate = !!task && isTaskLate(task, new Date());

  // Google Drive URL state
  const [driveUrl, setDriveUrl] = useState(task?.googleDriveUrl || '');

  // Voice Memo state
  const [voiceMemoUrl, setVoiceMemoUrl] = useState(task?.voiceMemoUrl || '');

  // Two-Tier Financials state
  const [finInstallment, setFinInstallment] = useState<number>(task?.twoTierFinancials?.projectInstallment || 500000);
  const [finRemuneration, setFinRemuneration] = useState<number>(task?.twoTierFinancials?.approvedRemuneration || 120000);
  const [finMaterials, setFinMaterials] = useState<number>(task?.twoTierFinancials?.approvedMaterials || 230000);
  const [finOperating, setFinOperating] = useState<number>(task?.twoTierFinancials?.approvedExpenses || 45000);

  // Checklist editing & adding state (Page 8)
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null);
  const [editingChecklistText, setEditingChecklistText] = useState('');
  const [newChecklistInput, setNewChecklistInput] = useState('');

  // Selected Approver state (Page 10)
  const [selectedApproverId, setSelectedApproverId] = useState<string>(() => {
    const admin = users.find(u => u.role === 'admin' || u.role === 'super_admin');
    return admin?.id || '';
  });

  // Custom System Dialog Popup state replacing native window.prompt / window.alert
  const [systemPopup, setSystemPopup] = useState<{
    isOpen: boolean;
    type: 'approve' | 'return' | 'alert';
    title: string;
    labelMessage: string;
    onConfirm: (val: string) => void;
  }>({
    isOpen: false,
    type: 'approve',
    title: '',
    labelMessage: '',
    onConfirm: () => {},
  });
  const [popupComment, setPopupComment] = useState('');

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // แก้รูปตอนรอตรวจ: id ของไฟล์ที่กำลังถามยืนยันลบ, สถานะกำลังอัปโหลด/ลบ, และข้อความ error
  const [confirmDeleteAttId, setConfirmDeleteAttId] = useState<string | null>(null);
  const [isImageBusy, setIsImageBusy] = useState(false);
  const [imageError, setImageError] = useState('');

  if (!task) return null;

  const taskLogs = logs
    .filter(l => l.taskId === task.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const canReview = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  // ลบการ์ดถาวรได้เฉพาะ admin ขึ้นไป — ด่านจริงคือ policy tasks_delete_admin ที่ฐานข้อมูล
  const canDelete = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  // Find image attachment if any for blueprint annotation
  const imageAttachment = task.attachments.find(a => a.fileType === 'image' && !a.fileUrl.startsWith('blob:'));
  const sampleBlueprintUrl = imageAttachment?.fileUrl || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?q=80&w=1200';

  // ล็อกการแก้ไขเฉพาะตอนที่งานไม่ได้อยู่ในมือเจ้าของงาน
  //   pending_review = อยู่ระหว่างผู้ตรวจพิจารณา ห้ามแก้ใต้มือผู้ตรวจ
  //   approved       = ปิดงานแล้ว
  //   returned       = ต้องกลับไปแก้ จึงต้องแก้ได้ (ไม่ล็อก)
  const isLockedStatus = task.status === 'pending_review' || task.status === 'approved';

  // ข้อยกเว้นของการล็อก: ตอนรอตรวจยังเพิ่ม/ลบรูปผลงานได้ (เช่น แนบรูปผิดหรือรูปเปิดไม่ได้)
  // ให้สิทธิ์ตรงกับ app_can_edit_task ที่ฐานข้อมูลใช้ตรวจตอนเพิ่มไฟล์แนบ
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  const canEditImages =
    task.status === 'pending_review' &&
    !!currentUser &&
    (isAdmin ||
      [task.assignedToUserId, task.assignedTargetUserId, task.reviewerUserId, task.createdById].includes(currentUser.id));
  // ลบได้เฉพาะผู้อัปโหลดหรือแอดมิน ตาม policy attachments_delete
  const canDeleteAttachment = (att: Attachment) =>
    canEditImages && att.fileType === 'image' && (isAdmin || att.uploadedById === currentUser?.id);

  const handleAddImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setIsImageBusy(true);
    setImageError('');
    try {
      await addTaskImages(task.id, files);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsImageBusy(false);
    }
  };

  const handleDeleteAttachment = async (att: Attachment) => {
    setIsImageBusy(true);
    setImageError('');
    try {
      await deleteAttachment(att);
      setConfirmDeleteAttId(null);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsImageBusy(false);
    }
  };
  const statusLabel =
    task.status === 'pending_review'
      ? 'รอตรวจ'
      : task.status === 'returned'
      ? 'ตีกลับ'
      : task.status === 'approved'
      ? 'อนุมัติ'
      : '';

  const handleChecklistToggle = (
    checklistId: string,
    completed: boolean,
    resultStatus?: 'success' | 'fail',
    resultReason?: string
  ) => {
    if (isLockedStatus) return;
    updateChecklist(task.id, checklistId, completed, resultStatus, resultReason);
    // Page 9 Requirement: When all items are checked, auto-switch to 'attachments' tab
    const currentItems = task.checklists;
    const remainingUnchecked = currentItems.filter(c => c.id !== checklistId && !c.completed);
    if (completed && remainingUnchecked.length === 0) {
      setActiveTab('attachments');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-3xl lg:max-w-4xl w-full shadow-2xl border border-gray-100 overflow-hidden my-4 sm:my-8 flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-gray-100 flex items-center justify-between gap-3 shrink-0" style={{ backgroundColor: '#ffcc80' }}>
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2 flex-wrap gap-1">
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-white text-amber-950">
                #{task.code}
              </span>
              <span className="text-xs font-bold text-amber-900 truncate">
                {task.projectName}
              </span>
              {task.category === 'ku_university' && (
                <span className="bg-emerald-800 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md flex items-center space-x-1">
                  <GraduationCap className="w-3 h-3" />
                  <span>งานโครงการ</span>
                </span>
              )}
              {task.category === 'drawing_draft' && (
                <span className="bg-purple-800 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md flex items-center space-x-1">
                  <PenTool className="w-3 h-3" />
                  <span>เขียนแบบ/ภาพ</span>
                </span>
              )}
              {/* Page 19 Result Badge */}
              {task.status === 'approved' && (
                <span className="bg-emerald-700 text-white text-[10px] font-black px-2 py-0.5 rounded-md flex items-center space-x-1 shadow-2xs">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  <span>ผลลัพธ์ดำเนินการสำเร็จแล้ว</span>
                </span>
              )}
            </div>
            <h3 className="font-extrabold text-base text-amber-950 mt-1 line-clamp-1">
              {task.title}
            </h3>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {/* Page 19 Requirement: Export Daily Report button */}
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-amber-900 hover:bg-amber-950 text-white text-xs font-black rounded-xl shadow-xs transition-all flex items-center space-x-1 cursor-pointer"
              title="ส่งออกรายงานประจำวันเพื่อพิมพ์ หรือ Save PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">ส่งออก Report รายวัน</span>
            </button>

            {canDelete && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded-xl shadow-xs transition-all flex items-center space-x-1 cursor-pointer"
                title="ลบการ์ดงานนี้ถาวร (เฉพาะผู้ดูแลระบบ)"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">ลบการ์ด</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/50 text-amber-950 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        {/* แท็บขึ้นบรรทัดใหม่เมื่อจอแคบ แทนการเลื่อนแนวนอน — แถบเลื่อนบน Windows บังชื่อแท็บและซ่อนแท็บท้าย */}
        <div className="flex flex-wrap border-b border-gray-100 bg-gray-50/80 px-2 sm:px-4 text-[11px] sm:text-xs font-bold shrink-0">
          <button
            onClick={() => setActiveTab('info')}
            className={`py-2.5 sm:py-3 px-2.5 sm:px-3.5 border-b-2 transition-all flex items-center space-x-1.5 whitespace-nowrap ${
              activeTab === 'info'
                ? 'border-orange-600 text-orange-600 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>ข้อมูลงาน & Checklist</span>
          </button>

          {task.category === 'ku_university' && (
            <button
              onClick={() => setActiveTab('ku_flow')}
              className={`py-2.5 sm:py-3 px-2.5 sm:px-3.5 border-b-2 transition-all flex items-center space-x-1.5 whitespace-nowrap ${
                activeTab === 'ku_flow'
                  ? 'border-emerald-600 text-emerald-700 bg-emerald-50/60'
                  : 'border-transparent text-emerald-800 hover:text-emerald-950'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
              <span>ขั้นตอนโครงการ ({task.milestones?.length || 0} งวด)</span>
            </button>
          )}

          {/* Two-Tier Financials tab */}
          <button
            onClick={() => setActiveTab('financials')}
            className={`py-2.5 sm:py-3 px-2.5 sm:px-3.5 border-b-2 transition-all flex items-center space-x-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'financials'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/60'
                : 'border-transparent text-emerald-800 hover:text-emerald-950'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
            <span>เงินงวด 2 ระดับ</span>
          </button>

          {/* Drawing Review & Pin Point Annotation tab */}
          <button
            onClick={() => setActiveTab('annotation')}
            className={`py-2.5 sm:py-3 px-2.5 sm:px-3.5 border-b-2 transition-all flex items-center space-x-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'annotation'
                ? 'border-purple-600 text-purple-700 bg-purple-50/60'
                : 'border-transparent text-purple-800 hover:text-purple-950'
            }`}
          >
            <PenTool className="w-3.5 h-3.5 text-purple-600" />
            <span>แก้ไขวงแบบแปลน & เสียง ({task.annotations?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('attachments')}
            className={`py-2.5 sm:py-3 px-2.5 sm:px-3.5 border-b-2 transition-all flex items-center space-x-1.5 whitespace-nowrap ${
              activeTab === 'attachments'
                ? 'border-orange-600 text-orange-600 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Paperclip className="w-3.5 h-3.5" />
            <span>ประวัติไฟล์แนบ ({task.attachments.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`py-2.5 sm:py-3 px-2.5 sm:px-3.5 border-b-2 transition-all flex items-center space-x-1.5 whitespace-nowrap ${
              activeTab === 'history'
                ? 'border-orange-600 text-orange-600 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit Log / ทำแทน ({taskLogs.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* Tab 1: Info & Checklists */}
          {activeTab === 'info' && (
            <div className="space-y-5">
              
              {/* Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-gray-50/80 p-3.5 rounded-2xl border border-gray-100 text-xs">
                <div>
                  <span className="text-[10px] text-gray-400 block font-semibold">ผู้รับผิดชอบงาน</span>
                  <span className="font-bold text-gray-800 flex items-center space-x-1 mt-0.5">
                    <User className="w-3.5 h-3.5 text-orange-600" />
                    <span>{task.assignedToUserName}</span>
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 block font-semibold">กำหนดส่ง (Deadline)</span>
                  <span className="font-bold text-gray-800 flex items-center space-x-1 mt-0.5">
                    <Calendar className="w-3.5 h-3.5 text-orange-600" />
                    <span>{new Date(task.deadlineAt).toLocaleDateString('th-TH')}</span>
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 block font-semibold">เวลาดำเนินการจริง (Lead Time)</span>
                  <span className="font-bold text-emerald-700 flex items-center space-x-1 mt-0.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{task.leadTimeDays ? `${task.leadTimeDays} วัน` : `แผน ${task.planDays} วัน`}</span>
                  </span>
                </div>
              </div>

              {/* Description (Editable per Page 8 requirement) */}
              <div className="space-y-1.5 bg-gray-50/60 p-3.5 rounded-2xl border border-gray-100">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-800">รายละเอียดงานขอบเขตงาน:</h4>
                  <button
                    type="button"
                    onClick={() => setIsEditingDesc(!isEditingDesc)}
                    className="text-[11px] font-bold text-orange-700 hover:text-orange-900 bg-orange-100 hover:bg-orange-200 px-2.5 py-1 rounded-lg transition-colors flex items-center space-x-1 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>{isEditingDesc ? 'เสร็จสิ้นการแก้ไข' : 'แก้ไขรายละเอียด'}</span>
                  </button>
                </div>

                {isEditingDesc ? (
                  <div className="space-y-2 pt-1">
                    <textarea
                      rows={3}
                      value={descText}
                      onChange={e => setDescText(e.target.value)}
                      className="w-full p-2.5 text-xs border border-orange-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          task.description = descText;
                          setIsEditingDesc(false);
                        }}
                        className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold shadow-2xs"
                      >
                        บันทึกการปรับแก้
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {descText || 'ไม่มีรายละเอียดเพิ่มเติม'}
                  </p>
                )}
              </div>

              {/* Google Drive Integration Box */}
              <div className="bg-blue-50/60 border border-blue-200 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-blue-950 flex items-center space-x-1.5">
                    <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                    <span>คลังเก็บไฟล์กลาง (Google Drive URL Link):</span>
                  </h4>
                  <span className="text-[10px] text-blue-800 bg-blue-100 px-2 py-0.5 rounded font-bold">
                    Cloud Drive Integration
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="url"
                    value={driveUrl}
                    onChange={e => {
                      setDriveUrl(e.target.value);
                      task.googleDriveUrl = e.target.value;
                    }}
                    placeholder="เช่น https://drive.google.com/drive/folders/xxxxxxxx"
                    className="flex-1 p-2 text-xs border border-blue-200 rounded-xl bg-white text-blue-950 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {driveUrl && (
                    <a
                      href={driveUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shrink-0 flex items-center space-x-1 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>เปิด Drive</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Delay Reason Free Text Notes (Page 19 Requirement) */}
              {isLate && (
              <div className="bg-red-50/60 border border-red-200 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-red-950 flex items-center space-x-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                    <span>หมายเหตุกรณีงานล่าช้า (Free Text Delay Note):</span>
                  </h4>
                  <span className="text-[10px] text-red-700 bg-red-100 px-2 py-0.5 rounded font-bold">
                    ราย Task
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={delayReason}
                  onChange={e => {
                    setDelayReason(e.target.value);
                    task.delayReason = e.target.value;
                  }}
                  placeholder="เช่น อยู่ระหว่างรอเอกสารอนุมัติจากหน่วยงานภายนอก"
                  className="w-full p-2.5 text-xs border border-red-200 rounded-xl bg-white text-red-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              )}

              {/* Checklists (Editable & Deletable per Page 8 Requirement) */}
              {(() => {
                const KU_9_STEPS = [
                  '1. เขียนข้อเสนอ — ร่าง (จัดทำข้อเสนอฉบับแรก)',
                  '2. อาจารย์หนุ่ยเปิด (เปิดอ่านและให้ข้อเสนอแนะ)',
                  '3. พลอยปรับแก้ (แก้ข้อเสนอตามความคิดเห็น)',
                  '4. รออาจารย์หนุ่ยอนุมัติ (ตรวจฉบับพร้อมส่ง)',
                  '5. พลอยกรอกข้อมูลเข้าระบบ (บันทึกข้อมูลและเอกสาร)',
                  '6. รอหน่วยงานพิจารณา (ติดตามผลภายในกรอบเวลา)',
                  '7. ผ่าน — กลับมาแก้ข้อมูล (แก้ไขและส่งกลับหน่วยงาน)',
                  '8. ติดตามข้อมูลจากพี่ฟ้อง (พลอยส่งรายละเอียดและติดตาม)',
                  '9. อนุมัติ — เริ่มรันงวด (รับ TOR และเปิดแผนส่งมอบตามงวด)',
                ];

                const isKU = task.category === 'ku_university';
                let itemsToShow = task.checklists;

                if (isKU) {
                  const statusStepMap: Record<string, number> = {
                    '1_draft_proposal': 1,
                    '2_aj_nui_open': 2,
                    '3_ploy_revision': 3,
                    '4_wait_aj_nui_approval': 4,
                    '5_ploy_system_submit': 5,
                    '6_agency_review': 6,
                    '7_passed_with_revision': 7,
                    '8_approved_run_terms': 8,
                  };
                  const currentStepNum = statusStepMap[task.kuProposalStatus || '1_draft_proposal'] || 1;

                  itemsToShow = KU_9_STEPS.map((stepTitle, idx) => {
                    const stepNum = idx + 1;
                    const existing = task.checklists.find(c => c.title.startsWith(`${stepNum}.`));
                    return {
                      id: existing?.id || `ku-step-${stepNum}`,
                      title: stepTitle,
                      completed: existing ? existing.completed : stepNum < currentStepNum,
                    };
                  });
                }

                const completedCount = itemsToShow.filter(c => c.completed).length;

                return (
                  <div className="space-y-2.5">
                    {/* Status Lock Warning Banner */}
                    {isLockedStatus && (
                      <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-center space-x-2">
                        <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          <strong>🔒 ล็อคการแก้ไขรายการ Checklist:</strong> การ์ดอยู่ในสถานะ{' '}
                          <span className="font-black underline text-amber-950">"{statusLabel}"</span>{' '}
                          ไม่อนุญาตให้แก้ไข/ติ๊กรายการใน Checklist (ยกเว้นกรอกหมายเหตุ หรือแก้ไขรายละเอียดงานขอบเขตงาน)
                        </span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <h4 className="text-xs font-bold text-gray-800 flex items-center space-x-1.5">
                        <CheckSquare className="w-4 h-4 text-orange-600" />
                        <span>รายการ Checklist การทำงาน:</span>
                      </h4>
                      <div className="flex items-center space-x-1">
                        {!isLockedStatus && (
                          <button
                            type="button"
                            onClick={() => {
                              task.checklists = [
                                { id: `chk-${Date.now()}-1`, title: '1. แกะสูตร + จัดหาวัตถุดิบ', completed: true },
                                { id: `chk-${Date.now()}-2`, title: '2. ทดลองครั้งที่ 1', completed: true },
                                { id: `chk-${Date.now()}-3`, title: '3. ส่งตัวอย่างทดลองครั้งที่ 1 (ให้พี่รักษ์)', completed: true },
                                { id: `chk-${Date.now()}-4`, title: '4. ปรับสูตรครั้งที่ 1', completed: false },
                                { id: `chk-${Date.now()}-5`, title: '5. ส่งตัวอย่างหลังปรับสูตรครั้งที่ 1 (ถ้าผ่านไปข้อ 6 / ถ้าไม่ผ่าน ย้อนปรับสูตรครั้งที่ 2 และส่งตัวอย่างครั้งที่ 2)', completed: false },
                                { id: `chk-${Date.now()}-6`, title: '6. ส่งตรวจข้อมูลโภชนาการ และขอเลขอย.', completed: false },
                                { id: `chk-${Date.now()}-7`, title: '7. ออกแบบและทดลองบรรจุภัณฑ์', completed: false },
                                { id: `chk-${Date.now()}-8`, title: '8. ทดลองเก็บ Shelf Life', completed: false },
                                { id: `chk-${Date.now()}-9`, title: '9. คำนวณต้นทุนและกำหนดราคาขาย', completed: false },
                                { id: `chk-${Date.now()}-10`, title: '10. ลงขาย', completed: false },
                              ];
                              setNewChecklistInput('');
                            }}
                            className="text-[10px] font-black px-2 py-0.5 bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-300 rounded-md transition-colors cursor-pointer"
                          >
                            🧪 โหลด Flow RD
                          </button>
                        )}
                        <span className="text-[10px] text-gray-500 font-bold bg-gray-100 px-2 py-0.5 rounded-full">
                          {completedCount}/{itemsToShow.length} สำเร็จ
                        </span>
                      </div>
                    </div>

                    {/* Add new checklist item input - hidden if locked */}
                    {!isLockedStatus && (
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          placeholder="เพิ่มข้อ checklist ใหม่..."
                          value={newChecklistInput}
                          onChange={e => setNewChecklistInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && newChecklistInput.trim()) {
                              e.preventDefault();
                              task.checklists.push({
                                id: `chk-${Date.now()}`,
                                title: newChecklistInput.trim(),
                                completed: false,
                              });
                              setNewChecklistInput('');
                            }
                          }}
                          className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (newChecklistInput.trim()) {
                              task.checklists.push({
                                id: `chk-${Date.now()}`,
                                title: newChecklistInput.trim(),
                                completed: false,
                              });
                              setNewChecklistInput('');
                            }
                          }}
                          className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                        >
                          เพิ่ม
                        </button>
                      </div>
                    )}

                    {/* Column Headers */}
                    <div className="flex items-center justify-between px-3 py-1.5 bg-gray-100/80 rounded-xl text-xs font-bold text-gray-700 border border-gray-200">
                      <span className="flex-1">เป้าหมาย</span>
                      <span className="w-36 text-right pr-2">ผลลัพธ์</span>
                    </div>

                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {itemsToShow.map(chk => {
                        const currentResult = chk.resultStatus || 'success';
                        return (
                          <div
                            key={chk.id}
                            className={`p-2.5 rounded-xl border transition-all text-xs space-y-2 ${
                              currentResult === 'fail'
                                ? 'bg-red-50/50 border-red-200 shadow-2xs'
                                : isLockedStatus
                                ? 'bg-gray-50/60 opacity-90 border-gray-100'
                                : 'bg-white hover:bg-orange-50/20 border-gray-200 shadow-2xs'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              {/* Left Column: เป้าหมาย */}
                              <label className={`flex items-center space-x-2.5 flex-1 min-w-0 ${isLockedStatus ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                <input
                                  type="checkbox"
                                  checked={chk.completed}
                                  disabled={isLockedStatus}
                                  onChange={e => handleChecklistToggle(chk.id, e.target.checked, chk.resultStatus, chk.resultReason)}
                                  className="rounded-md border-gray-300 text-orange-600 focus:ring-orange-500 w-4 h-4 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                />
                                {editingChecklistId === chk.id && !isLockedStatus ? (
                                  <input
                                    type="text"
                                    value={editingChecklistText}
                                    onChange={e => setEditingChecklistText(e.target.value)}
                                    onBlur={() => {
                                      const target = task.checklists.find(c => c.id === chk.id);
                                      if (target) target.title = editingChecklistText;
                                      setEditingChecklistId(null);
                                    }}
                                    className="flex-1 px-2 py-0.5 border border-orange-400 rounded-lg text-xs"
                                    autoFocus
                                  />
                                ) : (
                                  <span className={`truncate ${chk.completed ? 'line-through text-gray-400' : 'text-gray-800 font-medium'}`}>
                                    {chk.title}
                                  </span>
                                )}
                              </label>

                              {/* Right Column: ผลลัพธ์ Dropdown */}
                              <div className="flex items-center space-x-1.5 shrink-0">
                                <select
                                  disabled={isLockedStatus}
                                  value={currentResult}
                                  onChange={e => {
                                    const val = e.target.value as 'success' | 'fail';
                                    chk.resultStatus = val;
                                    if (val === 'success') {
                                      chk.completed = true;
                                    } else {
                                      chk.completed = false;
                                    }
                                    handleChecklistToggle(chk.id, chk.completed, val, chk.resultReason);
                                  }}
                                  className={`text-xs font-black px-2.5 py-1 rounded-lg border focus:outline-none transition-all cursor-pointer ${
                                    currentResult === 'fail'
                                      ? 'bg-red-600 text-white border-red-700 shadow-2xs'
                                      : 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                                  }`}
                                >
                                  <option value="success" className="bg-white text-emerald-800 font-bold">สำเร็จ</option>
                                  <option value="fail" className="bg-white text-red-800 font-bold">ไม่สำเร็จ</option>
                                </select>

                                {!isLockedStatus && (
                                  <div className="flex items-center space-x-0.5 shrink-0">
                                    {/* Edit Checklist Item */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingChecklistId(chk.id);
                                        setEditingChecklistText(chk.title);
                                      }}
                                      className="p-1 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-md transition-colors"
                                      title="แก้ไขข้อความ"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>

                                    {/* Delete Checklist Item */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        task.checklists = task.checklists.filter(c => c.id !== chk.id);
                                        handleChecklistToggle(chk.id, false);
                                      }}
                                      className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                      title="ลบข้อนี้"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Reason Input Box */}
                            {currentResult === 'fail' ? (
                              <div className="mt-1 pl-6">
                                <div className="p-2 bg-red-100/70 border border-red-300 rounded-xl space-y-1">
                                  <div className="flex items-center justify-between">
                                    <label className="text-[11px] font-extrabold text-red-800 flex items-center space-x-1">
                                      <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                      <span>เหตุผลที่ไม่สำเร็จ (บังคับระบุ)</span>
                                    </label>
                                    {!chk.resultReason?.trim() && (
                                      <span className="text-[10px] font-bold text-red-600 animate-pulse">
                                        * จำเป็นต้องกรอกเหตุผล
                                      </span>
                                    )}
                                  </div>
                                  <input
                                    type="text"
                                    disabled={isLockedStatus}
                                    placeholder="กรุณาระบุเหตุผลที่ไม่สำเร็จ..."
                                    value={chk.resultReason || ''}
                                    onChange={e => {
                                      chk.resultReason = e.target.value;
                                      handleChecklistToggle(chk.id, chk.completed, currentResult, e.target.value);
                                    }}
                                    className="w-full px-2.5 py-1 text-xs bg-white border border-red-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 font-medium text-gray-900 placeholder-red-300"
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="mt-1 pl-6">
                                <input
                                  type="text"
                                  disabled={isLockedStatus}
                                  placeholder="ระบุเหตุผลหรือหมายเหตุเพิ่มเติม (ถ้ามี)..."
                                  value={chk.resultReason || ''}
                                  onChange={e => {
                                    chk.resultReason = e.target.value;
                                    handleChecklistToggle(chk.id, chk.completed, currentResult, e.target.value);
                                  }}
                                  className="w-full px-2.5 py-1 text-[11px] bg-gray-50/70 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400 text-gray-700 placeholder-gray-400"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

            </div>
          )}

          {/* Tab KU University Flow */}
          {activeTab === 'ku_flow' && (
            <KUMilestonesView task={task} readOnly={isLockedStatus} />
          )}

          {/* Tab: Two-Tier Financials */}
          {activeTab === 'financials' && (
            <div className="space-y-4">
              <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                  <h4 className="text-xs font-extrabold text-emerald-950 flex items-center space-x-1.5">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    <span>การติดตามเงินงวด 2 ระดับ (Two-Tier Financial Tracking)</span>
                  </h4>
                  <span className="text-[10px] text-emerald-800 bg-emerald-200 px-2.5 py-0.5 rounded-full font-extrabold">
                    Real-Time Balance
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Tier 1: Project Installment */}
                  <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 space-y-1.5 shadow-2xs">
                    <span className="text-[10px] text-gray-500 font-bold block">1. ยอดเงินงวดสัญญาโครงการหลัก</span>
                    <div className="flex items-center space-x-1">
                      <span className="text-gray-400 font-bold">฿</span>
                      <input
                        type="number"
                        disabled={isLockedStatus}
                        value={finInstallment}
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 0;
                          setFinInstallment(val);
                          updateTaskFinancials(task.id, {
                            projectInstallment: val,
                            approvedRemuneration: finRemuneration,
                            approvedMaterials: finMaterials,
                            approvedExpenses: finOperating,
                            remainingBalance: val - (finRemuneration + finMaterials + finOperating),
                          });
                        }}
                        className="w-full font-black text-emerald-900 text-lg focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {/* Tier 2: Calculated Remaining Balance */}
                  <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 space-y-1.5 shadow-2xs">
                    <span className="text-[10px] text-gray-500 font-bold block">2. ยอดเงินคงเหลือคงเหลือสุทธิ (Remaining Balance)</span>
                    <div className="font-black text-xl text-emerald-700">
                      ฿{((finInstallment) - (finRemuneration + finMaterials + finOperating)).toLocaleString('th-TH')}
                    </div>
                  </div>
                </div>

                {/* Expense Itemization */}
                <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 space-y-3 text-xs shadow-2xs">
                  <span className="text-xs font-bold text-gray-800 block">ยอดอนุมัติเบิกจ่ายจริงรายหมวด (Approved Actual Expenses):</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                      <label className="text-[10px] text-gray-500 font-bold block mb-1">ค่าตอบแทน (Remuneration)</label>
                      <div className="flex items-center space-x-1">
                        <span className="text-gray-400 font-bold text-xs">฿</span>
                        <input
                          type="number"
                          disabled={isLockedStatus}
                          value={finRemuneration}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            setFinRemuneration(val);
                            updateTaskFinancials(task.id, {
                              projectInstallment: finInstallment,
                              approvedRemuneration: val,
                              approvedMaterials: finMaterials,
                              approvedExpenses: finOperating,
                              remainingBalance: finInstallment - (val + finMaterials + finOperating),
                            });
                          }}
                          className="w-full p-1 border border-gray-300 rounded-lg font-bold text-gray-800 text-xs bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>

                    <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                      <label className="text-[10px] text-gray-500 font-bold block mb-1">ค่าวัสดุ (Materials)</label>
                      <div className="flex items-center space-x-1">
                        <span className="text-gray-400 font-bold text-xs">฿</span>
                        <input
                          type="number"
                          disabled={isLockedStatus}
                          value={finMaterials}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            setFinMaterials(val);
                            updateTaskFinancials(task.id, {
                              projectInstallment: finInstallment,
                              approvedRemuneration: finRemuneration,
                              approvedMaterials: val,
                              approvedExpenses: finOperating,
                              remainingBalance: finInstallment - (finRemuneration + val + finOperating),
                            });
                          }}
                          className="w-full p-1 border border-gray-300 rounded-lg font-bold text-gray-800 text-xs bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>

                    <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                      <label className="text-[10px] text-gray-500 font-bold block mb-1">ค่าใช้สอย (Operating)</label>
                      <div className="flex items-center space-x-1">
                        <span className="text-gray-400 font-bold text-xs">฿</span>
                        <input
                          type="number"
                          disabled={isLockedStatus}
                          value={finOperating}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            setFinOperating(val);
                            updateTaskFinancials(task.id, {
                              projectInstallment: finInstallment,
                              approvedRemuneration: finRemuneration,
                              approvedMaterials: finMaterials,
                              approvedExpenses: val,
                              remainingBalance: finInstallment - (finRemuneration + finMaterials + val),
                            });
                          }}
                          className="w-full p-1 border border-gray-300 rounded-lg font-bold text-gray-800 text-xs bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab Image Annotation / Blueprint Review */}
          {activeTab === 'annotation' && (
            <div className="space-y-3">
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 flex items-center justify-between">
                <span>🎨 ปักหมุดพิกัดบนแบบแปลน/รูปภาพ พร้อมแนบข้อความหรือเสียงสั่งงาน (Voice Memo)</span>
                <span className="font-bold text-[10px] bg-purple-200 px-2 py-0.5 rounded-full">
                  Interactive Blueprint
                </span>
              </div>

              {/* Voice Memo Controls */}
              <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-800 flex items-center space-x-1.5">
                    <Mic className="w-4 h-4 text-purple-600" />
                    <span>อัดเสียงสั่งงาน / สั่งแก้ไขงานด้วยเสียง (Voice Memo):</span>
                  </span>
                  <VoiceInputButton onTranscript={text => {
                    const memo = `เสียงสั่งงาน: "${text}"`;
                    setVoiceMemoUrl(memo);
                    task.voiceMemoUrl = memo;
                  }} />
                </div>
                {voiceMemoUrl ? (
                  <div className="p-2.5 bg-purple-100/60 border border-purple-200 rounded-xl flex items-center justify-between text-xs text-purple-950">
                    <span className="font-bold flex items-center space-x-1">
                      <Volume2 className="w-4 h-4 text-purple-700" />
                      <span>{voiceMemoUrl}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setVoiceMemoUrl('');
                        task.voiceMemoUrl = '';
                      }}
                      className="text-[10px] text-red-600 font-bold hover:underline cursor-pointer"
                    >
                      ลบเสียง
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-400">กดปุ่มไมโครโฟนเพื่อเริ่มพูดสั่งงานและแปลงเป็นข้อความสั่งแก้ไขอัตโนมัติ</p>
                )}
              </div>

              <ImageAnnotationViewer
                imageUrl={sampleBlueprintUrl}
                annotations={task.annotations || []}
                onAddAnnotation={ann => addAnnotation(task.id, { ...ann, imageUrl: sampleBlueprintUrl })}
              />
            </div>
          )}

          {/* Tab 2: Attachments (Accessible even after task closed) */}
          {activeTab === 'attachments' && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-center justify-between">
                <span>📁 ไฟล์และภาพถ่ายถูกบันทึกไว้ในคลัง สามารถเรียกดูย้อนหลังได้ตลอดแม้ปิดงานแล้ว</span>
                <span className="font-bold text-[10px] bg-amber-200 px-2 py-0.5 rounded-full">
                  5-Year Saved
                </span>
              </div>

              {canEditImages && (
                <div className="space-y-2">
                  <label
                    className={`flex items-center justify-center space-x-2 border-2 border-dashed rounded-2xl p-3 text-xs font-bold transition-colors ${
                      isImageBusy
                        ? 'border-gray-200 text-gray-400 cursor-wait'
                        : 'border-orange-200 hover:border-orange-400 text-orange-700 cursor-pointer'
                    }`}
                  >
                    <Upload className="w-4 h-4" />
                    <span>{isImageBusy ? 'กำลังบันทึก...' : 'เพิ่มรูปภาพผลงาน (แก้ไขได้ระหว่างรอตรวจ)'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={isImageBusy}
                      onChange={handleAddImages}
                      className="hidden"
                    />
                  </label>
                  {imageError && (
                    <p className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                      {imageError}
                    </p>
                  )}
                </div>
              )}

              {task.attachments.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-2xl">
                  ยังไม่มีไฟล์หรือรูปภาพแนบในงานนี้
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {task.attachments.map(att => {
                    // ลิงก์ blob: มาจากเวอร์ชันเก่าที่ไม่ได้อัปโหลดไฟล์ขึ้นเซิร์ฟเวอร์ — ตัวไฟล์หายไปแล้ว เปิดไม่ได้
                    const isLostFile = att.fileUrl.startsWith('blob:');
                    return (
                    <div
                      key={att.id}
                      className="p-3 border border-gray-200 rounded-2xl bg-white hover:border-orange-300 transition-all space-y-2 flex flex-col justify-between"
                    >
                      <div>
                        {att.fileType === 'image' && att.fileUrl && att.fileUrl !== '#' && !isLostFile && (
                          <div className="w-full h-32 rounded-xl overflow-hidden mb-2 bg-black/5">
                            <img
                              src={att.fileUrl}
                              alt={att.fileName}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="flex items-start space-x-2">
                          <span className="text-base">{att.fileType === 'image' ? '🖼️' : '📄'}</span>
                          <div className="overflow-hidden">
                            <p className="text-xs font-bold text-gray-800 truncate">{att.fileName}</p>
                            <p className="text-[10px] text-gray-400">
                              อัปโหลดโดย {att.uploadedBy} • {new Date(att.uploadedAt).toLocaleDateString('th-TH')}
                            </p>
                          </div>
                        </div>
                      </div>

                      {isLostFile ? (
                        <p className="w-full text-center py-1.5 px-2 text-[11px] font-bold text-red-700 bg-red-50 rounded-xl mt-2">
                          ไฟล์นี้ไม่ได้ถูกอัปโหลดขึ้นระบบ เปิดไม่ได้ — กรุณาส่งตรวจงานพร้อมแนบรูปใหม่
                        </p>
                      ) : (
                        <a
                          href={att.fileUrl !== '#' ? att.fileUrl : undefined}
                          target="_blank"
                          rel="noreferrer"
                          onClick={e => {
                            if (att.fileUrl === '#') {
                              e.preventDefault();
                              setSystemPopup({
                                isOpen: true,
                                type: 'alert',
                                title: 'ดาวน์โหลดไฟล์เอกสาร',
                                labelMessage: `จำลองดาวน์โหลดไฟล์: ${att.fileName} (${Math.round(att.fileSize / 1024 / 1024 * 10) / 10} MB)`,
                                onConfirm: () => {},
                              });
                            }
                          }}
                          className="w-full text-center py-1.5 text-[11px] font-bold text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-xl transition-colors inline-flex items-center justify-center space-x-1 mt-2"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>เปิด / ดาวน์โหลดไฟล์</span>
                        </a>
                      )}

                      {canDeleteAttachment(att) &&
                        (confirmDeleteAttId === att.id ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={isImageBusy}
                              onClick={() => handleDeleteAttachment(att)}
                              className="flex-1 py-1.5 text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl disabled:opacity-60 cursor-pointer"
                            >
                              ยืนยันลบรูปนี้
                            </button>
                            <button
                              type="button"
                              disabled={isImageBusy}
                              onClick={() => setConfirmDeleteAttId(null)}
                              className="px-3 py-1.5 text-[11px] font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer"
                            >
                              ยกเลิก
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={isImageBusy}
                            onClick={() => setConfirmDeleteAttId(att.id)}
                            className="w-full py-1.5 text-[11px] font-bold text-red-600 bg-white border border-red-200 hover:bg-red-50 rounded-xl inline-flex items-center justify-center space-x-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>ลบรูปนี้</span>
                          </button>
                        ))}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: History & Audit Logs */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-700">ประวัติการดำเนินงาน & บันทึกการทำแทนกัน:</h4>

              <div className="relative border-l-2 border-orange-200 ml-3 space-y-4 pl-4 py-1">
                {taskLogs.map(log => {
                  const isDelegated = log.actionByUserId !== log.onBehalfOfUserId;

                  return (
                    <div key={log.id} className="relative group">
                      <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-orange-500 ring-4 ring-white"></span>
                      <div className="bg-gray-50/80 p-3 rounded-2xl border border-gray-100 text-xs space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-gray-400">
                          <span className="font-bold text-gray-700">
                            {new Date(log.createdAt).toLocaleString('th-TH')}
                          </span>
                          <span className="bg-gray-200 text-gray-700 font-semibold px-2 py-0.5 rounded-full">
                            สถานะ: {log.newStatus}
                          </span>
                        </div>

                        {/* User Action / On Behalf */}
                        <div className="text-xs font-semibold text-gray-900 flex items-center space-x-1">
                          <span>{log.actionByUserName}</span>
                          {isDelegated && (
                            <span className="text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded-md text-[10px] font-bold">
                              (ทำแทน: {log.onBehalfOfUserName})
                            </span>
                          )}
                        </div>

                        {/* Comment */}
                        <p className="text-xs text-gray-600 pt-1 leading-relaxed">
                          {log.comment}
                        </p>

                        {/* Attached files count in this log */}
                        {log.attachments && log.attachments.length > 0 && (
                          <div className="pt-1.5 flex items-center space-x-2 text-[10px] text-amber-800">
                            <Paperclip className="w-3 h-3 text-amber-600" />
                            <span>แนบ {log.attachments.length} ไฟล์ในขั้นตอนนี้</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer / Review Controls */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors shrink-0"
          >
            ปิดหน้าต่าง
          </button>

          {/* Page 10 Requirement: Select Approver */}
          <div className="flex flex-wrap items-center space-x-2 gap-y-2">
            {(task.status === 'pending_submission' || task.status === 'returned') && (
              <div className="flex items-center space-x-1.5 bg-white border border-gray-200 px-2.5 py-1 rounded-xl">
                <span className="text-[11px] font-bold text-gray-600 shrink-0">ส่งให้ผู้อนุมัติ:</span>
                <select
                  value={selectedApproverId}
                  onChange={e => setSelectedApproverId(e.target.value)}
                  className="text-xs font-bold text-gray-800 bg-transparent focus:outline-none"
                >
                  {users
                    .filter(u => u.role === 'admin' || u.role === 'super_admin')
                    .map(u => (
                      <option key={u.id} value={u.id}>
                        {u.fullName?.replace(/\s*\([^)]*\)/g, '')}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* If task is pending_submission or returned, offer quick submit */}
            {(task.status === 'pending_submission' || task.status === 'returned') && (
              <button
                onClick={() => {
                  const missingReasonItem = task.checklists.find(
                    c => c.resultStatus === 'fail' && !c.resultReason?.trim()
                  );
                  if (missingReasonItem) {
                    setSystemPopup({
                      isOpen: true,
                      type: 'alert',
                      title: 'แจ้งเตือนการกรอกข้อมูล',
                      labelMessage: `กรุณากรอกเหตุผลสำหรับรายการ Checklist ที่เลือก "ไม่สำเร็จ": "${missingReasonItem.title}"`,
                      onConfirm: () => {},
                    });
                    return;
                  }
                  onClose();
                  onOpenSubmitModal(task);
                }}
                className="px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-all hover:opacity-90 flex items-center space-x-1 cursor-pointer"
                style={{ backgroundColor: '#ef6c00' }}
              >
                <Send className="w-3.5 h-3.5" />
                <span>ส่งตรวจงานใหม่</span>
              </button>
            )}

            {/* Admin review controls */}
            {task.status === 'pending_review' && canReview && (
              <>
                <button
                  onClick={() => {
                    setPopupComment('');
                    setSystemPopup({
                      isOpen: true,
                      type: 'return',
                      title: 'ตีกลับงาน',
                      labelMessage: 'ระบุเหตุผลการตีกลับ:',
                      onConfirm: (comment) => {
                        returnTask(task.id, comment || 'ข้อมูลส่งตรวจไม่สมบูรณ์');
                        onClose();
                      },
                    });
                  }}
                  className="px-3.5 py-2 text-xs font-bold text-white bg-red-700 hover:bg-red-800 rounded-xl transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 inline mr-1" />
                  ตีกลับ
                </button>
                <button
                  onClick={() => {
                    setPopupComment('');
                    setSystemPopup({
                      isOpen: true,
                      type: 'approve',
                      title: 'อนุมัติปิดงาน',
                      labelMessage: 'ระบุข้อความอนุมัติ (ถ้ามี):',
                      onConfirm: (comment) => {
                        approveTask(task.id, comment || 'อนุมัติเสร็จสมบูรณ์');
                        onClose();
                      },
                    });
                  }}
                  className="px-3.5 py-2 text-xs font-bold text-emerald-950 bg-emerald-300 hover:bg-emerald-400 rounded-xl transition-all cursor-pointer shadow-2xs"
                >
                  <CheckCircle className="w-3.5 h-3.5 inline mr-1" />
                  อนุมัติปิดงาน
                </button>
              </>
            )}
          </div>
        </div>

      </div>

      {/* Custom System Popup Dialog (Replacing native web window.prompt / window.alert) */}
      {systemPopup.isOpen && (
        <div className="fixed inset-0 z-70 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-gray-100 overflow-hidden p-6 space-y-4">
            
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-extrabold text-gray-900 flex items-center space-x-2">
                <span className={systemPopup.type === 'return' ? 'text-red-600' : 'text-teal-800'}>
                  {systemPopup.type === 'return' ? '🔄' : systemPopup.type === 'approve' ? '✅' : 'ℹ️'}
                </span>
                <span>{systemPopup.title}</span>
              </h3>
              <button
                onClick={() => setSystemPopup(prev => ({ ...prev, isOpen: false }))}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs font-bold text-gray-800 leading-relaxed">
              {systemPopup.labelMessage}
            </p>

            {systemPopup.type !== 'alert' && (
              <textarea
                rows={3}
                value={popupComment}
                onChange={e => setPopupComment(e.target.value)}
                placeholder={systemPopup.type === 'return' ? 'กรอกเหตุผลที่ต้องแก้ไข...' : 'กรอกข้อความอนุมัติเพิ่มเติม...'}
                className="w-full p-3 text-xs border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-600 bg-gray-50/50"
                autoFocus
              />
            )}

            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSystemPopup(prev => ({ ...prev, isOpen: false }))}
                className="px-6 py-2.5 text-xs font-black text-teal-950 bg-[#80deea] hover:bg-cyan-300 rounded-2xl transition-all cursor-pointer shadow-2xs"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  systemPopup.onConfirm(popupComment);
                  setSystemPopup(prev => ({ ...prev, isOpen: false }));
                }}
                className={`px-6 py-2.5 text-xs font-black text-white rounded-2xl shadow-md transition-all cursor-pointer ${
                  systemPopup.type === 'return'
                    ? 'bg-red-700 hover:bg-red-800'
                    : 'bg-[#004d40] hover:bg-teal-900'
                }`}
              >
                ตกลง
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ยืนยันลบการ์ดงาน — ลบสำเร็จแล้วปิด modal เพราะงานที่เปิดอยู่หายไปจาก state แล้ว */}
      {showDeleteConfirm && (
        <DeleteTaskConfirmModal
          code={task.code}
          title={task.title}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={() => {
            deleteTask(task.id);
            setShowDeleteConfirm(false);
            onClose();
          }}
        />
      )}

    </div>
  );
};
