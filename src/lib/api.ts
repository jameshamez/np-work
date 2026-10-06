/**
 * ชั้นเชื่อมต่อฐานข้อมูล — แปลงข้อมูลระหว่าง Supabase (snake_case) กับ type ฝั่งแอป (camelCase)
 *
 * กติกาในไฟล์นี้
 *   - ทุกฟังก์ชันโยน error ออกมาเมื่อล้มเหลว ให้ผู้เรียกเป็นคนตัดสินใจว่าจะแสดงผลอย่างไร
 *   - ไม่มีการเก็บ state ใด ๆ ที่นี่ (AppContext เป็นคนถือ state)
 *   - id ทุกตัวถูกสร้างโดยฐานข้อมูล ฝั่งหน้าเว็บไม่ต้องคิด id เอง
 */
import { SupabaseClient } from '@supabase/supabase-js';
import {
  Attachment,
  ChecklistItem,
  FlowTemplate,
  ImageAnnotation,
  NotificationItem,
  Project,
  ProjectCategory,
  ProjectMilestone,
  Task,
  TaskDeletionLog,
  TaskLog,
  TaskStatus,
  TwoTierFinancials,
  User,
} from '../types';

// -----------------------------------------------------------------------------
// รูปแบบแถวดิบที่ได้จากฐานข้อมูล
// -----------------------------------------------------------------------------
type Row = Record<string, any>;

export interface AppSnapshot {
  users: User[];
  projects: Project[];
  tasks: Task[];
  logs: TaskLog[];
  notifications: NotificationItem[];
  flowTemplates: FlowTemplate[];
  deletionLogs: TaskDeletionLog[];
}

// -----------------------------------------------------------------------------
// ตัวแปลงข้อมูล
// -----------------------------------------------------------------------------
const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
const opt = <T,>(v: T | null | undefined): T | undefined => (v === null || v === undefined ? undefined : v);

export const mapUser = (r: Row): User => ({
  id: r.id,
  username: r.username,
  fullName: r.full_name,
  email: r.email,
  role: r.role,
  status: r.status,
  avatarUrl: opt(r.avatar_url),
  createdAt: r.created_at,
  // numeric ในฐานข้อมูลอาจมาเป็น string ได้ แปลงเป็นตัวเลขไว้ก่อนเสมอ
  noUpdateAlertHours: r.no_update_alert_hours == null ? undefined : Number(r.no_update_alert_hours),
});

export const mapProject = (r: Row): Project => ({
  id: r.id,
  name: r.name,
  description: r.description ?? '',
  color: r.color,
  createdAt: r.created_at,
  category: opt(r.category),
});

const mapChecklist = (r: Row): ChecklistItem => ({
  id: r.id,
  title: r.title,
  completed: r.completed,
  resultStatus: opt(r.result_status),
  resultReason: opt(r.result_reason),
  completedById: opt(r.completed_by_user_id),
  completedAt: opt(r.completed_at),
});

const mapMilestone = (r: Row): ProjectMilestone => ({
  id: r.id,
  milestoneNumber: num(r.milestone_number),
  title: r.title,
  deliverables: r.deliverables ?? '',
  amount: num(r.amount),
  dueDate: r.due_date,
  status: r.status,
  projectPayoutStatus: opt(r.project_payout_status),
  projectPayoutDate: opt(r.project_payout_date),
  holderPayoutStatus: opt(r.holder_payout_status),
  holderPayoutDate: opt(r.holder_payout_date),
  holderName: opt(r.holder_name),
  evidenceFileUrl: opt(r.evidence_file_url),
  evidenceFileName: opt(r.evidence_file_name),
});

const mapAnnotation = (r: Row): ImageAnnotation => ({
  id: r.id,
  imageUrl: r.image_url,
  x: num(r.x),
  y: num(r.y),
  radius: opt(r.radius) === undefined ? undefined : num(r.radius),
  comment: r.comment ?? '',
  authorName: r.author_name ?? '',
  createdAt: r.created_at,
});

const mapAttachment = (r: Row): Attachment => ({
  id: r.id,
  taskId: r.task_id,
  logId: opt(r.log_id),
  fileName: r.file_name,
  fileUrl: r.file_url,
  fileType: r.file_type,
  fileSize: num(r.file_size),
  uploadedBy: r.uploaded_by_name ?? '',
  uploadedById: opt(r.uploaded_by),
  uploadedAt: r.uploaded_at,
});

const mapFinancials = (r: Row): TwoTierFinancials => ({
  projectInstallment: num(r.project_installment),
  approvedRemuneration: num(r.approved_remuneration),
  approvedMaterials: num(r.approved_materials),
  approvedExpenses: num(r.approved_expenses),
  remainingBalance: num(r.remaining_balance),
});

const mapLog = (r: Row, attachments: Attachment[]): TaskLog => ({
  id: r.id,
  taskId: r.task_id,
  actionByUserId: r.action_by_user_id ?? '',
  actionByUserName: r.action_by_user_name,
  onBehalfOfUserId: r.on_behalf_of_user_id ?? '',
  onBehalfOfUserName: r.on_behalf_of_user_name,
  previousStatus: opt(r.previous_status),
  newStatus: r.new_status,
  comment: r.comment ?? '',
  attachments: attachments.length > 0 ? attachments : undefined,
  createdAt: r.created_at,
});

