-- =============================================================================
-- NP Taskwork — ระบบติดตามงาน
-- 04_seed.sql : ข้อมูลตัวอย่างสำหรับทดสอบ (แปลงจาก src/data/mockData.ts)
--
-- ครอบคลุม: ผู้ใช้ทุก role, โครงการทั้ง 10, งานตัวอย่าง 6 ใบที่กินครบทุกสถานะ
--           และทุกความสามารถ (checklist / งวดงาน / การเงิน / มาร์กภาพ / ทำแทน)
--
-- อ้างอิงกันด้วย legacy_id เพื่อให้ id จริงยังเป็น uuid ที่ระบบออกให้
-- รันซ้ำได้ (idempotent) — ใช้ on conflict (legacy_id) do nothing
--
-- หมายเหตุ: auth_user_id ปล่อยเป็น null ไว้ ถ้าจะใช้ Supabase Auth ให้ผูกทีหลังด้วย
--   update users set auth_user_id = '<uuid จาก auth.users>' where username = '...';
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Users
-- -----------------------------------------------------------------------------
insert into users (legacy_id, username, full_name, email, role, status, created_at) values
  ('usr-aom',  'SuperAdmin_Aom', 'ออม',      'aom.superadmin@company.co.th', 'super_admin', 'approved', '2026-07-01T08:00:00Z'),
  ('usr-moo',  'Admin_Moo',      'พี่หมู',   'moo.admin@company.co.th',      'admin',       'approved', '2026-07-01T08:15:00Z'),
  ('usr-rak',  'Admin_Rak',      'พี่รักษ์', 'rak.admin@company.co.th',      'admin',       'approved', '2026-07-01T08:30:00Z'),
  ('usr-1',    'User_Nueng',     'พี่หนึ่ง', 'nueng.a@company.co.th',        'user',        'approved', '2026-07-01T08:00:00Z'),
  ('usr-fong', 'User_Fong',      'พี่ฟ้อง',  'fong.user@company.co.th',      'user',        'approved', '2026-07-02T08:00:00Z'),
  ('usr-ploy', 'User_Ploy',      'พลอย',     'ploy.user@company.co.th',      'user',        'approved', '2026-07-02T09:00:00Z')
on conflict (legacy_id) do nothing;

-- -----------------------------------------------------------------------------
-- Projects
-- -----------------------------------------------------------------------------
insert into projects (legacy_id, name, description, color, created_at) values
  ('prj-tar', 'ไทยเอเชียไรซ์ โปรดักส์',
   'งานออกแบบ ปรับปรุง และติดตั้งเครื่องจักรไลน์ผลิตก๋วยเตี๋ยวและตู้อบ โรงงานไทยเอเชียไรซ์',
   '#ef6c00', '2026-07-01T00:00:00Z'),
  ('prj-prakulao', 'โครงการเครื่องอบแนวตั้งปลากุเลา',
   'โครงการพัฒนาและสร้างเครื่องอบแนวตั้งสำหรับปลากุเลา (Phase สร้างเครื่อง)',
   '#81d4fa', '2026-07-05T00:00:00Z'),
  ('prj-homelift', 'โปรเจค Home Lift บ้านพี่อ๋อง',
   'งานสำรวจ ออกแบบ ผลิต และติดตั้ง Home Lift สำหรับที่พักอาศัย',
   '#72d572', '2026-07-10T00:00:00Z'),
  ('prj-poc', 'โครงการ POC (Phase สร้างเครื่อง)',
   'โครงการ Proof of Concept สร้างเครื่องจักรต้นแบบ',
   '#ffd54f', '2026-07-12T00:00:00Z'),
  ('prj-sundry', 'โปรเจค Sun Dry',
   'เครื่องอบแห้งพลังงานแสงอาทิตย์แบบไฮบริด พร้อมหลอดฮาโลเจนช่วยอบยามไร้แสง',
   '#ff9800', '2026-07-15T00:00:00Z'),
  ('prj-chain-tsri', 'โปรเจคโครงการสายพานโซ่ บพข.',
   'โครงการเสนอขอทุนวิจัยและพัฒนาสายพานโซ่ บพข.',
   '#9c27b0', '2026-07-18T00:00:00Z'),
  ('prj-dksh', 'โปรเจคยอดค้างชำระ DKSH',
   'งานติดตามยอดค้างชำระและประสานงานข้อเสนอโครงการใหม่กับ DKSH',
   '#bf360c', '2026-07-20T00:00:00Z'),
  ('prj-patent', 'โปรเจคแบบคำขออนุสิทธิบัตร',
   'การร่างและยื่นแบบคำขออนุสิทธิบัตรสิ่งประดิษฐ์และนวัตกรรม',
   '#00bcd4', '2026-07-22T00:00:00Z'),
  ('prj-brochure', 'โปรเจคจัดทำโบรชัวร์เครื่องอบแสงอาทิตย์ Version ชุมชน',
   'จัดทำสื่อโบรชัวร์และเอกสารนำเสนอเครื่องอบแสงอาทิตย์สำหรับใช้งานในชุมชน',
   '#4caf50', '2026-07-25T00:00:00Z'),
  ('prj-toho', 'โปรเจค เครื่อง De-Burr โรงงาน TOHO เมืองเอก',
   'ออกแบบและเสนอราคาเครื่องลบคมชิ้นงาน (De-Burr Machine) โรงงาน TOHO',
   '#607d8b', '2026-07-28T00:00:00Z')
