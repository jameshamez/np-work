import React from 'react';
import { useApp } from '../context/AppContext';
import { Database, Download, RefreshCw, ShieldAlert, CheckCircle2 } from 'lucide-react';

export const BackupModal: React.FC = () => {
  const { exportBackup, resetDataToDefault, tasks, logs, users } = useApp();

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-2xs">
        <h2 className="text-base font-extrabold text-gray-900 flex items-center space-x-2">
          <Database className="w-5 h-5 text-orange-600" />
          <span>การสำรองข้อมูล & นโยบายจัดเก็บข้อมูลย้อนหลัง 5 ปี (5-Year Data Retention)</span>
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          ดาวน์โหลดไฟล์สำรองข้อมูล JSON/CSV ครอบคลุมประวัติ Audit Log และไฟล์แนบของทุกการ์ดงาน
        </p>
      </div>

      {/* Backup Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Export Card */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <h3 className="text-xs font-extrabold text-gray-900 uppercase tracking-wide flex items-center space-x-2">
              <Download className="w-4 h-4 text-orange-600" />
              <span>ดาวน์โหลดสำรองข้อมูลระบบ (Export Data Backup)</span>
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              สกัดข้อมูลทั้งหมดในระบบออกมาเป็นไฟล์ JSON สำรองความปลอดภัย ประกอบด้วย:
            </p>
            <ul className="text-xs text-gray-500 space-y-1 list-disc pl-5">
              <li>รายชื่อผู้ใช้งานและระดับสิทธิ์ ({users.length} รายการ)</li>
              <li>การ์ดงานและสถานะการดำเนินงาน ({tasks.length} รายการ)</li>
              <li>ประวัติการทำแทน Audit Log ({logs.length} รายการ)</li>
              <li>ลิงก์และไฟล์แนบรูปภาพทั้งหมด</li>
            </ul>
          </div>

          <button
            onClick={exportBackup}
            className="w-full py-2.5 text-xs font-bold text-white rounded-xl shadow-md transition-all hover:opacity-90 inline-flex items-center justify-center space-x-2"
            style={{ backgroundColor: '#ef6c00' }}
          >
            <Download className="w-4 h-4" />
            <span>ส่งออกไฟล์ JSON Backup</span>
          </button>
        </div>

        {/* Retention Policy Notice */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <h3 className="text-xs font-extrabold text-gray-900 uppercase tracking-wide flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-emerald-600" />
              <span>นโยบายความคุ้มครองข้อมูล 5 ปี (Data Archival)</span>
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              ตามข้อกำหนดของระบบ NP Taskwork ข้อมูลประวัติการส่งงาน ข้อความสั้น และภาพแนบจะถูกคงสภาพให้อ่านย้อนหลังได้ (Read-Only Archival) เป็นเวลาอย่างน้อย 5 ปี
            </p>
            <div className="p-3 bg-emerald-50 rounded-xl text-[11px] text-emerald-900 font-semibold space-y-1">
              <div className="flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>สถานะระบบ: เปิดใช้งานการจัดเก็บบันทึกอัตโนมัติ</span>
              </div>
              <p className="text-emerald-700 font-normal">
                ไม่มีการลบข้อมูลประวัติหรือไฟล์แนบแม้การ์ดงานจะอยู่ในสถานะ 4. อนุมัติเสร็จสิ้น แล้วก็ตาม
              </p>
            </div>
          </div>

          {/* Reset Demo Data Button */}
          <button
            onClick={resetDataToDefault}
            className="w-full py-2.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl transition-all inline-flex items-center justify-center space-x-2"
          >
            <RefreshCw className="w-4 h-4 text-gray-500" />
            <span>โหลดข้อมูลใหม่จากฐานข้อมูล</span>
          </button>
        </div>

      </div>

    </div>
  );
};
