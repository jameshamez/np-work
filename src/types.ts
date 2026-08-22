export type UserRole = 'user' | 'admin' | 'super_admin';
export type UserStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl?: string;
  createdAt: string;
  noUpdateAlertHours?: number; // default 4 hours
}

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  createdAt: string;
  category?: ProjectCategory;
  code?: string; // รหัสย่อโครงการ ใช้ค้นหาในช่องเลือกโครงการ
}

export type TaskStatus = 'pending_submission' | 'pending_review' | 'returned' | 'approved';
export type SLAStatus = 'on_time' | 'delayed' | 'no_update';

export type ProjectCategory = 
  | 'general'           // งานประจำ (Routine / Maintenance)
  | 'ku_university'     // งานโครงการ (รองรับทุกแหล่งทุน: เกษตร, บพข., ทอพ., ปากเลา, ส้มป่อย, พ็อก)
  | 'rd_project'        // R&D Project (วงจรทดลองสูตร, ส่งชิม, แปรแปรรูป, แพ็กเกจจิ้ง, ยื่นขอ อย.)
  | 'sales_presale'     // งานเสนอราคา & ประเมินหน้างาน (Sales & Pre-Sale Flow)
  | 'drawing_draft';    // งานเขียนแบบ / ตรวจภาพแปลน (Drawing Review & Annotation)

export type KUProposalStatus =
  | '1_draft_proposal'
  | '2_aj_nui_open'
  | '3_ploy_revision'
  | '4_wait_aj_nui_approval'
  | '5_ploy_system_submit'
  | '6_agency_review'
  | '7_passed_with_revision'
  | '8_approved_run_terms';

export interface ProjectMilestone {
  id: string;
  milestoneNumber: number;
  title: string;
  deliverables: string;
  amount: number; // budget/amount
  dueDate: string;
  status: 'pending' | 'submitted' | 'approved';

  // Payout tracking fields
  projectPayoutStatus?: 'รอเบิก' | 'กำลังดำเนินการ' | 'เบิกสำเร็จ';
  projectPayoutDate?: string;
  holderPayoutStatus?: 'รออนุมัติ' | 'กำลังดำเนินการ' | 'เบิกสำเร็จ';
  holderPayoutDate?: string;
  holderName?: string;
  evidenceFileUrl?: string;
  evidenceFileName?: string;
}

export interface ImageAnnotation {
  id: string;
  imageUrl: string;
  x: number; // percentage (0-100)
  y: number; // percentage (0-100)
  radius?: number;
  comment: string;
  authorName: string;
  createdAt: string;
}

export interface ChecklistItem {
  id: string;
  title: string;
  completed: boolean;
  resultStatus?: 'success' | 'fail';
  resultReason?: string;
}

export interface Attachment {
  id: string;
  taskId: string;
  logId?: string;
  fileName: string;
  fileUrl: string;
  fileType: 'image' | 'file';
  fileSize: number; // in bytes
  uploadedBy: string;
  uploadedAt: string;
}

export interface TaskLog {
  id: string;
  taskId: string;
  actionByUserId: string;
  actionByUserName: string;
  onBehalfOfUserId: string;
  onBehalfOfUserName: string;
  previousStatus?: TaskStatus;
  newStatus: TaskStatus;
  comment: string;
  attachments?: Attachment[];
  createdAt: string;
}

export interface TwoTierFinancials {
  projectInstallment: number;      // ยอดเงินงวดสัญญาโครงการหลัก
  approvedRemuneration: number;   // ค่าตอบแทน (อนุมัติเบิกจริง)
  approvedMaterials: number;      // ค่าวัสดุ (อนุมัติเบิกจริง)
  approvedExpenses: number;       // ค่าใช้สอย (อนุมัติเบิกจริง)
  remainingBalance: number;       // ยอดคงเหลืออัตโนมัติ
}

export interface Task {
  id: string;
  code: string; // e.g. TK-101
  projectId: string;
  projectName: string;
  title: string;
  description: string;
  assignedToUserId: string; // Original owner
  assignedToUserName: string;
  createdById?: string; // ผู้สร้างการ์ดงาน (ใช้หาว่าจะเตือนใครเมื่องานค้างอัปเดต)
  planDays: number; // Planned duration (e.g., 3 days)
  status: TaskStatus;
  slaStatus: SLAStatus;
  checklists: ChecklistItem[];
  createdAt: string; // ISO date
  deadlineAt: string; // ISO date
  completedAt?: string; // ISO date when approved
  leadTimeDays?: number; // Actual days taken
  lastUpdatedAt: string;
  attachments: Attachment[];

  // Enhanced requirements
  category?: ProjectCategory;
  kuProposalStatus?: KUProposalStatus;
  kuDeadline?: string; // กรอบเวลาโครงการ ม.เกษตร
  assignedTargetUserId?: string; // พลอยส่งรายละเอียดให้ใครทำ (เช่น พี่ฟ้อง)
  assignedTargetUserName?: string;
  reviewerUserId?: string; // ตัวบุคคลผู้ตรวจงาน (Reviewer) เช่น พี่หมู, พี่รักษ์, ออม, พี่รัก
  reviewerUserName?: string;
  torDocumentName?: string;
  torDocumentUrl?: string;
  googleDriveUrl?: string; // ลิงก์ Google Drive ของบริษัท
  delayReason?: string; // Free-text ระบุสาเหตุการล่าช้าหากเลย Deadline
  voiceMemoUrl?: string; // เสียงอัดออดิโอสั่งแก้แบบ
  twoTierFinancials?: TwoTierFinancials; // การติดตามเงินงวด 2 ระดับ
  holderName?: string; // ชื่อผู้ถือเงิน (เช่น อาจารย์หนุ่ย)
  milestones?: ProjectMilestone[];
  annotations?: ImageAnnotation[];
  isDraft?: boolean;
  incompleteWarnings?: string[];
  lastInactivityAlertAt?: string;
}

export interface NotificationItem {
  id: string;
  recipientUserId: string;
  title: string;
  message: string;
  taskId?: string;
  read: boolean;
  type: 'status_change' | 'approval_required' | 'returned' | 'sla_warning' | 'line_notify_sent' | 'hourly_reminder' | 'ku_status_update';
  createdAt: string;
}

export interface FlowTemplate {
  id: string;
  name: string;
  category?: ProjectCategory;
  description?: string;
  checklists: string[];
  createdAt?: string;
}

