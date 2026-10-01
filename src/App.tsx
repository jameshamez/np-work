import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthScreen } from './components/AuthScreen';
import { AccountStatusScreen } from './components/AccountStatusScreen';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { KanbanBoard } from './components/KanbanBoard';
import { DashboardView } from './components/DashboardView';
import { KUProjectDashboardView } from './components/KUProjectDashboardView';
import { CalendarView } from './components/CalendarView';
import { AuditLogView } from './components/AuditLogView';
import { AdminApprovalView } from './components/AdminApprovalView';
import { BackupModal } from './components/BackupModal';
import { SubmitTaskModal } from './components/SubmitTaskModal';
import { TaskDetailModal } from './components/TaskDetailModal';
import { CreateTaskModal } from './components/CreateTaskModal';
import { CreateFlowModal } from './components/CreateFlowModal';
import { Task } from './types';

function AppContent() {
  const [activeTab, setActiveTab] = useState<string>('kanban');

  // Modals state
  const [submittingTask, setSubmittingTask] = useState<Task | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateFlowModal, setShowCreateFlowModal] = useState(false);

  const { signOut } = useAuth();
  const { tasks } = useApp();

  // เปิดหน้ารายละเอียดด้วยข้อมูลล่าสุดเสมอ — ถ้าส่งตัวที่จำไว้ตอนคลิกเปิด หน้าจะไม่เห็นการแก้ไข
  // ที่เกิดขึ้นทีหลัง (เช่น เพิ่ม/ลบรูปตอนรอตรวจ) และถ้าการ์ดถูกลบไปแล้ว หน้าจะปิดเอง
  const liveDetailTask = detailTask ? tasks.find(t => t.id === detailTask.id) ?? null : null;

  return (
    <div className="min-h-screen bg-[#fffbf2] flex flex-col font-sans text-gray-900 antialiased selection:bg-[#ef6c00] selection:text-white">
      
      {/* Top Navbar */}
      <Navbar
        onOpenCreateModal={() => setShowCreateModal(true)}
        onSignOut={signOut}
      />

      {/* Main Layout */}
      <div className="flex-1 flex flex-col md:flex-row max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 gap-6">
        
        {/* Sidebar Navigation */}
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Tab View Container */}
        <main className="flex-1 min-w-0">
          {activeTab === 'ku_project' && (
            <KUProjectDashboardView
              onOpenCreateModal={() => setShowCreateModal(true)}
              onOpenDetailModal={task => setDetailTask(task)}
              onOpenCreateFlowModal={() => setShowCreateFlowModal(true)}
            />
          )}

          {activeTab === 'kanban' && (
            <KanbanBoard
              onOpenSubmitModal={task => setSubmittingTask(task)}
              onOpenDetailModal={task => setDetailTask(task)}
              onOpenCreateModal={() => setShowCreateModal(true)}
              onOpenCreateFlowModal={() => setShowCreateFlowModal(true)}
            />
          )}

          {(activeTab === 'dashboard' || activeTab === 'milestones') && (
            <DashboardView />
          )}

          {activeTab === 'calendar' && (
            <CalendarView onOpenDetailModal={task => setDetailTask(task)} />
          )}

          {activeTab === 'logs' && (
            <AuditLogView onOpenDetailModal={task => setDetailTask(task)} />
          )}

          {activeTab === 'admin' && <AdminApprovalView />}

          {activeTab === 'backup' && <BackupModal />}
        </main>

      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-4 text-center text-xs text-gray-400 print:hidden mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>TASK-FLOW © 2026 • ระบบติดตามโครงการ ม.เกษตร และงานทั่วไป</span>
          <div className="flex items-center space-x-3 text-[11px]">
            <span className="text-[#ef6c00] font-bold">Theme KU Flow (#ef6c00)</span>
            <span>•</span>
            <span>SLA Auto Engine</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      {submittingTask && (
        <SubmitTaskModal
          task={submittingTask}
          onClose={() => setSubmittingTask(null)}
        />
      )}

      {liveDetailTask && (
        <TaskDetailModal
          task={liveDetailTask}
          onClose={() => setDetailTask(null)}
          onOpenSubmitModal={task => {
            setDetailTask(null);
            setSubmittingTask(task);
          }}
        />
      )}

      {showCreateModal && (
        <CreateTaskModal onClose={() => setShowCreateModal(false)} />
      )}

      {showCreateFlowModal && (
        <CreateFlowModal onClose={() => setShowCreateFlowModal(false)} />
      )}

    </div>
  );
}

/**
 * ด่านตรวจสิทธิ์ก่อนเข้าแอป
 *   กำลังเช็ค session -> หน้าโหลด
 *   ยังไม่ล็อกอิน       -> หน้าเข้าสู่ระบบ
 *   ล็อกอินแล้วแต่ยังไม่ได้รับอนุมัติ -> หน้าแจ้งสถานะบัญชี
 *   ผ่านทั้งหมด        -> เข้าใช้งานระบบ
 */
function AuthGate() {
  const { loading, session, profile } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fffbf2] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-7 h-7 animate-spin text-[#ef6c00]" />
        <span className="text-xs font-bold text-gray-500">กำลังตรวจสอบสิทธิ์การเข้าใช้งาน...</span>
      </div>
    );
  }

  if (!session) return <AuthScreen />;
  if (!profile) return <AccountStatusScreen variant="missing" />;
  if (profile.status === 'pending') return <AccountStatusScreen variant="pending" />;
  if (profile.status === 'rejected') return <AccountStatusScreen variant="rejected" />;

  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
