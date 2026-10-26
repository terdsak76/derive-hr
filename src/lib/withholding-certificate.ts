import type { CertificateAmounts } from './employee-tax-summary';

const escape = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
export const taxCompany = {
  name: 'บริษัท ดีไรฟ์ อินโนเวชั่น จำกัด',
  taxId: '0105556107148',
  address: '653/37 ถ.จรัญสนิทวงศ์ แขวงอรุณอมรินทร์ เขตบางกอกน้อย กรุงเทพมหานคร 10700',
};

export function renderWithholdingCertificate(input: {
  year: number; employee: { name: string; taxId: string; address: string }; amounts: CertificateAmounts; issuedAt?: Date;
}) {
  const { year, employee, amounts } = input;
  const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok' }).format(input.issuedAt ?? new Date()).split('-').map(Number);
  const total = amounts.salaryCents + amounts.incentiveCents + amounts.bonusCents + amounts.overtimeCents;
  const field = (x: number, y: number, width: number, value: unknown, extra = '') => `<span class="field" style="left:${x}pt;top:${y}pt;width:${width}pt;${extra}">${escape(value)}</span>`;
  const digits = (id: string, y: number) => [853, 892, 919, 946, 974, 1015, 1042, 1069, 1096, 1137, 1164, 1193, 1233]
    .map((x, i) => field(x * 595 / 1333 - 5, y, 10, id[i], 'text-align:center')).join('');
  const amount = (integerRight: number, y: number, cents: number, width = 63) => field(integerRight - width, y, width, Math.floor(cents / 100).toLocaleString('en-US'), 'text-align:right')
    + field(integerRight + 1, y, 14, String(cents % 100).padStart(2, '0'), 'text-align:center;font-size:9pt');
  const page = (copy: number) => `<section class="certificate">
    <img class="template" src="/tax/withholding-certificate-template.png" alt="แบบหนังสือรับรองการหักภาษี ณ ที่จ่าย" />
    <div class="copy">ฉบับที่ ${copy} (สำหรับผู้ถูกหักภาษี ณ ที่จ่าย ${copy === 1 ? 'ใช้แนบพร้อมกับแบบแสดงรายการภาษี' : 'เก็บไว้เป็นหลักฐาน'})</div>
    ${digits(taxCompany.taxId, 84)}${digits(employee.taxId, 153)}
    ${field(56, 103, 255, taxCompany.name)}${field(59, 127, 489, taxCompany.address, 'font-size:9pt')}
    ${field(56, 176, 255, employee.name)}${field(59, 202, 489, employee.address, 'font-size:9pt;white-space:normal;line-height:10pt;max-height:20pt')}
    ${field(210, 228, 10, '×', 'text-align:center')}
    ${field(330, 299, 70, `ปี ${year + 543}`, 'text-align:center')}
    ${amount(472, 299, total)}${amount(543, 299, 0, 45)}
    ${amount(472, 651, total)}${amount(543, 651, 0, 45)}
    ${field(185, 669, 366, 'ศูนย์บาทถ้วน', 'background:#ccc;text-align:center')}
    ${field(364, 690, 40, (amounts.socialSecurityCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 'text-align:right;font-size:8pt')}
    ${field(84, 710, 9, '×', 'text-align:center')}
    ${field(339, 758, 22, date[2], 'text-align:center')}${field(368, 758, 21, date[1], 'text-align:center')}${field(395, 758, 27, date[0] + 543, 'text-align:center')}
  </section>`;
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>หนังสือรับรองฯ ${escape(employee.name)} ${year + 543}</title>
    <style>@page{size:A4 portrait;margin:0}*{box-sizing:border-box}body{margin:0;background:#e2e8f0;color:#000;font:10pt Tahoma,Arial,sans-serif}.toolbar{padding:14px;text-align:center}.toolbar button{background:#2563eb;color:white;border:0;border-radius:6px;padding:10px 22px;cursor:pointer}.certificate{position:relative;width:210mm;height:297mm;margin:10px auto;background:white;overflow:hidden;break-after:page}.certificate:last-child{break-after:auto}.template{position:absolute;inset:0;width:100%;height:100%}.field{position:absolute;background:white;line-height:13pt;white-space:nowrap;overflow:hidden}.copy{position:absolute;left:28pt;top:0;width:545pt;height:43pt;background:white;padding-top:20pt;font-size:9pt}.error{color:#b91c1c}@media print{body{background:white}.toolbar{display:none}.certificate{margin:0;print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style>
    </head><body><div class="toolbar"><button id="print" disabled>กำลังโหลดแบบฟอร์ม…</button><p>ตรวจสอบยอดแล้ว · ภาษีหัก ณ ที่จ่าย 0.00 บาท · เว้นช่องลงลายมือชื่อสำหรับผู้มีอำนาจ</p><p id="error" class="error"></p></div>${page(1)}${page(2)}
    <script>const button=document.getElementById('print');Promise.all([document.fonts.ready,...Array.from(document.images).map(image=>image.decode())]).then(()=>{for(const field of document.querySelectorAll('.field')){let size=parseFloat(getComputedStyle(field).fontSize);while((field.scrollWidth>field.clientWidth||field.scrollHeight>field.clientHeight)&&size>8){size-=0.25;field.style.fontSize=size+'px';}if(field.scrollWidth>field.clientWidth||field.scrollHeight>field.clientHeight)throw new Error('overflow');}button.disabled=false;button.textContent='พิมพ์ / บันทึก PDF';button.onclick=()=>window.print();}).catch(error=>{document.getElementById('error').textContent=error.message==='overflow'?'ข้อมูลยาวเกินช่องแบบฟอร์ม กรุณาปรับชื่อหรือที่อยู่ก่อนพิมพ์':'โหลดแบบฟอร์มไม่สำเร็จ กรุณาลองใหม่';});</script></body></html>`;
}