export const mapDeletionLog = (r: Row): TaskDeletionLog => ({
  id: r.id,
  taskId: r.task_id,
  taskCode: r.task_code,
  taskTitle: r.task_title,
  projectName: r.project_name ?? '',
  assignedToName: r.assigned_to_name ?? '',
  lastStatus: r.last_status,
  taskCreatedAt: r.task_created_at,
  deletedByUserId: opt(r.deleted_by_user_id),
  deletedByName: r.deleted_by_name,
  deletedAt: r.deleted_at,
  taskLogsRemoved: num(r.task_logs_removed),
  attachmentsRemoved: num(r.attachments_removed),
});

export const mapNotification = (r: Row): NotificationItem => ({
  id: r.id,
  recipientUserId: r.recipient_user_id,
  title: r.title,
  message: r.message ?? '',
  taskId: opt(r.task_id),
  read: r.read,
  type: r.type,
  createdAt: r.created_at,
});

/** ประกอบแถวจาก v_tasks เข้ากับข้อมูลลูกทั้งหมดให้เป็น Task ที่หน้าเว็บใช้ได้ */
const buildTask = (
  r: Row,
  children: {
    checklists: Row[];
    milestones: Row[];
    annotations: Row[];
    attachments: Row[];
    financials?: Row;
  }
): Task => ({
  id: r.id,
  code: r.code,
  projectId: r.project_id,
  projectName: r.project_name,
  title: r.title,
  description: r.description ?? '',
  assignedToUserId: r.assigned_to_user_id,
  assignedToUserName: r.assigned_to_user_name,
  createdById: opt(r.created_by_user_id),
  assignedTargetUserId: opt(r.assigned_target_user_id),
  assignedTargetUserName: opt(r.assigned_target_user_name),
  reviewerUserId: opt(r.reviewer_user_id),
  reviewerUserName: opt(r.reviewer_user_name),
  planDays: num(r.plan_days),
  status: r.status,
  // ใช้ค่าที่คำนวณสด ณ เวลาที่ query เพื่อให้ป้าย SLA ตรงเสมอแม้ cron ยังไม่ทำงาน
  slaStatus: r.live_sla_status ?? r.sla_status,
  checklists: children.checklists.map(mapChecklist),
  createdAt: r.created_at,
  deadlineAt: r.deadline_at,
  completedAt: opt(r.completed_at),
  leadTimeDays: opt(r.lead_time_days) === undefined ? undefined : num(r.lead_time_days),
  lastUpdatedAt: r.last_updated_at,
  lastInactivityAlertAt: opt(r.last_inactivity_alert_at),
  attachments: children.attachments.map(mapAttachment),
  category: opt(r.category),
  kuProposalStatus: opt(r.ku_proposal_status),
  kuDeadline: opt(r.ku_deadline),
  torDocumentName: opt(r.tor_document_name),
  torDocumentUrl: opt(r.tor_document_url),
  googleDriveUrl: opt(r.google_drive_url),
  delayReason: opt(r.delay_reason),
  voiceMemoUrl: opt(r.voice_memo_url),
  holderName: opt(r.holder_name),
  milestones: children.milestones.length > 0 ? children.milestones.map(mapMilestone) : undefined,
  annotations: children.annotations.length > 0 ? children.annotations.map(mapAnnotation) : undefined,
  twoTierFinancials: children.financials ? mapFinancials(children.financials) : undefined,
  isDraft: r.is_draft ?? false,
  incompleteWarnings: r.incomplete_warnings ?? [],
});

