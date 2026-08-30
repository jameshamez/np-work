import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface DeleteTaskConfirmModalProps {
  /** รหัสการ์ดงาน เช่น TW-0012 ใช้ย้ำให้ผู้ลบเห็นว่ากำลังลบใบไหน */
  code: string;
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Popup ยืนยันลบการ์ดงาน ใช้ร่วมกันทั้งกระดาน Kanban, หน้ารายละเอียดงาน และหน้าโครงการ KU
 *
 * คอมโพเนนต์นี้ไม่รู้จัก deleteTask เอง — ผู้เรียกเป็นคนสั่งลบใน onConfirm
 * เพราะแต่ละหน้ามีงานที่ต้องทำต่อหลังลบต่างกัน (ปิด modal, เคลียร์การ์ดที่เลือก, ขึ้น toast)
 */
export const DeleteTaskConfirmModal: React.FC<DeleteTaskConfirmModalProps> = ({
  code,
  title,
  onCancel,
  onConfirm,
}) => (
  <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
    <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-red-100 space-y-5 animate-in zoom-in-95 duration-200">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-red-100 text-red-600 rounded-2xl shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-gray-900">
              ยืนยันการลบการ์ดงาน
            </h3>
            <p className="text-xs text-red-600 font-bold mt-0.5">
              รหัสการ์ด #{code}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="bg-red-50/70 border border-red-200/80 p-3.5 rounded-2xl text-xs text-red-900 space-y-1.5 font-medium">
        <p className="font-extrabold text-red-800 text-sm">
          คุณแน่ใจหรือไม่ว่าต้องการลบการ์ดนี้?
        </p>
        <p className="text-gray-700">
          การ์ดงาน: <span className="font-bold text-gray-900">"{title}"</span>
        </p>
        <p className="text-red-700 font-bold text-[11px]">
          * เมื่อยืนยันการลบแล้ว ข้อมูลการ์ดทั้งหมด (Checklist งวดงาน ไฟล์แนบ ประวัติการทำงาน
          และข้อมูลการเงิน) จะถูกลบออกจากระบบ และไม่สามารถกู้คืนได้
        </p>
      </div>

      <div className="flex items-center justify-end space-x-2.5 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
        >
          ยกเลิก
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
          <span>ยืนยัน ลบ</span>
        </button>
      </div>
    </div>
  </div>
);
