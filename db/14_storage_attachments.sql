-- =============================================================================
-- NP Taskwork — ระบบติดตามงาน
-- 14_storage_attachments.sql : ที่เก็บรูปแนบจริงบน Supabase Storage — รันซ้ำได้
--
-- ปัญหา
--   หน้าเว็บเคยบันทึกรูปแนบเป็นลิงก์ blob:https://... ลงตาราง attachments
--   ลิงก์แบบนี้มีอยู่แค่ในแท็บเบราว์เซอร์ที่อัปโหลดเท่านั้น ตัวไฟล์ไม่เคยถูกส่งขึ้นเซิร์ฟเวอร์
--   พอรีเฟรชหน้า หรือคนอื่น (ผู้ตรวจ) เปิดดู รูปจึงไม่ขึ้นและกดเปิดไม่ได้
--
-- การแก้
--   สร้าง bucket "attachments" ให้หน้าเว็บอัปโหลดไฟล์ขึ้นไปก่อน แล้วค่อยบันทึกลิงก์ถาวรลงตาราง
--     * อ่านได้แบบสาธารณะ (public) ให้ <img src> ใช้ลิงก์ตรง ๆ ได้
--       ชื่อไฟล์ขึ้นต้นด้วย UUID สุ่ม จึงเดาลิงก์ไม่ได้ถ้าไม่ได้รับลิงก์มา
--     * อัปโหลดได้เฉพาะผู้ใช้ที่อนุมัติแล้ว และต้องอยู่ใต้โฟลเดอร์ของตัวเอง (<users.id>/...)
--     * ผู้ใช้ที่อนุมัติแล้วค้นรายการไฟล์ใน bucket ได้ (Storage บังคับ ไม่งั้นลบไฟล์ไม่ได้)
--     * ลบได้เฉพาะเจ้าของไฟล์หรือแอดมิน — ตรงกับ policy attachments_delete ใน 03_rls.sql
--     * รับเฉพาะไฟล์รูป ขนาดไม่เกิน 50MB (เพดานต่อไฟล์ของ Supabase แพ็กเกจฟรี)
--
-- หมายเหตุ
--   รูปเก่าที่บันทึกเป็น blob: ไปแล้วกู้คืนไม่ได้ เพราะตัวไฟล์ไม่เคยขึ้นเซิร์ฟเวอร์ ต้องอัปโหลดใหม่
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attachments', 'attachments', true, 52428800, array['image/*'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists attachments_storage_insert on storage.objects;
create policy attachments_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and public.app_is_approved()
    and (storage.foldername(name))[1] = public.app_current_user_id()::text
  );

-- Storage ต้องค้นเจอไฟล์ผ่าน SELECT ก่อนถึงจะลบได้ ไม่มี policy นี้ การลบจะเงียบ ๆ ไม่ลบอะไรเลย
-- (การเปิดดูรูปผ่านลิงก์ public ไม่ผ่าน policy นี้อยู่แล้ว)
drop policy if exists attachments_storage_select on storage.objects;
create policy attachments_storage_select on storage.objects
  for select to authenticated
  using (bucket_id = 'attachments' and public.app_is_approved());

drop policy if exists attachments_storage_delete on storage.objects;
create policy attachments_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'attachments'
    and (
      (storage.foldername(name))[1] = public.app_current_user_id()::text
      or public.app_is_admin()
    )
  );
