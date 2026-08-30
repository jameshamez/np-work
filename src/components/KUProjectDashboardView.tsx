import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Task, KUProposalStatus, User } from '../types';
import { KUMilestonesView } from './KUMilestonesView';
import { DeleteTaskConfirmModal } from './DeleteTaskConfirmModal';
import {
  GraduationCap,
  Plus,
  Calendar,
  UserCheck,
  CheckCircle2,
  Clock,
  DollarSign,
  AlertCircle,
  Save,
  Send,
  FileText,
  ChevronRight,
  ArrowLeft,
  Search,
  Filter,
  CheckSquare,
  Briefcase,
  Layers,
  ChevronDown,
  Lock,
  Trash2,
  X,
} from 'lucide-react';

interface StepDefinition {
  id: string;
  stepNumber: number;
  title: string;
  subtitle: string;
  defaultStatus: 'completed' | 'in_progress' | 'not_started';
  defaultAssignee: string;
}

const KU_STEPS: StepDefinition[] = [
  {
    id: 'step_1',
    stepNumber: 1,
    title: 'เขียนข้อเสนอ — ร่าง',
    subtitle: 'จัดทำข้อเสนอฉบับแรก',
    defaultStatus: 'completed',
    defaultAssignee: 'พลอย',
  },
  {
    id: 'step_2',
    stepNumber: 2,
    title: 'อาจารย์หนุ่ยเปิด',
    subtitle: 'เปิดอ่านและให้ข้อเสนอแนะ',
    defaultStatus: 'completed',
    defaultAssignee: 'อาจารย์หนุ่ย',
  },
  {
    id: 'step_3',
    stepNumber: 3,
    title: 'พลอยปรับแก้',
    subtitle: 'แก้ข้อเสนอตามความคิดเห็น',
    defaultStatus: 'in_progress',
    defaultAssignee: 'พลอย',
  },
  {
    id: 'step_4',
    stepNumber: 4,
    title: 'รออาจารย์หนุ่ยอนุมัติ',
    subtitle: 'ตรวจฉบับพร้อมส่ง',
    defaultStatus: 'not_started',
    defaultAssignee: 'อาจารย์หนุ่ย',
  },
  {
    id: 'step_5',
    stepNumber: 5,
    title: 'พลอยกรอกข้อมูลเข้าระบบ',
    subtitle: 'บันทึกข้อมูลและเอกสาร',
    defaultStatus: 'not_started',
    defaultAssignee: 'พลอย',
  },
  {
    id: 'step_6',
    stepNumber: 6,
    title: 'รอหน่วยงานพิจารณา',
    subtitle: 'ติดตามผลภายในกรอบเวลา',
    defaultStatus: 'not_started',
    defaultAssignee: 'หน่วยงานผู้พิจารณา',
  },
  {
    id: 'step_7',
    stepNumber: 7,
    title: 'ผ่าน — กลับมาแก้ข้อมูล',
    subtitle: 'แก้ไขและส่งกลับหน่วยงาน',
    defaultStatus: 'not_started',
    defaultAssignee: 'พลอย',
  },
  {
    id: 'step_8',
    stepNumber: 8,
    title: 'ติดตามข้อมูลจากพี่ฟ้อง',
    subtitle: 'พลอยส่งรายละเอียดและติดตาม',
    defaultStatus: 'not_started',
    defaultAssignee: 'พี่ฟ้อง',
  },
  {
    id: 'step_9',
    stepNumber: 9,
    title: 'อนุมัติ — เริ่มรันงวด',
    subtitle: 'รับ TOR และเปิดแผนส่งมอบตามงวด',
    defaultStatus: 'not_started',
    defaultAssignee: 'พลอย',
  },
];

export const RD_STEPS: StepDefinition[] = [
  {
    id: 'rd_step_1',
    stepNumber: 1,
    title: '1. แกะสูตร + จัดหาวัตถุดิบ',
    subtitle: 'แกะสูตรและจัดหาวัตถุดิบสำหรับทดลอง',
    defaultStatus: 'completed',
    defaultAssignee: 'ทีม R&D',
  },
  {
    id: 'rd_step_2',
    stepNumber: 2,
    title: '2. ทดลองครั้งที่ 1',
    subtitle: 'ทำสูตรและขึ้นตัวอย่างทดลองผลิตครั้งที่ 1',
    defaultStatus: 'in_progress',
    defaultAssignee: 'ทีม R&D',
  },
  {
    id: 'rd_step_3',
    stepNumber: 3,
    title: '3. ส่งตัวอย่างทดลองครั้งที่ 1 (ให้พี่รักษ์)',
    subtitle: 'ส่งตัวอย่างทดลองให้พี่รักษ์ประเมินและชิม',
    defaultStatus: 'not_started',
    defaultAssignee: 'พี่รักษ์',
  },
  {
    id: 'rd_step_4',
    stepNumber: 4,
    title: '4. ปรับสูตรครั้งที่ 1',
    subtitle: 'ปรับแก้สูตรตามคำแนะนำครั้งที่ 1',
    defaultStatus: 'not_started',
    defaultAssignee: 'ทีม R&D',
  },
  {
    id: 'rd_step_5',
    stepNumber: 5,
    title: '5. ส่งตัวอย่างหลังปรับสูตรครั้งที่ 1',
    subtitle: 'ถ้าผ่านจะไปขั้นตอนที่ 6 / ถ้าไม่ผ่าน จะย้อนกลับไปเป็น ปรับสูตรครั้งที่ 2 และส่งตัวอย่างหลังปรับสูตรครั้งที่ 2',
    defaultStatus: 'not_started',
    defaultAssignee: 'พี่รักษ์',
  },
  {
    id: 'rd_step_6',
    stepNumber: 6,
    title: '6. ส่งตรวจข้อมูลโภชนาการ และขอเลขอย.',
    subtitle: 'ส่ง Lab ตรวจ Nutrition Facts และยื่นขอ อย.',
    defaultStatus: 'not_started',
    defaultAssignee: 'ทีม R&D / อย.',
  },
  {
    id: 'rd_step_7',
    stepNumber: 7,
    title: '7. ออกแบบและทดลองบรรจุภัณฑ์',
    subtitle: 'ออกแบบฉลาก/แพ็กเกจ และทดสอบการบรรจุจริง',
    defaultStatus: 'not_started',
    defaultAssignee: 'ทีมออกแบบ / R&D',
  },
  {
    id: 'rd_step_8',
    stepNumber: 8,
    title: '8. ทดลองเก็บ Shelf Life',
    subtitle: 'ทดสอบอายุการเก็บรักษาและสภาวะเสื่อมสภาพ',
    defaultStatus: 'not_started',
    defaultAssignee: 'ทีม R&D',
  },
  {
    id: 'rd_step_9',
    stepNumber: 9,
    title: '9. คำนวณต้นทุนและกำหนดราคาขาย',
    subtitle: 'สรุปต้นทุน COGS และเคาะราคาขายปลีก/ส่ง',
    defaultStatus: 'not_started',
    defaultAssignee: 'ทีมบัญชี / ผู้บริหาร',
  },
  {
    id: 'rd_step_10',
    stepNumber: 10,
    title: '10. ลงขาย',
    subtitle: 'เปิดตัวและจัดจำหน่ายสินค้าเข้าระบบ',
    defaultStatus: 'not_started',
    defaultAssignee: 'ทีมการตลาด / ขาย',
  },
];

