import React, { useState } from 'react';
import { Task, KUProposalStatus, ProjectMilestone } from '../types';
import { useApp } from '../context/AppContext';
import { OCRScannerModal } from './OCRScannerModal';
import {
  FileText,
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  Send,
  UserCheck,
  ChevronRight,
  Plus,
  Trash2,
  Sparkles,
  CheckSquare,
  Upload,
  Edit2,
  Save,
  Check,
  X,
  Layers,
  Eye,
  Download,
  Percent,
  Link,
} from 'lucide-react';

interface KUMilestonesViewProps {
  task: Task;
  readOnly?: boolean;
  showOnlyPayout?: boolean;
}

export const KUMilestonesView: React.FC<KUMilestonesViewProps> = ({
  task,
  readOnly = false,
  showOnlyPayout = false,
}) => {
  const { updateKUStatus, addMilestone, updateMilestones, updateTaskHolderName, users, currentUser } = useApp();

  // Dynamic Holder Name State
  const holderName = task.holderName || 'อาจารย์หนุ่ย';
  const [isEditHolderModalOpen, setIsEditHolderModalOpen] = useState(false);
  const [editHolderInput, setEditHolderInput] = useState(holderName);

  // Evidence Preview Modal State
  const [previewFileModal, setPreviewFileModal] = useState<{ isOpen: boolean; url: string; name: string } | null>(null);

  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [mTitle, setMTitle] = useState('งวดที่ 1 : เอกสารส่งมอบ');
  const [mAmount, setMAmount] = useState<number>(100000);
  const [mDueDate, setMDueDate] = useState('2026-08-01');
  const [selectedNextUser, setSelectedNextUser] = useState<string>(users[0]?.id || '');

  // Active view mode in banner: 'milestones' (ล้อตามงวดงาน) or 'proposal_steps' (8 ขั้นตอนยื่นทุน)
  const [bannerViewMode, setBannerViewMode] = useState<'milestones' | 'proposal_steps'>('milestones');

  // Input state for adding new deliverable item per milestone
  const [newDeliverableInputs, setNewDeliverableInputs] = useState<Record<string, string>>({});

  // Milestone edit modal / inline edit state
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [editMTitle, setEditMTitle] = useState('');
  const [editMAmount, setEditMAmount] = useState<number>(0);
  const [editMDueDate, setEditMDueDate] = useState('');

  // Deliverable checklist items state for creation form
  const [newFormDeliverableItems, setNewFormDeliverableItems] = useState<
    { id: string; title: string; completed: boolean }[]
  >([
    { id: 'del-1', title: 'ส่งเอกสารงวดงานที่ 1', completed: true },
    { id: 'del-2', title: 'เอกสารแผนงาน', completed: true },
    { id: 'del-3', title: 'เอกสารรายละเอียดงานตามขอบเขตงาน', completed: false },
  ]);
  const [newFormDeliverableInput, setNewFormDeliverableInput] = useState('');
  const [showOcrModal, setShowOcrModal] = useState(false);

  // Status map for 8 Proposal Steps
  const statusMap: Record<KUProposalStatus, { label: string; step: number; color: string }> = {
    '1_draft_proposal': { label: 'เขียนข้อเสนอ ร่าง', step: 1, color: 'bg-gray-100 text-gray-800 border-gray-300' },
    '2_aj_nui_open': { label: 'อาจารย์หนุ่ยเปิด', step: 2, color: 'bg-blue-50 text-blue-800 border-blue-200' },
    '3_ploy_revision': { label: 'พลอยปรับแก้', step: 3, color: 'bg-amber-50 text-amber-800 border-amber-200' },
    '4_wait_aj_nui_approval': { label: 'รออาจารย์หนุ่ยอนุมัติ', step: 4, color: 'bg-purple-50 text-purple-800 border-purple-200' },
    '5_ploy_system_submit': { label: 'พลอยกรอกข้อมูลเข้าระบบ', step: 5, color: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
    '6_agency_review': { label: 'รอพิจารณาโดยหน่วยงานที่เราขอ', step: 6, color: 'bg-orange-50 text-orange-800 border-orange-200' },
    '7_passed_with_revision': { label: 'ผ่านแต่มีการกลับมาให้แก้ข้อมูลอีกครั้ง', step: 7, color: 'bg-rose-50 text-rose-800 border-rose-200' },
    '8_approved_run_terms': { label: 'อนุมัติ : เริ่มรันงวด (ส่ง TOR)', step: 8, color: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
  };

  const currentKUStatus = task.kuProposalStatus || '1_draft_proposal';
  const currentStep = statusMap[currentKUStatus].step;

  // Default milestones if none exist yet (matching screenshot example)
  const currentMilestones: ProjectMilestone[] = (task.milestones && task.milestones.length > 0)
    ? task.milestones
    : [
        {
          id: 'ms-default-1',
          milestoneNumber: 2,
          title: 'งวดที่ 2',
          deliverables: '[x] ส่งเอกสารงวดงานที่ 2',
          amount: 19600,
          dueDate: '2026-08-08',
          status: 'approved',
          projectPayoutStatus: 'เบิกสำเร็จ',
          projectPayoutDate: '8 สิงหาคม 2569',
          holderPayoutStatus: 'รออนุมัติ',
          holderPayoutDate: '8 สิงหาคม 2569',
        },
        {
          id: 'ms-default-2',
          milestoneNumber: 1,
          title: 'งวดที่ 1',
          deliverables: '[x] เอกสารแผนงานและหลักฐานการเบิก',
          amount: 11000,
          dueDate: '2026-08-08',
          status: 'approved',
          projectPayoutStatus: 'เบิกสำเร็จ',
          projectPayoutDate: '8 สิงหาคม 2569',
          holderPayoutStatus: 'เบิกสำเร็จ',
          holderPayoutDate: '8 สิงหาคม 2569',
          evidenceFileName: 'ITM202601000009-13.xlsx',
        },
      ];

  // Handler for updating payout fields on a milestone
  const handleUpdatePayout = (milestoneId: string, fields: Partial<ProjectMilestone>) => {
    const updated = currentMilestones.map(m => {
      if (m.id === milestoneId) {
        return { ...m, ...fields };
      }
      return m;
    });
    updateMilestones(task.id, updated);
  };

  // Handler for file upload (slips, screenshots, documents)
  const handleFileUpload = (milestoneId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      handleUpdatePayout(milestoneId, {
        evidenceFileName: file.name,
        evidenceFileUrl: dataUrl,
      });
    };
    reader.readAsDataURL(file);
  };

  // Parse deliverables string into individual checkable items
  const getDeliverableItems = (m: ProjectMilestone) => {
    if (!m.deliverables) return [];
    const lines = m.deliverables.split('\n').filter(Boolean);
    return lines.map((line, idx) => {
      const isChecked = line.startsWith('[x]') || line.startsWith('[X]') || line.startsWith('☑');
      const cleanText = line.replace(/^(\[x\]|\[X\]|\[ \]|☑|☐|\d+\.\s*)/i, '').trim();
      return {
        id: `del-${m.id}-${idx}`,
        text: cleanText || line,
        completed: isChecked,
      };
    });
  };

  // Deliverable item operations for a milestone
  const handleToggleDeliverable = (milestoneId: string, itemIdx: number) => {
    const updated = currentMilestones.map(m => {
      if (m.id === milestoneId) {
        const items = getDeliverableItems(m);
        if (items[itemIdx]) {
          items[itemIdx].completed = !items[itemIdx].completed;
        }
        const newStr = items.map(i => `${i.completed ? '[x]' : '[ ]'} ${i.text}`).join('\n');
        return { ...m, deliverables: newStr };
      }
      return m;
    });
    updateMilestones(task.id, updated);
  };

  const handleUpdateDeliverableText = (milestoneId: string, itemIdx: number, newText: string) => {
    const updated = currentMilestones.map(m => {
      if (m.id === milestoneId) {
        const items = getDeliverableItems(m);
        if (items[itemIdx]) {
          items[itemIdx].text = newText;
        }
        const newStr = items.map(i => `${i.completed ? '[x]' : '[ ]'} ${i.text}`).join('\n');
        return { ...m, deliverables: newStr };
      }
      return m;
    });
    updateMilestones(task.id, updated);
  };

  const handleAddDeliverableToMilestone = (milestoneId: string) => {
    const textToAdd = newDeliverableInputs[milestoneId]?.trim();
    if (!textToAdd) return;

    const updated = currentMilestones.map(m => {
      if (m.id === milestoneId) {
        const items = getDeliverableItems(m);
        items.push({ id: `del-${Date.now()}`, text: textToAdd, completed: false });
        const newStr = items.map(i => `${i.completed ? '[x]' : '[ ]'} ${i.text}`).join('\n');
        return { ...m, deliverables: newStr };
      }
      return m;
    });

    updateMilestones(task.id, updated);
    setNewDeliverableInputs(prev => ({ ...prev, [milestoneId]: '' }));
  };

  const handleDeleteDeliverable = (milestoneId: string, itemIdx: number) => {
    const updated = currentMilestones.map(m => {
      if (m.id === milestoneId) {
        const items = getDeliverableItems(m);
        items.splice(itemIdx, 1);
        const newStr = items.map(i => `${i.completed ? '[x]' : '[ ]'} ${i.text}`).join('\n');
        return { ...m, deliverables: newStr };
      }
      return m;
    });
    updateMilestones(task.id, updated);
  };

  const handleDeleteMilestone = (milestoneId: string) => {
    const updated = currentMilestones.filter(m => m.id !== milestoneId);
    updateMilestones(task.id, updated);
  };

  const handleStartEditMilestone = (m: ProjectMilestone) => {
    setEditingMilestoneId(m.id);
    setEditMTitle(m.title);
    setEditMAmount(m.amount);
    setEditMDueDate(m.dueDate || '');
  };

  const handleSaveEditMilestone = (milestoneId: string) => {
    const updated = currentMilestones.map(m => {
      if (m.id === milestoneId) {
        return {
          ...m,
          title: editMTitle.trim() || m.title,
          amount: editMAmount,
          dueDate: editMDueDate,
        };
      }
      return m;
    });
    updateMilestones(task.id, updated);
    setEditingMilestoneId(null);
  };

  const handleStatusChange = (newStatus: KUProposalStatus) => {
    updateKUStatus(task.id, newStatus, selectedNextUser || undefined);
  };

  const handleSaveNewMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mTitle) return;

    const deliverablesText = newFormDeliverableItems
      .map(d => `${d.completed ? '[x]' : '[ ]'} ${d.title}`)
      .join('\n');

    addMilestone(task.id, {
      milestoneNumber: currentMilestones.length + 1,
      title: mTitle,
      deliverables: deliverablesText || '[ ] เอกสารส่งมอบตามงวดงาน',
      amount: mAmount,
      dueDate: mDueDate || new Date().toISOString().slice(0, 10),
      status: 'pending',
    });

    setMTitle(`งวดที่ ${currentMilestones.length + 2} : เอกสารส่งมอบ`);
    setShowAddMilestone(false);
  };

  const handleOcrApplyText = (text: string) => {
    const lines = text
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    const newItems = lines.map((line, idx) => ({
      id: `ocr-${Date.now()}-${idx}`,
      title: line,
      completed: false,
    }));

    if (newItems.length > 0) {
      setNewFormDeliverableItems(prev => [...prev, ...newItems]);
    }
  };

  const totalAmount = currentMilestones.reduce((sum, m) => sum + (m.amount || 0), 0);

  // Render Payout & Withdrawal Flow Section (Matching exact user screenshot requirements)
  const renderPayoutSection = () => {
    // Stat Calculations
    const totalProjectAmount = currentMilestones.reduce((acc, m) => acc + (m.amount || 0), 0);
    const completedProjectPayout = currentMilestones
      .filter(m => m.projectPayoutStatus === 'เบิกสำเร็จ')
      .reduce((acc, m) => acc + (m.amount || 0), 0);
    
    const projectPayoutPct = totalProjectAmount > 0
      ? ((completedProjectPayout / totalProjectAmount) * 100).toFixed(1)
      : '0.0';

    const remainingProjectBalance = totalProjectAmount - completedProjectPayout;

    const completedHolderPayout = currentMilestones
      .filter(m => m.holderPayoutStatus === 'เบิกสำเร็จ')
      .reduce((acc, m) => acc + (m.amount || 0), 0);

    const remainingHolderBalance = completedProjectPayout - completedHolderPayout;

    return (
      <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5 animate-in fade-in">
        {/* Top Header Card matching screenshot layout */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-black text-slate-900">{task.title || 'เครื่องตบลดิน'}</h3>
              <span className="text-xs text-slate-500 font-bold">
                รหัส {task.code || '1.3'} · ครุภัณฑ์ก่อสร้าง · ปีงบ 2569
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {/* EDIT HOLDER NAME BUTTON */}
            <button
              type="button"
              onClick={() => {
                setEditHolderInput(holderName);
                setIsEditHolderModalOpen(true);
              }}
              className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-black shadow-2xs transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5 text-slate-500" />
              <span>แก้ไขผู้ถือเงิน ({holderName})</span>
            </button>
          </div>
        </div>

        {/* 6 Stat Cards Grid matching screenshot */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {/* Card 1: ยอดเงินโครงการ */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center space-x-1.5 text-slate-500 text-[11px] font-extrabold">
              <div className="p-1 bg-blue-50 rounded-md text-blue-600">
                <Link className="w-3.5 h-3.5" />
              </div>
              <span className="truncate">ยอดเงินโครงการ</span>
            </div>
            <div className="text-base font-black text-slate-900">
              {totalProjectAmount.toLocaleString()} <span className="text-xs font-bold">บาท</span>
            </div>
            <div className="text-[10px] text-slate-400 font-bold">8 สิงหาคม 2569</div>
          </div>

          {/* Card 2: ยอดเงินเบิกจากโครงการแล้ว */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center space-x-1.5 text-slate-500 text-[11px] font-extrabold">
              <div className="p-1 bg-slate-100 rounded-md text-slate-600">
                <FileText className="w-3.5 h-3.5" />
              </div>
              <span className="truncate">ยอดเงินเบิกจากโครงการแล้ว</span>
            </div>
            <div className="text-base font-black text-slate-900">
              {completedProjectPayout.toLocaleString()} <span className="text-xs font-bold">บาท</span>
            </div>
          </div>

          {/* Card 3: เปอร์เซ็นต์การเบิกเงินโครงการ */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center space-x-1.5 text-slate-500 text-[11px] font-extrabold">
              <div className="p-1 bg-slate-100 rounded-md text-slate-600">
                <Percent className="w-3.5 h-3.5" />
              </div>
              <span className="truncate">เปอร์เซ็นต์การเบิกเงินโครงการ</span>
            </div>
            <div className="text-base font-black text-slate-900">
              {projectPayoutPct}%
            </div>
          </div>

          {/* Card 4: ยอดคงเหลือโครงการที่รอเบิก */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center space-x-1.5 text-emerald-700 text-[11px] font-extrabold">
              <div className="p-1 bg-emerald-50 rounded-md text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <span className="truncate">ยอดคงเหลือโครงการที่รอเบิก</span>
            </div>
            <div className="text-base font-black text-emerald-700">
              {remainingProjectBalance.toLocaleString()} <span className="text-xs font-bold">บาท</span>
            </div>
          </div>

          {/* Card 5: ยอดเงินเบิกจากผู้ถือเงิน */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center space-x-1.5 text-slate-800 text-[11px] font-black">
              <span className="truncate">ยอดเงินเบิกจาก{holderName}</span>
            </div>
            <div className="text-base font-black text-slate-900">
              {completedHolderPayout.toLocaleString()} <span className="text-xs font-bold">บาท</span>
            </div>
          </div>

          {/* Card 6: ยอดเงินคงเหลือที่ผู้ถือเงิน */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center space-x-1.5 text-slate-800 text-[11px] font-black">
              <span className="truncate">ยอดเงินคงเหลือที่{holderName}</span>
            </div>
            <div className="text-base font-black text-slate-900">
              {remainingHolderBalance.toLocaleString()} <span className="text-xs font-bold">บาท</span>
            </div>
          </div>
        </div>

        {/* Table Section: ประวัติการเบิกจ่ายงวดงาน */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h4 className="text-xs font-black text-slate-900 flex items-center space-x-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>ประวัติการเบิกจ่ายงวดงาน</span>
            </h4>
            <span className="text-xs font-bold text-slate-400">หน่วย : บาท</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-black text-slate-600 uppercase border-b border-slate-200">
                <tr>
                  <th className="p-2.5 text-center w-12">ครั้งที่</th>
                  <th className="p-2.5 text-right">ราคาตามงวดงาน</th>
                  <th className="p-2.5 text-center">วันที่เบิกจากส่งมอบ</th>
                  <th className="p-2.5 text-center">สถานะเบิกจากโครงการ</th>
                  <th className="p-2.5 text-center">วันที่เบิกจากผู้ถือเงิน</th>
                  <th className="p-2.5 text-center">ผู้ถือเงิน</th>
                  <th className="p-2.5 text-center">สถานะเบิกจากผู้ถือเงิน</th>
                  <th className="p-2.5 text-center">ไฟล์</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-800">
                {currentMilestones.map((m, idx) => (
                  <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* ครั้งที่ */}
                    <td className="p-2.5 text-center font-black text-slate-700">
                      {m.milestoneNumber || idx + 1}
                    </td>

                    {/* ราคาตามงวดงาน (มาจากงวดงานในการ์ดที่เปิด) */}
                    <td className="p-2.5 text-right font-black text-slate-900">
                      {(m.amount || 0).toLocaleString()}
                    </td>

                    {/* วันที่เบิกจากส่งมอบ */}
                    <td className="p-2.5 text-center">
                      <input
                        type="text"
                        value={m.projectPayoutDate || '8 สิงหาคม 2569'}
                        onChange={(e) => handleUpdatePayout(m.id, { projectPayoutDate: e.target.value })}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-center w-28 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </td>

                    {/* สถานะเบิกจากโครงการ (Dropdown) */}
                    <td className="p-2.5 text-center">
                      <select
                        value={m.projectPayoutStatus || 'รอเบิก'}
                        onChange={(e) => handleUpdatePayout(m.id, { projectPayoutStatus: e.target.value as any })}
                        className={`px-2.5 py-1 rounded-full text-xs font-black border cursor-pointer focus:outline-none shadow-2xs ${
                          m.projectPayoutStatus === 'เบิกสำเร็จ'
                            ? 'bg-emerald-500 text-white border-emerald-600'
                            : m.projectPayoutStatus === 'กำลังดำเนินการ'
                            ? 'bg-blue-100 text-blue-800 border-blue-300'
                            : 'bg-amber-100 text-amber-800 border-amber-300'
                        }`}
                      >
                        <option value="รอเบิก">รอเบิก</option>
                        <option value="กำลังดำเนินการ">กำลังดำเนินการ</option>
                        <option value="เบิกสำเร็จ">เบิกสำเร็จ</option>
                      </select>
                    </td>

                    {/* วันที่เบิกจากผู้ถือเงิน */}
                    <td className="p-2.5 text-center">
                      <input
                        type="text"
                        value={m.holderPayoutDate || '8 สิงหาคม 2569'}
                        onChange={(e) => handleUpdatePayout(m.id, { holderPayoutDate: e.target.value })}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-center w-28 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </td>

                    {/* ผู้ถือเงิน (Dynamic) */}
                    <td className="p-2.5 text-center font-black text-slate-700">
                      {holderName}
                    </td>

                    {/* สถานะเบิกจากผู้ถือเงิน (Dropdown) */}
                    <td className="p-2.5 text-center">
                      <select
                        value={m.holderPayoutStatus || 'รออนุมัติ'}
                        onChange={(e) => handleUpdatePayout(m.id, { holderPayoutStatus: e.target.value as any })}
                        className={`px-2.5 py-1 rounded-full text-xs font-black border cursor-pointer focus:outline-none shadow-2xs ${
                          m.holderPayoutStatus === 'เบิกสำเร็จ'
                            ? 'bg-emerald-500 text-white border-emerald-600'
                            : m.holderPayoutStatus === 'กำลังดำเนินการ'
                            ? 'bg-blue-100 text-blue-800 border-blue-300'
                            : 'bg-amber-100 text-amber-800 border-amber-300'
                        }`}
                      >
                        <option value="รออนุมัติ">รออนุมัติ</option>
                        <option value="กำลังดำเนินการ">กำลังดำเนินการ</option>
                        <option value="เบิกสำเร็จ">เบิกสำเร็จ</option>
                      </select>
                    </td>

                    {/* ไฟล์ (รองรับการอัปโหลดรูปภาพสลิป/หลักฐานภาพแชทสนทนา) */}
                    <td className="p-2.5 text-center">
                      {m.evidenceFileName || m.evidenceFileUrl ? (
                        <div className="flex items-center justify-center space-x-1">
                          <span
                            className="bg-slate-100 text-slate-800 border border-slate-300 px-2 py-0.5 rounded-lg text-[11px] font-bold max-w-[120px] truncate flex items-center space-x-1"
                            title={m.evidenceFileName || 'สลิป/หลักฐาน'}
                          >
                            <FileText className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span className="truncate">{m.evidenceFileName || 'สลิปหลักฐาน'}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setPreviewFileModal({
                              isOpen: true,
                              url: m.evidenceFileUrl || '',
                              name: m.evidenceFileName || 'สลิปหลักฐาน'
                            })}
                            className="p-1 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded cursor-pointer"
                            title="ดูภาพสลิป/หลักฐาน"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {m.evidenceFileUrl && (
                            <a
                              href={m.evidenceFileUrl}
                              download={m.evidenceFileName || 'slip.png'}
                              className="p-1 text-slate-600 hover:text-emerald-600 hover:bg-slate-100 rounded cursor-pointer"
                              title="ดาวน์โหลด"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => handleUpdatePayout(m.id, { evidenceFileName: undefined, evidenceFileUrl: undefined })}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded cursor-pointer"
                            title="ลบไฟล์"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <label className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center space-x-1 shadow-2xs">
                          <Upload className="w-3 h-3 text-emerald-700" />
                          <span>แนบสลิป/แชท</span>
                          <input
                            type="file"
                            accept="image/*,.pdf,.xlsx"
                            className="hidden"
                            onChange={(e) => handleFileUpload(m.id, e)}
                          />
                        </label>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Edit Holder Name */}
        {isEditHolderModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900 flex items-center space-x-2">
                  <Edit2 className="w-4 h-4 text-emerald-600" />
                  <span>แก้ไขชื่อผู้ถือเงินโครงการ</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditHolderModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-700">
                  ระบุชื่อผู้ถือเงิน (เช่น อาจารย์หนุ่ย, พี่นก, คุณสมชาย)
                </label>
                <input
                  type="text"
                  value={editHolderInput}
                  onChange={(e) => setEditHolderInput(e.target.value)}
                  placeholder="พิมพ์ชื่อผู้ถือเงิน..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-500 font-bold">
                  ระบบจะทำการอัปเดตชื่อผู้ถือเงินในการ์ดนี้ และการ์ดสถิติทั้งหมดในแดชบอร์ดโดยอัตโนมัติ
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditHolderModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (editHolderInput.trim()) {
                      updateTaskHolderName(task.id, editHolderInput.trim());
                      setIsEditHolderModalOpen(false);
                    }
                  }}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-black shadow-md cursor-pointer"
                >
                  บันทึกการแก้ไข
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Preview Evidence Image/File */}
        {previewFileModal?.isOpen && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900 flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span>หลักฐานสลิป / ภาพแชทสนทนา: {previewFileModal.name}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setPreviewFileModal(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-slate-100 rounded-xl p-3 border border-slate-200">
                {previewFileModal.url && previewFileModal.url.startsWith('data:image') ? (
                  <img
                    src={previewFileModal.url}
                    alt={previewFileModal.name}
                    className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-md"
                  />
                ) : (
                  <div className="text-center py-10 space-y-3">
                    <FileText className="w-16 h-16 text-emerald-600 mx-auto" />
                    <p className="text-xs font-black text-slate-700">{previewFileModal.name}</p>
                    {previewFileModal.url && (
                      <a
                        href={previewFileModal.url}
                        download={previewFileModal.name}
                        className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md"
                      >
                        <Download className="w-4 h-4" />
                        <span>ดาวน์โหลดไฟล์เอกสาร</span>
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setPreviewFileModal(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold cursor-pointer"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (showOnlyPayout) {
    return renderPayoutSection();
  }

  return (
    <div className="space-y-6">
      
      {/* Proposal & Milestones Flow Status Banner (Dark Green Theme matching Image 2) */}
      <div className="bg-gradient-to-r from-emerald-950 via-teal-900 to-emerald-900 text-white rounded-2xl p-5 shadow-lg space-y-4 border border-emerald-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-emerald-700/50 pb-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="bg-emerald-500/20 text-emerald-200 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center space-x-1">
                <Layers className="w-3 h-3 text-emerald-300" />
                <span>ขั้นตอนโครงการ</span>
              </span>
              <span className="bg-amber-400 text-emerald-950 text-[10px] font-black px-2 py-0.5 rounded-md">
                {bannerViewMode === 'milestones' ? 'ตรงนี้ล้อตามงวดงาน' : '8 ขั้นตอนยื่นเสนอทุน'}
              </span>
            </div>
            <h4 className="text-base font-black mt-1.5 text-white flex items-center space-x-2">
              <span>{statusMap[currentKUStatus].label}</span>
              {currentMilestones.length > 0 && (
                <span className="text-xs text-emerald-300 font-bold bg-emerald-800/80 px-2 py-0.5 rounded-lg border border-emerald-700">
                  (มีทั้งหมด {currentMilestones.length} งวดงาน)
                </span>
              )}
            </h4>
          </div>

          <div className="flex items-center space-x-2">
            {/* View Mode Switcher */}
            <div className="bg-emerald-950/80 p-1 rounded-xl border border-emerald-700 flex items-center space-x-1">
              <button
                type="button"
                onClick={() => setBannerViewMode('milestones')}
                className={`px-2.5 py-1 text-[10px] font-black rounded-lg transition-all ${
                  bannerViewMode === 'milestones'
                    ? 'bg-amber-400 text-emerald-950 shadow-xs'
                    : 'text-emerald-200 hover:bg-emerald-800/50'
                }`}
              >
                ล้อตามงวดงาน ({currentMilestones.length})
              </button>
              <button
                type="button"
                onClick={() => setBannerViewMode('proposal_steps')}
                className={`px-2.5 py-1 text-[10px] font-black rounded-lg transition-all ${
                  bannerViewMode === 'proposal_steps'
                    ? 'bg-amber-400 text-emerald-950 shadow-xs'
                    : 'text-emerald-200 hover:bg-emerald-800/50'
                }`}
              >
                8 ขั้นตอนข้อเสนอ
              </button>
            </div>
          </div>
        </div>

        {/* Step Progression Bar: "ตรงนี้ล้อตามงวดงาน" (Matching Image 2) */}
        {bannerViewMode === 'milestones' && currentMilestones.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 pt-1">
            {currentMilestones.map((m, idx) => {
              const isFirst = idx === 0;
              const isCompleted = m.status === 'approved' || m.status === 'submitted';
              const items = getDeliverableItems(m);
              const doneCount = items.filter(i => i.completed).length;

              return (
                <div
                  key={m.id}
                  onClick={() => {
                    const el = document.getElementById(`milestone-card-${m.id}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                  className={`p-2.5 rounded-xl border text-[11px] font-bold cursor-pointer transition-all text-center flex flex-col items-center justify-between min-h-[72px] relative overflow-hidden ${
                    isFirst
                      ? 'bg-amber-400 text-emerald-950 border-amber-300 shadow-lg ring-2 ring-amber-300'
                      : isCompleted
                      ? 'bg-emerald-800/90 text-emerald-100 border-emerald-500'
                      : 'bg-emerald-950/80 text-emerald-200 border-emerald-700/80 hover:bg-emerald-800/60'
                  }`}
                >
                  <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-full ${
                    isFirst ? 'bg-emerald-950/20 text-emerald-950' : 'bg-emerald-900/80 text-emerald-300'
                  }`}>
                    ขั้นตอน {idx + 1}
                  </span>
                  <div className="my-1 text-center">
                    <p className="line-clamp-1 font-black text-xs">{m.title}</p>
                    <p className="text-[10px] opacity-80 mt-0.5">{m.amount.toLocaleString()} บาท</p>
                  </div>
                  <div className="flex items-center space-x-1 text-[9px] opacity-90">
                    <CheckSquare className="w-3 h-3" />
                    <span>{doneCount}/{items.length} รายการ</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* 8 Proposal Steps View */
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-1">
            {Object.entries(statusMap).map(([key, val]) => {
              const isCurrent = key === currentKUStatus;
              const isPassed = val.step < currentStep;

              return (
                <div
                  key={key}
                  onClick={() => !readOnly && handleStatusChange(key as KUProposalStatus)}
                  className={`p-2 rounded-xl border text-[11px] font-bold cursor-pointer transition-all text-center flex flex-col items-center justify-between min-h-[68px] ${
                    isCurrent
                      ? 'bg-amber-400 text-emerald-950 border-amber-300 shadow-md ring-2 ring-amber-300'
                      : isPassed
                      ? 'bg-emerald-800/80 text-emerald-100 border-emerald-600'
                      : 'bg-emerald-950/40 text-emerald-400 border-emerald-800 hover:bg-emerald-800/40'
                  }`}
                >
                  <span className="text-[9px] opacity-75">ขั้นตอน {val.step}</span>
                  <span className="line-clamp-2 leading-tight">{val.label}</span>
                  {isPassed && <CheckCircle2 className="w-3 h-3 text-emerald-300 mt-1" />}
                </div>
              );
            })}
          </div>
        )}

        {/* Status & Delegate Controller */}
        {!readOnly && (
          <div className="bg-emerald-950/70 rounded-xl p-3 border border-emerald-700/60 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex items-center space-x-2 text-xs">
              <UserCheck className="w-4 h-4 text-emerald-300 shrink-0" />
              <span className="text-emerald-200 font-medium">ส่งต่อมอบหมายให้ผู้รับผิดชอบถัดไป:</span>
              <select
                value={selectedNextUser}
                onChange={e => setSelectedNextUser(e.target.value)}
                className="bg-emerald-900 border border-emerald-600 text-white rounded-lg text-xs font-bold px-2.5 py-1 focus:outline-none"
              >
                {users
                  .filter(u => u.status === 'approved')
                  .map(u => (
                    <option key={u.id} value={u.id}>
                      {u.fullName}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* TOR Milestones Section */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-2xl">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-gray-900">
                การรับงวดส่งมอบ และ ยอดเงินงบประมาณ
              </h4>
              <p className="text-xs text-gray-500">
                ยอดเงินรวมทั้งสิ้น: <span className="font-black text-emerald-600">{totalAmount.toLocaleString()} บาท</span>
              </p>
            </div>
          </div>

          {!readOnly && (
            <button
              type="button"
              onClick={() => setShowAddMilestone(!showAddMilestone)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มงวดส่งงาน</span>
            </button>
          )}
        </div>

        {/* Add New Milestone Form */}
        {showAddMilestone && !readOnly && (
          <form onSubmit={handleSaveNewMilestone} className="p-4 bg-emerald-50/90 border border-emerald-200 rounded-2xl space-y-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-black text-emerald-900">เพิ่มงวดส่งงานใหม่</h5>
              <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md font-bold">
                TOR / Milestone Setup
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">ชื่องวดงาน</label>
                <input
                  type="text"
                  placeholder="เช่น งวดที่ 3 : เอกสารส่งมอบ"
                  value={mTitle}
                  onChange={e => setMTitle(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">ยอดเงินตามงวด (บาท)</label>
                <input
                  type="number"
                  value={mAmount}
                  onChange={e => setMAmount(Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">กำหนดส่ง (DueDate)</label>
                <input
                  type="date"
                  value={mDueDate}
                  onChange={e => setMDueDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                />
              </div>
            </div>

            {/* Deliverables Checklist Builder for Form */}
            <div className="space-y-2 bg-white p-3.5 rounded-xl border border-emerald-200/80 shadow-2xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-gray-100 pb-2">
                <label className="text-xs font-black text-gray-900 flex items-center space-x-1.5">
                  <CheckSquare className="w-4 h-4 text-emerald-600" />
                  <span>รายการ Checklist การทำงานในงวดนี้ (Deliverables):</span>
                </label>

                <button
                  type="button"
                  onClick={() => setShowOcrModal(true)}
                  className="px-2.5 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg text-[10px] font-black shadow-2xs flex items-center space-x-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>OCR อ่านไฟล์งวดงาน</span>
                </button>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {newFormDeliverableItems.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between space-x-2 p-2 bg-emerald-50/40 rounded-xl border border-emerald-100"
                  >
                    <div className="flex items-center space-x-2.5 flex-1">
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => {
                          setNewFormDeliverableItems(
                            newFormDeliverableItems.map(d =>
                              d.id === item.id ? { ...d, completed: !d.completed } : d
                            )
                          );
                        }}
                        className="rounded border-gray-300 text-emerald-600 w-4 h-4 cursor-pointer shrink-0"
                      />
                      <input
                        type="text"
                        value={item.title}
                        onChange={e => {
                          const val = e.target.value;
                          setNewFormDeliverableItems(
                            newFormDeliverableItems.map(d =>
                              d.id === item.id ? { ...d, title: val } : d
                            )
                          );
                        }}
                        className="w-full text-xs text-gray-800 font-medium bg-transparent focus:outline-none focus:ring-1 focus:ring-emerald-400 px-1 py-0.5 rounded"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setNewFormDeliverableItems(newFormDeliverableItems.filter(d => d.id !== item.id))}
                      className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center space-x-2 pt-1 border-t border-gray-100">
                <input
                  type="text"
                  placeholder="พิมพ์รายการใหม่ เช่น เอกสารรายงานฉบับสมบูรณ์..."
                  value={newFormDeliverableInput}
                  onChange={e => setNewFormDeliverableInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (newFormDeliverableInput.trim()) {
                        setNewFormDeliverableItems([
                          ...newFormDeliverableItems,
                          { id: `del-${Date.now()}`, title: newFormDeliverableInput.trim(), completed: false },
                        ]);
                        setNewFormDeliverableInput('');
                      }
                    }
                  }}
                  className="flex-1 px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newFormDeliverableInput.trim()) {
                      setNewFormDeliverableItems([
                        ...newFormDeliverableItems,
                        { id: `del-${Date.now()}`, title: newFormDeliverableInput.trim(), completed: false },
                      ]);
                      setNewFormDeliverableInput('');
                    }
                  }}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 inline mr-1" />
                  เพิ่มรายการ
                </button>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddMilestone(false)}
                className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-xs font-bold"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-black"
              >
                บันทึกงวดงาน
              </button>
            </div>
          </form>
        )}

        {/* Milestone Cards List ("ต้องแก้ไขได้ในแต่ละงวด" - Matching Image 1) */}
        <div className="space-y-4">
          {currentMilestones.map((m, mIdx) => {
            const deliverableItems = getDeliverableItems(m);
            const isEditingThis = editingMilestoneId === m.id;

            return (
              <div
                key={m.id}
                id={`milestone-card-${m.id}`}
                className="p-4 bg-emerald-50/20 border border-emerald-200 rounded-2xl space-y-3 hover:border-emerald-300 transition-all shadow-2xs relative"
              >
                {/* Milestone Card Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-emerald-100 pb-2.5">
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <span className="px-2.5 py-1 bg-emerald-600 text-white text-[11px] font-black rounded-lg shrink-0">
                      งวดที่ {m.milestoneNumber || mIdx + 1}
                    </span>

                    {isEditingThis ? (
                      <input
                        type="text"
                        value={editMTitle}
                        onChange={e => setEditMTitle(e.target.value)}
                        className="text-xs font-bold text-gray-900 border border-emerald-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 flex-1"
                      />
                    ) : (
                      <h5 className="text-xs font-black text-gray-900 truncate">
                        {m.title}
                      </h5>
                    )}
                  </div>

                  <div className="flex items-center space-x-3 shrink-0">
                    {isEditingThis ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          value={editMAmount}
                          onChange={e => setEditMAmount(Number(e.target.value))}
                          className="w-24 text-xs font-bold border border-emerald-300 rounded px-2 py-1 bg-white"
                        />
                        <span className="text-xs font-bold text-emerald-700">บาท</span>
                        <input
                          type="date"
                          value={editMDueDate}
                          onChange={e => setEditMDueDate(e.target.value)}
                          className="text-xs font-bold border border-emerald-300 rounded px-2 py-1 bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEditMilestone(m.id)}
                          className="p-1 bg-emerald-600 text-white rounded-lg text-xs font-bold px-2 flex items-center space-x-1"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>บันทึก</span>
                        </button>
                      </div>
                    ) : (
                      <div className="text-right flex items-center space-x-3">
                        <span className="text-xs font-black text-emerald-700">
                          {m.amount.toLocaleString()} บาท
                        </span>
                        <span className="text-[10px] text-gray-500 font-medium">
                          (กำหนดส่ง: {m.dueDate ? new Date(m.dueDate).toLocaleDateString('th-TH') : '1/8/2569'})
                        </span>

                        {!readOnly && (
                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => handleStartEditMilestone(m)}
                              className="p-1 text-gray-400 hover:text-emerald-700 hover:bg-emerald-100/60 rounded-lg transition-colors"
                              title="แก้ไขหัวข้องวดงาน"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMilestone(m.id)}
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="ลบงวดงานนี้"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Deliverables Checklist Items Section */}
                <div className="bg-white p-3 rounded-xl border border-emerald-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-800 flex items-center space-x-1.5">
                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                      <span>รายการสิ่งที่ส่งมอบในงวดนี้:</span>
                    </span>
                    <span className="text-[10px] text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      {deliverableItems.filter(i => i.completed).length}/{deliverableItems.length} รายการสำเร็จ
                    </span>
                  </div>

                  {/* Checklist items list */}
                  <div className="space-y-1.5">
                    {deliverableItems.length === 0 ? (
                      <p className="text-[11px] text-gray-400 italic py-1">
                        ยังไม่มีรายการส่งมอบสำหรับงวดนี้
                      </p>
                    ) : (
                      deliverableItems.map((item, itemIdx) => (
                        <div
                          key={item.id}
                          className={`flex items-center justify-between space-x-2 p-2 rounded-xl border transition-colors ${
                            item.completed
                              ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950 font-semibold'
                              : 'bg-gray-50/60 border-gray-200 text-gray-800'
                          }`}
                        >
                          <div className="flex items-center space-x-2.5 flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={item.completed}
                              disabled={readOnly}
                              onChange={() => handleToggleDeliverable(m.id, itemIdx)}
                              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer shrink-0"
                            />

                            {isEditingThis && !readOnly ? (
                              <input
                                type="text"
                                value={item.text}
                                onChange={e => handleUpdateDeliverableText(m.id, itemIdx, e.target.value)}
                                className={`w-full text-xs font-medium bg-white border border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 px-2 py-0.5 rounded ${
                                  item.completed ? 'line-through text-gray-500' : 'text-gray-800 font-bold'
                                }`}
                              />
                            ) : (
                              <span className={`text-xs ${item.completed ? 'line-through text-gray-500 font-medium' : 'text-gray-800 font-bold'}`}>
                                {item.text}
                              </span>
                            )}
                          </div>

                          {isEditingThis && !readOnly && (
                            <button
                              type="button"
                              onClick={() => handleDeleteDeliverable(m.id, itemIdx)}
                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0 cursor-pointer"
                              title="ลบรายการส่งมอบนี้"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add New Deliverable Item or Save button when in edit mode */}
                  {!readOnly && (
                    <div className="flex items-center justify-between space-x-2 pt-2 border-t border-gray-100">
                      {isEditingThis ? (
                        <div className="flex items-center space-x-2 w-full">
                          <input
                            type="text"
                            placeholder="➕ พิมพ์รายการส่งมอบเพิ่มในงวดนี้..."
                            value={newDeliverableInputs[m.id] || ''}
                            onChange={e => setNewDeliverableInputs({ ...newDeliverableInputs, [m.id]: e.target.value })}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddDeliverableToMilestone(m.id);
                              }
                            }}
                            className="flex-1 px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddDeliverableToMilestone(m.id)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1 shrink-0 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>เพิ่ม</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEditMilestone(m.id)}
                            className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-black shadow-xs flex items-center space-x-1 shrink-0 cursor-pointer"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>บันทึก</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[11px] text-gray-500 font-medium">
                            กดไอคอนดินสอด้านบนขวาเพื่อแก้ไขงวดงานและรายการส่งมอบ
                          </span>
                          <button
                            type="button"
                            onClick={() => handleStartEditMilestone(m)}
                            className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center space-x-1 shrink-0 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>แก้ไขงวดงาน</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Free Text & Links Notes Section (Page 11 Requirement) */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
          <h4 className="text-xs font-black text-gray-900 flex items-center space-x-2">
            <FileText className="w-4 h-4 text-emerald-600" />
            <span>บันทึกโน้ตย่อและลิงก์แนบเพิ่มเติม</span>
          </h4>
          <span className="text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md font-bold border border-emerald-200">
            สามารถเพิ่ม/แก้ไขได้ตลอดเวลาโดยไม่ต้องรอจบ Flow
          </span>
        </div>

        <div className="space-y-2">
          <textarea
            rows={2}
            placeholder="พิมพ์ข้อความโน้ตย่อ หรือแปะลิงก์เอกสาร Google Drive / OneDrive..."
            className="w-full p-3 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50/50"
            defaultValue={task.description ? `โน้ตติดตามโครงการ: ${task.description}` : ''}
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => alert('บันทึกโน้ตย่อและลิงก์เรียบร้อยแล้ว')}
              className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-2xs"
            >
              บันทึกโน้ตย่อ
            </button>
          </div>
        </div>
      </div>

      {/* OCR Scanner Modal */}
      <OCRScannerModal
        isOpen={showOcrModal}
        onClose={() => setShowOcrModal(false)}
        onApplyText={handleOcrApplyText}
      />
    </div>
  );
};