on conflict (legacy_id) do nothing;

-- -----------------------------------------------------------------------------
-- Flow templates
-- -----------------------------------------------------------------------------
insert into flow_templates (legacy_id, name, category, description) values
  ('flow-rd-10',      '🧪 Flow RD (10 ขั้นตอน)',                  'ku_university', 'กระบวนการวิจัยและพัฒนาผลิตภัณฑ์อาหาร (R&D)'),
  ('flow-ku-9',       '🎓 Flow ทุน ม.เกษตร (9 ข้อ)',              'ku_university', 'กระบวนการยื่นและบริหารข้อเสนอโครงการทุน ม.เกษตร'),
  ('flow-drawing-3',  '📐 Flow เขียนแบบและตรวจแบบ 3D (3 ข้อ)',    'drawing_draft', 'กระบวนการเขียนแบบแปลนโครงสร้าง ขึ้นรูป 3D และพิมพ์เขียว'),
  ('flow-sales-4',    '💼 Flow Sales & Pre-Sale (4 ข้อ)',         'sales_presale', 'กระบวนการเสนอราคา สำรวจหน้างาน และปิดการขาย')
on conflict (legacy_id) do nothing;

insert into flow_template_items (template_id, sort_order, title)
select (select id from flow_templates where legacy_id = 'flow-rd-10'), ord, title
from (values
  (1,  '1. แกะสูตร + จัดหาวัตถุดิบ'),
  (2,  '2. ทดลองครั้งที่ 1'),
  (3,  '3. ส่งตัวอย่างทดลองครั้งที่ 1 (ให้พี่รักษ์)'),
  (4,  '4. ปรับสูตรครั้งที่ 1'),
  (5,  '5. ส่งตัวอย่างหลังปรับสูตรครั้งที่ 1 (ถ้าผ่านไปข้อ 6 / ถ้าไม่ผ่าน ย้อนปรับสูตรครั้งที่ 2 และส่งตัวอย่างครั้งที่ 2)'),
  (6,  '6. ส่งตรวจข้อมูลโภชนาการ และขอเลขอย.'),
  (7,  '7. ออกแบบและทดลองบรรจุภัณฑ์'),
  (8,  '8. ทดลองเก็บ Shelf Life'),
  (9,  '9. คำนวณต้นทุนและกำหนดราคาขาย'),
  (10, '10. ลงขาย')
) as v(ord, title)
on conflict (template_id, sort_order) do nothing;

insert into flow_template_items (template_id, sort_order, title)
select (select id from flow_templates where legacy_id = 'flow-ku-9'), ord, title
from (values
  (1, '1. เขียนข้อเสนอ — ร่าง (จัดทำข้อเสนอฉบับแรก)'),
  (2, '2. อาจารย์หนุ่ยเปิด (เปิดอ่านและให้ข้อเสนอแนะ)'),
  (3, '3. พลอยปรับแก้ (แก้ข้อเสนอตามความคิดเห็น)'),
  (4, '4. รออาจารย์หนุ่ยอนุมัติ (ตรวจฉบับพร้อมส่ง)'),
  (5, '5. พลอยกรอกข้อมูลเข้าระบบ (บันทึกข้อมูลและเอกสาร)'),
  (6, '6. รอหน่วยงานพิจารณา (ติดตามผลภายในกรอบเวลา)'),
  (7, '7. ผ่าน — กลับมาแก้ข้อมูล (แก้ไขและส่งกลับหน่วยงาน)'),
  (8, '8. ติดตามข้อมูลจากพี่ฟ้อง (พลอยส่งรายละเอียดและติดตาม)'),
  (9, '9. อนุมัติ — เริ่มรันงวด (รับ TOR และเปิดแผนส่งมอบตามงวด)')
) as v(ord, title)
on conflict (template_id, sort_order) do nothing;