const getStepNumberFromStatus = (status?: string): number => {
  if (!status) return 3;
  if (status.startsWith('1')) return 1;
  if (status.startsWith('2')) return 2;
  if (status.startsWith('3')) return 3;
  if (status.startsWith('4')) return 4;
  if (status.startsWith('5')) return 5;
  if (status.startsWith('6')) return 6;
  if (status.startsWith('7')) return 7;
  if (status.startsWith('8')) return 8;
  if (status.startsWith('9')) return 9;
  return 3;
};

const getStepTitle = (stepNum: number): string => {
  const found = KU_STEPS.find(s => s.stepNumber === stepNum);
  return found ? found.title : `ขั้นตอนที่ ${stepNum}`;
};

interface KUProjectDashboardViewProps {
  onOpenCreateModal?: () => void;
  onOpenDetailModal?: (task: Task) => void;
  onOpenCreateFlowModal?: () => void;
}

export const KUProjectDashboardView: React.FC<KUProjectDashboardViewProps> = ({
  onOpenCreateModal,
  onOpenDetailModal,
  onOpenCreateFlowModal,
}) => {
  const { tasks, users, createTask, updateKUStatus, flowTemplates, deleteTask, currentUser } = useApp();

  // ลบการ์ดถาวรได้เฉพาะ admin ขึ้นไป — ด่านจริงคือ policy tasks_delete_admin ที่ฐานข้อมูล
  const canDelete = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  // Toast notification banner state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Delete Confirmation Modal State
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<{ id: string; title: string; code: string } | null>(null);

  const handleOpenDeleteConfirm = (task: Task) => {
    setTaskToDelete({ id: task.id, title: task.title, code: task.code });
    setShowDeleteConfirmModal(true);
  };

  const handleConfirmDelete = () => {
    if (taskToDelete) {
      deleteTask(taskToDelete.id);
      setShowDeleteConfirmModal(false);
      setTaskToDelete(null);
      setSelectedTaskId(null);
      setToastMessage(`ลบการ์ดโครงการรหัส #${taskToDelete.code} เรียบร้อยแล้ว`);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  // Filter tasks belonging to KU University
  const kuTasks = tasks.filter(
    t => t.category === 'ku_university' || t.code?.startsWith('KU')
  );

  // Selected Task ID (null = show all cards, string = show single detail view)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOwner, setFilterOwner] = useState<string>('all');
  const [filterStep, setFilterStep] = useState<string>('all');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  // Quick Inline Creation Modal State for new KU Card
  const [showQuickCreateModal, setShowQuickCreateModal] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [newCardOwner, setNewCardOwner] = useState('พลอย');
  const [newCardBudget, setNewCardBudget] = useState('1,200,000');
  const [newCardDeadline, setNewCardDeadline] = useState('2026-10-31');
  const [newCardSelectedFlowId, setNewCardSelectedFlowId] = useState<string>('');

  // Active Task for detail view
  const currentTask = kuTasks.find(t => t.id === selectedTaskId);

  // Local state for detail view
  const [currentStepName, setCurrentStepName] = useState<string>('พลอยปรับแก้');
  const [projectOwner, setProjectOwner] = useState<string>('พลอย');
  const [projectDeadline, setProjectDeadline] = useState<string>('2026-09-30');
  const [totalBudget, setTotalBudget] = useState<string>('1,200,000');
  const [revisionNote, setRevisionNote] = useState<string>(
    'ปรับรายละเอียดผลลัพธ์โครงการและตรวจงบประมาณอีกครั้ง'
  );

  const [delegateUser, setDelegateUser] = useState<string>('พี่ฟ้อง');
  const [delegateDeadline, setDelegateDeadline] = useState<string>('2026-08-10');

  // Step state management for selected card
  const [stepStatuses, setStepStatuses] = useState<
    Record<number, 'completed' | 'in_progress' | 'not_started'>
  >({});

  const [stepAssignees, setStepAssignees] = useState<Record<number, string>>({});

  // Delegate Submission & Unlocking state
  const [isSubmittedAndAssigned, setIsSubmittedAndAssigned] = useState<boolean>(false);

  // Active Tab under selected project card (matching Budget Bureau UI)
  const [activeTabUnderCard, setActiveTabUnderCard] = useState<'overview' | 'steps' | 'tor' | 'payout'>('steps');

  // Selected Workflow Flow Type (proposal_9 vs rd_10)
  const [selectedFlowType, setSelectedFlowType] = useState<'proposal_9' | 'rd_10'>('proposal_9');

  const handleFlowTypeChange = (flowType: 'proposal_9' | 'rd_10') => {
    setSelectedFlowType(flowType);
    const stepsToUse = flowType === 'rd_10' ? RD_STEPS : KU_STEPS;
    const initialStatuses: Record<number, 'completed' | 'in_progress' | 'not_started'> = {};
    const initialAssignees: Record<number, string> = {};

    stepsToUse.forEach(s => {
      initialStatuses[s.stepNumber] = s.defaultStatus;
      initialAssignees[s.stepNumber] = s.defaultAssignee;
    });
    setStepStatuses(initialStatuses);
    setStepAssignees(initialAssignees);
  };

  // When a card is selected, initialize detail states
  const handleSelectCard = (task: Task) => {
    setSelectedTaskId(task.id);
    const activeStepNum = getStepNumberFromStatus(task.kuProposalStatus);
    
    // Auto detect RD task
    const isRdTask =
      task.title?.toLowerCase().includes('rd') ||
      task.title?.includes('สูตร') ||
      task.code?.includes('RD') ||
      (task.checklists && task.checklists.length >= 10);
    const targetFlow = isRdTask ? 'rd_10' : 'proposal_9';
    setSelectedFlowType(targetFlow);

    const activeStepsList = targetFlow === 'rd_10' ? RD_STEPS : KU_STEPS;

    setCurrentStepName(getStepTitle(activeStepNum));
    setProjectOwner(task.assignedToUserName?.replace(/\s*\([^)]*\)/g, '').trim() || 'พลอย');
    setProjectDeadline(task.kuDeadline || task.deadlineAt?.split('T')[0] || '2026-09-30');

    // Check if task is already approved/submitted
    setIsSubmittedAndAssigned(task.kuProposalStatus === '8_approved_run_terms');

    // Calculate total budget from milestones or fallback
    const totalMsAmount = task.milestones?.reduce((acc, m) => acc + m.amount, 0);
    setTotalBudget(totalMsAmount ? totalMsAmount.toLocaleString() : '1,200,000');

    // Initialize step statuses based on active step number
    const initialStatuses: Record<number, 'completed' | 'in_progress' | 'not_started'> = {};
    const initialAssignees: Record<number, string> = {};

    const isFullyApproved = task.kuProposalStatus === '8_approved_run_terms';

    activeStepsList.forEach(s => {
      if (isFullyApproved || s.stepNumber < activeStepNum) {
        initialStatuses[s.stepNumber] = 'completed';
      } else if (s.stepNumber === activeStepNum) {
        initialStatuses[s.stepNumber] = 'in_progress';
      } else {
        initialStatuses[s.stepNumber] = 'not_started';
      }
      initialAssignees[s.stepNumber] = s.defaultAssignee;
    });

    setStepStatuses(initialStatuses);
    setStepAssignees(initialAssignees);
  };

  const handleStepStatusChange = (
    stepNum: number,
    newStatus: 'completed' | 'in_progress' | 'not_started'
  ) => {
    setStepStatuses(prev => ({ ...prev, [stepNum]: newStatus }));
    if (newStatus === 'in_progress') {
      const stepObj = KU_STEPS.find(s => s.stepNumber === stepNum);
      if (stepObj) {
        setCurrentStepName(stepObj.title);
      }
    }
  };

  const handleStepAssigneeChange = (stepNum: number, newAssignee: string) => {
    setStepAssignees(prev => ({ ...prev, [stepNum]: newAssignee }));
  };

  const handleSaveAll = () => {
    setToastMessage(`บันทึกข้อมูลโครงการ "${currentTask?.title || 'งานโครงการ'}" เรียบร้อยแล้ว!`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleDelegateSubmit = () => {
    if (currentTask) {
      const foundUser = users.find(u => u.fullName.includes(delegateUser) || u.id === delegateUser);
      updateKUStatus(currentTask.id, '8_approved_run_terms', foundUser?.id);
      setCurrentStepName('อนุมัติ — เริ่มรันงวด');
      setProjectOwner(delegateUser);

      // Automatically set all 9 steps as completed
      const allCompleted: Record<number, 'completed'> = {};
      KU_STEPS.forEach(s => {
        allCompleted[s.stepNumber] = 'completed';
      });
      setStepStatuses(allCompleted);

      // Unlock TOR Milestones section
      setIsSubmittedAndAssigned(true);

      // Open Task Detail Modal (Modal 2 per Page 3 requirement)
      if (onOpenDetailModal) {
        onOpenDetailModal({
          ...currentTask,
          kuProposalStatus: '8_approved_run_terms',
          assignedToUserName: delegateUser,
        });
      }

      // Scroll smoothly to TOR Milestones section
      setTimeout(() => {
        const el = document.getElementById('tor-milestones-section');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 150);
    }

    setToastMessage(`ส่งรายละเอียดและมอบหมายให้ "${delegateUser}" เรียบร้อยแล้ว! สถานะขั้นตอนเสร็จสิ้นทั้งหมด และปลดล็อกส่วนงวดงาน TOR`);
    setTimeout(() => setToastMessage(null), 5000);
  };

  const handleCreateNewCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardTitle.trim()) return;

    const numBudget = parseFloat(newCardBudget.replace(/,/g, '')) || 1200000;

    const selectedFlow = flowTemplates.find(f => f.id === newCardSelectedFlowId);
    const createdChecklists = selectedFlow && selectedFlow.checklists.length > 0
      ? selectedFlow.checklists.map((cTitle, idx) => ({
          id: `chk-new-${Date.now()}-${idx}`,
          title: cTitle,
          completed: false,
          resultStatus: 'success' as const,
        }))
      : [
          { id: `chk-new-1`, title: 'จัดทำร่างข้อเสนอโครงการ', completed: true, resultStatus: 'success' as const },
          { id: `chk-new-2`, title: 'อาจารย์หนุ่ยเปิดอ่าน', completed: false, resultStatus: 'success' as const },
        ];

    createTask({
      projectId: 'prj-chain-tsri',
      title: newCardTitle,
      description: selectedFlow
        ? `งานโครงการ (${newCardTitle}) ใช้ Flow: ${selectedFlow.name} มอบหมาย ${newCardOwner}`
        : `งานโครงการ (${newCardTitle}) มอบหมาย ${newCardOwner}`,
      assignedToUserId: 'usr-ploy',
      planDays: 14,
      category: 'ku_university',
      kuProposalStatus: '1_draft_proposal',
      kuDeadline: newCardDeadline,
      milestones: [
        {
          id: `ms-new-1`,
          milestoneNumber: 1,
          title: 'งวดที่ 1: ร่างข้อเสนอและ Concept Note',
          deliverables: 'ส่งเล่มข้อเสนอโครงการ',
          amount: Math.round(numBudget * 0.4),
          dueDate: newCardDeadline,
          status: 'pending',
        },
        {
          id: `ms-new-2`,
          milestoneNumber: 2,
          title: 'งวดที่ 2: ดำเนินงานและส่งมอบงานฉบับสมบูรณ์',
          deliverables: 'รายงานฉบับสมบูรณ์และผลงาน',
          amount: Math.round(numBudget * 0.6),
          dueDate: newCardDeadline,
          status: 'pending',
        },
      ],
      checklists: createdChecklists,
      deadlineAt: `${newCardDeadline}T23:59:59Z`,
    });

    setNewCardTitle('');
    setNewCardSelectedFlowId('');
    setShowQuickCreateModal(false);
    setToastMessage('สร้างการ์ดโครงการสำเร็จ! ระบบออกรหัสให้อัตโนมัติแล้ว');
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Filter logic for Cards Grid
  const filteredTasks = kuTasks.filter(task => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.assignedToUserName.toLowerCase().includes(searchQuery.toLowerCase());

    const cleanOwnerName = task.assignedToUserName?.replace(/\s*\([^)]*\)/g, '').trim() || '';
    const matchesOwner =
      filterOwner === 'all' || cleanOwnerName.includes(filterOwner) || task.assignedToUserName.includes(filterOwner);

    // Date Filters
    const taskCreatedDate = task.createdAt ? task.createdAt.split('T')[0] : '';
    const taskDeadlineDate = task.kuDeadline || (task.deadlineAt ? task.deadlineAt.split('T')[0] : '');

    const matchesStartDate =
      !filterStartDate || (taskCreatedDate && taskCreatedDate >= filterStartDate);

    const matchesEndDate =
      !filterEndDate || (taskDeadlineDate && taskDeadlineDate <= filterEndDate);

    return matchesSearch && matchesOwner && matchesStartDate && matchesEndDate;
  });

  return (
    <div className="space-y-6 animate-in fade-in pb-12">
      
      {/* If viewing a specific card details, show Budget Bureau-styled tabbed detail view */}
      {selectedTaskId && currentTask ? (
        <div className="space-y-4 animate-in fade-in duration-200">
          
          {/* 1. Top Header & Badge Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
              <span className="bg-blue-600 text-white font-extrabold text-xs px-2.5 py-1 rounded-lg shadow-2xs">
                รอบที่ 1
              </span>
              <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 font-black text-xs px-2.5 py-1 rounded-lg">
                #{currentTask.code}
              </span>
              <h1 className="text-base md:text-lg font-extrabold text-slate-900 ml-1">
                {currentTask.title}
              </h1>
            </div>

            <div className="flex items-center space-x-2 shrink-0 self-start md:self-auto">
              {canDelete && (
                <button
                  type="button"
                  onClick={() => handleOpenDeleteConfirm(currentTask)}
                  className="px-3.5 py-1.5 border border-red-200 hover:border-red-400 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-xl shadow-2xs transition-all flex items-center space-x-1.5 cursor-pointer"
                  title="ยกเลิกการ์ดกรณีสร้างผิด (ลบการ์ดโครงการออก) — เฉพาะผู้ดูแลระบบ"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span>ยกเลิก</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setSelectedTaskId(null)}
                className="px-3.5 py-1.5 border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-slate-600" />
                <span>กลับ</span>
              </button>
            </div>
          </div>

          {/* 2. Top Navigation Tab Bar (RED BOX #1 in User Reference Image) */}
          <div className="bg-slate-100/90 border border-slate-200/80 p-1.5 rounded-2xl flex flex-wrap items-center gap-1.5 shadow-2xs">
            
            {/* Tab 1: ภาพรวม & รายละเอียดโครงการ */}
            <button
              type="button"
              onClick={() => setActiveTabUnderCard('overview')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-2 cursor-pointer ${
                activeTabUnderCard === 'overview'
                  ? 'bg-white shadow-xs border border-slate-200/80 text-blue-900'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Briefcase className={`w-4 h-4 ${activeTabUnderCard === 'overview' ? 'text-blue-600' : 'text-slate-500'}`} />
              <span>ภาพรวม & รายละเอียดโครงการ</span>
            </button>

            {/* Tab 2: ตารางลำดับขั้นตอน (9 ขั้นตอน) */}
            <button
              type="button"
              onClick={() => setActiveTabUnderCard('steps')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-2 cursor-pointer ${
                activeTabUnderCard === 'steps'
                  ? 'bg-white shadow-xs border border-slate-200/80 text-blue-900'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <CheckSquare className={`w-4 h-4 ${activeTabUnderCard === 'steps' ? 'text-blue-600' : 'text-slate-500'}`} />
              <span>ตารางลำดับขั้นตอน (9 ขั้นตอน)</span>
            </button>

            {/* Tab 3: การรับงวดส่งมอบ & ยอดเงินงบประมาณ (TOR Milestones) */}
            <button
              type="button"
              onClick={() => setActiveTabUnderCard('tor')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-2 cursor-pointer ${
                activeTabUnderCard === 'tor'
                  ? 'bg-white shadow-xs border border-slate-200/80 text-blue-900'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <GraduationCap className={`w-4 h-4 ${activeTabUnderCard === 'tor' ? 'text-blue-600' : 'text-slate-500'}`} />
              <span>การรับงวดส่งมอบ & งบประมาณ (TOR)</span>
            </button>

            {/* Tab 4: สถานะการเบิกเงิน (FLOW การเบิกเงินงวดโครงการ & อาจารย์หนุ่ย) */}
            <button
              type="button"
              onClick={() => setActiveTabUnderCard('payout')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-2 cursor-pointer ${
                activeTabUnderCard === 'payout'
                  ? 'bg-emerald-800 text-amber-300 shadow-md border border-emerald-700'
                  : 'text-emerald-900 bg-emerald-100/70 hover:bg-emerald-200/80 border border-emerald-300/80'
              }`}
            >
              <DollarSign className={`w-4 h-4 ${activeTabUnderCard === 'payout' ? 'text-amber-300' : 'text-emerald-700'}`} />
              <span>สถานะการเบิกเงิน</span>
            </button>

          </div>

          {/* 3. Sub-Header Section & 3 Top Stat Cards (RED BOX #2 in User Reference Image) */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs space-y-4">
            
            {/* Sub-Header Banner with Filter Badges */}
            <div className="bg-blue-50/70 border border-blue-100 p-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-2 font-bold text-blue-950 min-w-0">
                <Layers className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="truncate">
                  {activeTabUnderCard === 'overview' && 'รายละเอียด — ข้อมูลการดำเนินงานและการมอบหมาย'}
                  {activeTabUnderCard === 'steps' && 'ลำดับขั้นตอน — ติดตามข้อเสนอทุน 9 ขั้นตอน'}
                  {activeTabUnderCard === 'tor' && 'งวดส่งมอบ — แผนการส่งมอบงานและเบิกจ่ายตาม TOR'}
                  {activeTabUnderCard === 'payout' && 'สถานะการเบิกเงิน — ระบบติดตามการเบิกเงินโครงการ & ผู้ถือเงิน'}
                </span>
              </div>

              <div className="flex items-center space-x-2 shrink-0 self-start sm:self-auto flex-wrap gap-y-1">
                <span className="bg-white border border-blue-200 text-blue-900 font-bold px-3 py-1 rounded-xl shadow-2xs text-[11px]">
                  ผู้รับผิดชอบ: {projectOwner?.replace(/\s*\([^)]*\)/g, '').trim()}
                </span>
                <span className="bg-white border border-blue-200 text-blue-900 font-bold px-3 py-1 rounded-xl shadow-2xs text-[11px]">
                  กำหนดส่ง: {projectDeadline}
                </span>
                <span className="bg-blue-600 text-white font-extrabold px-3 py-1 rounded-xl shadow-2xs text-[11px]">
                  งบประมาณ: ฿{totalBudget}
                </span>
              </div>
            </div>

            {/* 3 Summary Stat Metric Cards (RED BOX #2 Top Part in Image) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              
              {/* Card 1: ข้อเสนอโครงการในรอบ */}
              <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-1">
                <div className="flex items-center space-x-1.5 text-slate-500 font-bold text-[11px]">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>ขั้นตอนข้อเสนอในรอบ</span>
                </div>
                <div className="text-lg font-black text-slate-900 flex items-baseline space-x-2">
                  <span>
                    {Object.values(stepStatuses).filter(s => s === 'completed').length} / 9 ขั้นตอน
                  </span>
                  <span className="text-xs text-blue-700 font-bold bg-blue-100 px-2 py-0.5 rounded-full">
                    {Math.round((Object.values(stepStatuses).filter(s => s === 'completed').length / 9) * 100)}%
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 font-medium truncate">
                  ขั้นตอนปัจจุบัน: {currentStepName}
                </p>
              </div>

              {/* Card 2: ครบเกณฑ์แล้ว / สถานะอนุมัติ */}
              <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-1">
                <div className="flex items-center space-x-1.5 text-slate-500 font-bold text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>สถานะพิจารณาโครงการ</span>
                </div>
                <div className="text-base font-black text-emerald-700 flex items-center space-x-1.5 truncate">
                  {isSubmittedAndAssigned || currentTask?.kuProposalStatus === '8_approved_run_terms' ? (
                    <span className="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-lg text-xs font-bold border border-emerald-200">
                      ✓ อนุมัติ — พร้อมรันงวด TOR
                    </span>
                  ) : (
                    <span className="bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-lg text-xs font-bold border border-amber-200">
                      ⏳ อยู่ระหว่างดำเนินงานข้อเสนอ
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 font-medium">
                  สิทธิ์งวดงาน TOR: {isSubmittedAndAssigned || currentTask?.kuProposalStatus === '8_approved_run_terms' ? 'เปิดใช้งานแล้ว' : 'รออนุมัติครบ 9 ขั้นตอน'}
                </p>
              </div>

              {/* Card 3: มูลค่ารวมตามงวดงาน */}
              <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-1">
                <div className="flex items-center space-x-1.5 text-slate-500 font-bold text-[11px]">
                  <DollarSign className="w-3.5 h-3.5 text-orange-600" />
                  <span>งบประมาณโครงการรวม</span>
                </div>
                <div className="text-lg font-black text-orange-600">
                  ฿{totalBudget}
                </div>
                <p className="text-[10px] text-slate-500 font-medium">
                  รวม {currentTask.milestones?.length || 4} งวดส่งมอบตาม TOR
                </p>
              </div>

            </div>

            {/* Toast Notification Banner */}
            {toastMessage && (
              <div className="bg-emerald-800 text-white p-3.5 rounded-2xl shadow-md border border-emerald-600 flex items-center justify-between animate-in fade-in">
                <div className="flex items-center space-x-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
                  <p className="text-xs font-black">{toastMessage}</p>
                </div>
                <button
                  onClick={() => setToastMessage(null)}
                  className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-3 py-1 rounded-lg cursor-pointer"
                >
                  ตกลง
                </button>
              </div>
            )}

            {/* Main Tab Content Display */}
            
            {/* TAB 1: ภาพรวม & รายละเอียดโครงการ */}
            {activeTabUnderCard === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2 animate-in fade-in">
                
                {/* Left Panel (7 cols): Information & Form Inputs */}
                <div className="lg:col-span-7 bg-slate-50/60 p-4.5 rounded-2xl border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <h3 className="text-xs font-black text-slate-900 flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span>ข้อมูลและรายละเอียดโครงการ</span>
                    </h3>
                    <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2.5 py-0.5 rounded-md">
                      Project Specs
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">ชื่อโครงการ</label>
                      <input
                        type="text"
                        readOnly
                        value={currentTask.title}
                        className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-white font-bold text-slate-800 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">สถานะขั้นตอนปัจจุบัน</label>
                        <select
                          value={currentStepName}
                          onChange={e => setCurrentStepName(e.target.value)}
                          className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-white font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        >
                          <option value="เสนอโครงการ">เสนอโครงการ</option>
                          <option value="พิจารณา">พิจารณา</option>
                          <option value="ติดตามข้อเสนอ">ติดตามข้อเสนอ</option>
                          <option value="เริ่มทำโครงการ">เริ่มทำโครงการ</option>
                          <option value="อยู่ระหว่างดำเนินการ">อยู่ระหว่างดำเนินการ</option>
                          <option value="เบิกเงิน">เบิกเงิน</option>
                          <option value="ปิดโครงการ">ปิดโครงการ</option>
                          <option value="ยกเลิก/ไม่ผ่านพิจารณา">ยกเลิก/ไม่ผ่านพิจารณา</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">เจ้าของงาน / ผู้รับผิดชอบหลัก</label>
                        <select
                          value={projectOwner}
                          onChange={e => setProjectOwner(e.target.value)}
                          className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-white text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        >
                          <option value="พลอย">พลอย</option>
                          <option value="พี่ฟ้อง">พี่ฟ้อง</option>
                          <option value="พี่หนึ่ง">พี่หนึ่ง</option>
                          <option value="พี่หมู">พี่หมู</option>
                          <option value="พี่รักษ์">พี่รักษ์</option>
                          <option value="ออม">ออม</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">วันกำหนดส่ง (Deadline)</label>
                      <input
                        type="date"
                        value={projectDeadline}
                        onChange={e => setProjectDeadline(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-white font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">หมายเหตุ / สิ่งที่ต้องปรับแก้เพิ่มเติม</label>
                      <textarea
                        rows={3}
                        value={revisionNote}
                        onChange={e => setRevisionNote(e.target.value)}
                        placeholder="ระบุข้อความโน้ต..."
                        className="w-full p-3 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Panel (5 cols): Delegate & Quick Action */}
                <div className="lg:col-span-5 space-y-4">
                  
                  {/* Delegate Section Card */}
                  <div className="p-4 bg-orange-50/70 border border-orange-200 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between border-b border-orange-200 pb-2">
                      <p className="text-xs font-black text-orange-950 flex items-center space-x-1.5">
                        <Send className="w-4 h-4 text-orange-600" />
                        <span>ส่งต่อให้ผู้รับผิดชอบ</span>
                      </p>
                      <span className="text-[10px] bg-orange-200 text-orange-900 font-bold px-2 py-0.5 rounded-md">
                        อนุมัติ & รันงวด TOR
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-600 mb-1">มอบหมายส่งต่อให้ใคร</label>
                        <select
                          value={delegateUser}
                          onChange={e => setDelegateUser(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-orange-200 rounded-xl bg-white font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400 cursor-pointer"
                        >
                          <option value="พี่ฟ้อง">พี่ฟ้อง</option>
                          <option value="พลอย">พลอย</option>
                          <option value="พี่หนึ่ง">พี่หนึ่ง</option>
                          <option value="พี่หมู">พี่หมู</option>
                          <option value="พี่รักษ์">พี่รักษ์</option>
                          <option value="ออม">ออม</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-gray-600 mb-1">กำหนดส่งมอบงาน</label>
                        <input
                          type="date"
                          value={delegateDeadline}
                          onChange={e => setDelegateDeadline(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-orange-200 rounded-xl bg-white font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400 cursor-pointer"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleDelegateSubmit}
                      className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 active:scale-[0.98] text-white rounded-xl text-xs font-black shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer border border-emerald-600"
                    >
                      <Send className="w-4 h-4 text-emerald-200" />
                      <span>ส่งรายละเอียดและมอบหมาย</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveAll}
                    className="w-full py-3 bg-[#ef6c00] hover:bg-[#d85c00] text-white rounded-xl text-xs font-black shadow-md transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>บันทึกการเปลี่ยนแปลง</span>
                  </button>

                </div>

              </div>
            )}

            {/* TAB 2: ตารางลำดับขั้นตอนโครงการ (ข้อเสนอทุน 9 ขั้นตอน หรือ Flow R&D 10 ขั้นตอน) */}
            {activeTabUnderCard === 'steps' && (
              <div className="space-y-3 pt-2 animate-in fade-in">
                
                {/* Workflow Selector / Locked Flow Bar */}
                <div className="bg-slate-100 p-2 rounded-2xl flex flex-wrap items-center justify-between gap-2 border border-slate-200">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase px-1">
                      {currentTask?.isDraft ? 'เลือกประเภท Flow:' : 'Flow งานที่เลือก:'}
                    </span>

                    {currentTask?.isDraft ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleFlowTypeChange('proposal_9')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                            selectedFlowType === 'proposal_9'
                              ? 'bg-white text-blue-900 shadow-xs border border-blue-200'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                          }`}
                        >
                          🎓 Flow ข้อเสนอทุน (9 ขั้นตอน)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFlowTypeChange('rd_10')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center space-x-1 ${
                            selectedFlowType === 'rd_10'
                              ? 'bg-purple-700 text-white shadow-xs'
                              : 'text-purple-900 bg-purple-100/80 hover:bg-purple-200'
                          }`}
                        >
                          <span>🧪 Flow R&D (10 ขั้นตอน)</span>
                          <span className="text-[9px] bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded-full font-black ml-1">
                            RD Flow
                          </span>
                        </button>
                      </>
                    ) : (
                      /* Read-Only / Locked Selected Flow Badge */
                      <div className="flex items-center space-x-2">
                        {selectedFlowType === 'rd_10' ? (
                          <div className="px-3 py-1.5 rounded-xl text-xs font-black bg-purple-700 text-white shadow-xs flex items-center space-x-1.5">
                            <span>🧪 Flow R&D (10 ขั้นตอน)</span>
                            <span className="text-[9px] bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded-full font-black">
                              RD Flow
                            </span>
                          </div>
                        ) : (
                          <div className="px-3 py-1.5 rounded-xl text-xs font-black bg-white text-blue-900 shadow-xs border border-blue-200 flex items-center space-x-1.5">
                            <span>🎓 Flow ข้อเสนอทุน (9 ขั้นตอน)</span>
                          </div>
                        )}
                        <span className="text-[10px] text-slate-500 font-bold bg-slate-200/80 px-2.5 py-1 rounded-lg flex items-center space-x-1 border border-slate-300/60">
                          <Lock className="w-3 h-3 text-slate-500" />
                          <span>เริ่มงานแล้ว (ไม่สามารถเปลี่ยน Flow ได้)</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-md">
                      #{currentTask.code}
                    </span>
                    <h2 className="text-sm font-black text-slate-900 mt-1">
                      {selectedFlowType === 'rd_10'
                        ? 'ตารางลำดับขั้นตอน Flow R&D (10 ขั้นตอน)'
                        : 'ตารางลำดับขั้นตอนข้อเสนอโครงการ (9 ขั้นตอน)'}
                    </h2>
                  </div>
                  <span className="text-xs font-extrabold text-orange-600 bg-orange-50 border border-orange-200 px-3 py-1 rounded-full self-start sm:self-auto">
                    กำหนดส่ง: {projectDeadline}
                  </span>
                </div>

                {/* Process Steps List */}
                <div className="space-y-2 pt-1">
                  {(selectedFlowType === 'rd_10' ? RD_STEPS : KU_STEPS).map(step => {
                    const currentStatus = stepStatuses[step.stepNumber] || 'not_started';
                    const currentAssignee = stepAssignees[step.stepNumber] || step.defaultAssignee;

                    const isCompleted = currentStatus === 'completed';
                    const isInProgress = currentStatus === 'in_progress';

                    return (
                      <div
                        key={step.id}
                        className={`p-3 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isInProgress
                            ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-200/50'
                            : isCompleted
                            ? 'bg-emerald-50/40 border-emerald-200'
                            : 'bg-white border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-xs shrink-0 ${
                              isCompleted
                                ? 'bg-emerald-100 text-emerald-700'
                                : isInProgress
                                ? 'bg-orange-500 text-white shadow-xs ring-4 ring-orange-100'
                                : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            ) : (
                              <span>{step.stepNumber}</span>
                            )}
                          </div>

                          <div className="min-w-0">
                            <h4
                              className={`text-xs font-black truncate ${
                                isInProgress
                                  ? 'text-amber-950'
                                  : isCompleted
                                  ? 'text-slate-800'
                                  : 'text-slate-600'
                              }`}
                            >
                              {step.title}
                            </h4>
                            <p className="text-[10px] text-slate-400 truncate">
                              {step.subtitle}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                          <select
                            value={
                              currentStatus === 'completed'
                                ? 'เสร็จแล้ว'
                                : currentStatus === 'in_progress'
                                ? 'กำลังดำเนินการ'
                                : 'ยังไม่เริ่ม'
                            }
                            onChange={e => {
                              const val = e.target.value;
                              const statusKey =
                                val === 'เสร็จแล้ว'
                                  ? 'completed'
                                  : val === 'กำลังดำเนินการ'
                                  ? 'in_progress'
                                  : 'not_started';
                              handleStepStatusChange(step.stepNumber, statusKey);
                            }}
                            className={`px-3 py-1.5 text-xs font-bold border rounded-xl focus:outline-none cursor-pointer ${
                              currentStatus === 'completed'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : currentStatus === 'in_progress'
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}
                          >
                            <option value="ยังไม่เริ่ม">ยังไม่เริ่ม</option>
                            <option value="กำลังดำเนินการ">กำลังดำเนินการ</option>
                            <option value="เสร็จแล้ว">เสร็จแล้ว</option>
                          </select>

                          <select
                            value={currentAssignee}
                            onChange={e =>
                              handleStepAssigneeChange(step.stepNumber, e.target.value)
                            }
                            className="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50/80 text-slate-700 focus:outline-none cursor-pointer"
                          >
                            <option value="พลอย">พลอย</option>
                            <option value="พี่ฟ้อง">พี่ฟ้อง</option>
                            <option value="พี่หนึ่ง">พี่หนึ่ง</option>
                            <option value="พี่หมู">พี่หมู</option>
                            <option value="พี่รักษ์">พี่รักษ์</option>
                            <option value="ออม">ออม</option>
                            <option value="หน่วยงานผู้พิจารณา">หน่วยงานผู้พิจารณา</option>
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 bg-blue-50/40 p-3.5 rounded-2xl border-blue-100/60 mt-3">
                  <div className="flex items-center space-x-2 text-xs text-blue-950 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>
                      เมื่อขั้นตอนข้อเสนอเสร็จสิ้น ให้ใช้สลับแท็บไปที่ <strong className="text-blue-800 font-extrabold">"ภาพรวม & รายละเอียด"</strong> หรือ <strong className="text-blue-800 font-extrabold">"การรับงวดส่งมอบ & งบประมาณ"</strong> เพื่อติดตามงวด TOR
                    </span>
                  </div>
                </div>

              </div>
            )}

            {/* TAB 4: สถานะการเบิกเงิน (FLOW การเบิกเงินงวดโครงการ & อาจารย์หนุ่ย) */}
            {activeTabUnderCard === 'payout' && (
              <div className="space-y-4 pt-2 animate-in fade-in">
                <div className="bg-emerald-950 text-emerald-100 px-4 py-2.5 rounded-2xl text-xs font-black flex items-center justify-between border border-emerald-800 shadow-md">
                  <div className="flex items-center space-x-2.5">
                    <DollarSign className="w-4 h-4 text-amber-300 shrink-0" />
                    <div>
                      <span className="font-black text-white text-xs">💸 สถานะการเบิกเงินโครงการ & ผู้ถือเงิน</span>
                      <span className="ml-2 text-[10px] text-emerald-300 font-normal hidden sm:inline">
                        (ระบบติดตามสถานะเบิกเงิน ยอดคงเหลือ และตารางเบิกจ่าย)
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] bg-emerald-800 text-emerald-200 px-2.5 py-1 rounded-lg font-extrabold border border-emerald-700 shrink-0">
                    Payout Status Active
                  </span>
                </div>
                <KUMilestonesView task={currentTask} showOnlyPayout={true} />
              </div>
            )}
            {activeTabUnderCard === 'tor' && (
              <div className="space-y-4 pt-2 animate-in fade-in">
                {(() => {
                  const isTorUnlocked =
                    isSubmittedAndAssigned ||
                    currentTask?.kuProposalStatus === '8_approved_run_terms' ||
                    (Object.keys(stepStatuses).length > 0 &&
                      Object.values(stepStatuses).every(s => s === 'completed'));

                  if (isTorUnlocked) {
                    return (
                      <div id="tor-milestones-section" className="space-y-4">
                        <div className="bg-emerald-950 text-emerald-100 px-4 py-2.5 rounded-2xl text-xs font-black flex items-center justify-between border border-emerald-800 shadow-md">
                          <div className="flex items-center space-x-2.5">
                            <GraduationCap className="w-4 h-4 text-emerald-400 shrink-0" />
                            <div>
                              <span className="font-black text-white text-xs">🎓 การรับงวดส่งมอบ และ ยอดเงินงบประมาณ</span>
                              <span className="ml-2 text-[10px] text-emerald-300 font-normal hidden sm:inline">
                                (สถานะ: ปลดล็อกแล้ว สามารถบันทึกงวดส่งมอบได้)
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] bg-emerald-800 text-emerald-200 px-2.5 py-1 rounded-lg font-extrabold border border-emerald-700 shrink-0">
                            TOR Active
                          </span>
                        </div>
                        <KUMilestonesView task={currentTask} />
                      </div>
                    );
                  }

                  return (
                    <div id="tor-milestones-section" className="bg-amber-50/90 border-2 border-dashed border-amber-300 rounded-2xl p-5 text-amber-950 flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xs">
                      <div className="flex items-center space-x-3.5">
                        <div className="p-3 bg-amber-200/80 text-amber-900 rounded-2xl shrink-0 shadow-2xs">
                          <Lock className="w-5 h-5 text-amber-800" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-black text-amber-950">
                              🔒 ส่วนงวดงานและเงื่อนไขส่งมอบ TOR
                            </span>
                            <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded-md">
                              ยังไม่เปิดใช้งาน
                            </span>
                          </div>
                          <p className="text-xs text-amber-900 font-bold leading-relaxed">
                            ส่วนนี้จะแสดงเมื่อ ตารางลำดับขั้นตอนข้อเสนอโครงการ มีสถานะเสร็จสิ้นทั้งหมดและถูกกดปุ่มส่งรายละเอียดและมอบหมาย
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleDelegateSubmit}
                        className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-black shadow-md transition-all shrink-0 flex items-center space-x-2 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5 text-emerald-200" />
                        <span>ส่งรายละเอียดและมอบหมาย (ปลดล็อก TOR)</span>
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}

          </div>

        </div>
      ) : (
        /* ================= CARDS GRID VIEW (Primary View for KU Projects) ================= */
        <div className="space-y-6">
          
          {/* Header Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white p-6 rounded-2xl shadow-md border border-emerald-700/50">
            <div>
              <div className="flex items-center space-x-2">
                <GraduationCap className="w-6 h-6 text-emerald-300" />
                <h1 className="text-xl md:text-2xl font-black tracking-tight">
                  งานโครงการ (รวม {kuTasks.length} โครงการ)
                </h1>
              </div>
              <p className="text-xs text-emerald-200 mt-1 font-medium">
                รายการการ์ดงานโครงการ ติดตามสถานะข้อเสนอทุน ขั้นตอนปรับแก้ และการส่งมอบตามงวด
              </p>
            </div>

            <button
              onClick={() => setShowQuickCreateModal(true)}
              className="px-5 py-2.5 bg-[#ef6c00] hover:bg-[#d85c00] text-white rounded-xl text-xs font-black shadow-md transition-all flex items-center space-x-1.5 shrink-0 self-start md:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>สร้างการ์ดงานโครงการ</span>
            </button>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            
            {/* Search input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหาตามชื่อโครงการ, รหัส #KU-..., หรือชื่อผู้รับผิดชอบ..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2">

              {/* Filter by Owner */}
              <div className="flex items-center space-x-1 text-xs font-bold text-gray-600 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <select
                  value={filterOwner}
                  onChange={e => setFilterOwner(e.target.value)}
                  className="bg-transparent focus:outline-none font-bold text-gray-800 cursor-pointer"
                >
                  <option value="all">ผู้รับผิดชอบทั้งหมด</option>
                  <option value="พลอย">พลอย</option>
                  <option value="พี่ฟ้อง">พี่ฟ้อง</option>
                  <option value="พี่หนึ่ง">พี่หนึ่ง</option>
                  <option value="พี่หมู">พี่หมู</option>
                  <option value="พี่รักษ์">พี่รักษ์</option>
                  <option value="ออม">ออม</option>
                </select>
              </div>

              {/* Filter by Start Date (วันที่สร้างการ์ดโครงการ) */}
              <div className="flex items-center space-x-1.5 text-xs font-bold text-gray-700 bg-gray-50 border border-gray-200 px-2.5 py-1.5 rounded-xl">
                <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-[11px] text-gray-500 font-semibold whitespace-nowrap">เริ่ม:</span>
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={e => setFilterStartDate(e.target.value)}
                  className="bg-transparent focus:outline-none font-bold text-gray-800 text-xs cursor-pointer"
                  title="กรองตามวันที่สร้างการ์ดโครงการ (เริ่มต้น)"
                />
              </div>

              {/* Filter by End Date (วันที่สิ้นสุด Plan ส่งงาน) */}
              <div className="flex items-center space-x-1.5 text-xs font-bold text-gray-700 bg-gray-50 border border-gray-200 px-2.5 py-1.5 rounded-xl">
                <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="text-[11px] text-gray-500 font-semibold whitespace-nowrap">สิ้นสุด Plan:</span>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={e => setFilterEndDate(e.target.value)}
                  className="bg-transparent focus:outline-none font-bold text-gray-800 text-xs cursor-pointer"
                  title="กรองตามวันที่สิ้นสุด plan ส่งงาน"
                />
              </div>

              {/* Reset Filters button */}
              {(filterStartDate || filterEndDate || filterOwner !== 'all' || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterOwner('all');
                    setFilterStartDate('');
                    setFilterEndDate('');
                  }}
                  className="px-2.5 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-all cursor-pointer flex items-center space-x-1 shrink-0"
                  title="ล้างตัวกรองทั้งหมด"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>ล้างตัวกรอง</span>
                </button>
              )}

            </div>

          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTasks.length === 0 ? (
              <div className="col-span-full bg-white p-12 text-center rounded-2xl border border-dashed border-gray-300 space-y-2">
                <GraduationCap className="w-10 h-10 text-gray-300 mx-auto" />
                <p className="text-sm font-bold text-gray-600">ไม่พบการ์ดโครงการที่ตรงกับเงื่อนไข</p>
                <p className="text-xs text-gray-400">ลองเปลี่ยนคำค้นหาหรือตัวกรอง หรือกดปุ่ม + สร้างการ์ดโครงการ</p>
              </div>
            ) : (
              filteredTasks.map(task => {
                const stepNum = getStepNumberFromStatus(task.kuProposalStatus);
                const stepTitle = getStepTitle(stepNum);
                const progressPct = Math.round((stepNum / 9) * 100);

                // Total budget calculation
                const totalBudgetNum = task.milestones?.reduce((sum, m) => sum + m.amount, 0) || 1200000;

                return (
                  <div
                    key={task.id}
                    onClick={() => handleSelectCard(task)}
                    className="bg-white rounded-2xl border border-gray-200 hover:border-emerald-500 shadow-2xs hover:shadow-md transition-all cursor-pointer p-4 space-y-3.5 flex flex-col justify-between group"
                  >
                    <div className="space-y-2.5">
                      {/* Top Code Badge & Step Badge */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md flex items-center space-x-1">
                          <GraduationCap className="w-3 h-3 text-emerald-600" />
                          <span>#{task.code}</span>
                        </span>

                        <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                          stepNum >= 8
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            : stepNum >= 4
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-blue-50 text-blue-800 border-blue-200'
                        }`}>
                          ขั้นตอนที่ {stepNum}/9: {stepTitle.split('—')[0]}
                        </span>
                      </div>

                      {/* Project Title */}
                      <h3 className="text-sm font-black text-gray-900 group-hover:text-emerald-700 transition-colors line-clamp-2 leading-snug">
                        {task.title}
                      </h3>

                      {/* Description preview */}
                      <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                        {task.description}
                      </p>
                    </div>

                    <div className="space-y-3 pt-2 border-t border-gray-100">
                      
                      {/* Mini Step Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-bold text-gray-500">
                          <span>ความคืบหน้าข้อเสนอ ({stepNum}/9)</span>
                          <span className="text-emerald-700">{progressPct}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Owner & Budget details */}
                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div className="bg-gray-50 p-2 rounded-xl border border-gray-100 space-y-0.5">
                          <p className="text-[10px] font-bold text-gray-400">ผู้รับผิดชอบ</p>
                          <p className="font-extrabold text-gray-800 truncate">
                            {task.assignedToUserName?.replace(/\s*\([^)]*\)/g, '').trim()}
                          </p>
                        </div>

                        <div className="bg-orange-50/60 p-2 rounded-xl border border-orange-100 space-y-0.5">
                          <p className="text-[10px] font-bold text-orange-400">มูลค่ารวมงวด</p>
                          <p className="font-black text-orange-600 truncate">฿{totalBudgetNum.toLocaleString()}</p>
                        </div>
                      </div>

                      {/* Deadline & Action button */}
                      <div className="flex items-center justify-between pt-1 text-xs">
                        <div className="flex items-center space-x-1 text-gray-500 font-bold text-[11px]">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          <span>กำหนดส่ง: {task.kuDeadline || task.deadlineAt?.split('T')[0] || 'ไม่ระบุ'}</span>
                        </div>

                        <span className="text-xs font-black text-emerald-700 group-hover:translate-x-1 transition-transform flex items-center space-x-0.5">
                          <span>จัดการขั้นตอน</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>

                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>
      )}

      {/* Quick Create Card Modal */}
      {showQuickCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center space-x-2">
                <GraduationCap className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-black text-gray-900">สร้างการ์ดโครงการใหม่</h3>
              </div>
              <button
                onClick={() => setShowQuickCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNewCard} className="space-y-4 text-xs">
              
              <div className="space-y-1">
                <label className="block font-bold text-gray-700">ชื่อข้อเสนอ/โครงการ *</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น โครงการวิจัยเตาอบพลังงานชีวมวล"
                  value={newCardTitle}
                  onChange={e => setNewCardTitle(e.target.value)}
                  className="w-full p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-gray-700">ผู้รับผิดชอบหลัก</label>
                  <select
                    value={newCardOwner}
                    onChange={e => setNewCardOwner(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  >
                    <option value="พลอย">พลอย</option>
                    <option value="พี่ฟ้อง">พี่ฟ้อง</option>
                    <option value="พี่หนึ่ง">พี่หนึ่ง</option>
                    <option value="พี่หมู">พี่หมู</option>
                    <option value="พี่รักษ์">พี่รักษ์</option>
                    <option value="ออม">ออม</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-gray-700">งบประมาณรวม (บาท)</label>
                  <input
                    type="text"
                    value={newCardBudget}
                    onChange={e => setNewCardBudget(e.target.value)}
                    placeholder="1,200,000"
                    className="w-full p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1 bg-emerald-50/40 p-3 rounded-xl border border-emerald-200">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-gray-800 flex items-center space-x-1.5">
                    <span>เลือก Flow งาน</span>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      ข้อมูลมาจาก สร้าง Flow งาน
                    </span>
                  </label>
                  {onOpenCreateFlowModal && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowQuickCreateModal(false);
                        onOpenCreateFlowModal();
                      }}
                      className="text-[11px] font-extrabold text-orange-600 hover:text-orange-700 flex items-center space-x-1 cursor-pointer hover:underline"
                    >
                      <Plus className="w-3 h-3" />
                      <span>สร้าง/แก้ไข Flow</span>
                    </button>
                  )}
                </div>
                <select
                  value={newCardSelectedFlowId}
                  onChange={e => setNewCardSelectedFlowId(e.target.value)}
                  className="w-full p-2.5 border border-emerald-300 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-gray-800 cursor-pointer text-xs"
                >
                  <option value="">-- เลือก Flow งาน (ได้ข้อมูลมาจาก สร้าง Flow งาน) --</option>
                  {flowTemplates.map(flow => (
                    <option key={flow.id} value={flow.id}>
                      ⚡ {flow.name} ({flow.checklists.length} ขั้นตอน)
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-500">
                  * เมื่อเลือก Flow งาน ระบบจะนำขั้นตอนใน Flow มาสร้างเป็น Checklist ประจำการ์ดโครงการโดยอัตโนมัติ
                </p>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-gray-700">กรอบเวลาส่งมอบโครงการ</label>
                <input
                  type="date"
                  value={newCardDeadline}
                  onChange={e => setNewCardDeadline(e.target.value)}
                  className="w-full p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                />
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowQuickCreateModal(false)}
                  className="px-4 py-2 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-xs"
                >
                  สร้างการ์ดโครงการ
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Pop up ยืนยันการลบการ์ดโครงการกรณีสร้างผิด */}
      {showDeleteConfirmModal && taskToDelete && (
        <DeleteTaskConfirmModal
          code={taskToDelete.code}
          title={taskToDelete.title}
          onCancel={() => {
            setShowDeleteConfirmModal(false);
            setTaskToDelete(null);
          }}
          onConfirm={handleConfirmDelete}
        />
      )}

    </div>
  );
};
