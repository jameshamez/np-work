import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Calendar, Filter, Building, Info } from 'lucide-react';
import { Task, TaskStatus, User, Project } from '../types';
import {
  STATUS_LABEL,
  SLA_LABEL,
  averageLeadDays,
  buildPersonRows,
  buildProjectRows,
  cleanName,
  countByStatus,
  followUpList,
  isInScope,
  isLate,
  monthRange,
  needsFollowUp,
  returnReason,
  thaiDate,
  weekRange,
} from '../lib/report';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

interface ExportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  users: User[];
  projects: Project[];
}

// สีสถานะ — ผ่าน validate_palette (dataviz) แล้ว: รอตรวจใช้อำพันเข้มแทนเหลืองอ่อนเพื่อให้ตัดกับพื้นขาว
const STATUS_COLOR: Record<TaskStatus, string> = {
  approved: '#2e7d32',
  pending_review: '#c98200',
  pending_submission: '#1976d2',
  returned: '#c62828',
};
const STATUS_ORDER: TaskStatus[] = ['approved', 'pending_review', 'pending_submission', 'returned'];
const BRAND = '#ef6c00';
const NAVY = '#13304a';

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

const toInputDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const ExportReportModal: React.FC<ExportReportModalProps> = ({ isOpen, onClose, tasks, users, projects }) => {
  const today = new Date();
  const [weekDay, setWeekDay] = useState<string>(toInputDate(today));
  const [year, setYear] = useState<number>(today.getFullYear());
  const [month, setMonth] = useState<number>(today.getMonth() + 1);
  const [assigneeId, setAssigneeId] = useState<string>('all');
  const [projectId, setProjectId] = useState<string>('all');
  // ปัญหาและแนวทางแก้ไข — ผู้ออกรายงานพิมพ์เองก่อนพิมพ์ (บรรทัดละข้อ) ขึ้นเป็นส่วนสุดท้ายของรายงานเสมอ
  // ถ้าเว้นว่างใช้ข้อเสนอที่ระบบสรุปให้
  const [notes, setNotes] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  // เลือกรอบรายงานที่จะออก — ต้องเหลืออย่างน้อยหนึ่งรอบเสมอ
  const [includeWeek, setIncludeWeek] = useState(true);
  const [includeMonth, setIncludeMonth] = useState(true);
  const { logs } = useApp();
  const { profile } = useAuth();

  // ตอนสั่งพิมพ์ให้เหลือแต่รายงาน — ซ่อนตัวแอปทั้งหน้า (ดู .np-report-open ใน index.css)
  useEffect(() => {
    if (!isOpen) return;
    document.body.classList.add('np-report-open');
    return () => document.body.classList.remove('np-report-open');
  }, [isOpen]);

  const report = useMemo(() => {
    const [y, m, d] = weekDay.split('-').map(Number);
    const week = weekRange(new Date(y, m - 1, d));
    const monthR = monthRange(year, month);
    const now = new Date();

    const filtered = tasks.filter(t => {
      if (projectId !== 'all' && t.projectId !== projectId) return false;
      if (assigneeId !== 'all' && t.assignedToUserId !== assigneeId && t.assignedTargetUserId !== assigneeId) return false;
      return true;
    });
    const scopedProjects = projectId === 'all' ? projects : projects.filter(p => p.id === projectId);

    const monthTasks = filtered.filter(t => isInScope(t, monthR.start, monthR.end));
    const weekTasks = filtered.filter(t => isInScope(t, week.start, week.end));

    // หน้า Dashboard ภาพรวมทั้งระบบ — ใช้งานทุกใบ (ไม่จำกัดช่วงเวลา) ตามหน้า Dashboard ในแอป
    const allTasks = filtered.filter(t => !t.isDraft);
    const finance = allTasks.map(t => t.twoTierFinancials).filter((f): f is NonNullable<typeof f> => !!f);
    const staff = users.filter(u => u.status === 'approved' && (assigneeId === 'all' || u.id === assigneeId));
    const allPersonRows = buildPersonRows(allTasks, now);
    const withReasons = (list: Task[]) =>
      list.filter(t => t.status === 'returned').map(t => ({ task: t, reason: returnReason(t, logs) }));

    return {
      allTasks,
      allCounts: countByStatus(allTasks),
      allAvgLead: averageLeadDays(allTasks),
      financeCards: finance.length,
      financeInstallment: finance.reduce((a, f) => a + f.projectInstallment, 0),
      financeApproved: finance.reduce((a, f) => a + f.approvedRemuneration + f.approvedMaterials + f.approvedExpenses, 0),
      staffRows: staff.map(
        u =>
          allPersonRows.find(r => r.userId === u.id) ?? {
            userId: u.id, name: cleanName(u.fullName), total: 0, done: 0, inProgress: 0, followUp: 0,
            avgLeadDays: null, early: 0, onTime: 0, late: 0, overdue: 0,
          }
      ),
      week,
      month: monthR,
      monthTasks,
      weekTasks,
      monthCounts: countByStatus(monthTasks),
      weekCounts: countByStatus(weekTasks),
      monthFollowUp: monthTasks.filter(needsFollowUp).length,
      weekFollowUp: weekTasks.filter(needsFollowUp).length,
      avgLead: averageLeadDays(monthTasks),
      // ภาพรวมโครงการนับการ์ดทุกใบภายใต้โครงการ (สะสม ไม่ตัดตามเดือน) — ความสำเร็จ = เสร็จแล้ว / ทั้งหมด
      projectRows: buildProjectRows(allTasks, scopedProjects, logs, now),
      weekProjectRows: buildProjectRows(weekTasks, scopedProjects, logs, now).filter(r => r.total > 0),
      personRows: buildPersonRows(monthTasks, now),
      weekUrgent: followUpList(weekTasks),
      // รายละเอียดงานที่ต้องติดตามไม่รวมงานที่ SLA ยังตรงเวลา
      monthUrgent: followUpList(monthTasks).filter(t => t.slaStatus !== 'on_time'),
      monthLate: monthTasks.filter(t => isLate(t, now)),
      weekLate: weekTasks.filter(t => isLate(t, now)),
      monthReturned: withReasons(monthTasks),
      weekReturned: withReasons(weekTasks),
      weekAvgLead: averageLeadDays(weekTasks),
      projectCount: scopedProjects.length,
    };
  }, [tasks, projects, users, logs, weekDay, year, month, assigneeId, projectId]);

  if (!isOpen) return null;

  const weekLabel = `${thaiDate(report.week.start)} ถึง ${thaiDate(report.week.end)}`;
  const monthLabel = `${thaiDate(report.month.start)} ถึง ${thaiDate(report.month.end)}`;
  const issuedAt = thaiDate(new Date());
  const issuedBy = profile ? cleanName(profile.full_name) : '';
  const filterNote = [
    projectId !== 'all' ? `โครงการ: ${projects.find(p => p.id === projectId)?.name ?? ''}` : '',
    assigneeId !== 'all' ? `ผู้รับผิดชอบ: ${cleanName(users.find(u => u.id === assigneeId)?.fullName ?? '')}` : '',
  ]
    .filter(Boolean)
    .join(' • ');

  const mTotal = report.monthTasks.length;

  // หน้าสรุปผู้บริหารใช้ขอบเขตรายเดือน ถ้าเลือกเฉพาะรายสัปดาห์จึงสรุปจากสัปดาห์
  const sum = includeMonth
    ? { total: mTotal, counts: report.monthCounts, followUp: report.monthFollowUp, late: report.monthLate, returned: report.monthReturned, avgLead: report.avgLead }
    : { total: report.weekTasks.length, counts: report.weekCounts, followUp: report.weekFollowUp, late: report.weekLate, returned: report.weekReturned, avgLead: report.weekAvgLead };
  const sumInProgress = sum.counts.pending_submission + sum.counts.pending_review;
  const successPct = sum.total > 0 ? Math.round((sum.counts.approved / sum.total) * 100) : 0;
  const roundLabel = [includeWeek && `รายสัปดาห์ ${weekLabel}`, includeMonth && `รายเดือน ${monthLabel}`].filter(Boolean).join(' และ');
  const toggleRound = (which: 'week' | 'month') => {
    if (which === 'week' && (includeMonth || !includeWeek)) setIncludeWeek(v => !v);
    if (which === 'month' && (includeWeek || !includeMonth)) setIncludeMonth(v => !v);
  };
  // ปัญหาและแนวทางแก้ไข — วางท้ายหน้าสุดท้ายของรายงาน (รายเดือนถ้าเลือกไว้ ไม่งั้นรายสัปดาห์)
  const busiest = (includeMonth ? report.projectRows : report.weekProjectRows)[0];
  const closingNotes = (
    <>
      <h3 className="mt-8 mb-2 text-base font-extrabold text-slate-800">ปัญหาและแนวทางแก้ไข</h3>
      <NotesList text={notes}>
        {sum.followUp > 0 && <li>มอบหมายเจ้าของและวันปิดที่ชัดเจนให้ {sum.followUp} งานที่ล่าช้า ตีกลับ หรือไม่มีการอัปเดต</li>}
        {sum.counts.pending_review > 0 && (
          <li>เร่งตรวจ {sum.counts.pending_review} งานที่อยู่สถานะรอตรวจ เพื่อลดงานค้างระหว่างผู้ปฏิบัติกับผู้อนุมัติ</li>
        )}
        {busiest && busiest.total > 1 && (
          <li>ทบทวนกำลังคนของโครงการ “{busiest.name}” ซึ่งมีงานมากที่สุด ({busiest.total} งาน) และย้ายทรัพยากรเมื่อกำหนดส่งทับซ้อนกัน</li>
        )}
        {sum.followUp === 0 && sum.counts.pending_review === 0 && <li>ไม่มีประเด็นเร่งด่วนในรอบรายงานนี้</li>}
      </NotesList>
    </>
  );

  return createPortal(
    <div className="np-report-overlay fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden print:block">
      {/* แผงควบคุมด้านขวา (ไม่พิมพ์) — จอแคบย้ายขึ้นไปอยู่บนสุด */}
      <aside className="order-1 lg:order-2 w-full lg:w-[320px] shrink-0 bg-white border-b lg:border-b-0 lg:border-l border-orange-100 shadow-sm lg:overflow-y-auto print:hidden">
        <div className="px-4 py-4 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-extrabold text-gray-900">รายงานสรุปสถานะโครงการและผลการปฏิบัติงาน</h2>
              <p className="text-[11px] text-gray-500">คำนวณจากข้อมูลจริงในระบบ ณ ตอนเปิดรายงาน</p>
            </div>
            <div className="flex items-center shrink-0">
              <button
                type="button"
                onClick={() => setShowGuide(v => !v)}
                className="w-8 h-8 rounded-full hover:bg-orange-50 flex items-center justify-center text-orange-600 cursor-pointer"
                aria-label="รูปแบบข้อมูลของรายงาน"
                title="รูปแบบข้อมูลของรายงาน"
              >
                <Info className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600 cursor-pointer"
                aria-label="ปิด"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {showGuide && <ReportGuide />}

          <div className="space-y-1.5 text-xs font-bold text-gray-700">
            <span className="block text-[11px]">รอบรายงาน <span className="font-normal text-gray-400">(เลือกอย่างน้อย 1 รอบ)</span></span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={includeWeek} onChange={() => toggleRound('week')} className="w-4 h-4 accent-orange-600" />
              รายสัปดาห์
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={includeMonth} onChange={() => toggleRound('month')} className="w-4 h-4 accent-orange-600" />
              รายเดือน
            </label>
          </div>

          <label className={`block text-[11px] font-bold text-gray-700 space-y-1 ${includeWeek ? '' : 'opacity-40'}`}>
            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-orange-600" />สัปดาห์ (เลือกวันใดก็ได้ในสัปดาห์)</span>
            <input
              type="date"
              disabled={!includeWeek}
              value={weekDay}
              onChange={e => e.target.value && setWeekDay(e.target.value)}
              className="w-full py-1.5 px-2.5 bg-white border border-gray-200 rounded-lg text-xs font-bold"
            />
          </label>
          <label className={`block text-[11px] font-bold text-gray-700 space-y-1 ${includeMonth ? '' : 'opacity-40'}`}>
            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-orange-600" />เดือน</span>
            <div className="grid grid-cols-2 gap-1">
              <select disabled={!includeMonth} value={month} onChange={e => setMonth(Number(e.target.value))} className="py-1.5 px-2 bg-white border border-gray-200 rounded-lg text-xs font-bold">
                {THAI_MONTHS.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
              </select>
              <select disabled={!includeMonth} value={year} onChange={e => setYear(Number(e.target.value))} className="py-1.5 px-2 bg-white border border-gray-200 rounded-lg text-xs font-bold">
                {[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map(y => (
                  <option key={y} value={y}>{y + 543}</option>
                ))}
              </select>
            </div>
          </label>
          <label className="block text-[11px] font-bold text-gray-700 space-y-1">
            <span className="flex items-center gap-1"><Building className="w-3.5 h-3.5 text-orange-600" />โครงการ</span>
            <select value={projectId} onChange={e => setProjectId(e.target.value)} className="w-full py-1.5 px-2 bg-white border border-gray-200 rounded-lg text-xs font-bold">
              <option value="all">ทุกโครงการ ({projects.length})</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="block text-[11px] font-bold text-gray-700 space-y-1">
            <span className="flex items-center gap-1"><Filter className="w-3.5 h-3.5 text-orange-600" />ผู้รับผิดชอบ</span>
            <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} className="w-full py-1.5 px-2 bg-white border border-gray-200 rounded-lg text-xs font-bold">
              <option value="all">ทุกคน</option>
              {users.filter(u => u.status === 'approved').map(u => (
                <option key={u.id} value={u.id}>{cleanName(u.fullName)}</option>
              ))}
            </select>
          </label>

          <NotesInput label="ปัญหาและแนวทางแก้ไข (ขึ้นท้ายรายงาน)" value={notes} onChange={setNotes} />

          <button
            type="button"
            onClick={() => window.print()}
            className="w-full px-4 py-2.5 text-white rounded-xl text-xs font-extrabold shadow-md hover:opacity-90 inline-flex items-center justify-center gap-1.5 cursor-pointer"
            style={{ backgroundColor: BRAND }}
          >
            <Printer className="w-4 h-4" />
            <span>พิมพ์ / บันทึก PDF</span>
          </button>
        </div>
      </aside>

      <IssuedByContext.Provider value={issuedBy}>
      <div className="np-report-pages order-2 lg:order-1 flex-1 min-w-0 lg:overflow-y-auto py-6 px-3 space-y-6 print:overflow-visible print:p-0 print:space-y-0">
        {/* หน้า 1 — สรุปผู้บริหาร */}
        <Sheet>
          <h1 className="text-[32px] sm:text-[40px] print:text-[40px] font-black tracking-tight leading-none">
            <span style={{ color: BRAND }}>NP</span> <span className="text-slate-800">TASKWORK</span>
          </h1>
          <h2 className="mt-8 text-2xl font-extrabold text-slate-900 pb-2 border-b-2 border-blue-500">
            รายงานสรุปสถานะโครงการและผลการปฏิบัติงาน
          </h2>
          <p className="mt-2 text-sm text-slate-500">รายงานรายสัปดาห์และรายเดือนจากข้อมูลในระบบ • ออกรายงานวันที่ {issuedAt}</p>
          <Para label="วัตถุประสงค์">
            สรุปภาพรวมงาน ความคืบหน้า ความเสี่ยง และภาระงานรายโครงการ เพื่อให้ผู้บริหารทราบการดำเนินงานและปัญหาในการดำเนินงาน
          </Para>
          <Para label="รอบรายงาน">
            {roundLabel}
            {filterNote && <> • {filterNote}</>}
          </Para>

          <Kpis
            items={[
              { label: 'งานทั้งหมด', value: sum.total, note: `ครอบคลุม ${report.projectCount} โครงการ`, color: BRAND, bg: '#fff3e8' },
              { label: 'อนุมัติแล้ว', value: sum.counts.approved, note: `อัตราสำเร็จ ${successPct}%`, color: STATUS_COLOR.approved, bg: '#eaf5ec' },
              { label: 'อยู่ระหว่างดำเนินงาน', value: sumInProgress, note: 'รอส่งและรอตรวจ', color: STATUS_COLOR.pending_submission, bg: '#e9f2fb' },
              { label: 'ต้องติดตาม', value: sum.followUp, note: 'ล่าช้า ไม่มีอัปเดต หรือตีกลับ', color: STATUS_COLOR.returned, bg: '#fcecec' },
            ]}
          />

          <h3 className="mt-8 mb-3 text-lg font-extrabold text-slate-800">สัดส่วนสถานะงานทั้งหมด</h3>
          <StatusDonut counts={sum.counts} total={sum.total} />

          <Para label="ข้อสรุปผู้บริหาร">
            {sum.total === 0
              ? 'ไม่มีงานในขอบเขตช่วงเวลาที่เลือก'
              : `งานอนุมัติแล้ว ${sum.counts.approved} จาก ${sum.total} งาน ขณะที่มี ${sum.followUp} งานต้องติดตามเป็นพิเศษ`}
          </Para>
          {sum.late.length > 0 && (
            <>
              <p className="mt-3 text-sm font-bold text-slate-800">งานส่งล่าช้า {sum.late.length} งาน</p>
              <ol className="list-decimal pl-6 mt-1 space-y-1 text-sm text-slate-700">
                {sum.late.map(t => (
                  <li key={t.id}>
                    <span className="font-bold">{t.code}</span> {t.projectName} — {t.title} (กำหนดส่ง {thaiDate(t.deadlineAt)})
                  </li>
                ))}
              </ol>
            </>
          )}
          {sum.returned.length > 0 && (
            <>
              <p className="mt-3 text-sm font-bold text-slate-800">งานที่ถูกตีกลับ {sum.returned.length} งาน</p>
              <ol className="list-decimal pl-6 mt-1 space-y-1 text-sm text-slate-700">
                {sum.returned.map(({ task: t, reason }) => (
                  <li key={t.id}>
                    <span className="font-bold">{t.code}</span> {t.projectName} — {t.title} ถูกตีกลับเนื่องจาก {reason || 'ไม่ได้ระบุเหตุผล'}
                  </li>
                ))}
              </ol>
            </>
          )}
          {sum.total > 0 && (
            <p className="mt-3 text-sm text-slate-600">
              {sum.avgLead !== null
                ? `ระยะเวลาดำเนินงานเฉลี่ยของงานที่ปิดแล้วอยู่ที่ ${sum.avgLead} วัน`
                : 'ยังไม่มีงานที่ปิดในช่วงนี้'}
            </p>
          )}
        </Sheet>

        {/* หน้า Dashboard — ภาพรวมทั้งระบบ (ตรงกับหน้า Dashboard ในแอป) */}
        <Sheet>
          <SheetTitle>Dashboard ภาพรวมทั้งระบบ</SheetTitle>
          <Para label="ขอบเขต">งานทุกใบในระบบ ไม่จำกัดช่วงเวลา (ไม่นับร่าง){filterNote && <> • {filterNote}</>}</Para>
          <Kpis
            items={[
              { label: 'งานทั้งหมดในระบบ', value: report.allTasks.length, note: `จาก ${report.projectCount} โครงการ`, color: BRAND, bg: '#fff3e8' },
              {
                label: 'อนุมัติเสร็จสมบูรณ์', value: report.allCounts.approved,
                note: `คิดเป็น ${report.allTasks.length > 0 ? Math.round((report.allCounts.approved / report.allTasks.length) * 100) : 0}%`,
                color: STATUS_COLOR.approved, bg: '#eaf5ec',
              },
              { label: 'รอการตรวจอนุมัติ', value: report.allCounts.pending_review, note: 'รอผู้ตรวจดำเนินการ', color: STATUS_COLOR.pending_review, bg: '#fdf6e3' },
              { label: 'ต้องติดตาม', value: report.allTasks.filter(needsFollowUp).length, note: 'ล่าช้า ไม่มีอัปเดต หรือตีกลับ', color: STATUS_COLOR.returned, bg: '#fcecec' },
            ]}
          />
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div className="border border-slate-200 p-3">
              <div className="text-xs font-bold text-slate-700">Lead time เฉลี่ย (งานที่ปิดแล้ว)</div>
              <div className="mt-1 text-2xl font-black text-slate-800">{report.allAvgLead !== null ? `${report.allAvgLead} วัน` : '-'}</div>
              <div className="text-[11px] text-slate-500">นับรวมวันหยุดเสาร์-อาทิตย์</div>
            </div>
            <div className="border border-slate-200 p-3">
              <div className="text-xs font-bold text-slate-700">สรุปยอดเบิกจ่าย (เงินงวด 2 ระดับ)</div>
              {report.financeCards === 0 ? (
                <div className="mt-1 text-sm text-slate-500">ยังไม่มีการ์ดที่บันทึกเงินงวด</div>
              ) : (
                <>
                  <div className="mt-1 text-2xl font-black text-slate-800">{report.financeInstallment.toLocaleString('th-TH')} บาท</div>
                  <div className="text-[11px] text-slate-500">
                    อนุมัติเบิกจริงรวม {report.financeApproved.toLocaleString('th-TH')} บาท • จาก {report.financeCards} การ์ด
                  </div>
                </>
              )}
            </div>
          </div>
          <h3 className="mt-8 mb-1 text-base font-extrabold text-slate-800">รายงานสรุปผลการดำเนินงานรายบุคคล</h3>
          <Table
            head={['ผู้รับผิดชอบ', 'งานทั้งหมด', 'เสร็จสิ้น (อนุมัติ)', 'กำลังดำเนินงาน', 'ต้องติดตาม', 'Lead time เฉลี่ย']}
            rows={report.staffRows.map(r => [r.name, r.total, r.done, r.inProgress, r.followUp, r.avgLeadDays ?? '-'])}
            empty="ไม่มีผู้ใช้งาน"
          />
        </Sheet>

        {/* หน้า 2 — ภาพรวมโครงการ */}
        <Sheet>
          <SheetTitle>ภาพรวมโครงการทั้งหมด</SheetTitle>
          <Para label="อธิบาย">
            เรียงโครงการตามจำนวนงาน เพื่อให้เห็นโครงการที่ใช้ทรัพยากรมากและโครงการที่มีสัญญาณเสี่ยงก่อน
            ซึ่งอ้างอิงจากโครงการทั้งหมดในระบบ และนับการ์ดงานทุกใบภายใต้แต่ละโครงการ (สะสมทั้งหมด ไม่ตัดตามช่วงเวลา)
          </Para>
          <Table
            head={[
              'ลำดับ',
              'โครงการ',
              'จำนวนงานทั้งหมดภายใต้โครงการ (การ์ดงาน)',
              'จำนวนผู้ดำเนินงาน (ผู้สร้างการ์ด + ผู้ปรับสถานะ)',
              'เสร็จแล้ว',
              'ความสำเร็จ [(งานทั้งหมด − งานที่ไม่เสร็จ) ÷ งานทั้งหมด] × 100',
              'งานเสี่ยง (งานที่ไม่เสร็จ และงานที่ส่งล่าช้า)',
            ]}
            rows={report.projectRows.map((r, i) => [i + 1, r.name, r.total, r.participants, r.done, `${r.successPct}%`, r.risk])}
            empty="ไม่มีโครงการ"
          />
          <h3 className="mt-8 mb-1 text-base font-extrabold text-slate-800">จำนวนงานตามโครงการ 7 อันดับแรก</h3>
          <p className="mb-3 text-xs text-slate-500">
            <span className="font-bold text-slate-700">อธิบาย</span> คำนวณจาก 7 อันดับโครงการที่มีจำนวนงาน (การ์ดงาน) มากที่สุด เรียงตามลำดับ
          </p>
          <BarChart data={report.projectRows.slice(0, 7).map(r => ({ label: r.name, value: r.total }))} color={BRAND} unit="งาน" />
        </Sheet>

        {includeWeek && (
        <>
        {/* หน้า 3 — รายสัปดาห์ */}
        <Sheet>
          <SheetTitle>รายงานรายสัปดาห์</SheetTitle>
          <Para label="ช่วงเวลา">{weekLabel} ใช้หลักงานที่มีความเคลื่อนไหวในสัปดาห์หรือยังเปิดดำเนินการอยู่</Para>
          <Kpis
            items={[
              { label: 'งานในขอบเขตสัปดาห์', value: report.weekTasks.length, note: 'รวมงานที่ยังเปิดอยู่', color: BRAND, bg: '#fff3e8' },
              { label: 'รอตรวจ', value: report.weekCounts.pending_review, note: 'รอผู้ตรวจดำเนินการ', color: STATUS_COLOR.pending_review, bg: '#fdf6e3' },
              { label: 'รอส่งงาน', value: report.weekCounts.pending_submission, note: 'ยังดำเนินการไม่เสร็จ', color: STATUS_COLOR.pending_submission, bg: '#e9f2fb' },
              { label: 'ต้องติดตาม', value: report.weekFollowUp, note: 'ความเสี่ยงเกินระยะเวลาส่งงาน', color: STATUS_COLOR.returned, bg: '#fcecec' },
            ]}
          />
          <h3 className="mt-8 mb-3 text-base font-extrabold text-slate-800">รายการเร่งด่วนประจำสัปดาห์</h3>
          <Table
            head={['#', 'รหัส', 'ชื่องาน', 'ผู้รับผิดชอบ', 'สถานะ', 'SLA']}
            rows={report.weekUrgent.map((t, i) => [i + 1, t.code, t.title, cleanName(t.assignedToUserName), STATUS_LABEL[t.status], SLA_LABEL[t.slaStatus]])}
            empty="ไม่มีงานเร่งด่วนในสัปดาห์นี้"
          />
          <Para label="ข้อเสนอการประชุมประจำสัปดาห์">
            {report.weekTasks.length === 0
              ? 'ไม่มีงานในขอบเขตสัปดาห์นี้'
              : `เริ่มจากงานล่าช้าและงานตีกลับ ${report.weekFollowUp} งาน จากนั้นตรวจงานรอตรวจ ${report.weekCounts.pending_review} งานที่สามารถปิดได้เร็ว และยืนยันกำหนดส่งของงานรอส่ง ${report.weekCounts.pending_submission} งาน`}
          </Para>
        </Sheet>

        {/* หน้า 4 — รายสัปดาห์แยกตามโครงการ */}
        <Sheet>
          <SheetTitle>สรุปรายสัปดาห์แยกตามโครงการ</SheetTitle>
          <Table
            head={['#', 'โครงการ', 'รวม', 'เสร็จ', 'รอตรวจ', 'รอส่ง', 'เสี่ยง']}
            rows={report.weekProjectRows.map((r, i) => [i + 1, r.name, r.total, r.done, r.pendingReview, r.pendingSubmission, r.risk])}
            empty="ไม่มีงานในขอบเขตสัปดาห์นี้"
          />
          {!includeMonth && closingNotes}
        </Sheet>

        </>
        )}

        {includeMonth && (
        <>
        {/* หน้า 5 — รายเดือน */}
        <Sheet>
          <SheetTitle>รายงานรายเดือน</SheetTitle>
          <Para label="ช่วงเวลา">{monthLabel} แสดงภาพรวมงานที่ยังเปิดดำเนินการหรือมีความเคลื่อนไหวภายในเดือน</Para>
          <Kpis
            items={[
              { label: 'งานในขอบเขตเดือน', value: mTotal, note: 'รวมงานต่อเนื่อง', color: BRAND, bg: '#fff3e8' },
              { label: 'อนุมัติแล้ว', value: report.monthCounts.approved, note: 'ปิดงานในขอบเขต', color: STATUS_COLOR.approved, bg: '#eaf5ec' },
              { label: 'รอตรวจ', value: report.monthCounts.pending_review, note: 'คิวอนุมัติ', color: STATUS_COLOR.pending_review, bg: '#fdf6e3' },
              { label: 'ต้องติดตาม', value: report.monthFollowUp, note: 'ประเด็น SLA', color: STATUS_COLOR.returned, bg: '#fcecec' },
            ]}
          />
          <h3 className="mt-8 mb-1 text-base font-extrabold text-slate-800">ภาระงานตามผู้รับผิดชอบ</h3>
          <p className="mb-3 text-xs text-slate-500">
            <span className="font-bold text-slate-700">อธิบาย</span> งานที่อยู่ในมือของแต่ละคนภายในขอบเขตเดือน
          </p>
          <BarChart data={report.personRows.map(p => ({ label: p.name, value: p.total }))} color={STATUS_COLOR.pending_submission} unit="งาน" />
          <h3 className="mt-8 mb-2 text-base font-extrabold text-slate-800">ข้อสังเกต: สาเหตุงานล่าช้า</h3>
          {report.monthLate.length === 0 ? (
            <p className="text-sm text-slate-500">ไม่มีงานล่าช้าในเดือนนี้</p>
          ) : (
            <ol className="list-decimal pl-6 space-y-1 text-sm text-slate-700">
              {report.monthLate.map(t => (
                <li key={t.id}>
                  <span className="font-bold">{t.code}</span> {t.projectName} — {t.title}:{' '}
                  {t.delayReason?.trim() || <span className="text-slate-400">ยังไม่ได้ระบุสาเหตุ</span>}
                </li>
              ))}
            </ol>
          )}
        </Sheet>

        {/* หน้า 6 — รายบุคคล */}
        <Sheet>
          <SheetTitle>ผลการปฏิบัติงานรายบุคคล</SheetTitle>
          <Table
            head={['ผู้รับผิดชอบ', 'งานทั้งหมด', 'เสร็จแล้ว', 'กำลังดำเนินการ', 'ต้องติดตาม', 'Lead time เฉลี่ย']}
            rows={report.personRows.map(p => [p.name, p.total, p.done, p.inProgress, p.followUp, p.avgLeadDays ?? '-'])}
            empty="ไม่มีงานในขอบเขตเดือนนี้"
          />
          <h3 className="mt-8 mb-2 text-base font-extrabold text-slate-800">ความตรงต่อเวลาของการส่งงาน</h3>
          <Table
            head={['ผู้รับผิดชอบ', 'เสร็จก่อนกำหนด', 'เสร็จตรงเวลา', 'เสร็จล่าช้า', 'ค้างเกินกำหนด']}
            rows={report.personRows.map(p => [p.name, p.early, p.onTime, p.late, p.overdue])}
            empty="ไม่มีงานในขอบเขตเดือนนี้"
          />
          <p className="mt-2 text-xs text-slate-500">
            เทียบวันที่อนุมัติปิดงานกับวันกำหนดส่ง (ตามเวลาไทย) • ค้างเกินกำหนด = งานที่ยังไม่ปิดและเลยวันกำหนดส่งแล้ว
          </p>
          <h3 className="mt-6 mb-1 text-base font-extrabold text-slate-800">อธิบาย</h3>
          <Para label="Lead time">คือ จำนวนวันตั้งแต่เริ่มงานจนได้รับอนุมัติปิดงาน</Para>
          <Para label="การใช้งาน">
            ใช้เพื่อปรับสมดุลงานและระบุจุดติดขัดของกระบวนการ ไม่ควรสรุปประสิทธิภาพจากจำนวนงานเพียงอย่างเดียว เพราะความซับซ้อนและระยะเวลาของแต่ละงานแตกต่างกัน
          </Para>
        </Sheet>

        {/* หน้า 7 — งานที่ต้องติดตาม */}
        <Sheet>
          <SheetTitle>รายละเอียดงานที่ต้องติดตาม</SheetTitle>
          <p className="text-xs text-slate-500">แสดงเฉพาะงานที่ล่าช้า ไม่มีอัปเดต หรือตีกลับ ที่ SLA ไม่ตรงเวลา</p>
          <Table
            head={['#', 'รหัส', 'โครงการ', 'ชื่องาน', 'เจ้าของ', 'สถานะ', 'SLA', 'กำหนดส่ง']}
            rows={report.monthUrgent.map((t, i) => [
              i + 1, t.code, t.projectName, t.title, cleanName(t.assignedToUserName),
              STATUS_LABEL[t.status], SLA_LABEL[t.slaStatus], thaiDate(t.deadlineAt),
            ])}
            empty="ไม่มีงานที่ต้องติดตามในเดือนนี้"
          />
          {closingNotes}
        </Sheet>
        </>
        )}
      </div>
      </IssuedByContext.Provider>
    </div>,
    document.body
  );
};

// ---------------------------------------------------------------------------
// ชิ้นส่วนหน้ารายงาน
// ---------------------------------------------------------------------------

const IssuedByContext = createContext('');

const Sheet: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const issuedBy = useContext(IssuedByContext);
  return (
  <section className="np-report-sheet relative mx-auto bg-white text-slate-800 shadow-xl w-full max-w-[794px] sm:min-h-[1123px] print:min-h-[1123px] px-4 sm:px-[56px] print:px-[56px] pt-12 sm:pt-[56px] print:pt-[56px] pb-[64px] sm:pb-[72px] flex flex-col">
    <div className="absolute top-5 right-4 sm:right-[56px] print:right-[56px] text-[10px] font-bold tracking-wide text-slate-500">NP TASKWORK | MANAGEMENT REPORT</div>
    <div className="flex-1">{children}</div>
    <div className="absolute bottom-6 inset-x-0 text-center text-[10px] text-slate-500">
      รายงานสรุปสถานะโครงการและผลการปฏิบัติงาน
      {issuedBy && <> <span style={{ color: BRAND }}>•</span> ออกรายงานโดย {issuedBy}</>}
    </div>
  </section>
  );
};

const SheetTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-2xl font-extrabold text-slate-900 mb-2">{children}</h2>
);

const Para: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <p className="mt-4 text-sm leading-relaxed text-slate-600">
    <span className="font-extrabold text-slate-900">{label}</span> {children}
  </p>
);

const Kpis: React.FC<{ items: { label: string; value: number; note: string; color: string; bg: string }[] }> = ({ items }) => (
  <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 print:grid-cols-4 border border-slate-200">
    {items.map(k => (
      <div key={k.label} className="p-3 border-r border-b sm:border-b-0 print:border-b-0 last:border-r-0 border-slate-200" style={{ backgroundColor: k.bg }}>
        <div className="text-xs font-bold text-slate-700">{k.label}</div>
        <div className="mt-2 text-4xl font-black leading-none" style={{ color: k.color }}>{k.value}</div>
        <div className="mt-2 text-[11px] text-slate-600">{k.note}</div>
      </div>
    ))}
  </div>
);

/** จอแคบเลื่อนตารางแนวนอนได้ ตอนพิมพ์ A4 กว้างพอเสมอ */
const Table: React.FC<{ head: string[]; rows: (string | number)[][]; empty: string }> = ({ head, rows, empty }) => (
  <div className="mt-4 overflow-x-auto print:overflow-visible">
    <table className="w-full min-w-[480px] print:min-w-0 border-collapse text-xs">
      <thead>
        <tr>
          {head.map(h => (
            <th key={h} className="px-2 py-2.5 text-center font-bold text-white border border-slate-300" style={{ backgroundColor: NAVY }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={head.length} className="px-2 py-6 text-center text-slate-500 border border-slate-200">{empty}</td>
          </tr>
        ) : (
          rows.map((row, i) => (
            <tr key={i} className={i % 2 ? 'bg-slate-50' : 'bg-white'} style={{ breakInside: 'avoid' }}>
              {row.map((cell, j) => (
                <td key={j} className={`px-2 py-2 border border-slate-200 ${typeof cell === 'number' ? 'text-center tabular-nums' : ''}`}>{cell}</td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

/** โดนัทสัดส่วนสถานะ — ทุกชิ้นมีป้ายชื่อ จำนวน และเปอร์เซ็นต์ในคำอธิบาย ไม่พึ่งสีอย่างเดียว */
const StatusDonut: React.FC<{ counts: Record<TaskStatus, number>; total: number }> = ({ counts, total }) => {
  const r = 70;
  const circumference = 2 * Math.PI * r;
  const gap = total > 1 ? 2 : 0; // ช่องว่าง 2px ระหว่างชิ้น
  let offset = 0;
  const segments = STATUS_ORDER.filter(s => counts[s] > 0).map(s => {
    const len = (counts[s] / Math.max(total, 1)) * circumference;
    const seg = { status: s, dash: Math.max(len - gap, 0), offset };
    offset += len;
    return seg;
  });

  return (
    <div className="flex flex-col sm:flex-row print:flex-row items-center gap-6 sm:gap-10 sm:pl-6 print:pl-6">
      <svg width="200" height="200" viewBox="0 0 200 200" role="img" aria-label="สัดส่วนสถานะงาน">
        <circle cx="100" cy="100" r={r} fill="none" stroke="#eef1f4" strokeWidth="36" />
        {segments.map(seg => (
          <circle
            key={seg.status}
            cx="100"
            cy="100"
            r={r}
            fill="none"
            stroke={STATUS_COLOR[seg.status]}
            strokeWidth="36"
            strokeDasharray={`${seg.dash} ${circumference - seg.dash}`}
            strokeDashoffset={-seg.offset}
            transform="rotate(-90 100 100)"
          >
            <title>{`${STATUS_LABEL[seg.status]} ${counts[seg.status]} งาน`}</title>
          </circle>
        ))}
        <text x="100" y="100" textAnchor="middle" className="fill-slate-800" style={{ fontSize: 30, fontWeight: 800 }}>{total}</text>
        <text x="100" y="122" textAnchor="middle" className="fill-slate-500" style={{ fontSize: 11 }}>งานทั้งหมด</text>
      </svg>
      <ul className="space-y-3">
        {STATUS_ORDER.map(s => (
          <li key={s} className="flex items-center gap-3 text-sm font-bold text-slate-700">
            <span className="w-6 h-4 rounded-sm shrink-0" style={{ backgroundColor: STATUS_COLOR[s] }} />
            {STATUS_LABEL[s]} {counts[s]} งาน ({total > 0 ? Math.round((counts[s] / total) * 100) : 0}%)
          </li>
        ))}
      </ul>
    </div>
  );
};

/** กราฟแท่งชุดเดียว — ตัวเลขกำกับบนแท่ง ชื่ออยู่ใต้แท่ง แท่งค่า 0 แสดงเป็นเส้นฐาน */
const BarChart: React.FC<{ data: { label: string; value: number }[]; color: string; unit: string }> = ({ data, color, unit }) => {
  if (data.length === 0) {
    return <p className="text-sm text-slate-500 py-6 text-center border border-dashed border-slate-200">ไม่มีข้อมูล</p>;
  }
  const max = Math.max(...data.map(d => d.value), 1);
  const H = 170;
  return (
    <div>
      <div className="flex items-end gap-2 sm:gap-4 border-b border-slate-300" style={{ height: H + 28 }}>
        {data.map(d => (
          <div key={d.label} className="flex-1 min-w-0 flex flex-col items-center justify-end" title={`${d.label}: ${d.value} ${unit}`}>
            <span className="text-sm font-extrabold text-slate-800 mb-1 tabular-nums">{d.value}</span>
            <div
              className="w-full max-w-[90px] rounded-t"
              style={{ height: d.value > 0 ? (d.value / max) * H : 1, backgroundColor: d.value > 0 ? color : '#cbd5e1' }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2 sm:gap-4 pt-1.5">
        {data.map(d => (
          <span key={d.label} className="flex-1 min-w-0 text-[10px] leading-tight text-slate-600 text-center line-clamp-2">{d.label}</span>
        ))}
      </div>
    </div>
  );
};

const NOTES_PLACEHOLDER = [
  'บรรทัดละหนึ่งข้อ เช่น',
  'มอบหมายเจ้าของและวันปิดที่ชัดเจนให้ทุกงานที่ล่าช้าหรือไม่มีการอัปเดต',
  'เร่งตรวจงานที่อยู่สถานะรอตรวจ เพื่อลดงานค้างระหว่างผู้ปฏิบัติกับผู้อนุมัติ',
  'ทบทวนกำลังคนของโครงการที่มีจำนวนงานสูง และย้ายทรัพยากรเมื่อกำหนดส่งทับซ้อนกัน',
].join('\n');

const NotesInput: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <label className="text-[11px] font-bold text-gray-700 space-y-1">
    <span>{label}</span>
    <textarea
      rows={5}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={NOTES_PLACEHOLDER}
      className="w-full py-1.5 px-2.5 bg-white border border-gray-200 rounded-lg text-xs font-normal placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
    />
    <span className="block text-[10px] font-normal text-gray-400">เว้นว่างไว้ ระบบจะสรุปข้อเสนอให้อัตโนมัติ</span>
  </label>
);

/** ข้อความที่ผู้ออกรายงานพิมพ์ (บรรทัดละข้อ) — ถ้าไม่ได้พิมพ์ใช้ข้อเสนอที่ระบบสรุปให้ (children) */
const NotesList: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => {
  const lines = text.split('\n').map(l => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
  return (
    <ul className="list-disc pl-6 space-y-1 text-sm text-slate-700">
      {lines.length > 0 ? lines.map((l, i) => <li key={i}>{l}</li>) : children}
    </ul>
  );
};

/** รูปแบบข้อมูลของรายงาน — แสดงในระบบ (ปุ่ม i) แทนการพิมพ์เป็นหน้าท้ายรายงาน */
const ReportGuide: React.FC = () => (
  <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-orange-200 bg-orange-50/40 p-3 text-xs text-gray-700 space-y-3">
    <div className="space-y-1">
      <p><span className="font-bold">รายงานรายสัปดาห์</span> เหมาะสำหรับประชุมติดตามงาน เน้นความเคลื่อนไหว งานเสี่ยง งานรอตรวจ และสิ่งที่ต้องตัดสินใจใน 7 วันถัดไป</p>
      <p><span className="font-bold">รายงานรายเดือน</span> เหมาะสำหรับผู้บริหารและการวางแผนทรัพยากร เน้นแนวโน้มผลสำเร็จ ภาระงานรายโครงการและรายบุคคล SLA และผลส่งมอบ</p>
    </div>
    <GuideTable
      title="โครงสร้างหน้ารายงาน"
      rows={[
        ['ส่วนหัว', 'ชื่อรายงาน ช่วงเวลา วันที่ออกรายงาน ตัวกรองโครงการและผู้รับผิดชอบ'],
        ['สรุปผู้บริหาร', 'งานทั้งหมด เสร็จแล้ว กำลังดำเนินการ งานเสี่ยง งานล่าช้า และงานที่ถูกตีกลับพร้อมเหตุผล'],
        ['กราฟ', 'สถานะงาน งานรายโครงการ และภาระงานรายบุคคล'],
        ['ตารางโครงการ', 'จำนวนงาน ผู้ดำเนินงาน ความสำเร็จ และงานเสี่ยง'],
        ['รายการติดตาม', 'งานล่าช้า ตีกลับ ไม่มีอัปเดต ผู้รับผิดชอบ และแนวทางแก้ไข'],
      ]}
    />
    <GuideTable
      title="นิยามตัวชี้วัด"
      rows={[
        ['อัตราความสำเร็จ', 'จำนวนงานอนุมัติแล้ว หารด้วยจำนวนงานทั้งหมดในขอบเขตรายงาน'],
        ['งานต้องติดตาม', 'งานที่ยังไม่ปิดและถูกตีกลับ หรือ SLA ล่าช้า / ไม่มีการอัปเดตตามเกณฑ์ของระบบ'],
        ['งานเสี่ยง (รายโครงการ)', 'งานที่ยังไม่เสร็จ รวมกับงานที่ปิดแล้วแต่ส่งหลังวันกำหนดส่ง'],
        ['ผู้ดำเนินงาน', 'ผู้สร้างการ์ดและผู้ที่เคยปรับสถานะการ์ดในโครงการ นับคนไม่ซ้ำ'],
        ['Lead time', 'จำนวนวันตั้งแต่เริ่มงานจนได้รับอนุมัติปิดงาน'],
        ['ความตรงต่อเวลา', 'เทียบวันที่อนุมัติปิดงานกับวันกำหนดส่ง: ก่อนกำหนด / ตรงวัน / หลังกำหนด'],
        ['งานในขอบเขตช่วงเวลา', 'งานที่เปิดก่อนสิ้นช่วง และยังไม่ปิดก่อนเริ่มช่วง (ไม่นับร่าง)'],
      ]}
    />
  </div>
);

const GuideTable: React.FC<{ title: string; rows: [string, string][] }> = ({ title, rows }) => (
  <div>
    <p className="font-bold text-gray-900 mb-1">{title}</p>
    <table className="w-full border-collapse bg-white">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <td className="border border-gray-200 px-2 py-1 font-bold whitespace-nowrap align-top">{k}</td>
            <td className="border border-gray-200 px-2 py-1">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
