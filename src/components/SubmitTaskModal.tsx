import React, { useState } from 'react';
import { Task } from '../types';
import { useApp } from '../context/AppContext';
import {
  X,
  Upload,
  Image as ImageIcon,
  FileText,
  AlertCircle,
  CheckCircle,
  UserCheck,
  Send,
  Paperclip,
  ExternalLink,
  User,
} from 'lucide-react';

interface SubmitTaskModalProps {
  task: Task | null;
  onClose: () => void;
}

export const SubmitTaskModal: React.FC<SubmitTaskModalProps> = ({ task, onClose }) => {
  const { currentUser, submitTaskForReview, uploadAttachmentFile, users } = useApp();

  const [comment, setComment] = useState('');
  // รูปที่ผู้ใช้เลือกไว้ (เลือกได้หลายรูป) — url เป็นลิงก์ชั่วคราวไว้แสดงตัวอย่างเท่านั้น
  // ตัวไฟล์จริงจะถูกอัปโหลดขึ้น Storage ตอนกดส่งตรวจงาน
  const [pictures, setPictures] = useState<{ file: File; name: string; url: string; size: number }[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [documentName, setDocumentName] = useState('');
  const [documentSizeMB, setDocumentSizeMB] = useState<number>(0);
  const [googleDriveUrl, setGoogleDriveUrl] = useState(task?.googleDriveUrl || '');
  
  // SRS Table #2: Reviewer Dropdown Selection
  const [selectedReviewerId, setSelectedReviewerId] = useState<string>(() => {
    if (task?.reviewerUserId) return task.reviewerUserId;
    const defaultReviewer = users.find(u => u.role === 'admin' || u.role === 'super_admin');
    return defaultReviewer?.id || '';
  });

  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!task) return null;

  const handlePictureSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // ให้เลือกไฟล์เดิมซ้ำได้หลังลบออก
    if (files.length === 0) return;
    const added = files.map(file => ({ file, name: file.name, url: URL.createObjectURL(file), size: file.size }));
    setPreviewIndex(pictures.length);
    setPictures([...pictures, ...added]);
  };

  const removePicture = (index: number) => {
    URL.revokeObjectURL(pictures[index].url);
    setPictures(prev => prev.filter((_, i) => i !== index));
    setPreviewIndex(prev => (prev >= index && prev > 0 ? prev - 1 : prev));
  };

  const previewPicture = pictures[previewIndex];

  const handleDocumentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > 300) {
        setErrorMsg('ขนาดไฟล์เกินข้อกำหนดสูงสุด 300MB กรุณาเลือกไฟล์ที่มีขนาดเล็กกว่า');
        setDocumentName('');
        setDocumentSizeMB(0);
        return;
      }
      setErrorMsg('');
      setDocumentName(file.name);
      setDocumentSizeMB(Math.round(sizeMB * 10) / 10);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      setErrorMsg('กรุณากรอกข้อความสรุปการดำเนินงาน');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    // อัปโหลดรูปขึ้น Storage ก่อน ถ้าพังให้ค้างฟอร์มไว้ ผู้ใช้จะได้กดส่งใหม่โดยไม่ต้องกรอกซ้ำ
    let uploadedPictures: { name: string; url: string; size: number }[];
    try {
      uploadedPictures = await Promise.all(
        pictures.map(async p => ({ name: p.name, url: await uploadAttachmentFile(p.file), size: p.size }))
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setIsSubmitting(false);
      return;
    }

    const reviewerObj = users.find(u => u.id === selectedReviewerId);
    if (reviewerObj) {
      task.reviewerUserId = reviewerObj.id;
      task.reviewerUserName = reviewerObj.fullName;
    }
    if (googleDriveUrl.trim()) {
      task.googleDriveUrl = googleDriveUrl.trim();
    }

    const attachments: { name: string; url: string; type: 'image' | 'file'; size: number }[] =
      uploadedPictures.map(p => ({ name: p.name, url: p.url, type: 'image', size: p.size }));

    if (documentName) {
      attachments.push({
        name: documentName,
        url: '#',
        type: 'file',
        size: documentSizeMB * 1024 * 1024,
      });
    }

    submitTaskForReview(task.id, comment, attachments);
    pictures.forEach(p => URL.revokeObjectURL(p.url));
    setIsSubmitting(false);
    onClose();
  };

  const isDelegated = currentUser && currentUser.id !== task.assignedToUserId;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-gray-100 overflow-hidden my-8">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between" style={{ backgroundColor: '#ffcc80' }}>
          <div>
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-white text-amber-950">
              #{task.code} • {task.projectName}
            </span>
            <h3 className="font-extrabold text-base text-amber-950 mt-1">
              ส่งตรวจงาน: {task.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/50 text-amber-950 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Delegation Notification if sending on behalf */}
          {isDelegated && (
            <div className="p-3 bg-sky-50 border border-sky-200 rounded-2xl flex items-start space-x-2.5 text-xs text-sky-900">
              <UserCheck className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">ระบบบันทึกการส่งงานแทนกัน (Delegation Audit)</p>
                <p className="text-[11px] text-sky-800 mt-0.5">
                  คุณ (<strong className="font-bold">{currentUser?.fullName}</strong>) กำลังส่งงานแทนเจ้าของงาน (<strong className="font-bold">{task.assignedToUserName}</strong>) ระบบจะบันทึกประวัติการทำแทนลงใน Audit Log
                </p>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* SRS Requirement #2: Select Specific Reviewer */}
          <div className="space-y-1 bg-amber-50/60 p-3 rounded-2xl border border-amber-200">
            <label className="block text-xs font-bold text-amber-950 flex items-center space-x-1.5">
              <User className="w-4 h-4 text-amber-700" />
              <span>ระบุตัวบุคคลผู้ตรวจงาน (Reviewer Dropdown):</span>
            </label>
            <select
              value={selectedReviewerId}
              onChange={e => setSelectedReviewerId(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold border border-amber-300 rounded-xl bg-white text-gray-800 focus:ring-2 focus:ring-amber-500"
            >
              {users
                .filter(u => u.role === 'admin' || u.role === 'super_admin')
                .map(u => (
                  <option key={u.id} value={u.id}>
                    ส่งตรวจที่: {u.fullName?.replace(/\s*\([^)]*\)/g, '')}
                  </option>
                ))}
            </select>
          </div>

          {/* Requirement 1: Text Note */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-800">
              1. ข้อความรายละเอียดผลการดำเนินงาน <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="ระบุรายละเอียด เช่น ดำเนินการปรับปรุงโค้ดและทดสอบตาม Checklist ครบถ้วน..."
              value={comment}
              onChange={e => setComment(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>

          {/* SRS Requirement #4: Google Drive Integration via URL Link */}
          <div className="space-y-1 bg-blue-50/50 p-3 rounded-2xl border border-blue-200">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-blue-950 flex items-center space-x-1.5">
                <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                <span>คลังเก็บไฟล์กลาง (Google Drive Integration - แปะลิงก์ URL):</span>
              </label>
              <button
                type="button"
                onClick={() => setGoogleDriveUrl('https://drive.google.com/drive/folders/1A2b3C4d5E6f7G8h9I0j-np_taskwork')}
                className="text-[10px] text-blue-700 bg-blue-100 hover:bg-blue-200 px-2 py-0.5 rounded-md font-bold"
              >
                ใส่ลิงก์ไดรฟ์บริษัทตัวอย่าง
              </button>
            </div>
            <input
              type="url"
              value={googleDriveUrl}
              onChange={e => setGoogleDriveUrl(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/..."
              className="w-full px-3 py-2 text-xs border border-blue-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Requirement 2: Picture Attachment */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-800">
              2. แนบรูปภาพผลงาน (Picture)
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* File upload input for image */}
              <label className="border-2 border-dashed border-gray-200 hover:border-orange-400 rounded-2xl p-3 text-center cursor-pointer transition-colors flex flex-col items-center justify-center bg-gray-50/50">
                <ImageIcon className="w-5 h-5 text-orange-500 mb-1" />
                <span className="text-xs font-bold text-gray-700">อัปโหลดรูปภาพ</span>
                <span className="text-[10px] text-gray-400">JPG, PNG, GIF</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePictureSelect}
                  className="hidden"
                />
              </label>

              {/* รายการรูปที่อัปโหลดจริง */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gray-500 block">
                  รูปที่อัปโหลดแล้ว ({pictures.length}):
                </span>
                {pictures.length === 0 ? (
                  <p className="text-[11px] text-gray-400 px-2.5 py-1">ยังไม่ได้อัปโหลดรูปภาพ</p>
                ) : (
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {pictures.map((pic, i) => (
                      <div
                        key={pic.url}
                        className={`flex items-center rounded-xl border text-[11px] transition-all ${
                          previewIndex === i
                            ? 'border-orange-500 bg-orange-50 font-bold text-orange-900'
                            : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setPreviewIndex(i)}
                          className="flex-1 min-w-0 text-left px-2.5 py-1 truncate cursor-pointer"
                        >
                          🖼️ {pic.name}
                        </button>
                        <button
                          type="button"
                          onClick={() => removePicture(i)}
                          title="ลบรูปนี้"
                          className="p-1 mr-1 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Selected Image Preview */}
            {previewPicture && (
              <div className="relative rounded-2xl overflow-hidden border border-gray-200 max-h-32 bg-black/5">
                <img
                  src={previewPicture.url}
                  alt="Preview"
                  className="w-full h-32 object-cover"
                />
                <span className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-xs">
                  {previewPicture.name}
                </span>
              </div>
            )}
          </div>

          {/* Requirement 3: File Attachment (Max 300MB) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-gray-800">
                3. แนบไฟล์เอกสาร/ซอร์สโค้ด (File)
              </label>
              <span className="text-[10px] text-gray-400">รองรับไฟล์ใหญ่สูงสุด 300MB</span>
            </div>

            <div className="flex items-center">
              <label className="flex-1 border border-gray-200 hover:border-orange-400 rounded-2xl px-3 py-2 bg-gray-50/50 cursor-pointer transition-colors flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2 truncate">
                  <FileText className="w-4 h-4 text-orange-600 shrink-0" />
                  <span className="font-semibold text-gray-700 truncate">
                    {documentName ? `${documentName} (${documentSizeMB} MB)` : 'เลือกไฟล์เอกสาร (.pdf, .zip, .docx)...'}
                  </span>
                </div>
                <Upload className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="file"
                  onChange={handleDocumentSelect}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Submit Action Buttons */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white rounded-xl shadow-md transition-all hover:opacity-90 active:scale-95 inline-flex items-center space-x-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-wait"
              style={{ backgroundColor: '#ef6c00' }}
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'กำลังอัปโหลดไฟล์...' : 'ส่งตรวจงาน (อัปเดตสถานะออโต้)'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