/** จัดกลุ่มแถวลูกตาม task_id ไว้ล่วงหน้า จะได้ไม่ต้องวนหาซ้ำ ๆ ตอนประกอบ */
const groupBy = (rows: Row[], key: string): Map<string, Row[]> => {
  const map = new Map<string, Row[]>();
  for (const row of rows) {
    const k = row[key];
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return map;
};

// =============================================================================
// การอ่านข้อมูล
// =============================================================================

export async function fetchSnapshot(db: SupabaseClient): Promise<AppSnapshot> {
  const [
    usersRes,
    projectsRes,
    tasksRes,
    checklistRes,
    milestoneRes,
    annotationRes,
    attachmentRes,
    financialRes,
    logRes,
    notifRes,
    flowRes,
    flowItemRes,
    deletionRes,
  ] = await Promise.all([
    db.from('users').select('*').order('created_at'),
    db.from('projects').select('*').order('created_at'),
    db.from('v_tasks').select('*').order('created_at', { ascending: false }),
    db.from('task_checklist_items').select('*').order('sort_order'),
    db.from('task_milestones').select('*').order('milestone_number'),
    db.from('task_annotations').select('*').order('created_at'),
    db.from('attachments').select('*').order('uploaded_at'),
    db.from('task_financials').select('*'),
    db.from('task_logs').select('*').order('created_at', { ascending: false }),
    db.from('notifications').select('*').order('created_at', { ascending: false }),
    db.from('flow_templates').select('*').order('created_at'),
    db.from('flow_template_items').select('*').order('sort_order'),
    // ผู้ใช้ทั่วไปอ่านไม่ได้ตาม RLS จะได้ลิสต์ว่างกลับมา ไม่ใช่ error
    db.from('task_deletion_log').select('*').order('deleted_at', { ascending: false }),
  ]);

  const failed = [
    usersRes, projectsRes, tasksRes, checklistRes, milestoneRes, annotationRes,
    attachmentRes, financialRes, logRes, notifRes, flowRes, flowItemRes,
  ].find(r => r.error);
  if (failed?.error) throw new Error(`โหลดข้อมูลไม่สำเร็จ: ${failed.error.message}`);

  // ประวัติการลบเป็นข้อมูลเสริมของผู้ดูแล จงใจไม่รวมไว้ในการเช็คด้านบน
  // ถ้ายังไม่ได้รัน db/12_task_deletion_log.sql ตารางจะยังไม่มี แล้ว PostgREST จะตอบ error
  // ปล่อยให้ทั้งกระดานล่มเพราะเรื่องนี้ไม่คุ้ม — แจ้งไว้ใน console แล้วไปต่อด้วยลิสต์ว่าง
  if (deletionRes.error) {
    console.warn(`โหลดประวัติการลบไม่สำเร็จ: ${deletionRes.error.message}`);
  }

  const attachmentRows = attachmentRes.data ?? [];
  const byTask = {
    checklists: groupBy(checklistRes.data ?? [], 'task_id'),
    milestones: groupBy(milestoneRes.data ?? [], 'task_id'),
    annotations: groupBy(annotationRes.data ?? [], 'task_id'),
    attachments: groupBy(attachmentRows, 'task_id'),
  };
  const financialsByTask = new Map((financialRes.data ?? []).map(f => [f.task_id, f]));
  const attachmentsByLog = groupBy(attachmentRows.filter(a => a.log_id), 'log_id');

  const tasks = (tasksRes.data ?? []).map(r =>
    buildTask(r, {
      checklists: byTask.checklists.get(r.id) ?? [],
      milestones: byTask.milestones.get(r.id) ?? [],
      annotations: byTask.annotations.get(r.id) ?? [],
      attachments: byTask.attachments.get(r.id) ?? [],
      financials: financialsByTask.get(r.id),
    })
  );

  const logs = (logRes.data ?? []).map(r =>
    mapLog(r, (attachmentsByLog.get(r.id) ?? []).map(mapAttachment))
  );

  const itemsByTemplate = groupBy(flowItemRes.data ?? [], 'template_id');
  const flowTemplates = (flowRes.data ?? []).map((r): FlowTemplate => ({
    id: r.id,
    name: r.name,
    category: opt(r.category),
    description: opt(r.description),
    checklists: (itemsByTemplate.get(r.id) ?? []).map(i => i.title),
    createdAt: r.created_at,
  }));

  return {
    users: (usersRes.data ?? []).map(mapUser),
    projects: (projectsRes.data ?? []).map(mapProject),
    tasks,
    logs,
    notifications: (notifRes.data ?? []).map(mapNotification),
    flowTemplates,
    deletionLogs: (deletionRes.data ?? []).map(mapDeletionLog),
  };
}

/** ประวัติการลบการ์ดงาน — แอดมินขึ้นไปเท่านั้นที่ได้ข้อมูลกลับมา (RLS) */
export async function fetchDeletionLogs(db: SupabaseClient): Promise<TaskDeletionLog[]> {
  const { data, error } = await db
    .from('task_deletion_log')
    .select('*')
    .order('deleted_at', { ascending: false });
  if (error) throw new Error(`โหลดประวัติการลบไม่สำเร็จ: ${error.message}`);
  return (data ?? []).map(mapDeletionLog);
}

/** โหลดงานใบเดียวพร้อมลูกทั้งหมด ใช้หลังแก้ไขเพื่อ refresh เฉพาะใบที่เปลี่ยน */
export async function fetchTask(db: SupabaseClient, taskId: string): Promise<Task | null> {
  const [taskRes, checklistRes, milestoneRes, annotationRes, attachmentRes, financialRes] =
    await Promise.all([
      db.from('v_tasks').select('*').eq('id', taskId).maybeSingle(),
      db.from('task_checklist_items').select('*').eq('task_id', taskId).order('sort_order'),
      db.from('task_milestones').select('*').eq('task_id', taskId).order('milestone_number'),
      db.from('task_annotations').select('*').eq('task_id', taskId).order('created_at'),
      db.from('attachments').select('*').eq('task_id', taskId).order('uploaded_at'),
      db.from('task_financials').select('*').eq('task_id', taskId).maybeSingle(),
    ]);

  if (taskRes.error) throw new Error(taskRes.error.message);
  if (!taskRes.data) return null;

  return buildTask(taskRes.data, {
    checklists: checklistRes.data ?? [],
    milestones: milestoneRes.data ?? [],
    annotations: annotationRes.data ?? [],
    attachments: attachmentRes.data ?? [],
    financials: financialRes.data ?? undefined,
  });
}

export async function fetchLogs(db: SupabaseClient): Promise<TaskLog[]> {
  const [logRes, attachmentRes] = await Promise.all([
    db.from('task_logs').select('*').order('created_at', { ascending: false }),
    db.from('attachments').select('*').not('log_id', 'is', null),
  ]);
  if (logRes.error) throw new Error(logRes.error.message);

  const byLog = groupBy(attachmentRes.data ?? [], 'log_id');
  return (logRes.data ?? []).map(r => mapLog(r, (byLog.get(r.id) ?? []).map(mapAttachment)));
}

export async function fetchNotifications(db: SupabaseClient): Promise<NotificationItem[]> {
  const { data, error } = await db
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapNotification);
}

