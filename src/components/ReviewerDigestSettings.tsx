import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { LineGroup, LINE_GROUP_ID_PATTERN, ReviewerDigest } from '../lib/lineApi';
import { AlertCircle, CheckCircle2, ClipboardCheck, Plus, Send, Trash2 } from 'lucide-react';

const cleanName = (name: string) => name.replace(/\s*\([^)]*\)/g, '').trim();

/**
 * ส่วน "สรุปงานรออนุมัติ" ในหน้าการตั้งค่าระบบ (เฉพาะ Super Admin)
 * ส่งรายการการ์ด "รอตรวจ" ของผู้อนุมัติแต่ละคน เข้ากลุ่ม LINE ที่เลือก วันละครั้งตามเวลา
 * ตัวส่งจริงคือ app_run_reviewer_digests() ที่ pg_cron เรียกทุกนาที (db/21)
 */
export const ReviewerDigestSettings: React.FC = () => {
  const { users, fetchLineGroups, fetchReviewerDigests, saveReviewerDigest, deleteReviewerDigest, sendReviewerDigestNow } =
    useApp();
  const [digests, setDigests] = useState<ReviewerDigest[]>([]);
  const [groups, setGroups] = useState<LineGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [reviewerId, setReviewerId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [sendTime, setSendTime] = useState('17:00');

  // ผู้อนุมัติ = admin / super_admin ที่ยังใช้งานอยู่
  const reviewers = users.filter(u => u.status === 'approved' && (u.role === 'admin' || u.role === 'super_admin'));
  const userName = (id: string) => cleanName(users.find(u => u.id === id)?.fullName ?? 'ผู้ใช้ที่ถูกลบ');
  const groupName = (id: string) => groups.find(g => g.groupId === id)?.name;

  const reload = useCallback(async () => {
    try {
      const [d, g] = await Promise.all([fetchReviewerDigests(), fetchLineGroups().catch(() => [] as LineGroup[])]);
      setDigests(d);
      setGroups(g);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [fetchReviewerDigests, fetchLineGroups]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const mutate = async (action: () => Promise<void>) => {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      await reload();
      setBusy(false);
    }
  };

  const trimmedGroup = groupId.trim();
  const groupValid = LINE_GROUP_ID_PATTERN.test(trimmedGroup);
  const canAdd = !busy && !!reviewerId && groupValid && !!sendTime;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAdd) return;
    void mutate(async () => {
      await saveReviewerDigest({ reviewerUserId: reviewerId, groupId: trimmedGroup, sendTime, enabled: true });
      setReviewerId('');
      setGroupId('');
      setSendTime('17:00');
    });
  };

  const update = (d: ReviewerDigest, patch: Partial<Pick<ReviewerDigest, 'sendTime' | 'enabled'>>) =>
    void mutate(() =>
      saveReviewerDigest({
        id: d.id,
        reviewerUserId: d.reviewerUserId,
        groupId: d.groupId,
        sendTime: patch.sendTime ?? d.sendTime,
        enabled: patch.enabled ?? d.enabled,
      })
    );

  const handleSendNow = (d: ReviewerDigest) =>
    void mutate(async () => {
      setNotice(await sendReviewerDigestNow(d.id));
    });

  const handleDelete = (d: ReviewerDigest) => {
    if (confirm(`ลบการส่งสรุปงานรออนุมัติของ "${userName(d.reviewerUserId)}" ใช่หรือไม่?`)) {
      void mutate(() => deleteReviewerDigest(d.id));
    }
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-2xs space-y-4">
      <h3 className="text-xs font-extrabold text-gray-900 uppercase tracking-wide flex items-center space-x-2">
        <ClipboardCheck className="w-4 h-4 text-indigo-600" />
        <span>สรุปงานรออนุมัติ ส่งเข้ากลุ่ม LINE ({digests.length} รายการ)</span>
      </h3>

      <div className="text-[11px] text-gray-600 bg-indigo-50/60 border border-indigo-200 rounded-xl p-3 space-y-1">
        <p>
          ส่งรายการการ์ด <span className="font-bold">"รอตรวจ"</span> ที่เลือกผู้อนุมัติคนนั้นเป็นผู้ตรวจ
          เข้ากลุ่ม LINE ที่กำหนด <span className="font-bold">กลุ่มเดียว</span> วันละครั้งตามเวลาที่ตั้ง (เวลาไทย)
        </p>
        <p>วันไหนไม่มีงานรออนุมัติจะไม่ส่ง เพื่อประหยัดโควตา LINE • บอทของระบบต้องอยู่ในกลุ่มนั้นก่อน</p>
      </div>

      {error && (
        <div className="flex items-start space-x-2 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="flex items-start space-x-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{notice}</span>
        </div>
      )}

      <form onSubmit={handleAdd} className="flex flex-col lg:flex-row gap-2">
        <select
          value={reviewerId}
          onChange={e => setReviewerId(e.target.value)}
          className="lg:w-44 px-3 py-1.5 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="">-- เลือกผู้อนุมัติ --</option>
          {reviewers.map(u => (
            <option key={u.id} value={u.id}>{cleanName(u.fullName)}</option>
          ))}
        </select>
        <input
          type="text"
          list="reviewer-digest-groups"
          value={groupId}
          onChange={e => setGroupId(e.target.value)}
          placeholder="Group ID กลุ่ม LINE เช่น C1234…"
          className={`flex-1 min-w-0 px-3 py-1.5 text-xs font-mono border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder:text-gray-400 placeholder:font-sans ${
            trimmedGroup && !groupValid ? 'border-red-400' : 'border-gray-200'
          }`}
        />
        <datalist id="reviewer-digest-groups">
          {groups.map(g => (
            <option key={g.id} value={g.groupId}>{g.name}</option>
          ))}
        </datalist>
        <input
          type="time"
          value={sendTime}
          onChange={e => setSendTime(e.target.value)}
          className="lg:w-28 px-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <button
          type="submit"
          disabled={!canAdd}
          className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center space-x-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>เพิ่ม</span>
        </button>
      </form>
      {trimmedGroup && !groupValid && (
        <p className="text-[11px] font-bold text-red-600 -mt-2">
          รูปแบบ Group ID ไม่ถูกต้อง — ต้องขึ้นต้นด้วย C ตามด้วยตัวเลข/a–f ตัวเล็ก 32 ตัว
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-100 text-gray-400 uppercase text-[10px] font-extrabold">
              <th className="py-2.5 px-3">ผู้อนุมัติ</th>
              <th className="py-2.5 px-3">กลุ่ม LINE</th>
              <th className="py-2.5 px-3">เวลาส่ง</th>
              <th className="py-2.5 px-3 text-center">ส่งอัตโนมัติ</th>
              <th className="py-2.5 px-3 text-right">ดำเนินการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 font-medium">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-gray-400">กำลังโหลด...</td>
              </tr>
            ) : digests.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-gray-400">ยังไม่ได้ตั้งค่าการส่งสรุปงานรออนุมัติ</td>
              </tr>
            ) : (
              digests.map(d => (
                <tr key={d.id} className="hover:bg-orange-50/20 transition-colors">
                  <td className="py-2.5 px-3 font-bold text-gray-800">{userName(d.reviewerUserId)}</td>
                  <td className="py-2.5 px-3">
                    {groupName(d.groupId) && <div className="font-bold text-gray-700">{groupName(d.groupId)}</div>}
                    <div className="font-mono text-[11px] text-gray-500 break-all">{d.groupId}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    <input
                      // key ผูกกับค่าที่บันทึกจริง — บันทึกไม่ผ่านแล้วโหลดใหม่ ช่องจะกลับเป็นค่าจริง
                      key={`${d.id}-${d.sendTime}`}
                      type="time"
                      defaultValue={d.sendTime}
                      disabled={busy}
                      onBlur={e => {
                        if (e.target.value && e.target.value !== d.sendTime) update(d, { sendTime: e.target.value });
                      }}
                      className="px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <label className="inline-flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={d.enabled}
                        disabled={busy}
                        onChange={e => update(d, { enabled: e.target.checked })}
                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                      />
                      <span className={`text-[11px] font-bold ${d.enabled ? 'text-emerald-700' : 'text-gray-400'}`}>
                        {d.enabled ? 'เปิด' : 'ปิด'}
                      </span>
                    </label>
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap space-x-1.5">
                    <button
                      onClick={() => handleSendNow(d)}
                      disabled={busy}
                      title="ส่งสรุปงานรออนุมัติเข้ากลุ่มนี้ทันที (ไม่นับเป็นรอบประจำวัน)"
                      className="px-3 py-1.5 text-[11px] font-bold text-indigo-700 bg-indigo-100 hover:bg-indigo-200 rounded-xl transition-colors cursor-pointer disabled:opacity-40"
                    >
                      <Send className="w-3.5 h-3.5 inline mr-1" />
                      ส่งทดสอบตอนนี้
                    </button>
                    <button
                      onClick={() => handleDelete(d)}
                      disabled={busy}
                      className="px-3 py-1.5 text-[11px] font-bold text-red-700 bg-red-100 hover:bg-red-200 rounded-xl transition-colors cursor-pointer disabled:opacity-40"
                    >
                      <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                      ลบ
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