insert into flow_template_items (template_id, sort_order, title)
select (select id from flow_templates where legacy_id = 'flow-drawing-3'), ord, title
from (values
  (1, '1. ตรวจสอบรายละเอียดและข้อกำหนดงานเขียนแบบ'),
  (2, '2. เขียนแบบโครงสร้างและขึ้นรูปภาพ 3D'),
  (3, '3. ตรวจสอบระยะและพิมพ์เขียวพร้อมส่งมอบ')
) as v(ord, title)
on conflict (template_id, sort_order) do nothing;

insert into flow_template_items (template_id, sort_order, title)
select (select id from flow_templates where legacy_id = 'flow-sales-4'), ord, title
from (values
  (1, '1. สำรวจหน้างานและเก็บข้อมูลความต้องการลูกค้า'),
  (2, '2. คำนวณราคากลางและจัดทำใบเสนอราคา'),
  (3, '3. ส่งใบเสนอราคาและเสนอขายลูกค้า'),
  (4, '4. ยืนยันคำสั่งซื้อ (PO) และปิดการขาย')
) as v(ord, title)
on conflict (template_id, sort_order) do nothing;

-- -----------------------------------------------------------------------------
-- Tasks
-- -----------------------------------------------------------------------------
insert into tasks (
  legacy_id, code, project_id, title, description,
  assigned_to_user_id, assigned_target_user_id, category, ku_proposal_status, ku_deadline,
  plan_days, status, sla_status, created_at, deadline_at, completed_at, lead_time_days,
  last_updated_at, tor_document_name, tor_document_url
)
select
  v.legacy_id, v.code,
  (select id from projects where legacy_id = v.project_legacy),
  v.title, v.description,
  (select id from users where legacy_id = v.owner_legacy),
  (select id from users where legacy_id = v.target_legacy),
  v.category, v.ku_status, v.ku_deadline,
  v.plan_days, v.status, v.sla_status,
  v.created_at, v.deadline_at, v.completed_at, v.lead_time_days,
  v.last_updated_at, v.tor_name, v.tor_url
