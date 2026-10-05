import { describe, expect, it } from 'vitest';
import { Project, Task, TaskLog } from '../types';
import {
  buildPersonRows,
  buildProjectRows,
  countByStatus,
  isInScope,
  isLate,
  isLateAlert,
  monthRange,
  needsFollowUp,
  returnReason,
  taskContributors,
  timeliness,
  weekRange,
} from './report';

const task = (over: Partial<Task>): Task => ({
  id: over.id ?? 't1',
  code: 'NP-1',
  projectId: 'p1',
  projectName: 'โครงการ 1',
  title: 'งาน',
  description: '',
  assignedToUserId: 'u1',
  assignedToUserName: 'ออม',
  planDays: 3,
  status: 'pending_submission',
  slaStatus: 'on_time',
  checklists: [],
  createdAt: '2026-09-01T03:00:00Z',
  deadlineAt: '2026-09-10T10:00:00Z',
  lastUpdatedAt: '2026-09-01T03:00:00Z',
  attachments: [],
  ...over,
});

describe('weekRange / monthRange', () => {
  it('week runs Monday to Sunday around the chosen day', () => {
    const { start, end } = weekRange(new Date(2026, 9, 1)); // พุธ 1 ต.ค. 2026
    expect([start.getFullYear(), start.getMonth(), start.getDate(), start.getDay()]).toEqual([2026, 8, 28, 1]);
    expect([end.getMonth(), end.getDate(), end.getHours()]).toEqual([9, 4, 23]);
  });

  it('Sunday belongs to the week that started the Monday before', () => {
    const { start } = weekRange(new Date(2026, 9, 4));
    expect([start.getMonth(), start.getDate()]).toEqual([8, 28]);
  });

  it('month covers the first to the last day', () => {
    const { start, end } = monthRange(2026, 9);
    expect([start.getDate(), end.getMonth(), end.getDate()]).toEqual([1, 8, 30]);
  });
});

describe('isInScope', () => {
  const sep = monthRange(2026, 9);
  it('includes work opened before the period and still open', () => {
    expect(isInScope(task({ createdAt: '2026-08-01T00:00:00Z' }), sep.start, sep.end)).toBe(true);
  });
  it('excludes work closed before the period started', () => {
    expect(isInScope(task({ createdAt: '2026-08-01T00:00:00Z', status: 'approved', completedAt: '2026-08-20T00:00:00Z' }), sep.start, sep.end)).toBe(false);
  });
  it('excludes work created after the period ended', () => {
    expect(isInScope(task({ createdAt: '2026-10-02T00:00:00Z' }), sep.start, sep.end)).toBe(false);
  });
  it('excludes drafts', () => {
    expect(isInScope(task({ isDraft: true }), sep.start, sep.end)).toBe(false);
  });
});

describe('needsFollowUp', () => {
  it('flags returned, delayed and no-update work that is still open', () => {
    expect(needsFollowUp(task({ status: 'returned' }))).toBe(true);
    expect(needsFollowUp(task({ slaStatus: 'delayed' }))).toBe(true);
    expect(needsFollowUp(task({ slaStatus: 'no_update' }))).toBe(true);
    expect(needsFollowUp(task({}))).toBe(false);
  });
  it('never flags approved work', () => {
    expect(needsFollowUp(task({ status: 'approved', slaStatus: 'delayed' }))).toBe(false);
  });
});

describe('timeliness', () => {
  const now = new Date('2026-10-01T05:00:00Z');
  it('compares the approval day with the due day in Thai time', () => {
    // ส่งตี 1 ของวันที่ 10 ตามเวลาไทย = 18:00Z วันที่ 9 ยังถือว่าตรงวันกำหนด
    expect(timeliness(task({ status: 'approved', completedAt: '2026-09-09T18:00:00Z' }), now)).toBe('on_time');
    expect(timeliness(task({ status: 'approved', completedAt: '2026-09-08T03:00:00Z' }), now)).toBe('early');
    expect(timeliness(task({ status: 'approved', completedAt: '2026-09-12T03:00:00Z' }), now)).toBe('late');
  });
  it('marks open work past its due day as overdue, otherwise open', () => {
    expect(timeliness(task({}), now)).toBe('overdue');
    expect(timeliness(task({ deadlineAt: '2026-10-05T00:00:00Z' }), now)).toBe('open');
  });
});

