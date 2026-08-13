import React, { useState } from 'react';
import { Task, ProjectCategory } from '../types';
import { useApp } from '../context/AppContext';
import { TaskCard } from './TaskCard';
import { KUProjectDashboardView } from './KUProjectDashboardView';
import { ExportReportModal } from './ExportReportModal';
import {
  Search,
  Filter,
  Layers,
  User,
  Plus,
  Info,
  Clock,
  CheckCircle2,
  AlertTriangle,
  GraduationCap,
  PenTool,
  Grid,
  Briefcase,
  Workflow,
  FileText,
} from 'lucide-react';

interface KanbanBoardProps {
  onOpenSubmitModal: (task: Task) => void;
  onOpenDetailModal: (task: Task) => void;
  onOpenCreateModal: () => void;
  onOpenCreateFlowModal?: () => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  onOpenSubmitModal,
  onOpenDetailModal,
  onOpenCreateModal,
  onOpenCreateFlowModal,
}) => {
  const { tasks, projects, users } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>('all');
  const [selectedSlaFilter, setSelectedSlaFilter] = useState<string>('all');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === 'all' || task.category === selectedCategory;

    const matchesProject =
      selectedProjectId === 'all' || task.projectId === selectedProjectId;

    const matchesAssignee =
      selectedAssigneeId === 'all' || task.assignedToUserId === selectedAssigneeId;

    const matchesSla =
      selectedSlaFilter === 'all' || task.slaStatus === selectedSlaFilter;

    return matchesSearch && matchesCategory && matchesProject && matchesAssignee && matchesSla;
  });

  const column1Tasks = filteredTasks.filter(t => t.status === 'pending_submission');
  const column2Tasks = filteredTasks.filter(t => t.status === 'pending_review');
  const column3Tasks = filteredTasks.filter(t => t.status === 'returned');
  const column4Tasks = filteredTasks.filter(t => t.status === 'approved');

  // Quick user tabs for "พี่หนึ่ง", "พี่ฟ้อง", "พลอย"
  const quickUsers = users.filter(u => u.status === 'approved');

  return (
    <div className="space-y-6">
      
      {/* Technical Dashboard Summary Stats Header */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col lg:flex-row items-stretch lg:items-center justify-between shadow-xs gap-4">
        <div className="flex items-center gap-6 sm:gap-8 overflow-x-auto pb-2 lg:pb-0">
          <div className="text-center shrink-0">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">งานทั้งหมด</p>
            <p className="text-2xl font-black" style={{ color: '#ef6c00' }}>{tasks.length}</p>
          </div>
          <div className="w-[1px] h-9 bg-gray-200 shrink-0"></div>
          <div className="text-center shrink-0">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">อนุมัติแล้ว</p>
            <p className="text-2xl font-black text-[#72d572]">{column4Tasks.length}</p>
          </div>
          <div className="w-[1px] h-9 bg-gray-200 shrink-0"></div>
          <div className="text-center shrink-0">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">รอตรวจ</p>
            <p className="text-2xl font-black text-amber-500">{column2Tasks.length}</p>
          </div>
          <div className="w-[1px] h-9 bg-gray-200 shrink-0"></div>
          <div className="text-center shrink-0">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">ล่าช้า (SLA)</p>
            <p className="text-2xl font-black text-[#bf360c]">
              {tasks.filter(t => t.slaStatus === 'delayed' || t.slaStatus === 'no_update').length}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="px-3.5 py-2 bg-gray-100 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-200 transition-all cursor-pointer flex items-center space-x-1.5"
          >
            <FileText className="w-3.5 h-3.5 text-orange-600" />
            <span>ส่งออกรายงาน</span>
          </button>
          <button
            onClick={onOpenCreateFlowModal}
            className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 border border-purple-300 rounded-xl text-xs font-extrabold text-purple-900 shadow-2xs hover:shadow-xs transition-all cursor-pointer flex items-center space-x-1.5 active:scale-95"
          >
            <Workflow className="w-3.5 h-3.5 text-purple-700" />
            <span>สร้าง Flow งาน</span>
          </button>
          <button
            onClick={onOpenCreateModal}
            className="px-4 py-2 text-white rounded-xl text-xs font-bold shadow-sm transition-all hover:opacity-90 active:scale-95 cursor-pointer"
            style={{ backgroundColor: '#ef6c00' }}
          >
            + สร้างงานใหม่
          </button>
        </div>
      </div>

      {/* Quick User Selection Tabs (จัดกลุ่มดูงานแยกรายบุคคล เช่น พี่หนึ่ง, พี่ฟ้อง, พลอย) */}
      <div className="bg-[#ef6c00] text-white p-3.5 sm:p-4 rounded-2xl shadow-md space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <span className="text-xs sm:text-sm font-black uppercase tracking-wide flex items-center space-x-1.5">
            <User className="w-4 h-4" />
            <span>เลือกดูการ์ดงานแยกตามผู้รับผิดชอบ (USER TASKS GROUPING)</span>
          </span>
          <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full">
            คลิกที่ชื่อเพื่อกรองการ์ดงานทันที
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <button
            onClick={() => setSelectedAssigneeId('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              selectedAssigneeId === 'all'
                ? 'bg-white text-orange-900 shadow-md font-black scale-102'
                : 'bg-white/20 hover:bg-white/30 text-white'
            }`}
          >
            แสดงผู้รับผิดชอบทุกคน ({tasks.length} งาน)
          </button>

          {quickUsers.map(u => {
            const userTaskCount = tasks.filter(t => t.assignedToUserId === u.id).length;
            const isSelected = selectedAssigneeId === u.id;

            return (
              <button
                key={u.id}
                onClick={() => setSelectedAssigneeId(u.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center space-x-1.5 ${
                  isSelected
                    ? 'bg-white text-orange-950 shadow-md font-black scale-102 ring-2 ring-white/50'
                    : 'bg-white/20 hover:bg-white/30 text-white'
                }`}
              >
                <span>งาน{u.fullName?.replace(/\s*\([^)]*\)/g, '')}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                  isSelected ? 'bg-orange-100 text-orange-900' : 'bg-black/20 text-white'
                }`}>
                  {userTaskCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Category Tabs & Filter Bar */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-gray-200 shadow-2xs space-y-3">
        
        {/* Category Tabs (โปรเจคทั่วไป, โครงการ ม.เกษตร, เขียนแบบ/ภาพ) */}
        <div className="flex items-center space-x-2 border-b border-gray-100 pb-3 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center space-x-1 ${
              selectedCategory === 'all'
                ? 'bg-gray-900 text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>ทุกประเภทโครงการ</span>
          </button>

          <button
            onClick={() => setSelectedCategory('general')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center space-x-1 ${
              selectedCategory === 'general'
                ? 'bg-orange-500 text-white shadow-xs'
                : 'bg-orange-50 text-orange-800 hover:bg-orange-100'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>โปรเจคทั่วไป</span>
          </button>

          <button
            onClick={() => setSelectedCategory('ku_university')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center space-x-1 ${
              selectedCategory === 'ku_university'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>งานโครงการ</span>
          </button>

          <button
            onClick={() => setSelectedCategory('drawing_draft')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center space-x-1 ${
              selectedCategory === 'drawing_draft'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>เขียนแบบ/ภาพ</span>
          </button>
        </div>

        {/* Search & Project Filters */}
        <div className="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
          
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาชื่องาน, รหัส (#NP-204), หรือรายละเอียด..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ef6c00] bg-gray-50/50"
            />
          </div>

          {/* Project & Assignee & SLA Selectors */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            
            {/* Project Filter */}
            <div className="flex items-center space-x-1.5 bg-gray-50 border border-gray-200 px-3 py-2 rounded-xl text-xs min-w-0">
              <Layers className="w-3.5 h-3.5 text-gray-500 shrink-0" />
              <select
                value={selectedProjectId}
                onChange={e => setSelectedProjectId(e.target.value)}
                className="bg-transparent font-medium text-gray-700 focus:outline-none cursor-pointer w-full truncate"
              >
                <option value="all">ทุกโครงการ ({projects.length})</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* SLA Filter */}
            <div className="flex items-center space-x-1.5 bg-gray-50 border border-gray-200 px-3 py-2 rounded-xl text-xs min-w-0">
              <Clock className="w-3.5 h-3.5 text-gray-500 shrink-0" />
              <select
                value={selectedSlaFilter}
                onChange={e => setSelectedSlaFilter(e.target.value)}
                className="bg-transparent font-medium text-gray-700 focus:outline-none cursor-pointer w-full truncate"
              >
                <option value="all">สถานะ SLA ทั้งหมด</option>
                <option value="on_time">🟢 SLA: ON TIME</option>
                <option value="delayed">🟠 SLA: DELAYED</option>
                <option value="no_update">🔴 SLA: NO UPDATE</option>
              </select>
            </div>

          </div>

        </div>

      </div>

      {/* Conditionally render KU Flow view or Standard 4 Kanban Grid Columns */}
      {selectedCategory === 'ku_university' ? (
        <div className="pt-2">
          <KUProjectDashboardView
            onOpenCreateModal={onOpenCreateModal}
            onOpenDetailModal={onOpenDetailModal}
            onOpenCreateFlowModal={onOpenCreateFlowModal}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Col 1: Blue (#81d4fa) */}
          <div className="flex flex-col rounded-xl overflow-hidden border border-blue-200 shadow-xs min-h-[550px] bg-gray-100">
            <div className="bg-[#81d4fa] p-2.5 border-b-2 border-blue-400 flex items-center justify-between">
              <p className="text-xs font-black text-blue-950 uppercase tracking-wider">1. รอส่งงาน</p>
              <span className="bg-white text-blue-900 text-[10px] font-black px-2 py-0.5 rounded-full shadow-2xs">
                {column1Tasks.length}
              </span>
            </div>
            <div className="p-3 space-y-3 flex-1 overflow-y-auto">
              {column1Tasks.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400 border border-dashed border-gray-300 rounded-lg">
                  ไม่มีงานในรายการรอส่ง
                </div>
              ) : (
                column1Tasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onOpenSubmitModal={onOpenSubmitModal}
                    onOpenDetailModal={onOpenDetailModal}
                  />
                ))
              )}
            </div>
          </div>

          {/* Col 2: Yellow (#ffd54f) */}
          <div className="flex flex-col rounded-xl overflow-hidden border border-yellow-200 shadow-xs min-h-[550px] bg-gray-100">
            <div className="bg-[#ffd54f] p-2.5 border-b-2 border-yellow-400 flex items-center justify-between">
              <p className="text-xs font-black text-amber-950 uppercase tracking-wider">2. รอตรวจ</p>
              <span className="bg-white text-amber-950 text-[10px] font-black px-2 py-0.5 rounded-full shadow-2xs">
                {column2Tasks.length}
              </span>
            </div>
            <div className="p-3 space-y-3 flex-1 overflow-y-auto">
              {column2Tasks.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400 border border-dashed border-gray-300 rounded-lg">
                  ไม่มีงานรอตรวจ
                </div>
              ) : (
                column2Tasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onOpenSubmitModal={onOpenSubmitModal}
                    onOpenDetailModal={onOpenDetailModal}
                  />
                ))
              )}
            </div>
          </div>

          {/* Col 3: Red (#bf360c) */}
          <div className="flex flex-col rounded-xl overflow-hidden border border-red-200 shadow-xs min-h-[550px] bg-gray-100">
            <div className="bg-[#bf360c] p-2.5 border-b-2 border-red-900 flex items-center justify-between">
              <p className="text-xs font-black text-white uppercase tracking-wider">3. ตีกลับ</p>
              <span className="bg-white text-[#bf360c] text-[10px] font-black px-2 py-0.5 rounded-full shadow-2xs">
                {column3Tasks.length}
              </span>
            </div>
            <div className="p-3 space-y-3 flex-1 overflow-y-auto">
              {column3Tasks.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400 border border-dashed border-gray-300 rounded-lg">
                  ไม่มีงานที่ถูกตีกลับ
                </div>
              ) : (
                column3Tasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onOpenSubmitModal={onOpenSubmitModal}
                    onOpenDetailModal={onOpenDetailModal}
                  />
                ))
              )}
            </div>
          </div>

          {/* Col 4: Green (#72d572) */}
          <div className="flex flex-col rounded-xl overflow-hidden border border-green-200 shadow-xs min-h-[550px] bg-gray-100">
            <div className="bg-[#72d572] p-2.5 border-b-2 border-green-500 flex items-center justify-between">
              <p className="text-xs font-black text-green-950 uppercase tracking-wider">4. อนุมัติ</p>
              <span className="bg-white text-green-950 text-[10px] font-black px-2 py-0.5 rounded-full shadow-2xs">
                {column4Tasks.length}
              </span>
            </div>
            <div className="p-3 space-y-3 flex-1 overflow-y-auto">
              {column4Tasks.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400 border border-dashed border-gray-300 rounded-lg">
                  ยังไม่มีงานที่อนุมัติเสร็จสิ้น
                </div>
              ) : (
                column4Tasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onOpenSubmitModal={onOpenSubmitModal}
                    onOpenDetailModal={onOpenDetailModal}
                  />
                ))
              )}
            </div>
          </div>

        </div>
      )}

      {/* Export Report Modal */}
      <ExportReportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        tasks={tasks}
        users={users}
        projects={projects}
      />

    </div>
  );

};