from (values
  -- 1) งานเดินเครื่อง — ยังไม่ส่งตรวจ
  ('tsk-301', 'NP-201', 'prj-tar',
   '1. เครื่องอบไลน์ 13 - ระบบลม สายพาน และอุณหภูมิ',
   'ออกแบบและทดสอบลิ้นลม, ติดตั้งโบลเวอร์/คอยล์ร้อน 3 ชุด, สร้างปล่องลมร้อน 4 ชุด, สายพานโซ่ลำเลียง, วัดอุณหภูมิ 12 จุด, ปิดหน้าตู้อบ และพัดลมดูดความชื้น',
   'usr-1', null, null::project_category, null::ku_proposal_status, null::date,
   7, 'pending_submission'::task_status, 'on_time'::sla_status,
   '2026-07-25T08:00:00Z'::timestamptz, '2026-08-01T08:00:00Z'::timestamptz,
   null::timestamptz, null::integer, '2026-07-29T10:00:00Z'::timestamptz, null::text, null::text),

  -- 2) ส่งตรวจแล้ว เลยเดดไลน์ — ตัวอย่างการ "ทำแทน"
  ('tsk-302', 'NP-202', 'prj-tar',
   '2. ตู้นึ่งไลน์ 13 - ตรวจสอบและทดสอบการนึ่ง',
   'ตรวจสอบอุปกรณ์ตู้นึ่ง ติดตั้งอุปกรณ์ที่ขาด ทดสอบเดินระบบ ตรวจสอบสตีม และทดลองนึ่งด้วยน้ำแป้งจริง',
   'usr-1', null, null, null, null,
   4, 'pending_review', 'delayed',
   '2026-07-20T08:00:00Z', '2026-07-24T08:00:00Z', null, null, '2026-07-30T14:00:00Z', null, null),

  -- 3) ปิดงานแล้ว ตรงเวลา
  ('tsk-316', 'NP-216', 'prj-chain-tsri',
   'โครงการสายพานโซ่ บพข. - ยื่นเสนอขอทุนวิจัย',
   'เตรียมแผนส่ง Concept Note, แก้ระเบียบวิธีวิจัย, แก้ Gantt Chart, ยื่น Google Form และส่งไฟล์เล่มเต็มพร้อมรหัสโครงการ',
   'usr-1', null, null, null, null,
   5, 'approved', 'on_time',
   '2026-07-20T08:00:00Z', '2026-07-25T08:00:00Z', '2026-07-24T14:00:00Z', 4, '2026-07-24T14:00:00Z', null, null),

  -- 4) ถูกตีกลับ และเงียบเกิน 48 ชม.
  ('tsk-317', 'NP-217', 'prj-dksh',
   'ติดตามยอดค้างชำระและตามงานใหม่ DKSH',
   'ตามยอดค้างชำระกับคุณนิว และตามงานโครงการใหม่กับคุณนิว',
   'usr-1', null, null, null, null,
   3, 'returned', 'no_update',
   '2026-07-21T08:00:00Z', '2026-07-24T08:00:00Z', null, null, '2026-07-26T09:00:00Z', null, null),

  -- 5) โครงการ ม.เกษตร — อนุมัติแล้ว เริ่มรันงวดส่งมอบ TOR
  ('tsk-321-mushroom', 'KU-MUSHROOM-001', 'prj-chain-tsri',
   '🍄 โครงการวิจัยและพัฒนาโรงเรือนเพาะปลูกเห็ดอัจฉริยะ ม.เกษตร (เสร็จแล้ว รอตั้งงวดงาน)',
   'โครงการพัฒนาโรงเรือนเพาะเลี้ยงเห็ดสมุนไพรและเห็ดเศรษฐกิจด้วยระบบควบคุมอุณหภูมิและความชื้นอัตโนมัติ ผ่านการอนุมัติข้อเสนอทุน ม.เกษตร เรียบร้อยแล้ว',
   'usr-ploy', 'usr-fong', 'ku_university', '8_approved_run_terms', '2026-11-30',
   30, 'approved', 'on_time',
   '2026-07-28T08:00:00Z', '2026-08-15T08:00:00Z', '2026-07-31T08:00:00Z', 3, '2026-07-31T08:00:00Z',
   'TOR_SmartMushroom_KU_2026.pdf', '#'),

  -- 6) งานเขียนแบบ — มีมาร์กจุดบนภาพแปลน
  ('tsk-322', 'DWG-101', 'prj-tar',
   'เขียนแบบและตรวจแก้แปลนโครงสร้าง Slitter',
   'งานเขียนแบบ ตรวจสอบระยะ และวงคอมเมนต์จุดที่ต้องแก้ไขในแปลนเครื่อง Slitter',
   'usr-1', null, 'drawing_draft', null, null,
   3, 'pending_review', 'on_time',
   '2026-07-29T08:00:00Z', '2026-08-01T08:00:00Z', null, null, '2026-07-31T09:15:00Z', null, null)
) as v(legacy_id, code, project_legacy, title, description, owner_legacy, target_legacy,
       category, ku_status, ku_deadline, plan_days, status, sla_status,
       created_at, deadline_at, completed_at, lead_time_days, last_updated_at, tor_name, tor_url)
on conflict (legacy_id) do nothing;

