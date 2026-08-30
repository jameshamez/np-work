import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  User,
  Project,
  Task,
  TaskLog,
  TaskDeletionLog,
  NotificationItem,
  Attachment,
  ProjectCategory,
  KUProposalStatus,
  ProjectMilestone,
  ImageAnnotation,
  FlowTemplate,
  ChecklistItem,
  TwoTierFinancials,
} from '../types';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import * as api from '../lib/api';
import * as lineApi from '../lib/lineApi';

export interface AppContextType {
  currentUser: User | null;
  users: User[];
  projects: Project[];
  tasks: Task[];
  logs: TaskLog[];
  /** ประวัติการลบการ์ดงาน — ผู้ใช้ทั่วไปจะได้ลิสต์ว่างตาม RLS */
  deletionLogs: TaskDeletionLog[];
  notifications: NotificationItem[];
  flowTemplates: FlowTemplate[];
  lineEnabled: boolean;

  /** กำลังโหลดข้อมูลชุดแรกจากฐานข้อมูล */
  loading: boolean;
  /** ข้อความ error ล่าสุด (null = ไม่มีปัญหา) */
  error: string | null;
  /** ดึงข้อมูลทั้งหมดใหม่จากฐานข้อมูล */
  refreshAll: () => Promise<void>;

  addProject: (name: string) => Promise<Project>;
  addFlowTemplate: (data: {
    name: string;
    category?: ProjectCategory;
    description?: string;
    checklists: string[];
  }) => Promise<FlowTemplate>;
  updateFlowTemplate: (id: string, data: {
    name?: string;
    category?: ProjectCategory;
    description?: string;
    checklists?: string[];
  }) => void;
  deleteFlowTemplate: (id: string) => void;
  deleteTask: (taskId: string) => void;
  toggleLineEnabled: () => void;

