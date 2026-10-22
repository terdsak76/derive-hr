type InvoiceDetails = {
  name: string;
  address: string;
  tax_id: string;
  product: string;
  service: string;
  description: string;
  period: string;
  amount: number;
};

const escapeHtml = (value: unknown): string => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
const money = (value: number): string => new Intl.NumberFormat('th-TH', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(value);

export function getInvoiceAmounts(amount: number) {
  const subtotal = Math.round((Number(amount) || 0) * 100);
  const vat = Math.round(subtotal * 7 / 100);
  const withholding = Math.round(subtotal * 3 / 100);
  return {
    subtotal: subtotal / 100,
    vat: vat / 100,
    total: (subtotal + vat) / 100,
    withholding: withholding / 100,
    net: (subtotal + vat - withholding) / 100,
  };
}

/** Customer invoice layout based on the supplied DeRIVE Excel workbook. */
export function renderInvoiceHtml({ invoice, invoiceNumber, issueDate, amountWords, assetBaseUrl }: {
  invoice: InvoiceDetails;
  invoiceNumber: string;
  issueDate: string;
  amountWords: string;
  assetBaseUrl: string;
}): string {
  const amounts = getInvoiceAmounts(invoice.amount);
  const quantity = invoice.period === 'year' ? '1 ปี' : invoice.period === 'quarter' ? '1 ไตรมาส' : '1 เดือน';
  const asset = (name: string) => escapeHtml(`${assetBaseUrl}/${name}`);
  const page = (copy: string) => `
    <main class="invoice">
      <header>
        <div class="heading"><img class="logo" src="${asset('image1.jpeg')}" alt="DeRIVE Innovation Company Limited" /><h1>ใบแจ้งหนี้</h1></div>
        <div class="issuer-row"><strong>บริษัท ดีไรฟ์ อินโนเวชั่น จำกัด</strong><span>${copy}</span></div>
        <p>653/37 ถ.จรัญสนิทวงศ์ แขวงอรุณอมรินทร์ เขตบางกอกน้อย กรุงเทพมหานคร 10700</p>
        <p>Tax ID: 0105556107148 สำนักงานใหญ่ (061-5202649)</p>
      </header>
      <section class="customer">
        <div class="customer-row"><div>Attention:</div><div class="meta"><strong>เลขที่/ No. :</strong><span>${escapeHtml(invoiceNumber)}</span></div></div>
        <div class="customer-row"><div>Company: <span class="customer-name">${escapeHtml(invoice.name)}</span></div><div class="meta"><strong>วันที่ Date :</strong><span>${escapeHtml(issueDate)}</span></div></div>
        <p class="address">${escapeHtml(invoice.address)}</p>
        <p class="customer-tax">เลขประจำตัวผู้เสียภาษี : ${escapeHtml(invoice.tax_id)}</p>
      </section>
      <table class="items">
        <colgroup><col style="width:6%" /><col style="width:48%" /><col style="width:10%" /><col style="width:15%" /><col style="width:21%" /></colgroup>
        <thead><tr><th>ลำดับที่<span>ITEM</span></th><th>รายการ<span>DESCRIPTION</span></th><th>ราคา/หน่วย<span>Price/Unit</span></th><th>จำนวน<span>Quantity</span></th><th>จำนวนเงิน<span>Amount</span></th></tr></thead>
        <tbody>
          <tr class="line-item"><td class="center">1</td><td class="description">${escapeHtml(invoice.description)}</td><td class="money">${money(amounts.subtotal)}</td><td class="center">${quantity}</td><td class="money">${money(amounts.subtotal)}</td></tr>
        </tbody>
        <tfoot>
          <tr><td colspan="3" class="words"></td><td class="summary-label">รวมเงิน</td><td class="money">${money(amounts.subtotal)}</td></tr>
          <tr><td colspan="3" class="words"></td><td class="summary-label">ภาษีมูลค่าเพิ่ม 7%</td><td class="money">${money(amounts.vat)}</td></tr>
          <tr class="grand-total"><td colspan="3" class="words">( &nbsp; ***${escapeHtml(amountWords)}*** &nbsp; )</td><td class="summary-label">รวมทั้งสิ้น</td><td class="money">${money(amounts.total)}</td></tr>
        </tfoot>
      </table>
      <section class="withholding">
        <p>หมายเหตุ: ยอดเงินหน้าเช็ค หรือ รับเงินสด หลังหักภาษี ณ ที่จ่าย 3%</p>
        <p class="balance"><span>คงเหลือยอดเงิน</span><strong>${money(amounts.net)}</strong><span>บาท</span></p>
      </section>
      <section class="payment">
        <strong>วิธีการชำระเงิน</strong>
        <p>1. ฝากเข้าบัญชีธนาคาร : ชื่อบัญชี บริษัท ดีไรฟ์ อินโนเวชั่น จำกัด เลขที่ 016-8-53748-4 ธนาคาร กสิกรไทย สาขา วรจักร</p>
        <p>2. เช็คสั่งจ่าย “บริษัท ดีไรฟ์ อินโนเวชั่น จำกัด” โดยขีดคร่อมเช็ค และขีดฆ่า “หรือผู้ถือ”</p>
      </section>
      <footer>
        <section class="signature-block">
          <div class="signing-row"><span>ผู้รับใบแจ้งหนี้ :</span><span class="signature-space"></span></div>
          <p class="signer-name">( &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; )</p>
          <p class="signature-detail"><span>ตำแหน่ง</span><span class="blank"></span></p>
          <p class="signature-detail"><span>วันที่</span><span class="blank"></span></p>
        </section>
        <section class="signature-block approver">
          <div class="signing-row"><span>ผู้อนุมัติ :</span><img class="signature-image" src="${asset('image2.png')}" alt="ลายเซ็นผู้อนุมัติตามแบบฟอร์ม" /></div>
          <p class="signer-name">( นางสาวกัลยรัตน์ &nbsp; ฉัตรทันใจ )</p>
          <p class="signature-detail"><span>ตำแหน่ง</span><span>ผู้ประสานงานโครงการ</span></p>
          <p class="signature-detail"><span>วันที่</span><span>${escapeHtml(issueDate)}</span></p>
          <img class="company-stamp" src="${asset('image3.png')}" alt="ตราบริษัท DeRIVE" />
        </section>
      </footer>
    </main>`;

  return `<!doctype html>
  <html lang="th"><head><meta charset="utf-8" /><title>${escapeHtml(invoiceNumber)}</title>
    <style>
      @page { size: A4 portrait; margin: 8mm 4mm; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #000; background: #fff; font: 13px Tahoma, Arial, sans-serif; line-height: 1.6; }
      .invoice { width: 100%; max-width: 202mm; margin: 0 auto; padding-bottom: 2mm; }
      .invoice + .invoice { break-before: page; page-break-before: always; }
      .heading { display: flex; align-items: flex-start; justify-content: space-between; height: 17mm; }
      .logo { width: 52mm; height: auto; }
      h1 { margin: 0; font-size: 26px; font-weight: 700; font-style: italic; }
      .issuer-row { display: flex; justify-content: space-between; align-items: center; font-size: 14px; min-height: 8mm; }
      p { margin: 0; }
      header p { min-height: 7mm; font-size: 12px; }
      header { border-bottom: 2px solid #000; }
      .customer { padding: 1mm 0 0; border-bottom: 1px solid #000; }
      .customer-row { display: grid; grid-template-columns: 64% 36%; min-height: 9mm; align-items: center; }
      .customer-row > div { min-width: 0; overflow-wrap: anywhere; }
      .customer-name { margin-left: 4px; }
      .meta { display: grid; grid-template-columns: 42% 58%; gap: 2mm; }
      .meta strong { font-size: 12px; }
      .address { white-space: pre-line; min-height: 9mm; padding-left: 10mm; }
      .customer-tax { min-height: 10mm; padding-left: 10mm; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 4mm; }
      th, td { border-left: 1px solid #000; border-right: 1px solid #000; padding: 1.5mm 1mm; overflow-wrap: anywhere; }
      thead th { background: #17365d; color: #fff; height: 16mm; border-top: 1px solid #000; border-bottom: 1px solid #000; font-size: 12px; text-align: center; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      th span { display: block; margin-top: 3mm; font-weight: 400; }
      .line-item td { height: 14mm; vertical-align: top; border-bottom: 1px solid #000; }
      .description { white-space: pre-line; }
      .money { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
      .center { text-align: center; }
      tfoot td { height: 7mm; border-bottom: 1px solid #000; }
      .summary-label { text-align: center; font-size: 12px; white-space: nowrap; }
      .grand-total { font-weight: 700; }
      .words { text-align: center; border-bottom: 0; }
      .grand-total .words { border-bottom: 1px solid #000; }
      .withholding { padding: 4mm 0 0 12mm; }
      .balance { display: flex; gap: 8mm; align-items: baseline; padding: 1mm 0; }
      .balance strong { min-width: 27mm; text-align: right; }
      .payment { line-height: 2; margin-top: 1mm; }
      .payment > strong { display: block; font-size: 14px; }
      .payment p { font-size: 12px; }
      footer { display: grid; grid-template-columns: 1fr 1fr; gap: 12mm; padding: 3mm 0 0 12mm; break-inside: avoid; }
      .signing-row { display: flex; align-items: center; justify-content: space-between; min-height: 13mm; }
      .signature-space { display: inline-block; width: 44mm; border-bottom: 1px dotted #000; margin-top: 5mm; }
      .signature-image { width: 25mm; height: 11mm; object-fit: contain; margin-right: 13mm; }
      .signer-name { text-align: right; padding-right: 3mm; min-height: 7mm; }
      .signature-detail { display: grid; grid-template-columns: 18mm 1fr; align-items: baseline; min-height: 9mm; }
      .signature-detail > :last-child { text-align: center; }
      .blank { border-bottom: 1px dotted #000; }
      .company-stamp { display: block; width: 48mm; height: auto; margin: 0 auto; }
      @media screen { body { padding: 8mm 4mm; background: #eee; } .invoice { background: #fff; padding: 4mm; margin-bottom: 8mm; } }
      @media print { .invoice { break-inside: avoid; } }
    </style></head><body>${page('(ต้นฉบับ)')}${page('(สำเนา)')}
    <script>
      window.addEventListener('load', async function () {
        await document.fonts.ready;
        await Promise.all(Array.from(document.images, image => image.decode().catch(() => {})));
        window.focus();
        window.print();
      });
    </script>
  </body></html>`;
}