-- -----------------------------------------------------------------------------
-- Checklists
-- -----------------------------------------------------------------------------
insert into task_checklist_items (legacy_id, task_id, sort_order, title, completed)
select v.legacy_id, (select id from tasks where legacy_id = v.task_legacy), v.ord, v.title, v.done
from (values
  ('chk-301-1', 'tsk-301', 1, 'ออกแบบและทดสอบลิ้นลมสำหรับปล่องลมร้อน', true),
  ('chk-301-2', 'tsk-301', 2, 'ติดตั้งโบลเวอร์และคอยล์ร้อน 3 ชุด (โบลเวอร์ใหญ่ 1 ชุด, โบลเวอร์เล็ก 2 ชุด)', true),
  ('chk-301-3', 'tsk-301', 3, 'สร้างและติดตั้งปล่องลมร้อน จำนวน 4 ชุด', true),
  ('chk-301-4', 'tsk-301', 4, 'ติดตั้งซี่ของสายพานโซ่ในชุดลำเลียงแผ่นก๋วยเตี๋ยว', false),
  ('chk-301-5', 'tsk-301', 5, 'ติดตั้งชุดวัดอุณหภูมิภายในปล่องลมร้อนและตู้อบ จำนวน 12 จุด', false),
  ('chk-301-6', 'tsk-301', 6, 'ติดตั้งชุดปิดหน้าตู้อบ', false),
  ('chk-301-7', 'tsk-301', 7, 'ติดตั้งชุดพัดลมดูดความชื้นหลังตู้อบ', false),
  ('chk-301-8', 'tsk-301', 8, 'ทดสอบสายพานและระบบลม', false),

  ('chk-302-1', 'tsk-302', 1, 'ตรวจสอบอุปกรณ์ตู้นึ่ง', true),
  ('chk-302-2', 'tsk-302', 2, 'ติดตั้งอุปกรณ์ที่ขาดภายในตู้นึ่ง', true),
  ('chk-302-3', 'tsk-302', 3, 'ทดสอบเดินระบบตู้นึ่ง', true),
  ('chk-302-4', 'tsk-302', 4, 'ทดสอบตู้นึ่งด้วยสตีม', true),
  ('chk-302-5', 'tsk-302', 5, 'ทดลองนึ่งด้วยน้ำแป้งจริง', true),

  ('chk-316-1', 'tsk-316', 1, 'เตรียมแผนส่ง Concept Note', true),
  ('chk-316-2', 'tsk-316', 2, 'แก้ระเบียบวิธีวิจัย', true),
  ('chk-316-3', 'tsk-316', 3, 'แก้ไข Gantt Chart', true),
  ('chk-316-4', 'tsk-316', 4, 'จัดส่งในแบบ Google Form', true),
  ('chk-316-5', 'tsk-316', 5, 'ส่งไฟล์ข้อเสนอเล่มเต็มพร้อมเลขรหัสโครงการให้พี่รัก', true),

  ('chk-317-1', 'tsk-317', 1, 'ตามยอดค้างกับคุณนิว', true),
  ('chk-317-2', 'tsk-317', 2, 'ตามงานใหม่กับคุณนิว', false),

  ('chk-shroom-1', 'tsk-321-mushroom', 1, 'จัดทำร่างข้อเสนอโครงการปลูกเห็ด ม.เกษตร', true),
  ('chk-shroom-2', 'tsk-321-mushroom', 2, 'ผ่านการอนุมัติข้อเสนอทุนวิจัยเรียบร้อย', true),
  ('chk-shroom-3', 'tsk-321-mushroom', 3, 'พลอยเปิดสัญญารันงวดส่งมอบ TOR', true),

  ('chk-322-1', 'tsk-322', 1, 'เขียนแบบภาพประกอบ Slitter 3D', true),
  ('chk-322-2', 'tsk-322', 2, 'วงจุดแก้ไขเพลาเกียร์ในรูปภาพแปลน', true)
) as v(legacy_id, task_legacy, ord, title, done)
on conflict (legacy_id) do nothing;

-- -----------------------------------------------------------------------------
-- Milestones (งวดงานโครงการเห็ดอัจฉริยะ) + สถานะเบิกจ่าย 2 ระดับ
-- -----------------------------------------------------------------------------
insert into task_milestones (
  legacy_id, task_id, milestone_number, title, deliverables, amount, due_date, status,
  project_payout_status, project_payout_date, holder_payout_status, holder_payout_date, holder_name
)
select v.legacy_id, (select id from tasks where legacy_id = 'tsk-321-mushroom'),
       v.num, v.title, v.deliverables, v.amount, v.due_date, v.status,
       v.proj_payout, v.proj_date, v.holder_payout, v.holder_date, v.holder