describe('countByStatus', () => {
  it('counts each status', () => {
    const c = countByStatus([task({ status: 'approved' }), task({ status: 'returned' }), task({})]);
    expect(c).toEqual({ approved: 1, pending_review: 0, pending_submission: 1, returned: 1 });
  });
});

describe('buildProjectRows', () => {
  const projects = [
    { id: 'p1', name: 'A' },
    { id: 'p2', name: 'B' },
    { id: 'p3', name: 'C' },
  ] as Project[];
  it('lists every project, busiest first, with success rate and risk count', () => {
    const rows = buildProjectRows(
      [
        task({ id: '1', projectId: 'p2', status: 'approved', completedAt: '2026-09-05T03:00:00Z' }),
        task({ id: '2', projectId: 'p2', status: 'returned' }),
        task({ id: '3', projectId: 'p1' }),
      ],
      projects
    );
    expect(rows.map(r => [r.name, r.total, r.done, r.successPct, r.risk, r.pendingReview, r.pendingSubmission])).toEqual([
      ['B', 2, 1, 50, 1, 0, 0],
      ['A', 1, 0, 0, 1, 0, 1],
      ['C', 0, 0, 0, 0, 0, 0],
    ]);
  });

  it('does not count approved work as risk even when it closed after the deadline', () => {
    const [row] = buildProjectRows(
      [task({ projectId: 'p1', status: 'approved', slaStatus: 'delayed', completedAt: '2026-09-12T03:00:00Z' })],
      projects
    );
    expect(row.risk).toBe(0);
  });

  it('counts card creators plus everyone who changed a status, once each', () => {
    const logs = [
      { taskId: '1', actionByUserId: 'u1' },
      { taskId: '1', actionByUserId: 'u2' },
      { taskId: '2', actionByUserId: 'u2' },
      { taskId: 'other', actionByUserId: 'u9' },
    ] as TaskLog[];
    const [row] = buildProjectRows(
      [task({ id: '1', createdById: 'u1' }), task({ id: '2', createdById: 'u3' })],
      projects,
      logs
    );
    expect(row.participants).toBe(3);
  });
});

describe('isLate / returnReason', () => {
  const now = new Date('2026-09-20T03:00:00Z');
  it('flags SLA delays, late closes and overdue open work only', () => {
    expect(isLate(task({ slaStatus: 'delayed', deadlineAt: '2026-12-01T03:00:00Z' }), now)).toBe(true);
    expect(isLate(task({ status: 'approved', completedAt: '2026-09-12T03:00:00Z' }), now)).toBe(true);
    expect(isLate(task({}), now)).toBe(true);
    expect(isLate(task({ status: 'approved', completedAt: '2026-09-10T03:00:00Z' }), now)).toBe(false);
    expect(isLate(task({ deadlineAt: '2026-12-01T03:00:00Z' }), now)).toBe(false);
  });

  it('does not alert on approved work that closed late', () => {
    const lateApproved = task({ status: 'approved', slaStatus: 'delayed', completedAt: '2026-09-12T03:00:00Z' });
    expect(isLate(lateApproved, now)).toBe(true);
    expect(isLateAlert(lateApproved, now)).toBe(false);
    expect(isLateAlert(task({ slaStatus: 'delayed', deadlineAt: '2026-12-01T03:00:00Z' }), now)).toBe(true);
    expect(isLateAlert(task({}), now)).toBe(true);
  });

  it('takes the latest return comment without the system prefix', () => {
    const logs = [
      { taskId: 't1', newStatus: 'returned', comment: '[ตีกลับแก้ไข] เก่า', createdAt: '2026-09-01T00:00:00Z' },
      { taskId: 't1', newStatus: 'returned', comment: '[ตีกลับแก้ไข] ขาดรูปแนบ', createdAt: '2026-09-03T00:00:00Z' },
      { taskId: 't1', newStatus: 'pending_review', comment: 'ส่งงาน', createdAt: '2026-09-04T00:00:00Z' },
    ] as TaskLog[];
    expect(returnReason(task({ id: 't1' }), logs)).toBe('ขาดรูปแนบ');
    expect(returnReason(task({ id: 't2' }), logs)).toBe('');
  });
});

