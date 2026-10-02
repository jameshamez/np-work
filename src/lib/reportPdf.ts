/**
 * บันทึกรายงานผู้บริหารเป็นไฟล์ PDF โดยตรง (ไม่พึ่งหน้าต่างพิมพ์ของเบราว์เซอร์)
 * window.print() ใช้ไม่ได้ในเบราว์เซอร์บางตัว เช่น มือถือ และเบราว์เซอร์ในแอป LINE
 *
 * วาดหน้ารายงาน (.np-report-sheet) ทีละหน้าเป็นภาพ แล้ววางลงกระดาษ A4
 * หน้าที่ยาวเกิน A4 (เช่น ตารางโครงการยาว) จะถูกตัดต่อหน้าถัดไป
 */
const A4_W_MM = 210;
const A4_H_MM = 297;
const SHEET_W_PX = 1588; // ความละเอียดขั้นต่ำ (px) ของภาพหนึ่งหน้า ให้ตัวหนังสือคมเมื่อพิมพ์

export async function downloadReportPdf(sheets: HTMLElement[], fileName: string): Promise<void> {
  // โหลดไลบรารีเฉพาะตอนกดบันทึก ไม่ให้ถ่วงการเปิดแอป
  const [{ toPng, getFontEmbedCSS }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
  await document.fonts.ready;
  // ฝังฟอนต์ Sarabun ครั้งเดียวแล้วใช้ซ้ำทุกหน้า (ไม่ต้องอ่านฟอนต์ใหม่ทุกหน้า)
  const fontEmbedCSS = sheets.length > 0 ? await getFontEmbedCSS(sheets[0]) : '';

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  let first = true;

  for (const [index, sheet] of sheets.entries()) {
    // วาดตามขนาดจริงบนจอ แล้วย่อ/ขยายให้เต็มความกว้าง A4 — ความสูงจึงไม่เพี้ยนแม้เปิดบนมือถือ
    const width = sheet.offsetWidth;
    const height = sheet.scrollHeight;
    const dataUrl = await toPng(sheet, {
      pixelRatio: Math.max(2, SHEET_W_PX / width),
      backgroundColor: '#ffffff',
      width,
      height,
      style: { margin: '0', boxShadow: 'none' },
      fontEmbedCSS,
    });

    const imgHeightMm = (height * A4_W_MM) / width;

    // เกิน A4 นิดเดียว (ไม่เกิน 3%) — ย่อลงให้พอดีหน้าเดียว ไม่ต้องมีหน้าเกือบว่างต่อท้าย
    if (imgHeightMm <= A4_H_MM * 1.03) {
      if (!first) pdf.addPage('a4', 'portrait');
      first = false;
      const h = Math.min(imgHeightMm, A4_H_MM);
      const w = (A4_W_MM * h) / imgHeightMm;
      pdf.addImage(dataUrl, 'PNG', (A4_W_MM - w) / 2, 0, w, h, `sheet-${index}`, 'FAST');
      continue;
    }

    // ยาวกว่านั้น (เช่น ตารางโครงการยาว) ตัดเป็นช่วงละหนึ่งหน้า A4
    for (let offset = 0; offset < imgHeightMm; offset += A4_H_MM) {
      if (!first) pdf.addPage('a4', 'portrait');
      first = false;
      // alias เดียวกันทุกส่วนของหน้าเดียวกัน — ฝังภาพลงไฟล์ครั้งเดียว
      pdf.addImage(dataUrl, 'PNG', 0, -offset, A4_W_MM, imgHeightMm, `sheet-${index}`, 'FAST');
    }
  }

  pdf.save(fileName);
}