from (values
  ('ms-shroom-1', 1,
   'งวดที่ 1 : เอกสารแบบแปลนโครงสร้างโรงเรือนเห็ดและระบบหมอกความชื้น',
   E'[x] เอกสารแบบแปลนโครงสร้างโรงเรือนเห็ด 3D\n[x] รายการสเปกปั๊มหมอกแรงดันสูงและหัวฉีด\n[ ] เอกสารแผนการดำเนินงานจัดซื้ออุปกรณ์',
   150000::numeric, '2026-08-15'::date, 'approved'::milestone_status,
   'เบิกสำเร็จ'::project_payout_status, '2026-08-20'::date,
   'กำลังดำเนินการ'::holder_payout_status, null::date, 'อาจารย์หนุ่ย'),

  ('ms-shroom-2', 2,
   'งวดที่ 2 : ก่อสร้างโรงเรือนเห็ดและติดตั้งตู้ควบคุม IoT',
   E'[ ] ก่อสร้างโครงหลังคาและตาข่ายกันแมลง\n[ ] ประกอบตู้ควบคุมอุณหภูมิความชื้นดิจิทัล\n[ ] ติดตั้งเซนเซอร์ CO2 และวัดความชื้นสัมพัทธ์',
   250000, '2026-10-01', 'pending',
   'รอเบิก', null, 'รออนุมัติ', null, 'อาจารย์หนุ่ย'),

  ('ms-shroom-3', 3,
   'งวดที่ 3 : ทดสอบการเปิดดอกเห็ด อบรมชุมชน และส่งมอบรายงานฉบับสมบูรณ์',
   E'[ ] บันทึกผลการเจริญเติบโตของก้อนเห็ดทดลอง\n[ ] จัดอบรมกลุ่มเกษตรกรเครือข่าย ม.เกษตร 30 ท่าน\n[ ] เอกสารรายงานสรุปผลวิจัยฉบับสมบูรณ์ (TOR)',
   200000, '2026-11-30', 'pending',
   'รอเบิก', null, 'รออนุมัติ', null, 'อาจารย์หนุ่ย')
) as v(legacy_id, num, title, deliverables, amount, due_date, status,
       proj_payout, proj_date, holder_payout, holder_date, holder)
on conflict (legacy_id) do nothing;

-- -----------------------------------------------------------------------------
-- Two-Tier Financials (ตัวเลขสาธิตของงวดที่ 1 โครงการเห็ด)
-- remaining_balance คำนวณเอง = 150,000 - (45,000 + 62,500 + 18,000) = 24,500
-- -----------------------------------------------------------------------------
insert into task_financials (task_id, project_installment, approved_remuneration, approved_materials, approved_expenses)
select id, 150000, 45000, 62500, 18000 from tasks where legacy_id = 'tsk-321-mushroom'
on conflict (task_id) do nothing;

-- -----------------------------------------------------------------------------
-- Task logs (append-only)
-- -----------------------------------------------------------------------------
insert into task_logs (
  legacy_id, task_id, action_by_user_id, action_by_user_name,
  on_behalf_of_user_id, on_behalf_of_user_name, previous_status, new_status, comment, created_at
)
select v.legacy_id,
       (select id from tasks where legacy_id = v.task_legacy),
       (select id from users where legacy_id = v.actor_legacy), v.actor_name,
       (select id from users where legacy_id = v.behalf_legacy), v.behalf_name,
       v.prev, v.new_status, v.comment, v.created_at
from (values
  ('log-301', 'tsk-301', 'usr-1',   'พี่หนึ่ง', 'usr-1',    'พี่หนึ่ง',
   null::task_status, 'pending_submission'::task_status,
   'สร้างการ์ดงานไทยเอเชียไรซ์ - เครื่องอบไลน์ 13 กำหนดเวลา 7 วัน', '2026-07-25T08:00:00Z'::timestamptz),

  -- ตัวอย่าง "ทำแทน": พี่หนึ่งส่งตรวจแทนพี่ฟ้อง
  ('log-302', 'tsk-302', 'usr-1',   'พี่หนึ่ง', 'usr-fong', 'พี่ฟ้อง',
   'pending_submission', 'pending_review',
   'ทำแทนพี่ฟ้อง: ทดสอบตู้นึ่งด้วยสตีมและน้ำแป้งจริงเรียบร้อยแล้ว พร้อมแนบไฟล์รายงานผลการทดสอบ', '2026-07-30T14:00:00Z'),

  ('log-317', 'tsk-317', 'usr-moo', 'พี่หมู',   'usr-1',    'พี่หนึ่ง',
   'pending_review', 'returned',
   'ตีกลับ: กรุณาขอใบยืนยันการชำระเงินลงลายมือชื่อจากคุณนิวเพื่อปิดยอดค้าง', '2026-07-26T09:00:00Z'),

  ('log-316', 'tsk-316', 'usr-moo', 'พี่หมู',   'usr-1',    'พี่หนึ่ง',
   'pending_review', 'approved',
   'อนุมัติปิดงาน: ตรวจสอบเอกสารยื่นข้อเสนอโครงการสายพานโซ่ บพข. เล่มเต็มเรียบร้อยแล้ว', '2026-07-24T14:00:00Z')
) as v(legacy_id, task_legacy, actor_legacy, actor_name, behalf_legacy, behalf_name,
       prev, new_status, comment, created_at)
