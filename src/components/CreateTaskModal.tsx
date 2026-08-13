import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ProjectCategory, KUProposalStatus, Attachment } from '../types';
import { VoiceInputButton } from './VoiceInputButton';
import { OCRScannerModal } from './OCRScannerModal';
import { CreateFlowModal } from './CreateFlowModal';
import { X, Plus, Trash2, Calendar, User, Layers, FileText, Sparkles, Save, GraduationCap, PenTool, Briefcase, AlertTriangle, Upload, Image as ImageIcon, Paperclip, Search, ChevronDown, Check, FolderPlus, Folder, ArrowUp, ArrowDown } from 'lucide-react';

interface CreateTaskModalProps {
  onClose: () => void;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ onClose }) => {
  const { createTask, saveTaskDraft, projects, users, currentUser, addProject, flowTemplates, tasks } = useApp();

  const generateTaskCode = (cat: ProjectCategory) => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    const dateStr = `${month}/${year}`;
    const seq = String(tasks.length + 1).padStart(3, '0');

    if (cat === 'ku_university') {
      return `#PJ-${dateStr}-${seq}`;
    } else if (cat === 'drawing_draft') {
      return `#DWG-${dateStr}-${seq}`;
    } else {
      return `#NP-${dateStr}-${seq}`;
    }
  };

  const [category, setCategory] = useState<ProjectCategory>('general');
  const [taskCode, setTaskCode] = useState<string>(() => generateTaskCode('general'));
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFlowId, setSelectedFlowId] = useState<string>('');
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [projectSearchQuery, setProjectSearchQuery] = useState(
    projects.find(p => p.id === (projects[0]?.id || ''))?.name || projects[0]?.name || ''
  );
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);

  const [assignedToUserId, setAssignedToUserId] = useState(currentUser?.id || users[0]?.id || '');
  const [assignedTargetUserId, setAssignedTargetUserId] = useState<string>('');
  const [planDays, setPlanDays] = useState<number>(3);
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  });

  const [checklists, setChecklists] = useState<string[]>(['รวบรวมข้อมูลและรายละเอียดงาน', 'ดำเนินการพัฒนาและทดสอบ']);
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [showCreateFlowModal, setShowCreateFlowModal] = useState(false);

  // Attached Image 1 state for drawing/general task creation
  const [attachedImage1Url, setAttachedImage1Url] = useState<string>('');
  const [attachedImage1Name, setAttachedImage1Name] = useState<string>('');

  const handleStartDateChange = (newStart: string) => {
    setStartDate(newStart);
    if (newStart && dueDate) {
      const startMs = new Date(newStart).getTime();
      const dueMs = new Date(dueDate).getTime();
      const days = Math.max(1, Math.round((dueMs - startMs) / (1000 * 60 * 60 * 24)));
      setPlanDays(days);
    }
  };

  const handleDueDateChange = (newDue: string) => {
    setDueDate(newDue);
    if (startDate && newDue) {
      const startMs = new Date(startDate).getTime();
      const dueMs = new Date(newDue).getTime();
      const days = Math.max(1, Math.round((dueMs - startMs) / (1000 * 60 * 60 * 24)));
      setPlanDays(days);
    }
  };

  const handlePlanDaysChange = (days: number) => {
    const validDays = Math.max(1, days);
    setPlanDays(validDays);
    if (startDate) {
      const startD = new Date(startDate);
      startD.setDate(startD.getDate() + validDays);
      setDueDate(startD.toISOString().slice(0, 10));
    }
  };

  const handleAddChecklist = () => {
    if (newChecklistTitle.trim()) {
      setChecklists([...checklists, newChecklistTitle.trim()]);
      setNewChecklistTitle('');
    }
  };

  const handleRemoveChecklist = (index: number) => {
    setChecklists(checklists.filter((_, i) => i !== index));
  };

  const handleMoveChecklistUp = (index: number) => {
    if (index === 0) return;
    const updated = [...checklists];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    setChecklists(updated);
  };

  const handleMoveChecklistDown = (index: number) => {
    if (index === checklists.length - 1) return;
    const updated = [...checklists];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    setChecklists(updated);
  };

  const handleSelectCategory = (cat: ProjectCategory) => {
    setCategory(cat);
    setTaskCode(generateTaskCode(cat));
    if (cat === 'ku_university') {
      if (!title) {
        setTitle('ข้อเสนอโครงการวิจัยและพัฒนาระบบข้อมูล');
      }
      setChecklists([
        '1. เขียนข้อเสนอ — ร่าง (จัดทำข้อเสนอฉบับแรก)',
        '2. อาจารย์หนุ่ยเปิด (เปิดอ่านและให้ข้อเสนอแนะ)',
        '3. พลอยปรับแก้ (แก้ข้อเสนอตามความคิดเห็น)',
        '4. รออาจารย์หนุ่ยอนุมัติ (ตรวจฉบับพร้อมส่ง)',
        '5. พลอยกรอกข้อมูลเข้าระบบ (บันทึกข้อมูลและเอกสาร)',
        '6. รอหน่วยงานพิจารณา (ติดตามผลภายในกรอบเวลา)',
        '7. ผ่าน — กลับมาแก้ข้อมูล (แก้ไขและส่งกลับหน่วยงาน)',
        '8. ติดตามข้อมูลจากพี่ฟ้อง (พลอยส่งรายละเอียดและติดตาม)',
        '9. อนุมัติ — เริ่มรันงวด (รับ TOR และเปิดแผนส่งมอบตามงวด)',
      ]);
    } else if (cat === 'drawing_draft') {
      if (!title) {
        setTitle('งานเขียนแบบโครงสร้างและพิมพ์เขียว 3D');
      }
      // Auto open and set preset drawing image 1 if not attached yet
      if (!attachedImage1Url) {
        setAttachedImage1Url('https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80');
        setAttachedImage1Name('blueprint_3d_steamer_model.png');
      }
      setChecklists([
        '1. ตรวจสอบรายละเอียดและข้อกำหนดงานเขียนแบบ',
        '2. จัดทำแบบร่างและภาพที่ 1 ฉบับสมบูรณ์',
        '3. ส่งแบบให้ทีมวิศวกรและผู้ตรวจทานคอมเมนต์',
      ]);
    }
  };

  const buildAttachments = (): Attachment[] => {
    if (!attachedImage1Url) return [];
    return [
      {
        id: `att-${Date.now()}-1`,
        taskId: '',
        fileName: attachedImage1Name || 'drawing_plan_image_1.jpg',
        fileUrl: attachedImage1Url,
        fileType: 'image',
        fileSize: 2500000,
        uploadedBy: currentUser?.fullName || 'ผู้ใช้งาน',
        uploadedAt: new Date().toISOString(),
      },
    ];
  };

  const resolveTargetProjectId = async (): Promise<string> => {
    const trimmedQuery = projectSearchQuery.trim();
    if (!trimmedQuery) return projectId || projects[0]?.id || '';

    const currentProj = projects.find(p => p.id === projectId);
    if (currentProj && currentProj.name.trim().toLowerCase() === trimmedQuery.toLowerCase()) {
      return currentProj.id;
    }

    const matched = projects.find(p => p.name.trim().toLowerCase() === trimmedQuery.toLowerCase());
    if (matched) {
      return matched.id;
    }

    const created = await addProject(trimmedQuery);
    return created.id;
  };

  const handleSelectProject = (projId: string, projName: string) => {
    setProjectId(projId);
    setProjectSearchQuery(projName);
    setIsProjectDropdownOpen(false);
  };

  const handleAddNewProject = async () => {
    if (!projectSearchQuery.trim()) return;
    const newProj = await addProject(projectSearchQuery.trim());
    setProjectId(newProj.id);
    setProjectSearchQuery(newProj.name);
    setIsProjectDropdownOpen(false);
  };

  const handleSaveDraft = async () => {
    const targetProjId = await resolveTargetProjectId();
    saveTaskDraft({
      title,
      description,
      projectId: targetProjId,
      assignedToUserId,
      planDays,
      category,
      isDraft: true,
    });
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!startDate || !dueDate || !planDays || planDays < 1) {
      alert('กรุณาระบุกำหนดเวลาปฏิบัติงานให้ครบถ้วน');
      return;
    }

    const targetProjId = await resolveTargetProjectId();

    createTask({
      code: taskCode,
      title: title.trim() || 'การ์ดงานใหม่',
      description: description.trim(),
      projectId: targetProjId,
      assignedToUserId,
      assignedTargetUserId: assignedTargetUserId || undefined,
      planDays,
      category,
      checklists,
      attachments: buildAttachments(),
      isDraft: false,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-gray-100 overflow-hidden my-4 sm:my-8 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0" style={{ backgroundColor: '#ffcc80' }}>
          <h3 className="font-extrabold text-sm sm:text-base text-amber-950">
            สร้างการ์ดงานใหม่ (New Task Card)
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/50 text-amber-950 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          
          {/* Category Selector */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-gray-800">
              ประเภทโครงการ / หมวดหมู่งาน
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleSelectCategory('general')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center space-x-1 ${
                  category === 'general'
                    ? 'bg-orange-500 text-white border-orange-600 shadow-xs'
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>โปรเจคทั่วไป</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectCategory('ku_university')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center space-x-1 ${
                  category === 'ku_university'
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm ring-2 ring-emerald-400'
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>งานโครงการ</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectCategory('drawing_draft')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center space-x-1 ${
                  category === 'drawing_draft'
                    ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>เขียนแบบ/ภาพ</span>
              </button>
            </div>
          </div>

          {/* Task Card Code Display (Read-Only Auto Generated) */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-gray-800 flex items-center justify-between">
              <span>รหัสการ์ดงาน</span>
              <span className="text-[10px] text-gray-500 font-normal">(Run ออโต้ ไม่สามารถแก้ไขได้)</span>
            </label>
            <input
              type="text"
              value={taskCode}
              readOnly
              disabled
              className="w-full px-3.5 py-2 text-xs font-extrabold border border-gray-200 rounded-xl bg-gray-100 text-gray-800 cursor-not-allowed select-none shadow-inner"
            />
          </div>

          {/* Project & Assignee */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 z-30">
            {/* Searchable & Creatable Project Combobox */}
            <div className="relative space-y-1">
              <label className="block text-xs font-bold text-gray-800 flex items-center justify-between">
                <span>โครงการ (Project) <span className="text-red-500">*</span></span>
              </label>
              <div className="relative">
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="ค้นหาหรือพิมพ์เพิ่มโครงการใหม่..."
                    value={projectSearchQuery}
                    onChange={e => {
                      setProjectSearchQuery(e.target.value);
                      setIsProjectDropdownOpen(true);
                    }}
                    onFocus={() => setIsProjectDropdownOpen(true)}
                    className="w-full pl-8 pr-14 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white font-medium"
                  />
                  {projectSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setProjectSearchQuery('');
                        setProjectId('');
                        setIsProjectDropdownOpen(true);
                      }}
                      className="absolute right-7 p-1 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
                      title="ลบออกเพื่อเลือกโครงการใหม่"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
                    className="absolute right-2 p-1 text-gray-400 hover:text-gray-600 rounded-md cursor-pointer"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Dropdown Menu */}
                {isProjectDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsProjectDropdownOpen(false)}
                    />
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 max-h-52 overflow-y-auto py-1">
                      {/* Option to create new project if typed text doesn't match an existing project */}
                      {projectSearchQuery.trim() && !projects.some(p => p.name.trim().toLowerCase() === projectSearchQuery.trim().toLowerCase()) && (
                        <button
                          type="button"
                          onClick={handleAddNewProject}
                          className="w-full text-left px-3 py-2 bg-orange-50 hover:bg-orange-100 text-orange-950 border-b border-orange-100 flex items-center space-x-2 text-xs font-bold transition-colors cursor-pointer"
                        >
                          <FolderPlus className="w-4 h-4 text-orange-600 shrink-0" />
                          <span className="truncate">➕ เพิ่มโครงการใหม่: "{projectSearchQuery.trim()}"</span>
                        </button>
                      )}

                      {projects
                        .filter(p =>
                          p.name.toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
                          (p.code && p.code.toLowerCase().includes(projectSearchQuery.toLowerCase()))
                        )
                        .map(p => {
                          const isSelected = p.id === projectId && p.name.trim().toLowerCase() === projectSearchQuery.trim().toLowerCase();
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => handleSelectProject(p.id, p.name)}
                              className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-amber-100/70 text-amber-950 font-bold'
                                  : 'text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center space-x-2 truncate">
                                <Folder className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-700' : 'text-gray-400'}`} />
                                <span className="truncate">{p.name}</span>
                              </div>
                              {isSelected && <Check className="w-3.5 h-3.5 text-amber-700 shrink-0 ml-1" />}
                            </button>
                          );
                        })}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Assignee */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-gray-800">
                ผู้รับผิดชอบหลัก <span className="text-red-500">*</span>
              </label>
              <select
                value={assignedToUserId}
                onChange={e => setAssignedToUserId(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white font-medium"
              >
                {users
                  .filter(u => u.status === 'approved')
                  .map(u => (
                    <option key={u.id} value={u.id}>
                      {u.fullName?.replace(/\s*\([^)]*\)/g, '')}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-gray-800">
                ชื่องาน <span className="text-red-500">*</span>
              </label>
              {/* Quick Title Presets */}
              <div className="flex items-center space-x-1">
                <span className="text-[10px] text-gray-400">เลือกเร็ว:</span>
                <button
                  type="button"
                  onClick={() => setTitle('เครื่องบ่ม13')}
                  className="text-[10px] font-bold px-2 py-0.5 bg-orange-100 hover:bg-orange-200 text-orange-900 rounded-md transition-colors border border-orange-200"
                >
                  เครื่องบ่ม13
                </button>
                <button
                  type="button"
                  onClick={() => setTitle('งานเขียนแบบโครงสร้างและพิมพ์เขียว 3D')}
                  className="text-[10px] font-bold px-2 py-0.5 bg-purple-100 hover:bg-purple-200 text-purple-900 rounded-md transition-colors border border-purple-200"
                >
                  แบบ 3D
                </button>
                <button
                  type="button"
                  onClick={() => setTitle('สอบราคาอุปกรณ์ก่อสร้าง')}
                  className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-900 rounded-md transition-colors border border-blue-200"
                >
                  สอบราคา
                </button>
              </div>
            </div>
            <input
              type="text"
              placeholder="ระบุชื่องาน เช่น เครื่องบ่ม13..."
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 font-bold"
              required
            />
          </div>

          {/* Image 1 Attachment Box (ONLY for Drawing Draft cards) */}
          {category === 'drawing_draft' && (
            <div
              className="p-3.5 rounded-2xl border transition-all space-y-3 bg-purple-50/80 border-purple-300 ring-2 ring-purple-200/50"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-black text-gray-900 flex items-center space-x-1.5">
                  <Upload className="w-4 h-4 text-purple-600" />
                  <span>แนบรูปภาพ / แบบเขียนภาพที่ 1</span>
                  <span className="text-[10px] font-black text-purple-800 bg-purple-100 border border-purple-200 px-2 py-0.5 rounded-md">
                    เน้นแนบภาพที่ 1 สำหรับการ์ดเขียนแบบ
                  </span>
                </label>

                {/* Preset Sample Picker for Fast Testing */}
                <div className="flex items-center space-x-1">
                  <span className="text-[10px] text-gray-400 hidden sm:inline">เลือกตัวอย่าง:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachedImage1Url('https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80');
                      setAttachedImage1Name('blueprint_3d_steamer_model.png');
                    }}
                    className="text-[10px] font-bold px-2 py-0.5 bg-white border border-gray-200 hover:border-purple-400 text-gray-700 rounded-md transition-colors"
                  >
                    แบบ 3D
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachedImage1Url('https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=800&q=80');
                      setAttachedImage1Name('circuit_diagram_draft1.jpg');
                    }}
                    className="text-[10px] font-bold px-2 py-0.5 bg-white border border-gray-200 hover:border-purple-400 text-gray-700 rounded-md transition-colors"
                  >
                    แบบวงจร
                  </button>
                </div>
              </div>

              {/* Attached Preview Box vs Dropzone */}
              {attachedImage1Url ? (
                <div className="relative group bg-white border border-purple-200 rounded-xl p-2.5 flex items-center space-x-3 shadow-2xs">
                  <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 shrink-0 bg-gray-100">
                    <img
                      src={attachedImage1Url}
                      alt="แบบภาพที่ 1"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[9px] text-center font-black py-0.5">
                      ภาพที่ 1
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-1">
                      <span className="text-[10px] font-extrabold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">
                        ภาพที่ 1 (ภาพแบบหลัก)
                      </span>
                    </div>
                    <p className="text-xs font-bold text-gray-800 truncate mt-0.5">
                      {attachedImage1Name || 'drawing_plan_image_1.jpg'}
                    </p>
                    <p className="text-[10px] text-gray-400">ขนาด: ~2.5 MB • แนบไฟล์พร้อมสำหรับการ์ดงานแล้ว</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setAttachedImage1Url('');
                      setAttachedImage1Name('');
                    }}
                    className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                    title="ลบรูปภาพ"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative border-2 border-dashed border-purple-200 hover:border-purple-400 bg-white rounded-xl p-3.5 text-center transition-all">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setAttachedImage1Name(file.name);
                        setAttachedImage1Url(URL.createObjectURL(file));
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="space-y-1 pointer-events-none">
                    <div className="w-8 h-8 mx-auto rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
                      <Upload className="w-4 h-4" />
                    </div>
                    <p className="text-xs font-bold text-gray-800">
                      คลิกเพื่อเลือกภาพ หรือ<span className="text-purple-600 font-black">ลากไฟล์มาวาง (ภาพที่ 1)</span>
                    </p>
                    <p className="text-[10px] text-gray-400">
                      รองรับไฟล์ภาพ JPG, PNG, WEBP หรือคลิกปุ่มเลือกตัวอย่างแบบข้างบน
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Target Assignment (ส่งต่อให้ใคร (ถ้ามี)) */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-gray-800">
              ส่งต่อให้ใคร (ถ้ามี)
            </label>
            <select
              value={assignedTargetUserId}
              onChange={e => setAssignedTargetUserId(e.target.value)}
              className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
            >
              <option value="">ไม่ระบุผู้รับมอบหมายปลายทาง</option>
              {users
                .filter(u => u.status === 'approved')
                .map(u => (
                  <option key={u.id} value={u.id}>
                    ส่งต่อให้: {u.fullName}
                  </option>
                ))}
            </select>
          </div>

          {/* Planned Duration Days & Date Range Calculation (บังคับกรอก) */}
          <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-amber-950 flex items-center space-x-1.5">
                <Calendar className="w-4 h-4 text-amber-600" />
                <span>กำหนดเวลาปฏิบัติงาน <span className="text-red-500">*</span></span>
              </label>
              <span className="text-[10px] font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200">
                {planDays} วันแผนงาน
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-gray-700 mb-1">
                  ว/ด/ป ที่เริ่ม (Default) <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  required
                  onChange={e => handleStartDateChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-xl bg-white font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-700 mb-1">
                  ว/ด/ป ที่กำหนดส่ง <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={dueDate}
                  required
                  onChange={e => handleDueDateChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-xl bg-white font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-700 mb-1">
                  จำนวนวันแผนงาน <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  required
                  value={planDays}
                  onChange={e => handlePlanDaysChange(parseInt(e.target.value) || 1)}
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-xl bg-white font-black text-orange-950 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-gray-800">
                รายละเอียดขอบเขตงาน
              </label>
              <VoiceInputButton
                onTranscript={t => setDescription(prev => (prev ? `${prev}\n${t}` : t))}
                buttonText="พูดรายละเอียด"
              />
            </div>
            <textarea
              rows={2}
              placeholder="อธิบายรายละเอียดหรือสิ่งที่ต้องส่งมอบ..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Checklist Generator & Reorder Controls (per Image 2 requirement: ปรับเป็น Dropdown) */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <label className="block text-xs font-bold text-gray-800">
                รายการ
              </label>

              {/* Flow Selector Dropdown */}
              <div className="flex items-center space-x-1.5 shrink-0">
                <span className="text-[11px] font-bold text-purple-900 shrink-0">เลือก Flow:</span>
                <select
                  value={selectedFlowId}
                  onChange={e => {
                    const flowId = e.target.value;
                    setSelectedFlowId(flowId);
                    const flow = flowTemplates.find(f => f.id === flowId);
                    if (flow) {
                      setChecklists([...flow.checklists]);
                      if (flow.category) setCategory(flow.category);
                      if (!title) setTitle(flow.name);
                    }
                  }}
                  className="px-2.5 py-1 text-xs font-extrabold bg-purple-50 text-purple-950 border border-purple-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer max-w-[200px] sm:max-w-xs truncate shadow-2xs"
                >
                  <option value="">-- เลือก Flow งานที่ต้องการ --</option>
                  {flowTemplates.map(flow => (
                    <option key={flow.id} value={flow.id}>
                      {flow.name} ({flow.checklists.length} ขั้นตอน)
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowCreateFlowModal(true)}
                  className="px-2.5 py-1 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-[11px] font-bold shadow-2xs transition-colors flex items-center space-x-1 shrink-0"
                  title="สร้าง Flow งานใหม่"
                >
                  <Plus className="w-3 h-3" />
                  <span>สร้าง Flow</span>
                </button>
              </div>
            </div>


            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="เพิ่มหัวข้อ checklist..."
                value={newChecklistTitle}
                onChange={e => setNewChecklistTitle(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddChecklist();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddChecklist}
                className="px-3 py-1.5 text-xs font-bold text-orange-900 bg-amber-200 hover:bg-amber-300 rounded-xl transition-colors cursor-pointer"
              >
                เพิ่ม
              </button>
            </div>

            <div className="space-y-1 max-h-32 overflow-y-auto pt-1">
              {checklists.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-xl text-xs gap-2">
                  <span className="text-gray-800 font-medium truncate flex-1">
                    <strong className="text-amber-800 mr-1.5">{idx + 1}.</strong> {item}
                  </span>

                  <div className="flex items-center space-x-1 shrink-0">
                    {/* Move Up */}
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveChecklistUp(idx)}
                      className={`p-1 rounded-md transition-colors ${
                        idx === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                      }`}
                      title="เลื่อนขึ้น"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>

                    {/* Move Down */}
                    <button
                      type="button"
                      disabled={idx === checklists.length - 1}
                      onClick={() => handleMoveChecklistDown(idx)}
                      className={`p-1 rounded-md transition-colors ${
                        idx === checklists.length - 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                      }`}
                      title="เลื่อนลง"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => handleRemoveChecklist(idx)}
                      className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors ml-1"
                      title="ลบข้อนี้"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Submit buttons */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
            <button
              type="button"
              onClick={handleSaveDraft}
              className="px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold flex items-center space-x-1 transition-all"
              title="บันทึกร่างไว้ก่อนแม้ยังกรอกไม่ครบ"
            >
              <Save className="w-3.5 h-3.5" />
              <span>บันทึกเป็นร่าง (Draft)</span>
            </button>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold text-white rounded-xl shadow-md transition-all hover:opacity-90"
                style={{ backgroundColor: '#ef6c00' }}
              >
                บันทึกและสร้างการ์ดงาน
              </button>
            </div>
          </div>

        </form>

        <OCRScannerModal
          isOpen={showOcrModal}
          onClose={() => setShowOcrModal(false)}
          onApplyText={t => setDescription(prev => (prev ? `${prev}\n\n${t}` : t))}
        />

        {showCreateFlowModal && (
          <CreateFlowModal
            onClose={() => setShowCreateFlowModal(false)}
            onSuccess={(newFlowId, createdFlow) => {
              setSelectedFlowId(newFlowId);
              if (createdFlow) {
                setChecklists([...createdFlow.checklists]);
                if (createdFlow.category) setCategory(createdFlow.category);
                if (!title) setTitle(createdFlow.name);
              }
              setShowCreateFlowModal(false);
            }}
          />
        )}

      </div>
    </div>
  );
};