describe('buildPersonRows', () => {
  it('summarises each owner including timeliness and lead time', () => {
    const now = new Date('2026-10-01T05:00:00Z');
    const rows = buildPersonRows(
      [
        task({ id: '1', status: 'approved', completedAt: '2026-09-08T03:00:00Z', leadTimeDays: 7 }),
        task({ id: '2', status: 'approved', completedAt: '2026-09-12T03:00:00Z', leadTimeDays: 11 }),
        task({ id: '3', status: 'returned' }),
        task({ id: '4', assignedToUserId: 'u2', assignedToUserName: 'พลอย (ผู้ประสานงาน)', deadlineAt: '2026-10-09T00:00:00Z' }),
      ],
      now
    );
    expect(rows).toEqual([
      { userId: 'u1', name: 'ออม', total: 3, done: 2, inProgress: 1, followUp: 1, avgLeadDays: 9, early: 1, onTime: 0, late: 1, overdue: 1 },
      { userId: 'u2', name: 'พลอย', total: 1, done: 0, inProgress: 1, followUp: 0, avgLeadDays: null, early: 0, onTime: 0, late: 0, overdue: 0 },
    ]);
  });
});

describe('taskContributors', () => {
  const log = (actor: string, name: string, newStatus: TaskLog['newStatus'], createdAt: string) =>
    ({ id: actor + createdAt, taskId: 't1', actionByUserId: actor, actionByUserName: name,
       onBehalfOfUserId: 'u1', onBehalfOfUserName: 'ออม', newStatus, comment: '', createdAt }) as TaskLog;

  it('lists people who submitted or uploaded, except the owner and the hand-off target', () => {
    const t = task({
      assignedTargetUserId: 'u2',
      attachments: [
        { id: 'a1', taskId: 't1', fileName: 'x.png', fileUrl: 'u', fileType: 'image', fileSize: 1,
          uploadedBy: 'พี่หมู (Admin)', uploadedById: 'u4', uploadedAt: '2026-09-02T03:00:00Z' },
        { id: 'a2', taskId: 't1', fileName: 'y.png', fileUrl: 'u', fileType: 'image', fileSize: 1,
          uploadedBy: 'พลอย', uploadedById: 'u2', uploadedAt: '2026-09-02T04:00:00Z' },
      ],
    });
    const logs = [
      log('u3', 'พี่หนึ่ง', 'pending_review', '2026-09-03T03:00:00Z'),
      log('u1', 'ออม', 'pending_review', '2026-09-03T04:00:00Z'),
      log('u2', 'พลอย', 'pending_review', '2026-09-03T05:00:00Z'),
      log('u5', 'ผู้ตรวจ', 'returned', '2026-09-03T06:00:00Z'),
      log('u3', 'พี่หนึ่ง', 'pending_review', '2026-09-04T03:00:00Z'),
    ];
    expect(taskContributors(t, logs)).toEqual([
      { userId: 'u4', name: 'พี่หมู' },
      { userId: 'u3', name: 'พี่หนึ่ง' },
    ]);
  });

  it('is empty when only the assigned people worked on the card', () => {
    expect(taskContributors(task({}), [log('u1', 'ออม', 'pending_review', '2026-09-03T03:00:00Z')])).toEqual([]);
  });
});