export async function fetchUsers(db: SupabaseClient): Promise<User[]> {
  const { data, error } = await db.from('users').select('*').order('created_at');
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapUser);
}

// =============================================================================
// การเขียนข้อมูล — โครงการ
// =============================================================================

export async function createProject(db: SupabaseClient, name: string): Promise<Project> {
  const { data, error } = await db
    .from('projects')
    .insert({ name: name.trim(), description: `โครงการ ${name.trim()}`, color: '#0d9488' })
    .select()
    .single();
  if (error) throw new Error(`สร้างโครงการไม่สำเร็จ: ${error.message}`);
  return mapProject(data);
}

/**
 * ลบโครงการ — เฉพาะ Super Admin (policy projects_delete_super_admin ใน db/18)
 * โครงการที่ยังมีการ์ดงาน (รวมร่าง) ลบไม่ได้ ต้องย้ายหรือลบการ์ดก่อน
 */
export async function deleteProject(db: SupabaseClient, projectId: string): Promise<void> {
  const { count, error: countError } = await db
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId);
  if (countError) throw new Error(`ลบโครงการไม่สำเร็จ: ${countError.message}`);
  if (count && count > 0) {
    throw new Error(`ลบโครงการไม่สำเร็จ: ยังมีการ์ดงานในโครงการนี้ ${count} ใบ กรุณาย้ายหรือลบการ์ดงานก่อน`);
  }

  const { data, error } = await db.from('projects').delete().eq('id', projectId).select('id');
  if (error) throw new Error(`ลบโครงการไม่สำเร็จ: ${error.message}`);
  // RLS ไม่ให้ลบจะไม่ error แต่ได้ 0 แถว
  if (!data || data.length === 0) throw new Error('ลบโครงการไม่สำเร็จ: เฉพาะ Super Admin เท่านั้นที่ลบโครงการได้');
}

// =============================================================================
// การเขียนข้อมูล — งาน
// =============================================================================

export interface CreateTaskInput {
  title: string;
  description: string;
  projectId: string;
  assignedToUserId: string;
  assignedToUserName: string;
  createdByUserId: string;
  createdByUserName: string;
  planDays: number;
  deadlineAt: string;
  code?: string;
  category?: ProjectCategory;
  kuProposalStatus?: string;
  kuDeadline?: string;
  assignedTargetUserId?: string;
  isDraft?: boolean;
  incompleteWarnings?: string[];
  checklists?: { title: string; completed: boolean; resultStatus?: 'success' | 'fail'; resultReason?: string }[];
  milestones?: Omit<ProjectMilestone, 'id'>[];
  attachments?: { fileName: string; fileUrl: string; fileType: 'image' | 'file'; fileSize: number }[];
}

export async function createTask(db: SupabaseClient, input: CreateTaskInput): Promise<string> {
  const { data, error } = await db
    .from('tasks')
    .insert({
      ...(input.code ? { code: input.code } : {}),
      project_id: input.projectId,
      title: input.title,
      description: input.description,
      assigned_to_user_id: input.assignedToUserId,
      assigned_target_user_id: input.assignedTargetUserId ?? null,
      created_by_user_id: input.createdByUserId,
      plan_days: input.planDays,
      deadline_at: input.deadlineAt,
      category: input.category ?? null,
      ku_proposal_status: input.kuProposalStatus ?? null,
      ku_deadline: input.kuDeadline ?? null,
      is_draft: input.isDraft ?? false,
      incomplete_warnings: input.incompleteWarnings ?? [],
    })
    .select('id')
    .single();
  if (error) throw new Error(`สร้างการ์ดงานไม่สำเร็จ: ${error.message}`);

  const taskId = data.id as string;

  if (input.checklists?.length) {
    await insertChecklistItems(db, taskId, input.checklists, 0);
  }

  if (input.milestones?.length) {
    const { error: msError } = await db.from('task_milestones').insert(
      input.milestones.map(m => milestoneToRow(taskId, m))
    );
    if (msError) throw new Error(`บันทึกงวดงานไม่สำเร็จ: ${msError.message}`);
  }

  if (input.attachments?.length) {
    await insertAttachments(db, taskId, null, input.createdByUserId, input.createdByUserName, input.attachments);
  }

  // เปิดประวัติของงานใบนี้ทันทีที่สร้าง จะได้ตอบได้เสมอว่าใครเป็นคนตั้งงานและตั้งเมื่อไหร่
  const { error: logError } = await db.from('task_logs').insert({
    task_id: taskId,
    action_by_user_id: input.createdByUserId,
    action_by_user_name: input.createdByUserName,
    on_behalf_of_user_id: input.assignedToUserId,
    on_behalf_of_user_name: input.assignedToUserName,
    previous_status: null,
    new_status: 'pending_submission',
    comment: input.isDraft
      ? 'บันทึกร่างการ์ดงาน'
      : `สร้างงานใหม่ แผนการดำเนินงาน ${input.planDays} วัน`,
  });
  if (logError) throw new Error(`บันทึกประวัติการสร้างงานไม่สำเร็จ: ${logError.message}`);

  // แจ้งเตือนผู้รับผิดชอบเมื่อมอบหมายให้คนอื่น — ข้ามเงียบ ๆ ถ้าไม่มีสิทธิ์ส่งถึงผู้อื่น
  if (input.assignedToUserId !== input.createdByUserId && !input.isDraft) {
    await insertNotifications(db, [
      {
        recipientUserId: input.assignedToUserId,
        title: 'คุณได้รับมอบหมายงานใหม่',
        message: `${input.createdByUserName} ได้มอบหมายงาน "${input.title}" ให้คุณ (กำหนดส่งใน ${input.planDays} วัน)`,
        type: 'status_change',
        taskId,
      },
    ]).catch(e => console.warn('ส่งแจ้งเตือนผู้รับผิดชอบไม่ได้:', e));
  }

  return taskId;
}

