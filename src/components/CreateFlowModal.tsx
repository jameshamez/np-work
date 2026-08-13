import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ProjectCategory, FlowTemplate } from '../types';
import { X, Plus, Trash2, ArrowUp, ArrowDown, Workflow, Layers, CheckCircle2, Sparkles, Pencil, Check, Save, FolderOpen, RefreshCw } from 'lucide-react';

interface CreateFlowModalProps {
  onClose: () => void;
  onSuccess?: (flowId: string, createdFlow?: FlowTemplate) => void;
}

export const CreateFlowModal: React.FC<CreateFlowModalProps> = ({ onClose, onSuccess }) => {
  const { flowTemplates, addFlowTemplate, updateFlowTemplate, deleteFlowTemplate } = useApp();

  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ProjectCategory>('general');
  const [description, setDescription] = useState('');
  const [checklists, setChecklists] = useState<string[]>([
    '1. รวบรวมข้อมูลและวิเคราะห์ความต้องการ',
    '2. วางแผนดำเนินงานและจัดสรรทรัพยากร',
    '3. ดำเนินการและทดสอบระบบ',
    '4. สรุปผลและส่งมอบงาน',
  ]);
  const [newStepText, setNewStepText] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSelectFlowTemplate = (flowId: string) => {
    if (!flowId) {
      setSelectedFlowId(null);
      return;
    }
    if (flowId === 'new') {
      setSelectedFlowId(null);
      setName('');
      setDescription('');
      setCategory('general');
      setChecklists([
        '1. รวบรวมข้อมูลและวิเคราะห์ความต้องการ',
        '2. วางแผนดำเนินงานและจัดสรรทรัพยากร',
        '3. ดำเนินการและทดสอบระบบ',
        '4. สรุปผลและส่งมอบงาน',
      ]);
      return;
    }

    const flow = flowTemplates.find(f => f.id === flowId);
    if (flow) {
      setSelectedFlowId(flow.id);
      setName(flow.name);
      setCategory(flow.category || 'general');
      setDescription(flow.description || '');
      setChecklists([...flow.checklists]);
      setSuccessMessage(`ดึงร่าง/Flow "${flow.name}" ขึ้นมาแก้ไขเรียบร้อยแล้ว`);
      setTimeout(() => setSuccessMessage(''), 2500);
    }
  };

  const handleDeleteSelectedFlow = () => {
    if (!selectedFlowId) return;
    const flow = flowTemplates.find(f => f.id === selectedFlowId);
    if (confirm(`คุณต้องการลบ Flow / ร่าง "${flow?.name || ''}" นี้ออกจากระบบใช่หรือไม่?`)) {
      deleteFlowTemplate(selectedFlowId);
      setSelectedFlowId(null);
      setName('');
      setDescription('');
      setChecklists(['1. ขั้นตอนการดำเนินงาน']);
      setSuccessMessage('ลบ Flow/ร่างงาน เรียบร้อยแล้ว');
      setTimeout(() => setSuccessMessage(''), 2000);
    }
  };

  const handleAddStep = () => {
    if (newStepText.trim()) {
      setChecklists([...checklists, newStepText.trim()]);
      setNewStepText('');
    }
  };

  const handleRemoveStep = (index: number) => {
    setChecklists(checklists.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
    }
  };

  const handleStartEdit = (index: number, text: string) => {
    setEditingIndex(index);
    setEditingText(text);
  };

  const handleSaveEdit = (index: number) => {
    if (editingText.trim()) {
      const updated = [...checklists];
      updated[index] = editingText.trim();
      setChecklists(updated);
    }
    setEditingIndex(null);
    setEditingText('');
  };

  const handleMoveStepUp = (index: number) => {
    if (index === 0) return;
    const updated = [...checklists];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    setChecklists(updated);
  };

  const handleMoveStepDown = (index: number) => {
    if (index === checklists.length - 1) return;
    const updated = [...checklists];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    setChecklists(updated);
  };

  const handleSaveDraft = async () => {
    let draftName = name.trim();
    if (!draftName) {
      draftName = 'ร่าง Flow งานใหม่';
    } else if (!draftName.includes('ร่าง') && !draftName.includes('Draft')) {
      draftName = `${draftName} (ร่าง)`;
    }

    const currentChecklists = checklists.length > 0 ? checklists : ['1. ขั้นตอนที่ 1 (ร่าง)'];

    if (selectedFlowId) {
      updateFlowTemplate(selectedFlowId, {
        name: draftName,
        category,
        description: description.trim(),
        checklists: currentChecklists,
      });
      setName(draftName);
      const updatedFlow: FlowTemplate = {
        id: selectedFlowId,
        name: draftName,
        category,
        description: description.trim(),
        checklists: currentChecklists,
      };
      setSuccessMessage(`บันทึกอัปเดตร่าง Flow "${draftName}" สำเร็จ! สามารถเปิดสลับทำอย่างอื่นแล้วกลับมาดึงแก้ต่อได้ตลอดเวลา`);
      setTimeout(() => {
        if (onSuccess) onSuccess(selectedFlowId, updatedFlow);
        onClose();
      }, 1000);
    } else {
      const createdFlow = await addFlowTemplate({
        name: draftName,
        category,
        description: description.trim(),
        checklists: currentChecklists,
      });
      setSelectedFlowId(createdFlow.id);
      setName(createdFlow.name);
      setSuccessMessage(`บันทึกร่าง Flow "${createdFlow.name}" เรียบร้อยแล้ว! สามารถสลับหน้าจอแล้วเลือกดึงร่างนี้มาแก้ไขต่อได้ตลอดเวลา`);
      setTimeout(() => {
        if (onSuccess) onSuccess(createdFlow.id, createdFlow);
        onClose();
      }, 1000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('กรุณากรอกชื่อ Flow งาน');
      return;
    }
    if (checklists.length === 0) {
      alert('กรุณาเพิ่มรายการ Checklist อย่างน้อย 1 ขั้นตอน');
      return;
    }

    // Clean name if user finalized from a draft
    let finalName = name.trim();
    if (finalName.endsWith(' (ร่าง)')) {
      finalName = finalName.replace(/\s*\(ร่าง\)$/, '');
    }

    if (selectedFlowId) {
      updateFlowTemplate(selectedFlowId, {
        name: finalName,
        category,
        description: description.trim(),
        checklists,
      });
      const updatedFlow: FlowTemplate = {
        id: selectedFlowId,
        name: finalName,
        category,
        description: description.trim(),
        checklists,
      };
      setSuccessMessage(`บันทึกอัปเดต Flow "${finalName}" สำเร็จแล้ว!`);
      setTimeout(() => {
        if (onSuccess) onSuccess(selectedFlowId, updatedFlow);
        onClose();
      }, 800);
    } else {
      const createdFlow = await addFlowTemplate({
        name: finalName,
        category,
        description: description.trim(),
        checklists,
      });
      setSuccessMessage(`บันทึกสร้าง Flow "${createdFlow.name}" สำเร็จแล้ว!`);
      setTimeout(() => {
        if (onSuccess) onSuccess(createdFlow.id, createdFlow);
        onClose();
      }, 800);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col my-auto max-h-[92vh]">
        
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-purple-800 via-purple-700 to-indigo-800 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-amber-300 border border-white/20">
              <Workflow className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-base sm:text-lg">สร้าง/แก้ไข Flow งาน (Create Work Flow)</h3>
                <span className="text-[10px] font-black bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  FLOW BUILDER
                </span>
              </div>
              <p className="text-xs text-purple-100/80">
                สร้างหรือเลือกดึงร่าง Flow ที่บันทึกไว้ขึ้นมาแก้ไขต่อได้ตลอดเวลา
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors text-purple-100 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          
          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-900 text-xs font-bold flex items-center space-x-2 animate-in zoom-in-95">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Draft & Template Picker */}
          <div className="p-3 bg-purple-50/80 border border-purple-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-purple-950 flex items-center space-x-1.5">
                <FolderOpen className="w-4 h-4 text-purple-700" />
                <span>เลือกดึงร่าง Flow หรือ Template ที่บันทึกไว้ขึ้นมาแก้ไขต่อ:</span>
              </label>
              {selectedFlowId && (
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handleSelectFlowTemplate('new')}
                    className="text-[11px] font-bold text-purple-700 hover:text-purple-900 flex items-center space-x-0.5 bg-white px-2 py-0.5 rounded-lg border border-purple-200 shadow-2xs"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>ล้างหน้าจอเพื่อสร้างใหม่</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteSelectedFlow}
                    className="text-[11px] font-bold text-red-600 hover:text-red-800 flex items-center space-x-0.5 bg-white px-2 py-0.5 rounded-lg border border-red-200 shadow-2xs"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>ลบร่างนี้</span>
                  </button>
                </div>
              )}
            </div>

            <select
              value={selectedFlowId || ''}
              onChange={e => handleSelectFlowTemplate(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold bg-white text-slate-800 border border-purple-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs cursor-pointer"
            >
              <option value="">-- เลือกดึงร่าง Flow หรือ Template ที่เคยบันทึกไว้ --</option>
              <option value="new">+ สร้าง Flow งานใหม่ (เริ่มต้นใหม่)</option>
              {flowTemplates.map(flow => (
                <option key={flow.id} value={flow.id}>
                  {flow.name.includes('ร่าง') ? `📌 [ร่าง] ${flow.name}` : `⚡ [Flow] ${flow.name}`} ({flow.checklists.length} ขั้นตอน)
                </option>
              ))}
            </select>
          </div>

          {/* Flow Name */}
          <div className="space-y-1">
            <label className="block text-xs font-black text-slate-800">
              ชื่อ Flow งาน <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="เช่น Flow R&D ทดลองผลิตสินค้า, Flow เสนอราคา Sales & Pre-Sale..."
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-600 bg-slate-50/50 font-bold"
            />
          </div>

          {/* Quick Preset Templates */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-800">
              โหลดตัวอย่างขั้นตอนด่วน
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!name) setName('Flow R&D วิจัยและทดลองผลิต');
                  setCategory('ku_university');
                  setChecklists([
                    '1. แกะสูตร + จัดหาวัตถุดิบ',
                    '2. ทดลองครั้งที่ 1',
                    '3. ส่งตัวอย่างทดลองครั้งที่ 1 (ให้พี่รักษ์)',
                    '4. ปรับสูตรครั้งที่ 1',
                    '5. ส่งตัวอย่างหลังปรับสูตรครั้งที่ 1',
                    '6. ส่งตรวจข้อมูลโภชนาการ และขอเลขอย.',
                    '7. ออกแบบและทดลองบรรจุภัณฑ์',
                    '8. ทดลองเก็บ Shelf Life',
                    '9. คำนวณต้นทุนและกำหนดราคาขาย',
                    '10. ลงขาย',
                  ]);
                }}
                className="px-3 py-2 bg-purple-100 hover:bg-purple-200 text-purple-900 text-xs font-black rounded-xl border border-purple-300 transition-colors cursor-pointer flex-1 flex items-center justify-center space-x-1"
              >
                <span>🧪 โหลด 10 ข้อ R&D</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!name) setName('Flow เสนอโครงการ ม.เกษตร');
                  setCategory('ku_university');
                  setChecklists([
                    '1. เขียนข้อเสนอ — ร่าง (จัดทำข้อเสนอฉบับแรก)',
                    '2. อาจารย์หนุ่ยเปิด (เปิดอ่านและให้ข้อเสนอแนะ)',
                    '3. พลอยปรับแก้ (แก้ข้อเสนอตามความคิดเห็น)',
                    '4. รออาจารย์หนุ่ยอนุมัติ (ตรวจฉบับพร้อมส่ง)',
                    '5. พลอยกรอกข้อมูลเข้าระบบ (บันทึกข้อมูลและเอกสาร)',
                    '6. รอหน่วยงานพิจารณา (ติดตามผลภายในกรอบเวลา)',
                    '7. ผ่าน — กลับมาแก้ข้อมูล (แก้ไขและส่งกลับหน่วยงาน)',
                    '8. ติดตามข้อมูลจากพี่ฟ้อง (พลอยส่งรายละเอียดและติดตาม)',
                    '9. อนุมัติ — เริ่มรันงวด (รับ TOR และเปิดแผนส่งมอบตามงวด)',
                  ]);
                }}
                className="px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-900 text-xs font-black rounded-xl border border-blue-300 transition-colors cursor-pointer flex-1 flex items-center justify-center space-x-1"
              >
                <span>🎓 โหลด 9 ข้อ ม.เกษตร</span>
              </button>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-800">
              รายละเอียด Flow (คำอธิบายสังเขป)
            </label>
            <textarea
              rows={2}
              placeholder="ระบุวัตถุประสงค์หรือเงื่อนไขของ Flow งานนี้..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-600 bg-slate-50/50"
            />
          </div>

          {/* Checklist Builder */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-black text-slate-900 flex items-center space-x-1.5">
                <Layers className="w-4 h-4 text-purple-700" />
                <span>กำหนดรายการขั้นตอน Checklist ({checklists.length} ข้อ)</span>
              </label>
              <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-full">
                กด ▲ / ▼ เพื่อสลับลำดับข้อได้
              </span>
            </div>

            {/* Input to add step */}
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="พิมพ์ขั้นตอนการทำงาน แล้วกดเพิ่ม..."
                value={newStepText}
                onChange={e => setNewStepText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddStep();
                  }
                }}
                className="flex-1 px-3.5 py-2 text-xs border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-600"
              />
              <button
                type="button"
                onClick={handleAddStep}
                className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-2xl text-xs font-black cursor-pointer shadow-xs transition-all flex items-center space-x-1 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>เพิ่มข้อ</span>
              </button>
            </div>

            {/* Steps List */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {checklists.map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs hover:bg-purple-50/30 transition-colors gap-2"
                >
                  {editingIndex === idx ? (
                    <div className="flex-1 flex items-center space-x-1.5">
                      <input
                        type="text"
                        autoFocus
                        value={editingText}
                        onChange={e => setEditingText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveEdit(idx);
                          } else if (e.key === 'Escape') {
                            setEditingIndex(null);
                          }
                        }}
                        className="flex-1 px-2.5 py-1 text-xs border border-purple-400 rounded-xl bg-white font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(idx)}
                        className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer"
                        title="บันทึกการแก้ไข"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingIndex(null)}
                        className="p-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors cursor-pointer"
                        title="ยกเลิก"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="font-bold text-slate-800 flex-1 min-w-0 break-words">
                      {step}
                    </span>
                  )}

                  {editingIndex !== idx && (
                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(idx, step)}
                        className="p-1 text-purple-600 hover:text-purple-800 hover:bg-purple-100 cursor-pointer rounded-lg transition-colors"
                        title="แก้ไขข้อความ"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveStepUp(idx)}
                        className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-30 disabled:hover:text-slate-400 cursor-pointer rounded-lg hover:bg-slate-200 transition-colors"
                        title="เลื่อนขึ้น"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === checklists.length - 1}
                        onClick={() => handleMoveStepDown(idx)}
                        className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-30 disabled:hover:text-slate-400 cursor-pointer rounded-lg hover:bg-slate-200 transition-colors"
                        title="เลื่อนลง"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveStep(idx)}
                        className="p-1 text-red-400 hover:text-red-600 cursor-pointer rounded-lg hover:bg-red-50 transition-colors"
                        title="ลบข้อนี้"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {checklists.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                  ยังไม่มีขั้นตอน Checklist (กรุณาพิมพ์เพิ่มด้านบน)
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2.5 border border-slate-300 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
            >
              ยกเลิก
            </button>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleSaveDraft}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl text-xs font-extrabold shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center space-x-1.5"
                title="บันทึกร่างไว้แก้ไขต่อภายหลัง"
              >
                <Save className="w-4 h-4" />
                <span>{selectedFlowId ? 'อัปเดตบันทึกร่าง' : 'บันทึกร่าง'}</span>
              </button>

              <button
                type="submit"
                className="px-5 py-2.5 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white rounded-2xl text-xs font-extrabold shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center space-x-1.5"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>{selectedFlowId ? 'บันทึกและใช้อัปเดต Flow' : 'บันทึกและสร้าง Flow งาน'}</span>
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};


