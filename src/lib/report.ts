/**
 * ตัวคำนวณรายงานสรุปสถานะโครงการและผลการปฏิบัติงาน (รายสัปดาห์ / รายเดือน)
 * ตามต้นแบบ NP_Taskwork_Weekly_Monthly_Report_Template.pdf
 *
 * ทุกฟังก์ชันเป็น pure function — รับงานจริงจาก AppContext แล้วคืนตัวเลขให้หน้ารายงานวาด
 * นิยามตัวชี้วัด (หน้า "รูปแบบข้อมูลสำหรับระบบ" ของต้นแบบ)
 *   อัตราความสำเร็จ     = งานอนุมัติแล้ว / งานทั้งหมดในขอบเขต
 *   งานต้องติดตาม      = ตีกลับ หรือ SLA ล่าช้า / ไม่มีอัปเดต (เฉพาะงานที่ยังไม่ปิด)
 *   Lead time          = วันตั้งแต่เริ่มงานจนอนุมัติปิดงาน (lead_time_days จากฐานข้อมูล)
 *   งานในขอบเขตช่วงเวลา = เปิดก่อนสิ้นช่วง และยังไม่ปิดก่อนเริ่มช่วง
 */
import { Project, Task, TaskStatus } from '../types';

export interface DateRange {
  start: Date;
  end: Date;
}

/** สัปดาห์จันทร์–อาทิตย์ที่มีวันที่เลือกอยู่ */
export function weekRange(day: Date): DateRange {
  const offsetToMonday = (day.getDay() + 6) % 7;
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate() - offsetToMonday, 0, 0, 0, 0);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
  return { start, end };
}

/** เดือนเต็ม — month เป็น 1–12 */
export function monthRange(year: number, month: number): DateRange {
  return {
    start: new Date(year, month - 1, 1, 0, 0, 0, 0),
    end: new Date(year, month, 0, 23, 59, 59, 999),
  };
}

export function isInScope(task: Task, start: Date, end: Date): boolean {
  if (task.isDraft) return false;
  const created = new Date(task.createdAt);
  if (created > end) return false;
  return !task.completedAt || new Date(task.completedAt) >= start;
}

export function needsFollowUp(task: Task): boolean {
  if (task.status === 'approved') return false;
  return task.status === 'returned' || task.slaStatus === 'delayed' || task.slaStatus === 'no_update';
}

export type Timeliness = 'early' | 'on_time' | 'late' | 'overdue' | 'open';

// เทียบเป็น "วัน" ตามเวลาไทย — ส่งตอนตีหนึ่งของวันกำหนดส่งต้องนับว่าตรงเวลา ไม่ใช่วันก่อนหน้า
const thaiDay = (iso: string | Date) =>
  new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });

/** งานปิดแล้ว: เสร็จก่อน / ตรง / หลังวันกำหนดส่ง — งานยังเปิด: เกินกำหนดแล้วหรือยัง */
export function timeliness(task: Task, now: Date): Timeliness {
  const due = thaiDay(task.deadlineAt);
  if (task.status === 'approved' && task.completedAt) {
    const done = thaiDay(task.completedAt);
    return done < due ? 'early' : done === due ? 'on_time' : 'late';
  }
  return thaiDay(now) > due ? 'overdue' : 'open';
}

export type StatusCounts = Record<TaskStatus, number>;

export function countByStatus(tasks: Task[]): StatusCounts {
  const counts: StatusCounts = { approved: 0, pending_review: 0, pending_submission: 0, returned: 0 };
  tasks.forEach(t => {
    counts[t.status] += 1;
  });
  return counts;
}

export interface ProjectRow {
  projectId: string;
  name: string;
  total: number;
  done: number;
  successPct: number;
  pendingReview: number;
  pendingSubmission: number;
  risk: number;
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/** ทุกโครงการ เรียงจากงานมากไปน้อย (เท่ากันคงลำดับเดิมของโครงการ) */
export function buildProjectRows(tasks: Task[], projects: Project[]): ProjectRow[] {
  return projects
    .map(p => {
      const own = tasks.filter(t => t.projectId === p.id);
      const done = own.filter(t => t.status === 'approved').length;
      return {
        projectId: p.id,
        name: p.name,
        total: own.length,
        done,
        successPct: pct(done, own.length),
        pendingReview: own.filter(t => t.status === 'pending_review').length,
        pendingSubmission: own.filter(t => t.status === 'pending_submission').length,
        risk: own.filter(needsFollowUp).length,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export interface PersonRow {
  userId: string;
  name: string;
  total: number;
  done: number;
  inProgress: number;
  followUp: number;
  avgLeadDays: number | null;
  early: number;
  onTime: number;
  late: number;
  overdue: number;
}

export const cleanName = (name: string) => name.replace(/\s*\([^)]*\)/g, '').trim();

/** สรุปรายบุคคลตามเจ้าของงาน (ผู้รับผิดชอบหลัก) เรียงตามลำดับที่พบในรายการงาน */
export function buildPersonRows(tasks: Task[], now: Date): PersonRow[] {
  const byOwner = new Map<string, Task[]>();
  tasks.forEach(t => byOwner.set(t.assignedToUserId, [...(byOwner.get(t.assignedToUserId) ?? []), t]));

  return [...byOwner.entries()].map(([userId, own]) => {
    const closed = own.filter(t => t.status === 'approved');
    const leads = closed.map(t => t.leadTimeDays).filter((d): d is number => typeof d === 'number');
    const when = own.map(t => timeliness(t, now));
    return {
      userId,
      name: cleanName(own[0].assignedToUserName),
      total: own.length,
      done: closed.length,
      inProgress: own.length - closed.length,
      followUp: own.filter(needsFollowUp).length,
      avgLeadDays: leads.length > 0 ? Math.round((leads.reduce((a, b) => a + b, 0) / leads.length) * 10) / 10 : null,
      early: when.filter(w => w === 'early').length,
      onTime: when.filter(w => w === 'on_time').length,
      late: when.filter(w => w === 'late').length,
      overdue: when.filter(w => w === 'overdue').length,
    };
  });
}

/** Lead time เฉลี่ยของงานที่ปิดแล้ว (วัน, ทศนิยม 1 ตำแหน่ง) */
export function averageLeadDays(tasks: Task[]): number | null {
  const leads = tasks
    .filter(t => t.status === 'approved')
    .map(t => t.leadTimeDays)
    .filter((d): d is number => typeof d === 'number');
  return leads.length > 0 ? Math.round((leads.reduce((a, b) => a + b, 0) / leads.length) * 10) / 10 : null;
}

/** งานต้องติดตาม เรียงตามกำหนดส่งที่ใกล้/เลยมาก่อน */
export function followUpList(tasks: Task[]): Task[] {
  return tasks
    .filter(needsFollowUp)
    .sort((a, b) => new Date(a.deadlineAt).getTime() - new Date(b.deadlineAt).getTime());
}

export const STATUS_LABEL: Record<TaskStatus, string> = {
  approved: 'อนุมัติแล้ว',
  pending_review: 'รอตรวจ',
  pending_submission: 'รอส่งงาน',
  returned: 'ตีกลับ',
};

export const SLA_LABEL: Record<Task['slaStatus'], string> = {
  on_time: 'ตรงเวลา',
  delayed: 'ล่าช้า',
  no_update: 'ไม่มีอัปเดต',
};

export const thaiDate = (d: Date | string) =>
  new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' });