/** อัปเดตฟิลด์ทั่วไปของงาน (ไม่ใช่การเปลี่ยนสถานะ — สถานะต้องผ่าน changeTaskStatus) */
export async function updateTaskFields(
  db: SupabaseClient,
  taskId: string,
  fields: Partial<{
    title: string;
    description: string;
    project_id: string;
    assigned_to_user_id: string;
    assigned_target_user_id: string | null;
    reviewer_user_id: string | null;
    plan_days: number;
    deadline_at: string;
    category: string | null;
    ku_proposal_status: string | null;
    ku_deadline: string | null;
    tor_document_name: string | null;
    tor_document_url: string | null;
    google_drive_url: string | null;
    delay_reason: string | null;
    voice_memo_url: string | null;
    holder_name: string | null;
    is_draft: boolean;
    incomplete_warnings: string[];
    last_inactivity_alert_at: string;
  }>
): Promise<void> {
  const { error } = await db.from('tasks').update(fields).eq('id', taskId);
  if (error) throw new Error(`อัปเดตงานไม่สำเร็จ: ${error.message}`);
}

export async function deleteTask(db: SupabaseClient, taskId: string): Promise<void> {
  // จำลิงก์ไฟล์ไว้ก่อน เพราะแถว attachments จะหายไปพร้อมการ์ด (on delete cascade)
  const { data: files } = await db.from('attachments').select('file_url').eq('task_id', taskId);

  const { data, error } = await db.from('tasks').delete().eq('id', taskId).select('id');
  if (error) throw new Error(`ลบงานไม่สำเร็จ: ${error.message}`);
  // RLS ไม่ให้ลบจะไม่ error แต่ได้ 0 แถว — ห้ามไปลบไฟล์ของการ์ดที่ยังอยู่
  if (!data || data.length === 0) throw new Error('ลบงานไม่สำเร็จ: ลบการ์ดงานได้เฉพาะแอดมินขึ้นไป');

  await removeStorageFiles(db, (files ?? []).map(f => f.file_url as string));
}

/**
 * เปลี่ยนสถานะงานผ่านฟังก์ชันในฐานข้อมูล
 * ฝั่ง DB จะตรวจสิทธิ์ ตรวจเส้นทางสถานะ เขียน audit log และยิงแจ้งเตือนให้ในทรานแซกชันเดียว
 * คืนค่า id ของ log ที่เพิ่งบันทึก (ใช้ผูกไฟล์แนบเข้ากับ log นั้น)
 */
export async function changeTaskStatus(
  db: SupabaseClient,
  taskId: string,
  newStatus: TaskStatus,
  comment: string,
  onBehalfOfUserId?: string
): Promise<string> {
  const { data, error } = await db.rpc('app_change_task_status', {
    p_task_id: taskId,
    p_new_status: newStatus,
    p_comment: comment,
    p_on_behalf_of_user_id: onBehalfOfUserId ?? null,
  });
  if (error) throw new Error(error.message);
  return (data as Row)?.id;
}

// =============================================================================
// การเขียนข้อมูล — รายการตรวจ (checklist)
// =============================================================================

async function insertChecklistItems(
  db: SupabaseClient,
  taskId: string,
  items: { title: string; completed: boolean; resultStatus?: 'success' | 'fail'; resultReason?: string }[],
  offset: number
): Promise<void> {
  const { error } = await db.from('task_checklist_items').insert(
    items.map((c, i) => ({
      task_id: taskId,
      sort_order: offset + i + 1,
      title: c.title,
      completed: c.completed,
      // เก็บผลเฉพาะตอนที่ติ๊กเสร็จแล้วจริง ๆ ไม่งั้น constraint ฝั่ง DB จะไม่ยอม
      result_status: c.completed ? (c.resultStatus ?? 'success') : null,
      result_reason: c.resultReason ?? null,
    }))
  );
  if (error) throw new Error(`บันทึกรายการตรวจไม่สำเร็จ: ${error.message}`);
}

export async function updateChecklistItem(
  db: SupabaseClient,
  checklistId: string,
  completed: boolean,
  resultStatus?: 'success' | 'fail',
  resultReason?: string
): Promise<void> {
  const { data, error } = await db
    .from('task_checklist_items')
    .update({
      completed,
      result_status: completed ? (resultStatus ?? 'success') : null,
      result_reason: resultStatus === 'fail' ? (resultReason ?? 'ไม่ระบุสาเหตุ') : (resultReason ?? null),
    })
    .eq('id', checklistId)
    .select('id');
  if (error) throw new Error(`อัปเดตรายการตรวจไม่สำเร็จ: ${error.message}`);
  // RLS ไม่ให้แก้จะไม่ error แต่ได้ 0 แถว — ต้องแจ้ง ไม่งั้นหน้าจอจะติ๊กค้างทั้งที่ไม่ได้บันทึก
  if (!data || data.length === 0) throw new Error('อัปเดตรายการตรวจไม่สำเร็จ: ไม่มีสิทธิ์แก้ไขการ์ดงานนี้');
}

