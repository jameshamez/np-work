-- =============================================================================
-- NP Taskwork — ระบบติดตามงาน
-- 13_cleanup_mock_attachments.sql : ลบไฟล์แนบปลอมที่ฟอร์มส่งตรวจงานเวอร์ชันเก่าใส่ไว้ — รันซ้ำได้
--
-- ปัญหา
--   SubmitTaskModal เวอร์ชันก่อน commit d74206b แนบไฟล์ที่ไม่ใช่ของจริงลงตาราง attachments
--     * ไม่ได้อัปโหลดรูป → แนบ work_snapshot.png (รูปจาก Unsplash) ให้เอง
--     * กดเลือก "รูปตัวอย่าง" → screen_mockup_7030.png / system_architecture_diagram.jpg /
--       server_rack_installation.jpg (รูปจาก Unsplash)
--     * กด "เลือกไฟล์ตัวอย่าง (145MB)" → project_deliverables_v1.zip (ลิงก์ '#')
--
-- การแก้
--   ลบเฉพาะแถวที่ตรงกับลายเซ็นของไฟล์ปลอมข้างบนทั้งชื่อไฟล์และลิงก์
--   และ legacy_id เป็น null (แถวที่แอปใส่เอง) เพื่อไม่แตะข้อมูลตัวอย่างใน 04_seed.sql
--   ไฟล์ที่ผู้ใช้อัปโหลดจริงไม่โดนลบ แม้ชื่อจะบังเอิญซ้ำ เพราะลิงก์จะเป็น blob: ไม่ใช่ Unsplash / '#'
--
-- วิธีรัน
--   วางทั้งไฟล์ใน SQL Editor ของ Supabase แล้วกด Run
--   ตารางผลลัพธ์คือรายการที่ถูกลบ (ว่าง = ไม่มีไฟล์ปลอมเหลือแล้ว)
-- =============================================================================

delete from attachments a
using tasks t
where t.id = a.task_id
  and a.legacy_id is null
  and (
    (a.file_name in ('work_snapshot.png',
                     'screen_mockup_7030.png',
                     'system_architecture_diagram.jpg',
                     'server_rack_installation.jpg')
     and a.file_url like 'https://images.unsplash.com/%')
    or
    (a.file_name = 'project_deliverables_v1.zip' and a.file_url = '#')
  )
returning t.code as task_code, t.title as task_title,
          a.file_name, a.uploaded_by_name, a.uploaded_at;
