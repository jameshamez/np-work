import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { LineGroup, LINE_GROUP_ID_PATTERN } from '../lib/lineApi';
import { AlertCircle, MessageSquare, Plus, Trash2 } from 'lucide-react';

/**
 * ส่วน "กลุ่ม LINE ที่รับแจ้งเตือน" ในหน้าการตั้งค่าระบบ (เฉพาะ Super Admin)
 * กลุ่มหลักตั้งใน Supabase secret LINE_GROUP_ID — ที่นี่จัดการเฉพาะกลุ่มเพิ่มเติม
 * ทุกกลุ่มที่เปิดไว้ได้รับข้อความเหมือนกลุ่มหลักทุกข้อความ
 */
export const LineGroupsSettings: React.FC = () => {
  const { fetchLineGroups, addLineGroup, setLineGroupEnabled, deleteLineGroup } = useApp();
  const [groups, setGroups] = useState<LineGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [groupId, setGroupId] = useState('');

  const reload = useCallback(async () => {
    try {
      setGroups(await fetchLineGroups());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [fetchLineGroups]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // ครอบทุกการแก้ไข: กันกดซ้ำระหว่างบันทึก แสดง error ในส่วนนี้ แล้วโหลดค่าจริงกลับมาเสมอ
  const mutate = async (action: () => Promise<void>) => {
    setBusy(true);
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

  const trimmedId = groupId.trim();
  const idValid = LINE_GROUP_ID_PATTERN.test(trimmedId);
  const canAdd = !busy && name.trim() !== '' && idValid;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAdd) return;
    void mutate(async () => {
      await addLineGroup(name, trimmedId);
      setName('');
      setGroupId('');
    });
  };

  const handleDelete = (g: LineGroup) => {
    if (confirm(`ลบกลุ่ม LINE "${g.name}" ใช่หรือไม่?\n\nกลุ่มนี้จะไม่ได้รับแจ้งเตือนจากระบบอีก`)) {
      void mutate(() => deleteLineGroup(g.id));
    }
  };

  const activeCount = groups.filter(g => g.enabled).length;

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-2xs space-y-4">
      <h3 className="text-xs font-extrabold text-gray-900 uppercase tracking-wide flex items-center space-x-2">
        <MessageSquare className="w-4 h-4 text-emerald-600" />
        <span>กลุ่ม LINE ที่รับแจ้งเตือน (กลุ่มเพิ่มเติม {groups.length} กลุ่ม)</span>
      </h3>

      <div className="text-[11px] text-gray-600 bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 space-y-1">
        <p>
          ทุกข้อความที่ส่งเข้ากลุ่มหลัก (ตั้งไว้ใน Supabase secret <code className="font-mono">LINE_GROUP_ID</code>)
          จะส่งเข้าทุกกลุ่มที่เปิดไว้ด้านล่างด้วย
        </p>
        <p className="font-bold text-amber-800">
          ⚠️ LINE หักโควตาตามจำนวนสมาชิกของทุกกลุ่มรวมกัน และระบบจะนับเพดานรายเดือนเป็น จำนวนข้อความ × จำนวนกลุ่มที่เปิดอยู่
          {activeCount > 0 && ` (ตอนนี้ ×${activeCount + 1} รวมกลุ่มหลัก)`}
        </p>
        <p>
          บอท LINE ของระบบต้องอยู่ในกลุ่มนั้นก่อน และ Group ID ได้จาก webhook ตอนบอทเข้ากลุ่ม (ขึ้นต้นด้วย C ตามด้วยตัวอักษร 32 ตัว)
        </p>
      </div>

      {error && (
        <div className="flex items-start space-x-2 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="ชื่อกลุ่ม เช่น ทีมผู้บริหาร"
          className="sm:w-48 px-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder:text-gray-400"
        />
        <input
          type="text"
          value={groupId}
          onChange={e => setGroupId(e.target.value)}
          placeholder="Group ID เช่น C1234567890abcdef1234567890abcdef"
          className={`flex-1 min-w-0 px-3 py-1.5 text-xs font-mono border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder:text-gray-400 placeholder:font-sans ${
            trimmedId && !idValid ? 'border-red-400' : 'border-gray-200'
          }`}
        />
        <button
          type="submit"
          disabled={!canAdd}
          className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center space-x-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>เพิ่มกลุ่ม</span>
        </button>
      </form>
      {trimmedId && !idValid && (
        <p className="text-[11px] font-bold text-red-600 -mt-2">
          รูปแบบ Group ID ไม่ถูกต้อง — ต้องขึ้นต้นด้วย C ตามด้วยตัวเลข/a–f ตัวเล็ก 32 ตัว
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-100 text-gray-400 uppercase text-[10px] font-extrabold">
              <th className="py-2.5 px-3">ชื่อกลุ่ม</th>
              <th className="py-2.5 px-3">Group ID</th>
              <th className="py-2.5 px-3 text-center">ส่งแจ้งเตือน</th>
              <th className="py-2.5 px-3 text-right">ดำเนินการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 font-medium">
            {loading ? (
              <tr>
                <td colSpan={4} className="py-6 text-center text-gray-400">กำลังโหลด...</td>
              </tr>
            ) : groups.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-6 text-center text-gray-400">
                  ยังไม่มีกลุ่มเพิ่มเติม — ตอนนี้ส่งเข้ากลุ่มหลักกลุ่มเดียว
                </td>
              </tr>
            ) : (
              groups.map(g => (
                <tr key={g.id} className="hover:bg-orange-50/20 transition-colors">
                  <td className="py-2.5 px-3 font-bold text-gray-800">{g.name}</td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-gray-500 break-all">{g.groupId}</td>
                  <td className="py-2.5 px-3 text-center">
                    <label className="inline-flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={g.enabled}
                        disabled={busy}
                        onChange={e => void mutate(() => setLineGroupEnabled(g.id, e.target.checked))}
                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                      />
                      <span className={`text-[11px] font-bold ${g.enabled ? 'text-emerald-700' : 'text-gray-400'}`}>
                        {g.enabled ? 'เปิด' : 'ปิด'}
                      </span>
                    </label>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => handleDelete(g)}
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