/** เพิ่มข้อ checklist ต่อท้ายรายการเดิมของการ์ด */
export async function addChecklistItem(db: SupabaseClient, taskId: string, title: string): Promise<void> {
  const { data, error } = await db
    .from('task_checklist_items')
    .select('sort_order')
    .eq('task_id', taskId)
    .order('sort_order', { ascending: false })
    .limit(1);
  if (error) throw new Error(`เพิ่มรายการตรวจไม่สำเร็จ: ${error.message}`);
  const lastOrder = (data?.[0] as Row | undefined)?.sort_order ?? 0;
  await insertChecklistItems(db, taskId, [{ title, completed: false }], lastOrder);
}

export async function renameChecklistItem(db: SupabaseClient, checklistId: string, title: string): Promise<void> {
  const { data, error } = await db.from('task_checklist_items').update({ title }).eq('id', checklistId).select('id');
  if (error) throw new Error(`แก้ไขรายการตรวจไม่สำเร็จ: ${error.message}`);
  if (!data || data.length === 0) throw new Error('แก้ไขรายการตรวจไม่สำเร็จ: ไม่มีสิทธิ์แก้ไขการ์ดงานนี้');
}

export async function deleteChecklistItem(db: SupabaseClient, checklistId: string): Promise<void> {
  const { data, error } = await db.from('task_checklist_items').delete().eq('id', checklistId).select('id');
  if (error) throw new Error(`ลบรายการตรวจไม่สำเร็จ: ${error.message}`);
  // RLS ไม่ให้ลบจะไม่ error แต่ได้ 0 แถว — ต้องแจ้ง ไม่งั้นข้อที่ลบจะโผล่กลับมาเงียบ ๆ
  if (!data || data.length === 0) throw new Error('ลบรายการตรวจไม่สำเร็จ: ไม่มีสิทธิ์แก้ไขการ์ดงานนี้');
}

/** แทนที่ checklist ทั้งชุดของการ์ด (ใช้ตอนโหลด Flow สำเร็จรูป) */
export async function replaceChecklistItems(db: SupabaseClient, taskId: string, titles: string[]): Promise<void> {
  const { error } = await db.from('task_checklist_items').delete().eq('task_id', taskId);
  if (error) throw new Error(`ล้างรายการตรวจเดิมไม่สำเร็จ: ${error.message}`);
  await insertChecklistItems(db, taskId, titles.map(title => ({ title, completed: false })), 0);
}

// =============================================================================
// การเขียนข้อมูล — งวดงาน
// =============================================================================

const milestoneToRow = (taskId: string, m: Omit<ProjectMilestone, 'id'>) => ({
  task_id: taskId,
  milestone_number: m.milestoneNumber,
  title: m.title,
  deliverables: m.deliverables ?? '',
  amount: m.amount ?? 0,
  due_date: m.dueDate,
  status: m.status,
  project_payout_status: m.projectPayoutStatus ?? null,
  project_payout_date: m.projectPayoutDate || null,
  holder_payout_status: m.holderPayoutStatus ?? null,
  holder_payout_date: m.holderPayoutDate || null,
  holder_name: m.holderName ?? null,
  evidence_file_url: m.evidenceFileUrl ?? null,
  evidence_file_name: m.evidenceFileName ?? null,
});

export async function addMilestone(
  db: SupabaseClient,
  taskId: string,
  milestone: Omit<ProjectMilestone, 'id'>
): Promise<void> {
  const { error } = await db.from('task_milestones').insert(milestoneToRow(taskId, milestone));
  if (error) throw new Error(`เพิ่มงวดงานไม่สำเร็จ: ${error.message}`);
}

/** เขียนทับงวดงานทั้งชุด — ลบตัวที่หายไป แล้วอัปเดต/เพิ่มตัวที่เหลือ */
export async function replaceMilestones(
  db: SupabaseClient,
  taskId: string,
  milestones: ProjectMilestone[]
): Promise<void> {
  const keepIds = milestones.map(m => m.id).filter(Boolean);

  const del = keepIds.length
    ? db.from('task_milestones').delete().eq('task_id', taskId).not('id', 'in', `(${keepIds.join(',')})`)
    : db.from('task_milestones').delete().eq('task_id', taskId);
  const { error: delError } = await del;
  if (delError) throw new Error(`ลบงวดงานเดิมไม่สำเร็จ: ${delError.message}`);

  for (const m of milestones) {
    const row = milestoneToRow(taskId, m);
    const { error } = m.id
      ? await db.from('task_milestones').update(row).eq('id', m.id)
      : await db.from('task_milestones').insert(row);
    if (error) throw new Error(`บันทึกงวดงานไม่สำเร็จ: ${error.message}`);
  }
}

// =============================================================================
// การเขียนข้อมูล — การเงิน 2 ระดับ
// =============================================================================