on conflict (legacy_id) do nothing;

-- -----------------------------------------------------------------------------
-- Attachments
-- -----------------------------------------------------------------------------
insert into attachments (legacy_id, task_id, log_id, file_name, file_url, file_type, file_size, uploaded_by, uploaded_by_name, uploaded_at)
select v.legacy_id,
       (select id from tasks where legacy_id = v.task_legacy),
       (select id from task_logs where legacy_id = v.log_legacy),
       v.file_name, v.file_url, v.file_type, v.file_size,
       (select id from users where legacy_id = v.uploader_legacy), v.uploader_name, v.uploaded_at
from (values
  ('att-302-1', 'tsk-302', 'log-302', 'Steamer_Testing_Report_Line13.pdf', '#',
   'file'::attachment_file_type, 3400000::bigint, 'usr-1', 'พี่หนึ่ง', '2026-07-30T14:00:00Z'::timestamptz),
  ('att-322-1', 'tsk-322', null, 'Slitter_Blueprint_Layout.jpg',
   'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=800&auto=format&fit=crop&q=80',
   'image', 1800000, 'usr-1', 'พี่หนึ่ง', '2026-07-29T08:00:00Z')
) as v(legacy_id, task_legacy, log_legacy, file_name, file_url, file_type, file_size,
       uploader_legacy, uploader_name, uploaded_at)
on conflict (legacy_id) do nothing;

-- -----------------------------------------------------------------------------
-- Annotations (จุดมาร์กบนแปลน)
-- -----------------------------------------------------------------------------
insert into task_annotations (legacy_id, task_id, image_url, x, y, radius, comment, author_user_id, author_name, created_at)
select 'ann-1',
       (select id from tasks where legacy_id = 'tsk-322'),
       'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=800&auto=format&fit=crop&q=80',
       45, 38, 28,
       'ขยับระยะตำแหน่งมอเตอร์เกียร์ขึ้น 15mm เพื่อหลบสายพานโซ่',
       (select id from users where legacy_id = 'usr-moo'), 'พี่หมู', '2026-07-31T09:15:00Z'
on conflict (legacy_id) do nothing;

-- -----------------------------------------------------------------------------
-- Notifications
-- -----------------------------------------------------------------------------
insert into notifications (legacy_id, recipient_user_id, task_id, type, title, message, read, created_at)
select v.legacy_id,
       (select id from users where legacy_id = v.recipient_legacy),
       (select id from tasks where legacy_id = v.task_legacy),
       v.type, v.title, v.message, v.read, v.created_at
from (values
  ('notif-302', 'usr-1', 'tsk-302', 'status_change'::notification_type,
   'งานของคุณถูกส่งตรวจโดยผู้ทำแทน',
   'พี่ฟ้อง ได้ส่งตรวจงาน "2. ตู้นึ่งไลน์ 13 - ตรวจสอบและทดสอบการนึ่ง" แทนคุณเรียบร้อยแล้ว',
   false, '2026-07-30T14:00:00Z'::timestamptz),
  ('notif-317', 'usr-1', 'tsk-317', 'returned',
   'งานถูกตีกลับแก้ไข',
   'งาน "ติดตามยอดค้างชำระและตามงานใหม่ DKSH" ถูกตีกลับให้ขอหลักฐานใบยืนยัน',
   true, '2026-07-26T09:00:00Z')
) as v(legacy_id, recipient_legacy, task_legacy, type, title, message, read, created_at)
on conflict (legacy_id) do nothing;

-- -----------------------------------------------------------------------------
-- ตั้ง sequence รหัสงานให้ต่อจากเลขที่ใช้ไปแล้ว (NP-217)
-- -----------------------------------------------------------------------------
select setval('task_code_seq', greatest(400, (
  select coalesce(max(substring(code from 'NP-([0-9]+)$')::int), 0) + 1 from tasks
)));

commit;