  setCurrentUserId: (id: string) => void;
  approveUser: (userId: string) => void;
  rejectUser: (userId: string) => void;
  createTask: (data: {
    title: string;
    description: string;
    projectId: string;
    assignedToUserId: string;
    planDays: number;
    checklists?: (string | ChecklistItem)[];
    category?: ProjectCategory;
    code?: string;
    kuProposalStatus?: KUProposalStatus;
    kuDeadline?: string;
    assignedTargetUserId?: string;
    assignedTargetUserName?: string;
    isDraft?: boolean;
    attachments?: Attachment[];
    milestones?: ProjectMilestone[];
    deadlineAt?: string;
  }) => void;
  duplicateTask: (taskId: string) => void;
  saveTaskDraft: (data: Partial<Task>) => void;
  updateKUStatus: (taskId: string, newKuStatus: KUProposalStatus, nextAssignedUserId?: string) => void;
  addMilestone: (taskId: string, milestone: Omit<ProjectMilestone, 'id'>) => void;
  updateMilestones: (taskId: string, milestones: ProjectMilestone[]) => void;
  updateTaskHolderName: (taskId: string, holderName: string) => void;
  updateTaskFinancials: (taskId: string, financials: TwoTierFinancials) => void;
  addAnnotation: (taskId: string, annotation: Omit<ImageAnnotation, 'id' | 'createdAt' | 'authorName'>) => void;
  updateChecklist: (
    taskId: string,
    checklistId: string,
    completed: boolean,
    resultStatus?: 'success' | 'fail',
    resultReason?: string
  ) => void;
  submitTaskForReview: (
    taskId: string,
    comment: string,
    attachmentsData: { name: string; url: string; type: 'image' | 'file'; size: number }[]
  ) => void;
  returnTask: (taskId: string, comment: string) => void;
  approveTask: (taskId: string, comment: string) => void;
  markNotificationRead: (notifId: string) => void;
  clearAllNotifications: () => void;
  exportBackup: () => void;
  resetDataToDefault: () => void;
  updateUserNotificationSettings: (
    userId: string,
    settings: { noUpdateAlertHours?: number }
  ) => void;
  checkNoUpdateTasksAndNotify: (targetUserIds?: string[]) => number;
  sendTestLineMessage: () => void;
  sendCustomNotificationToUsers: (userIds: string[], title: string, customMessage: string) => void;
  /** ดึงคิวข้อความ LINE ล่าสุดมาแสดงในแผงสถานะของแอดมิน — โยน error ออกมาให้ผู้เรียกจัดการเอง */
  fetchLineQueue: () => Promise<lineApi.LineOutboxRow[]>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const KU_STATUS_TITLES: Record<KUProposalStatus, string> = {
  '1_draft_proposal': 'เขียนข้อเสนอ ร่าง',
  '2_aj_nui_open': 'อาจารย์หนุ่ยเปิด',
  '3_ploy_revision': 'พลอยปรับแก้',
  '4_wait_aj_nui_approval': 'รออาจารย์หนุ่ยอนุมัติ',
  '5_ploy_system_submit': 'พลอยกรอกข้อมูลเข้าระบบ',
  '6_agency_review': 'รอพิจารณาโดยหน่วยงานที่เราขอ',
  '7_passed_with_revision': 'ผ่านแต่มีการกลับมาให้แก้ข้อมูลอีกครั้ง',
  '8_approved_run_terms': 'อนุมัติ : เริ่มรันงวด (ส่ง TOR)',
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const db = supabase!; // AuthGate ปล่อยให้ถึงตรงนี้เฉพาะตอนที่ล็อกอินสำเร็จแล้วเท่านั้น

  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [deletionLogs, setDeletionLogs] = useState<TaskDeletionLog[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [flowTemplates, setFlowTemplates] = useState<FlowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Super Admin สลับมุมมองเพื่อดูหน้าจอในสิทธิ์ของคนอื่นได้ (มีผลกับการแสดงผลเท่านั้น
  // สิทธิ์จริงตอนอ่าน/เขียนยังถูกบังคับด้วย RLS ตามบัญชีที่ล็อกอินจริงเสมอ)
  const [viewAsUserId, setViewAsUserId] = useState<string>('');

  const currentUser =
    users.find(u => u.id === (viewAsUserId || profile?.id)) ??
    users.find(u => u.id === profile?.id) ??
    null;

  const [lineEnabled, setLineEnabled] = useState(false);

  // อ่านค่าสวิตช์ LINE ตอนเข้าระบบ — ผู้ใช้ทั่วไปอ่านไม่ได้ตาม RLS จึงได้ false ไป
  useEffect(() => {
    if (!db) return;
    void (async () => {
      try {
        const config = await lineApi.fetchLineConfig(db);
        setLineEnabled(config?.enabled ?? false);
      } catch {
        setLineEnabled(false);
      }
    })();
  }, [db, currentUser?.id]);

  const toggleLineEnabled = () => {
    const next = !lineEnabled;
    setLineEnabled(next);  // ตอบสนองทันที
    void run(async () => {
      try {
        await lineApi.setLineEnabled(db, next);
      } catch (e) {
        setLineEnabled(!next);  // ย้อนกลับถ้าบันทึกไม่ผ่าน
        throw e;
      }
    });
  };

  /** ครอบการเรียก API ทุกครั้ง เพื่อให้ error ไปโผล่บนหน้าจอแทนที่จะเงียบหายไปใน console */
  const run = useCallback(async (action: () => Promise<void>) => {
    try {
      setError(null);
      await action();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(message);
      setError(message);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    const snapshot = await api.fetchSnapshot(db);
    setUsers(snapshot.users);
    setProjects(snapshot.projects);
    setTasks(snapshot.tasks);
    setLogs(snapshot.logs);
    setNotifications(snapshot.notifications);
    setFlowTemplates(snapshot.flowTemplates);
    setDeletionLogs(snapshot.deletionLogs);
  }, [db]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const snapshot = await api.fetchSnapshot(db);
        if (!active) return;
        setUsers(snapshot.users);
        setProjects(snapshot.projects);
        setTasks(snapshot.tasks);
        setLogs(snapshot.logs);
        setNotifications(snapshot.notifications);
        setFlowTemplates(snapshot.flowTemplates);
        setDeletionLogs(snapshot.deletionLogs);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [db]);

  /** โหลดงานใบเดียวใหม่หลังแก้ไข แทนที่จะดึงใหม่ทั้งกระดาน */
  const refreshTask = useCallback(
    async (taskId: string) => {
      const fresh = await api.fetchTask(db, taskId);
      setTasks(prev => (fresh ? prev.map(t => (t.id === taskId ? fresh : t)) : prev.filter(t => t.id !== taskId)));
    },
    [db]
  );

  const refreshLogsAndNotifications = useCallback(async () => {
    const [freshLogs, freshNotifs] = await Promise.all([api.fetchLogs(db), api.fetchNotifications(db)]);
    setLogs(freshLogs);
    setNotifications(freshNotifs);
  }, [db]);

  // ---------------------------------------------------------------------------
  // โครงการ
  // ---------------------------------------------------------------------------
  const addProject = useCallback(
    async (name: string): Promise<Project> => {
      const trimmed = name.trim();
      const existing = projects.find(p => p.name.trim().toLowerCase() === trimmed.toLowerCase());
      if (existing) return existing;

      const created = await api.createProject(db, trimmed);
      setProjects(prev => [created, ...prev]);
      return created;
    },
    [db, projects]
  );

  // ---------------------------------------------------------------------------
  // งาน
  // ---------------------------------------------------------------------------
  const createTask: AppContextType['createTask'] = data => {
    if (!profile) return;

    const warnings: string[] = [];
    if (!data.title.trim()) warnings.push('ยังไม่ได้กรอกชื่อการ์ดงาน');
    if (!data.projectId) warnings.push('ยังไม่ได้เลือกโปรเจกต์');
    if (!data.assignedToUserId) warnings.push('ยังไม่ได้ระบุผู้รับผิดชอบ');

    const project = projects.find(p => p.id === data.projectId);
    const deadline =
      data.deadlineAt || new Date(Date.now() + data.planDays * 24 * 60 * 60 * 1000).toISOString();

    void run(async () => {
      const taskId = await api.createTask(db, {
        title: data.title || 'ร่างงานไม่มีชื่อ',
        description: data.description || '',
        projectId: data.projectId,
        assignedToUserId: data.assignedToUserId,
        assignedToUserName:
          users.find(u => u.id === data.assignedToUserId)?.fullName ?? profile.full_name,
        createdByUserId: profile.id,
        createdByUserName: profile.full_name,
        planDays: data.planDays,
        deadlineAt: deadline,
        code: data.code,
        category: data.category || project?.category || 'general',
        kuProposalStatus:
          data.kuProposalStatus || (data.category === 'ku_university' ? '1_draft_proposal' : undefined),
        kuDeadline: data.kuDeadline,
        assignedTargetUserId: data.assignedTargetUserId,
        isDraft: data.isDraft ?? false,
        incompleteWarnings: warnings,
        checklists: (data.checklists ?? []).map(item =>
          typeof item === 'string'
            ? { title: item, completed: false }
            : {
                title: String(item.title ?? ''),
                completed: !!item.completed,
                resultStatus: item.resultStatus,
                resultReason: item.resultReason,
              }
        ),
        milestones: data.milestones,
        attachments: (data.attachments ?? []).map(a => ({
          fileName: a.fileName,
          fileUrl: a.fileUrl,
          fileType: a.fileType,
          fileSize: a.fileSize,
        })),
      });

      const fresh = await api.fetchTask(db, taskId);
      if (fresh) setTasks(prev => [fresh, ...prev]);
      await refreshLogsAndNotifications();
    });
  };

  const duplicateTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !profile) return;

    void run(async () => {
      const newId = await api.createTask(db, {
        title: `${task.title} (สำเนา)`,
        description: task.description,
        projectId: task.projectId,
        assignedToUserId: task.assignedToUserId,
        assignedToUserName: task.assignedToUserName,
        createdByUserId: profile.id,
        createdByUserName: profile.full_name,
        planDays: task.planDays,
        deadlineAt: new Date(Date.now() + task.planDays * 24 * 60 * 60 * 1000).toISOString(),
        category: task.category,
        kuProposalStatus: task.kuProposalStatus,
        kuDeadline: task.kuDeadline,
        assignedTargetUserId: task.assignedTargetUserId,
        // สำเนาเริ่มนับหนึ่งใหม่: รายการตรวจถูกล้างสถานะ ไม่คัดลอกไฟล์แนบ
        checklists: task.checklists.map(c => ({ title: c.title, completed: false })),
        milestones: task.milestones?.map(({ id: _id, ...rest }) => rest),
      });

      const fresh = await api.fetchTask(db, newId);
      if (fresh) setTasks(prev => [fresh, ...prev]);
      await refreshLogsAndNotifications();
    });
  };

  const deleteTask = (taskId: string) => {
    void run(async () => {
      await api.deleteTask(db, taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      // ประวัติของงานใบนี้หายไปพร้อมกัน และมีแถวใหม่โผล่ในประวัติการลบ
      setLogs(prev => prev.filter(l => l.taskId !== taskId));
      // งานถูกลบสำเร็จไปแล้ว ถ้าดึงประวัติการลบมาแสดงไม่ได้ก็ไม่ควรขึ้นว่า "ลบไม่สำเร็จ"
      try {
        setDeletionLogs(await api.fetchDeletionLogs(db));
      } catch (e) {
        console.warn(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const saveTaskDraft = (data: Partial<Task>) => {
    if (!profile) return;

    if (data.id) {
      const warnings: string[] = [];
      if (!data.title?.trim()) warnings.push('ยังไม่ได้กรอกชื่อการ์ดงาน');
      if (!data.projectId) warnings.push('ยังไม่ได้เลือกโปรเจกต์');

      void run(async () => {
        await api.updateTaskFields(db, data.id!, {
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.projectId !== undefined ? { project_id: data.projectId } : {}),
          ...(data.planDays !== undefined ? { plan_days: data.planDays } : {}),
          ...(data.category !== undefined ? { category: data.category } : {}),
          ...(data.kuProposalStatus !== undefined ? { ku_proposal_status: data.kuProposalStatus } : {}),
          ...(data.kuDeadline !== undefined ? { ku_deadline: data.kuDeadline } : {}),
          is_draft: true,
          incomplete_warnings: warnings,
        });
        await refreshTask(data.id!);
      });
      return;
    }

    createTask({
      title: data.title || 'ร่างการ์ดงานใหม่',
      description: data.description || '',
      projectId: data.projectId || projects[0]?.id || '',
      assignedToUserId: data.assignedToUserId || profile.id,
      planDays: data.planDays || 3,
      category: data.category,
      kuProposalStatus: data.kuProposalStatus,
      kuDeadline: data.kuDeadline,
      isDraft: true,
    });
  };

  const updateKUStatus = (taskId: string, newKuStatus: KUProposalStatus, nextAssignedUserId?: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !profile) return;

    const targetUser = nextAssignedUserId ? users.find(u => u.id === nextAssignedUserId) : undefined;

    void run(async () => {
      await api.updateTaskFields(db, taskId, {
        ku_proposal_status: newKuStatus,
        ...(nextAssignedUserId ? { assigned_to_user_id: nextAssignedUserId } : {}),
      });

      await api.insertNotifications(db, [
        {
          recipientUserId: nextAssignedUserId || task.assignedToUserId,
          title: 'อัปเดตขั้นตอน โครงการ ม.เกษตร',
          message: `โครงการ "${task.title}" ได้เปลี่ยนสถานะเป็น "${KU_STATUS_TITLES[newKuStatus]}"${
            targetUser ? ` และส่งต่อให้ ${targetUser.fullName}` : ''
          }`,
          type: 'ku_status_update',
          taskId,
        },
      ]).catch(e => console.warn('ส่งแจ้งเตือนไม่ได้ (ต้องมีสิทธิ์ผู้ดูแล):', e));

      await refreshTask(taskId);
      await refreshLogsAndNotifications();
    });
  };

  const addMilestone = (taskId: string, milestone: Omit<ProjectMilestone, 'id'>) => {
    void run(async () => {
      await api.addMilestone(db, taskId, milestone);
      await refreshTask(taskId);
    });
  };

  const updateMilestones = (taskId: string, milestones: ProjectMilestone[]) => {
    void run(async () => {
      await api.replaceMilestones(db, taskId, milestones);
      await refreshTask(taskId);
    });
  };

  const updateTaskHolderName = (taskId: string, holderName: string) => {
    void run(async () => {
      await api.updateTaskFields(db, taskId, { holder_name: holderName });
      await refreshTask(taskId);
    });
  };

  const updateTaskFinancials = (taskId: string, financials: TwoTierFinancials) => {
    void run(async () => {
      await api.upsertFinancials(db, taskId, financials);
      await refreshTask(taskId);
    });
  };

  const addAnnotation = (
    taskId: string,
    annotation: Omit<ImageAnnotation, 'id' | 'createdAt' | 'authorName'>
  ) => {
    if (!profile) return;
    void run(async () => {
      await api.addAnnotation(db, taskId, profile.id, profile.full_name, annotation);
      await refreshTask(taskId);
    });
  };

  const updateChecklist = (
    taskId: string,
    checklistId: string,
    completed: boolean,
    resultStatus?: 'success' | 'fail',
    resultReason?: string
  ) => {
    void run(async () => {
      await api.updateChecklistItem(db, checklistId, completed, resultStatus, resultReason);
      await refreshTask(taskId);
    });
  };

  // ---------------------------------------------------------------------------
  // การเปลี่ยนสถานะงาน — ผ่านฟังก์ชันฝั่ง DB ที่เขียน log และแจ้งเตือนให้ครบในครั้งเดียว
  // ---------------------------------------------------------------------------
  const submitTaskForReview = (
    taskId: string,
    comment: string,
    attachmentsData: { name: string; url: string; type: 'image' | 'file'; size: number }[]
  ) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !profile) return;

    const isDelegated = profile.id !== task.assignedToUserId;
    const logComment = isDelegated
      ? `[ส่งแทนโดย ${profile.full_name} ให้แก่ ${task.assignedToUserName}] ${comment}`
      : comment;

    void run(async () => {
      const logId = await api.changeTaskStatus(db, taskId, 'pending_review', logComment, task.assignedToUserId);

      if (attachmentsData.length > 0) {
        await api.insertAttachments(db, taskId, logId ?? null, profile.id, profile.full_name,
          attachmentsData.map(a => ({
            fileName: a.name,
            fileUrl: a.url,
            fileType: a.type,
            fileSize: a.size,
          }))
        );
      }

      await refreshTask(taskId);
      await refreshLogsAndNotifications();
    });
  };

  const returnTask = (taskId: string, comment: string) => {
    void run(async () => {
      await api.changeTaskStatus(db, taskId, 'returned', `[ตีกลับแก้ไข] ${comment}`);
      await refreshTask(taskId);
      await refreshLogsAndNotifications();
    });
  };

  const approveTask = (taskId: string, comment: string) => {
    void run(async () => {
      await api.changeTaskStatus(
        db,
        taskId,
        'approved',
        `[อนุมัติปิดงาน] ${comment || 'ตรวจสอบแล้วถูกต้องผ่านเกณฑ์'}`
      );
      await refreshTask(taskId);
      await refreshLogsAndNotifications();
    });
  };

  // ---------------------------------------------------------------------------
  // ผู้ใช้
  // ---------------------------------------------------------------------------
  const approveUser = (userId: string) => {
    void run(async () => {
      await api.setUserApproval(db, userId, true);
      setUsers(await api.fetchUsers(db));
    });
  };

  const rejectUser = (userId: string) => {
    void run(async () => {
      await api.setUserApproval(db, userId, false);
      setUsers(await api.fetchUsers(db));
    });
  };

  const updateUserNotificationSettings = (
    userId: string,
    settings: { noUpdateAlertHours?: number }
  ) => {
    void run(async () => {
      await api.updateUserSettings(db, userId, settings);
      setUsers(await api.fetchUsers(db));
    });
  };

  // ---------------------------------------------------------------------------
  // แจ้งเตือน
  // ---------------------------------------------------------------------------
  const markNotificationRead = (notifId: string) => {
    setNotifications(prev => prev.map(n => (n.id === notifId ? { ...n, read: true } : n)));
    void run(() => api.markNotificationRead(db, notifId));
  };

  const clearAllNotifications = () => {
    if (!profile) return;
    setNotifications([]);
    void run(() => api.clearNotifications(db, profile.id));
  };

  const checkNoUpdateTasksAndNotify = (targetUserIds?: string[]): number => {
    const now = Date.now();
    const pending: {
      recipientUserId: string;
      title: string;
      message: string;
      type: NotificationItem['type'];
      taskId?: string;
    }[] = [];

    tasks.forEach(task => {
      if (task.status === 'approved') return;

      const recipientId = task.assignedToUserId || task.createdById || '';
      if (targetUserIds?.length && !targetUserIds.includes(recipientId) && !targetUserIds.includes(task.createdById ?? '')) {
        return;
      }

      const owner = users.find(u => u.id === recipientId);
      const alertHours = owner?.noUpdateAlertHours ?? 4;
      const elapsedHours = (now - new Date(task.lastUpdatedAt || task.createdAt).getTime()) / 3_600_000;
      if (elapsedHours < alertHours) return;

      const durationText = alertHours < 1 ? `${Math.round(alertHours * 60)} นาที` : `${alertHours} ชม.`;
      const elapsedText =
        elapsedHours < 1 ? `${Math.round(elapsedHours * 60)} นาที` : `${Math.floor(elapsedHours)} ชม.`;

      pending.push({
        recipientUserId: recipientId,
        title: '⏰ เตือนความจำ: การ์ดงานขาดการอัปเดต',
        message: `การ์ดงาน [${task.code}] "${task.title}" ขาดการอัปเดตเกิน ${durationText} (อัปเดตล่าสุดเมื่อ ${elapsedText} ที่แล้ว)`,
        type: 'sla_warning',
        taskId: task.id,
      });
    });

    if (pending.length > 0) {
      void run(async () => {
        await api.insertNotifications(db, pending);
        setNotifications(await api.fetchNotifications(db));
      });
    }

    return pending.length;
  };

  const sendCustomNotificationToUsers = (userIds: string[], title: string, customMessage: string) => {
    if (!userIds?.length) return;

    void run(async () => {
      // กระดิ่งบนเว็บ — 1 แถวต่อผู้รับ 1 คน (ตั้งใจ เพราะแต่ละคนต้องกดอ่านของตัวเอง)
      await api.insertNotifications(
        db,
        userIds.map(uid => ({
          recipientUserId: uid,
          title: title || '📢 ประกาศแจ้งเตือนพิเศษจาก Super Admin',
          message: customMessage,
          type: 'sla_warning' as const,
        }))
      );

      // LINE — 1 แถวเท่านั้นสำหรับประกาศทั้งก้อน
      // ถ้าวนสร้างทีละคน ประกาศเรื่องเดียวถึง 10 คนจะกลายเป็น 10 ข้อความ
      // และหักโควตา LINE ไป 100 (10 ข้อความ x สมาชิกกลุ่ม 10 คน)
      await lineApi.enqueueLineMessage(
        db,
        'broadcast',
        `📢 ${title || 'ประกาศจากผู้ดูแลระบบ'}\n${customMessage}`
      );

      setNotifications(await api.fetchNotifications(db));
    });
  };

  const sendTestLineMessage = () => {
    void run(async () => {
      await lineApi.enqueueLineMessage(
        db,
        'test',
        '🧪 ทดสอบระบบแจ้งเตือน NP Taskwork — ถ้าเห็นข้อความนี้แปลว่าเชื่อมต่อกลุ่มสำเร็จแล้ว'
      );
    });
  };

  // เจตนาไม่ครอบด้วย run() — ให้ error หลุดออกไปถึงผู้เรียกตรง ๆ
  // เพราะแผงสถานะใน AdminApprovalView ต้องเอาไปแสดงเป็นข้อความของตัวเอง ไม่ใช่ไปโผล่ที่แบนเนอร์กลาง
  const fetchLineQueue = useCallback(() => lineApi.fetchLineOutbox(db), [db]);

  // ---------------------------------------------------------------------------
  // เทมเพลต Flow
  // ---------------------------------------------------------------------------
  const addFlowTemplate = useCallback(
    async (data: {
      name: string;
      category?: ProjectCategory;
      description?: string;
      checklists: string[];
    }): Promise<FlowTemplate> => {
      const created = await api.createFlowTemplate(db, data);
      setFlowTemplates(prev => [...prev, created]);
      return created;
    },
    [db]
  );

  const updateFlowTemplate = (
    id: string,
    data: { name?: string; category?: ProjectCategory; description?: string; checklists?: string[] }
  ) => {
    void run(async () => {
      await api.updateFlowTemplate(db, id, data);
      setFlowTemplates(prev =>
        prev.map(f =>
          f.id === id
            ? {
                ...f,
                ...(data.name !== undefined ? { name: data.name.trim() } : {}),
                ...(data.category !== undefined ? { category: data.category } : {}),
                ...(data.description !== undefined ? { description: data.description } : {}),
                ...(data.checklists !== undefined ? { checklists: data.checklists } : {}),
              }
            : f
        )
      );
    });
  };

  const deleteFlowTemplate = (id: string) => {
    void run(async () => {
      await api.deleteFlowTemplate(db, id);
      setFlowTemplates(prev => prev.filter(f => f.id !== id));
    });
  };

  // ---------------------------------------------------------------------------
  // สำรองข้อมูล
  // ---------------------------------------------------------------------------
  const exportBackup = () => {
    const backupData = {
      exportedAt: new Date().toISOString(),
      appVersion: '2.0.0-supabase',
      users,
      projects,
      tasks,
      logs,
      notifications,
      flowTemplates,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NP_Taskwork_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /**
   * เดิมปุ่มนี้ล้างข้อมูลในเครื่องแล้วยัดข้อมูลตัวอย่างกลับเข้าไป
   * ตอนนี้ข้อมูลอยู่บนฐานข้อมูลกลางแล้ว การล้างทิ้งจะกระทบทุกคน จึงเปลี่ยนเป็นโหลดใหม่แทน
   */
  const resetDataToDefault = () => {
    void run(async () => {
      setLoading(true);
      try {
        await refreshAll();
      } finally {
        setLoading(false);
      }
    });
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        users,
        projects,
        tasks,
        logs,
        deletionLogs,
        notifications,
        flowTemplates,
        lineEnabled,
        loading,
        error,
        refreshAll,
        addFlowTemplate,
        updateFlowTemplate,
        deleteFlowTemplate,
        deleteTask,
        addProject,
        toggleLineEnabled,
        setCurrentUserId: setViewAsUserId,
        approveUser,
        rejectUser,
        createTask,
        duplicateTask,
        saveTaskDraft,
        updateKUStatus,
        addMilestone,
        updateMilestones,
        updateTaskHolderName,
        updateTaskFinancials,
        addAnnotation,
        updateChecklist,
        submitTaskForReview,
        returnTask,
        approveTask,
        markNotificationRead,
        clearAllNotifications,
        exportBackup,
        resetDataToDefault,
        updateUserNotificationSettings,
        checkNoUpdateTasksAndNotify,
        sendTestLineMessage,
        sendCustomNotificationToUsers,
        fetchLineQueue,
      }}
    >
      {error && (
        <div className="fixed bottom-4 right-4 z-[100] max-w-sm bg-red-50 border border-red-200 text-red-800 rounded-2xl shadow-lg p-3.5 text-xs print:hidden">
          <div className="font-extrabold mb-1">บันทึกข้อมูลไม่สำเร็จ</div>
          <p className="leading-relaxed break-words">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 px-3 py-1 rounded-lg bg-red-100 hover:bg-red-200 font-bold"
          >
            ปิด
          </button>
        </div>
      )}
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