export async function upsertFinancials(
  db: SupabaseClient,
  taskId: string,
  f: TwoTierFinancials
): Promise<void> {
  const { error } = await db.from('task_financials').upsert(
    {
      task_id: taskId,
      project_installment: f.projectInstallment,
      approved_remuneration: f.approvedRemuneration,
      approved_materials: f.approvedMaterials,
      approved_expenses: f.approvedExpenses,
      // remaining_balance เป็น generated column ฝั่ง DB คำนวณเอง ห้ามส่งไป
    },
    { onConflict: 'task_id' }
  );
  if (error) throw new Error(`บันทึกข้อมูลการเงินไม่สำเร็จ: ${error.message}`);
}

// =============================================================================
// การเขียนข้อมูล — มาร์กบนภาพ และไฟล์แนบ
// =============================================================================

export async function addAnnotation(
  db: SupabaseClient,
  taskId: string,
  authorUserId: string,
  authorName: string,
  annotation: Omit<ImageAnnotation, 'id' | 'createdAt' | 'authorName'>
): Promise<void> {
  const { error } = await db.from('task_annotations').insert({
    task_id: taskId,
    image_url: annotation.imageUrl,
    x: annotation.x,
    y: annotation.y,
    radius: annotation.radius ?? null,
    comment: annotation.comment,
    author_user_id: authorUserId,
    author_name: authorName,
  });
  if (error) throw new Error(`บันทึกจุดมาร์กไม่สำเร็จ: ${error.message}`);
}

/**
 * อัปโหลดไฟล์ขึ้น bucket "attachments" (db/14_storage_attachments.sql) แล้วคืนลิงก์ถาวร
 * เก็บใต้โฟลเดอร์ของผู้อัปโหลดตามที่ policy บังคับ และขึ้นต้นด้วย UUID กันชื่อชนและกันเดาลิงก์
 */
export async function uploadAttachmentFile(
  db: SupabaseClient,
  uploaderId: string,
  file: File
): Promise<string> {
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
  // ชื่อไฟล์ภาษาไทย/เว้นวรรคใช้เป็น key ของ Storage ไม่ได้ — ชื่อจริงเก็บแยกไว้ใน attachments.file_name
  const path = `${uploaderId}/${crypto.randomUUID()}${ext ? `.${ext}` : ''}`;
  const { error } = await db.storage
    .from('attachments')
    .upload(path, file, { contentType: file.type || undefined });
  if (error) throw new Error(`อัปโหลดไฟล์ "${file.name}" ไม่สำเร็จ: ${error.message}`);
  return db.storage.from('attachments').getPublicUrl(path).data.publicUrl;
}

/**
 * ลบไฟล์แนบ — ลบแถวในตารางก่อน (RLS attachments_delete: ผู้อัปโหลดหรือแอดมิน)
 * แล้วค่อยลบตัวไฟล์ใน Storage ถ้าเป็นไฟล์ที่อัปโหลดผ่าน bucket นี้
 * ลบตัวไฟล์ไม่สำเร็จไม่ถือว่าล้มเหลว เพราะแถวหายไปแล้ว ผู้ใช้มองไม่เห็นไฟล์นั้นอีก
 */
export async function deleteAttachment(db: SupabaseClient, attachmentId: string, fileUrl: string): Promise<void> {
  const { data, error } = await db.from('attachments').delete().eq('id', attachmentId).select('id');
  if (error) throw new Error(`ลบไฟล์แนบไม่สำเร็จ: ${error.message}`);
  // RLS ไม่ให้ลบจะไม่ error แต่ได้ 0 แถว — ต้องเช็คเอง ไม่งั้นผู้ใช้จะคิดว่าลบแล้ว
  if (!data || data.length === 0) throw new Error('ลบไฟล์แนบไม่สำเร็จ: ลบได้เฉพาะผู้อัปโหลดหรือแอดมิน');

  await removeStorageFiles(db, [fileUrl]);
}

/**
 * ลบตัวไฟล์ใน bucket "attachments" ตามลิงก์ที่เคยบันทึกไว้ — ข้ามลิงก์ที่ไม่ใช่ของ bucket นี้
 * (blob:, '#', Unsplash) ลบไม่สำเร็จแค่เขียน log เพราะเรียกหลังแถวในตารางหายไปแล้ว
 */
async function removeStorageFiles(db: SupabaseClient, fileUrls: string[]): Promise<void> {
  const marker = '/storage/v1/object/public/attachments/';
  const paths = fileUrls
    .map(url => url.indexOf(marker) >= 0 ? decodeURIComponent(url.slice(url.indexOf(marker) + marker.length)) : null)
    .filter((path): path is string => !!path);
  if (paths.length === 0) return;
  const { error } = await db.storage.from('attachments').remove(paths);
  if (error) console.error(`ลบตัวไฟล์ใน Storage ไม่สำเร็จ: ${error.message}`);
}

export async function insertAttachments(
  db: SupabaseClient,
  taskId: string,
  logId: string | null,
  uploaderId: string,
  uploaderName: string,
  files: { fileName: string; fileUrl: string; fileType: 'image' | 'file'; fileSize: number }[]
): Promise<void> {
  if (files.length === 0) return;
  const { error } = await db.from('attachments').insert(
    files.map(f => ({
      task_id: taskId,
      log_id: logId,
      file_name: f.fileName,
      file_url: f.fileUrl,
      file_type: f.fileType,
      // ขนาดไฟล์ต้องเป็นจำนวนเต็ม (bigint) — ฝั่ง UI คำนวณจาก MB ทศนิยมมาให้
      file_size: Math.round(f.fileSize),
      uploaded_by: uploaderId,
      uploaded_by_name: uploaderName,
    }))
  );
  if (error) throw new Error(`บันทึกไฟล์แนบไม่สำเร็จ: ${error.message}`);
}

