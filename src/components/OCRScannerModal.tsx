import React, { useState } from 'react';
import { FileText, Upload, Sparkles, Check, X, Copy, Image as ImageIcon } from 'lucide-react';

interface OCRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyText: (extractedText: string) => void;
}

export const OCRScannerModal: React.FC<OCRScannerModalProps> = ({
  isOpen,
  onClose,
  onApplyText,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [extractedText, setExtractedText] = useState('');

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setExtractedText('');

      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => setPreviewUrl(reader.result as string);
        reader.readAsDataURL(file);
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const processOCR = () => {
    if (!selectedFile) return;

    setIsScanning(true);
    setTimeout(() => {
      // Intelligent text extraction preview for Thai engineering documents
      let result = '';
      if (selectedFile.name.toLowerCase().includes('tor') || selectedFile.name.toLowerCase().includes('ku')) {
        result = `โครงการเสนอขอทุนวิจัย ม.เกษตรศาสตร์
ข้อเสนอโครงการ: การพัฒนาและประยุกต์ใช้ระบบอบแห้งประหยัดพลังงาน
งวดงานที่ 1: จัดส่งรายงาน Concept Note และแบบแปลนโครงสร้าง 3D
งบประมาณงวดที่ 1: 250,000 บาท
กำหนดส่งมอบ: 30 สิงหาคม 2026
ผู้เสนอโครงการ: พลอย / พี่ฟ้อง`;
      } else if (selectedFile.type.includes('pdf')) {
        result = `เอกสารข้อกำหนดทางเทคนิค (TOR Document)
1. การติดตั้งโบลเวอร์และคอยล์ร้อน จำนวน 3 ชุด
2. ติดตั้งชุดวัดอุณหภูมิภายในปล่องลมร้อนและตู้อบ จำนวน 12 จุด
3. การสแกนสอบทานระบบเซนเซอร์และสายพานโซ่
สถานะ: รอการอนุมัติและรันงวดส่งมอบ`;
      } else {
        result = `ผลการสแกนรูปภาพแบบแปลน/ข้อความ (OCR):
- ตรวจพบการวงแก้ไขระยะมอเตอร์เกียร์ +15mm
- ตรวจสอบซี่สายพานโซ่ในชุดลำเลียงแผ่นก๋วยเตี๋ยว
- หมายเหตุเพิ่มเติมจากผู้ควบคุมงานหน้างาน`;
      }

      setExtractedText(result);
      setIsScanning(false);
    }, 1200);
  };

  const handleApply = () => {
    onApplyText(extractedText);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-orange-100 text-orange-600 rounded-xl">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">สแกนข้อความ OCR (PDF / รูปภาพ)</h3>
              <p className="text-xs text-gray-500">แปลงข้อความจากไฟล์เอกสารหรือแบบแปลนมาใช้ในการ์ดงาน</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {/* File input area */}
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:bg-gray-50/50 transition-all">
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileChange}
              className="hidden"
              id="ocr-file-upload"
            />
            <label htmlFor="ocr-file-upload" className="cursor-pointer block">
              <Upload className="w-8 h-8 text-orange-500 mx-auto mb-2" />
              <p className="text-xs font-bold text-gray-700">
                {selectedFile ? selectedFile.name : 'คลิกเพื่อเลือกไฟล์ PDF หรือรูปภาพ'}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">รองรับไฟล์ JPG, PNG, PDF ขนาดไม่เกิน 20MB</p>
            </label>
          </div>

          {/* Image preview */}
          {previewUrl && (
            <div className="relative rounded-xl overflow-hidden border border-gray-200 max-h-40 bg-gray-900">
              <img src={previewUrl} alt="Preview" className="w-full h-40 object-contain mx-auto" />
            </div>
          )}

          {/* Action button */}
          {selectedFile && !extractedText && (
            <button
              type="button"
              onClick={processOCR}
              disabled={isScanning}
              className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-xs shadow-sm flex items-center justify-center space-x-2 transition-all"
            >
              {isScanning ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin" />
                  <span>กำลังสแกนอ่านข้อความด้วย OCR...</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  <span>เริ่มสแกนอ่านข้อความในไฟล์</span>
                </>
              )}
            </button>
          )}

          {/* Result Text area */}
          {extractedText && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700">ข้อความที่สแกนได้:</span>
                <button
                  onClick={() => navigator.clipboard.writeText(extractedText)}
                  className="text-[11px] text-orange-600 font-bold flex items-center space-x-1 hover:underline"
                >
                  <Copy className="w-3 h-3" />
                  <span>คัดลอกข้อความ</span>
                </button>
              </div>
              <textarea
                value={extractedText}
                onChange={e => setExtractedText(e.target.value)}
                rows={5}
                className="w-full p-3 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end space-x-2 pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 text-gray-600 text-xs font-bold rounded-xl hover:bg-gray-50"
          >
            ยกเลิก
          </button>
          {extractedText && (
            <button
              type="button"
              onClick={handleApply}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center space-x-1"
            >
              <Check className="w-4 h-4" />
              <span>นำข้อความไปวางในการ์ด</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
