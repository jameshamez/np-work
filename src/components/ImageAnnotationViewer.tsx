import React, { useEffect, useState, useRef } from 'react';
import { ImageAnnotation } from '../types';
import { Circle, MessageSquare, Plus, Trash2, Send } from 'lucide-react';

interface ImageAnnotationViewerProps {
  imageUrl: string;
  annotations?: ImageAnnotation[];
  onAddAnnotation?: (annotation: { x: number; y: number; radius: number; comment: string }) => void;
  readOnly?: boolean;
}

export const ImageAnnotationViewer: React.FC<ImageAnnotationViewerProps> = ({
  imageUrl,
  annotations = [],
  onAddAnnotation,
  readOnly = false,
}) => {
  const [clickPos, setClickPos] = useState<{ x: number; y: number } | null>(null);
  const [newComment, setNewComment] = useState('');
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const commentFormRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);

  // ช่องพิมพ์ความเห็นอยู่ใต้ภาพ มักตกขอบจอ — วงจุดแล้วเลื่อนลงไปให้เห็นและพิมพ์ได้ทันที
  // (จุดจะถูกนับในแท็บก็ต่อเมื่อกดบันทึกวงความเห็นแล้วเท่านั้น)
  useEffect(() => {
    if (!clickPos) return;
    commentFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    commentInputRef.current?.focus({ preventScroll: true });
  }, [clickPos]);

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || !onAddAnnotation) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setClickPos({ x, y });
  };

  const handleSaveAnnotation = () => {
    if (!clickPos || !newComment.trim() || !onAddAnnotation) return;

    onAddAnnotation({
      x: clickPos.x,
      y: clickPos.y,
      radius: 25, // default circle radius
      comment: newComment,
    });

    setClickPos(null);
    setNewComment('');
  };

  // Attach original badge index to each annotation for consistent badge numbering between image & list
  const annotationsWithBadge = annotations.map((ann, idx) => ({
    ...ann,
    badgeNumber: idx + 1,
  }));

  // Sort annotations descending (newest first)
  const sortedAnnotations = [...annotationsWithBadge].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (timeA !== timeB) {
      return timeB - timeA;
    }
    return b.badgeNumber - a.badgeNumber;
  });

  return (
    <div className="space-y-4">
      <div className="relative border border-gray-200 rounded-xl overflow-hidden bg-gray-950 group select-none">
        {/* Main Image */}
        <div className="relative cursor-crosshair" onClick={handleImageClick}>
          <img
            ref={imgRef}
            src={imageUrl}
            alt="Blueprint / Image"
            className="w-full max-h-[450px] object-contain mx-auto"
          />

          {/* Render Existing Circle Annotations */}
          {annotationsWithBadge.map((ann) => {
            const isSelected = selectedAnnotationId === ann.id;
            return (
              <div
                key={ann.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedAnnotationId(ann.id);
                }}
                className={`absolute rounded-full border-2 transition-all cursor-pointer transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center ${
                  isSelected
                    ? 'border-yellow-400 bg-yellow-400/30 scale-110 shadow-lg'
                    : 'border-red-500 bg-red-500/20 hover:bg-red-500/40'
                }`}
                style={{
                  left: `${ann.x}%`,
                  top: `${ann.y}%`,
                  width: `${(ann.radius || 25) * 2}px`,
                  height: `${(ann.radius || 25) * 2}px`,
                }}
              >
                <span className="bg-red-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-md">
                  #{ann.badgeNumber}
                </span>
              </div>
            );
          })}

          {/* Render New Pin Position if clicking */}
          {clickPos && (
            <div
              className="absolute w-12 h-12 rounded-full border-2 border-dashed border-yellow-300 bg-yellow-300/30 transform -translate-x-1/2 -translate-y-1/2 animate-pulse flex items-center justify-center"
              style={{ left: `${clickPos.x}%`, top: `${clickPos.y}%` }}
            >
              <Plus className="w-5 h-5 text-yellow-300" />
              <span className="absolute top-full mt-1 whitespace-nowrap rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-yellow-300">
                ยังไม่บันทึก
              </span>
            </div>
          )}
        </div>

        {!readOnly && (
          <div className="p-2 bg-gray-900 text-[11px] text-gray-300 text-center border-t border-gray-800">
            💡 คลิกบนภาพเพื่อ <span className="text-yellow-400 font-bold">"วงจุดแก้ไข"</span> และพิมพ์คอมเมนต์เสนอแนะ
          </div>
        )}
      </div>

      {/* New Annotation Input Form */}
      {clickPos && !readOnly && (
        <div ref={commentFormRef} className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 flex items-center space-x-1">
              <Circle className="w-3.5 h-3.5 text-amber-600" />
              <span>ใส่ความเห็นกำกับตำแหน่งที่เลือก ({clickPos.x.toFixed(1)}%, {clickPos.y.toFixed(1)}%)</span>
            </span>
            <button
              onClick={() => setClickPos(null)}
              className="text-[11px] font-bold text-gray-500 hover:text-gray-700"
            >
              ยกเลิก
            </button>
          </div>
          <div className="flex gap-2">
            <input
              ref={commentInputRef}
              type="text"
              placeholder="พิมพ์ความเห็น เช่น ขยับระยะตำแหน่งมอเตอร์เกียร์ขึ้น 15mm..."
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs bg-white border border-yellow-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              onKeyDown={e => e.key === 'Enter' && handleSaveAnnotation()}
            />
            <button
              onClick={handleSaveAnnotation}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1 shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>บันทึกวงความเห็น</span>
            </button>
          </div>
        </div>
      )}

      {/* List of Annotations */}
      {sortedAnnotations.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-gray-700 flex items-center space-x-1">
              <MessageSquare className="w-3.5 h-3.5 text-orange-600" />
              <span>รายการจุดที่วงแก้ไขและคอมเมนต์ ({sortedAnnotations.length})</span>
            </p>
            <span className="text-[10px] font-bold text-orange-800 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
              ความคิดเห็นล่าสุดอยู่ข้างบน
            </span>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {sortedAnnotations.map((ann) => (
              <div
                key={ann.id}
                onClick={() => setSelectedAnnotationId(ann.id)}
                className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-start justify-between ${
                  selectedAnnotationId === ann.id
                    ? 'bg-yellow-50 border-yellow-300'
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-start space-x-2">
                  <span className="shrink-0 w-5 h-5 bg-red-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                    #{ann.badgeNumber}
                  </span>
                  <div>
                    <p className="font-bold text-gray-900">{ann.comment}</p>
                    <p className="text-[10px] text-gray-500">
                      โดย {ann.authorName} • {new Date(ann.createdAt).toLocaleString('th-TH')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