// =============================================================================
// การเขียนข้อมูล — แจ้งเตือน
// =============================================================================

export async function markNotificationRead(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db.from('notifications').update({ read: true }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function clearNotifications(db: SupabaseClient, recipientUserId: string): Promise<void> {
  const { error } = await db.from('notifications').delete().eq('recipient_user_id', recipientUserId);
  if (error) throw new Error(`ล้างการแจ้งเตือนไม่สำเร็จ: ${error.message}`);
}

/** ส่งแจ้งเตือนถึงผู้อื่น — RLS อนุญาตเฉพาะ admin เท่านั้น */
export async function insertNotifications(
  db: SupabaseClient,
  items: { recipientUserId: string; title: string; message: string; type: NotificationItem['type']; taskId?: string }[]
): Promise<void> {
  if (items.length === 0) return;
  const { error } = await db.from('notifications').insert(
    items.map(n => ({
      recipient_user_id: n.recipientUserId,
      title: n.title,
      message: n.message,
      type: n.type,
      task_id: n.taskId ?? null,
    }))
  );
  if (error) throw new Error(`ส่งการแจ้งเตือนไม่สำเร็จ: ${error.message}`);
}

// =============================================================================
// การเขียนข้อมูล — ผู้ใช้
// =============================================================================

export async function updateUserSettings(
  db: SupabaseClient,
  userId: string,
  settings: { noUpdateAlertHours?: number }
): Promise<void> {
  const fields: Row = {};
  if (settings.noUpdateAlertHours !== undefined) fields.no_update_alert_hours = settings.noUpdateAlertHours;
  if (Object.keys(fields).length === 0) return;

  const { error } = await db.from('users').update(fields).eq('id', userId);
  if (error) throw new Error(`บันทึกการตั้งค่าไม่สำเร็จ: ${error.message}`);
}

export async function setUserApproval(
  db: SupabaseClient,
  userId: string,
  approve: boolean
): Promise<void> {
  const { error } = await db.rpc('app_approve_user', { p_user_id: userId, p_approve: approve });
  if (error) throw new Error(`บันทึกผลการอนุมัติไม่สำเร็จ: ${error.message}`);
}

/** ลบผู้ใช้ที่ลาออก — ตัดสิทธิ์ล็อกอินแต่เก็บโปรไฟล์ไว้ให้งานเก่าอ้างถึง (ดู db/15_remove_user.sql) */
export async function removeUser(db: SupabaseClient, userId: string): Promise<void> {
  const { error } = await db.rpc('app_remove_user', { p_user_id: userId });
  if (error) throw new Error(`ลบผู้ใช้งานไม่สำเร็จ: ${error.message}`);
}

// =============================================================================
// การเขียนข้อมูล — เทมเพลต Flow
// =============================================================================

export async function createFlowTemplate(
  db: SupabaseClient,
  data: { name: string; category?: ProjectCategory; description?: string; checklists: string[] }
): Promise<FlowTemplate> {
  const { data: row, error } = await db
    .from('flow_templates')
    .insert({
      name: data.name.trim(),
      category: data.category ?? 'general',
      description: data.description ?? '',
    })
    .select()
    .single();
  if (error) throw new Error(`สร้างเทมเพลต Flow ไม่สำเร็จ: ${error.message}`);

  const checklists = data.checklists.length > 0 ? data.checklists : ['ขั้นตอนการดำเนินงานที่ 1'];
  await replaceFlowItems(db, row.id, checklists);

  return {
    id: row.id,
    name: row.name,
    category: opt(row.category),
    description: opt(row.description),
    checklists,
    createdAt: row.created_at,
  };
}

async function replaceFlowItems(db: SupabaseClient, templateId: string, checklists: string[]): Promise<void> {
  const { error: delError } = await db.from('flow_template_items').delete().eq('template_id', templateId);
  if (delError) throw new Error(delError.message);

  if (checklists.length === 0) return;
  const { error } = await db.from('flow_template_items').insert(
    checklists.map((title, i) => ({ template_id: templateId, sort_order: i + 1, title }))
  );
  if (error) throw new Error(`บันทึกขั้นตอนใน Flow ไม่สำเร็จ: ${error.message}`);
}

export async function updateFlowTemplate(
  db: SupabaseClient,
  id: string,
  data: { name?: string; category?: ProjectCategory; description?: string; checklists?: string[] }
): Promise<void> {
  const fields: Row = {};
  if (data.name !== undefined) fields.name = data.name.trim();
  if (data.category !== undefined) fields.category = data.category;
  if (data.description !== undefined) fields.description = data.description;

  if (Object.keys(fields).length > 0) {
    const { error } = await db.from('flow_templates').update(fields).eq('id', id);
    if (error) throw new Error(`แก้ไขเทมเพลต Flow ไม่สำเร็จ: ${error.message}`);
  }

  if (data.checklists) await replaceFlowItems(db, id, data.checklists);
}

export async function deleteFlowTemplate(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db.from('flow_templates').delete().eq('id', id);
  if (error) throw new Error(`ลบเทมเพลต Flow ไม่สำเร็จ: ${error.message}`);
}
