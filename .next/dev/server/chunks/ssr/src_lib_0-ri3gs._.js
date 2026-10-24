module.exports = [
"[project]/src/lib/finance.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/** Calendar boundaries shared by incentives and company reporting. */ __turbopack_context__.s([
    "amountToCents",
    ()=>amountToCents,
    "combineFinanceReports",
    ()=>combineFinanceReports,
    "isInvoiceScheduled",
    ()=>isInvoiceScheduled,
    "parseFinanceMonth",
    ()=>parseFinanceMonth
]);
function parseFinanceMonth(value) {
    if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
    const [year, month] = value.split('-').map(Number);
    if (year < 2000 || year > 9998) return null;
    return {
        key: value,
        year,
        month,
        start: new Date(Date.UTC(year, month - 1, 1, -7)),
        end: new Date(Date.UTC(year, month, 1, -7))
    };
}
function isInvoiceScheduled(period, issueMonth, month) {
    if (period === 'month') return true;
    if (!issueMonth) return false;
    if (period === 'year') return issueMonth === month;
    return period === 'quarter' && (month - issueMonth + 12) % 3 === 0;
}
function amountToCents(value) {
    return Math.round((value + Number.EPSILON) * 100);
}
function combineFinanceReports(reports, period) {
    const sum = (values)=>values.reduce((total, amount)=>total + amountToCents(amount), 0) / 100;
    const employees = new Map();
    for (const report of reports)for (const employee of report.employees){
        const previous = employees.get(employee.id);
        employees.set(employee.id, previous ? {
            ...employee,
            salary: previous.salary === null || employee.salary === null ? null : sum([
                previous.salary,
                employee.salary
            ]),
            onsite: sum([
                previous.onsite,
                employee.onsite
            ]),
            overtime: sum([
                previous.overtime,
                employee.overtime
            ]),
            incentive: sum([
                previous.incentive,
                employee.incentive
            ]),
            total: sum([
                previous.total,
                employee.total
            ]),
            socialSecurity: sum([
                previous.socialSecurity,
                employee.socialSecurity
            ])
        } : {
            ...employee
        });
    }
    return {
        month: period,
        incomeBasis: reports[0].incomeBasis,
        expenses: {
            salary: sum(reports.map((report)=>report.expenses.salary)),
            onsite: sum(reports.map((report)=>report.expenses.onsite)),
            overtime: sum(reports.map((report)=>report.expenses.overtime)),
            incentive: sum(reports.map((report)=>report.expenses.incentive)),
            socialSecurity: sum(reports.map((report)=>report.expenses.socialSecurity)),
            purchases: sum(reports.map((report)=>report.expenses.purchases)),
            total: sum(reports.map((report)=>report.expenses.total))
        },
        income: {
            recurring: sum(reports.map((report)=>report.income.recurring)),
            project: sum(reports.map((report)=>report.income.project)),
            total: sum(reports.map((report)=>report.income.total))
        },
        profit: sum(reports.map((report)=>report.profit)),
        employees: Array.from(employees.values()),
        incomeItems: reports.flatMap((report)=>report.incomeItems),
        monthly: reports.map(({ month, expenses, income, profit })=>({
                month,
                expenses,
                income,
                profit
            }))
    };
}
}),
"[project]/src/lib/incentives.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Store baht as integer satang and round the calculated monthly payment once.
__turbopack_context__.s([
    "calculateIncentiveCents",
    ()=>calculateIncentiveCents
]);
function calculateIncentiveCents(fullIncentiveCents, score) {
    return Math.round(fullIncentiveCents * score / 100);
}
}),
"[project]/src/lib/invoice-template.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getInvoiceAmounts",
    ()=>getInvoiceAmounts,
    "renderInvoiceHtml",
    ()=>renderInvoiceHtml
]);
const escapeHtml = (value)=>String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
const money = (value)=>new Intl.NumberFormat('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
function getInvoiceAmounts(amount) {
    const subtotal = Math.round((Number(amount) || 0) * 100);
    const vat = Math.round(subtotal * 7 / 100);
    const withholding = Math.round(subtotal * 3 / 100);
    return {
        subtotal: subtotal / 100,
        vat: vat / 100,
        total: (subtotal + vat) / 100,
        withholding: withholding / 100,
        net: (subtotal + vat - withholding) / 100
    };
}
function renderInvoiceHtml({ invoice, invoiceNumber, issueDate, amountWords, assetBaseUrl }) {
    const amounts = getInvoiceAmounts(invoice.amount);
    const quantity = invoice.period === 'year' ? '1 ปี' : invoice.period === 'quarter' ? '1 ไตรมาส' : '1 เดือน';
    const asset = (name)=>escapeHtml(`${assetBaseUrl}/${name}`);
    const page = (copy)=>`
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
}),
"[project]/src/lib/kbiz-matching.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "kbizMatch",
    ()=>kbizMatch
]);
const normalize = (text)=>text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const generic = new Set([
    'company',
    'limited',
    'co',
    'ltd',
    'comp',
    'corporation',
    'บริษัท',
    'จำกัด',
    'บจก',
    'มหาชน',
    'the',
    'service',
    'services',
    'payment',
    'invoice'
]);
function kbizMatch(row, invoice) {
    if (invoice.status === 'INITIAL' || !row.depositCents) return {
        score: 0,
        reasons: []
    };
    const text = normalize(`${row.bankDescription} ${row.details}`);
    const reasons = [];
    let score = 0;
    const number = normalize(invoice.invoiceNumber);
    if (number.length >= 6 && text.includes(number)) {
        score += 100;
        reasons.push('เลขเอกสารตรงกัน');
    }
    const customer = normalize(invoice.customer.replace(/บริษัท|จำกัด|บจก\.?|มหาชน|company|limited|\bltd\b|\bco\b/gi, ''));
    const tokens = invoice.customer.split(/[\s.,()]+/).map(normalize).filter((token)=>token.length >= 3 && !generic.has(token));
    if (customer.length >= 4 && text.includes(customer) || tokens.some((token)=>text.includes(token))) {
        score += 40;
        reasons.push('ชื่อลูกค้าตรงกับรายละเอียดธนาคาร');
    }
    const code = normalize(invoice.customerCode || '');
    const bankWords = (row.details.match(/[a-z]{3,12}/gi) || []).map(normalize);
    if (code.length >= 3 && bankWords.includes(code)) {
        score += 35;
        reasons.push('รหัสลูกค้าตรงกัน');
    } else if (/^[a-z]{4,6}$/.test(code) && bankWords.some((word)=>word.length === code.length - 1 && Array.from(code).some((_, index)=>code.slice(0, index) + code.slice(index + 1) === word))) {
        score += 25;
        reasons.push('ชื่อย่อใกล้เคียงรหัสลูกค้า (ตรวจสอบ)');
    }
    const description = normalize(invoice.description);
    if (description.length >= 8 && text.includes(description)) {
        score += 30;
        reasons.push('คำอธิบายตรงกัน');
    }
    const remainingNet = invoice.netCents - invoice.allocatedCents;
    const remainingGross = invoice.grossCents - invoice.allocatedCents;
    if (remainingNet > 0 && remainingNet === row.depositCents) {
        score += 20;
        reasons.push('ยอดสุทธิหลังหัก 3% ตรงกัน');
    } else if (remainingGross > 0 && remainingGross === row.depositCents) {
        score += 20;
        reasons.push('ยอดรวม VAT ตรงกัน');
    }
    return {
        score,
        reasons
    };
}
}),
"[project]/src/lib/kbiz.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "kbizReconciliationStatus",
    ()=>kbizReconciliationStatus,
    "parseKbizCsv",
    ()=>parseKbizCsv
]);
function kbizReconciliationStatus(row) {
    const total = row.depositCents ? row.allocations.reduce((sum, item)=>sum + item.amountCents, 0) : row.vendorAllocations.reduce((sum, item)=>sum + item.amountCents, 0) + row.employeeAllocations.reduce((sum, item)=>sum + item.amountCents, 0) + row.taxAllocations.reduce((sum, item)=>sum + item.amountCents, 0);
    if (total) return total === (row.depositCents || row.withdrawalCents) ? 'COMPLETED' : 'PARTIAL';
    if (row.withdrawalCents && row.expenseKind === 'OTHER' && row.expenseDescription.trim()) return 'COMPLETED';
    return 'INITIAL';
}
/** RFC 4180 fields, including the quoted multiline account name in K BIZ exports. */ function csvRows(text) {
    const rows = [];
    let row = [], field = '', quoted = false;
    for(let i = 0; i < text.length; i++){
        const char = text[i];
        if (char === '"') {
            if (quoted && text[i + 1] === '"') {
                field += '"';
                i++;
            } else if (!quoted && field !== '') throw new Error('Invalid CSV quoting');
            else quoted = !quoted;
        } else if (!quoted && (char === ',' || char === '\n' || char === '\r')) {
            row.push(field.trim());
            field = '';
            if (char !== ',') {
                if (char === '\r' && text[i + 1] === '\n') i++;
                rows.push(row);
                row = [];
            }
        } else field += char;
    }
    if (quoted) throw new Error('Unclosed CSV quote');
    if (field || row.length) {
        row.push(field.trim());
        rows.push(row);
    }
    return rows;
}
function cents(text, required = false) {
    if (!text && !required) return 0;
    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text)) throw new Error('Invalid bank amount');
    const result = Math.round(Number(text.replaceAll(',', '')) * 100);
    if (!Number.isSafeInteger(result) || result > 2_147_483_647) throw new Error('Bank amount is too large');
    return result;
}
function parseKbizCsv(text) {
    const rows = csvRows(text.replace(/^\uFEFF/, ''));
    const header = rows.findIndex((row)=>row[1] === 'วันที่' && row[4] === 'ถอนเงิน' && row[6] === 'ฝากเงิน' && row[8] === 'ยอดคงเหลือ');
    const accountNumber = rows.flat().find((cell)=>/^\d{3}-\d-\d{5}-\d$/.test(cell));
    if (header < 0 || !accountNumber) throw new Error('Please select a K BIZ detailed savings statement CSV');
    const result = [];
    let previousBalance;
    for (const row of rows.slice(header + 1)){
        if (row.every((cell)=>!cell)) continue;
        const match = /^(\d{2})-(\d{2})-(\d{2}|\d{4})$/.exec(row[1] || '');
        if (!match) throw new Error('Invalid transaction date in statement');
        const [, day, month, rawYear] = match;
        const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
        const date = `${year}-${month}-${day}`;
        if (new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error('Invalid transaction date');
        const withdrawalCents = cents(row[4] || ''), depositCents = cents(row[6] || ''), balanceCents = cents(row[8] || '', true);
        if (row[3] === 'ยอดยกมา' && !withdrawalCents && !depositCents) {
            previousBalance = balanceCents;
            continue;
        }
        if (withdrawalCents > 0 === depositCents > 0) throw new Error('A transaction must have either a deposit or a withdrawal');
        if (previousBalance !== undefined && previousBalance + depositCents - withdrawalCents !== balanceCents) throw new Error('Statement running balance does not match');
        previousBalance = balanceCents;
        result.push({
            accountNumber,
            transactionDate: date,
            transactionTime: row[2] || '',
            bankDescription: row[3] || '',
            withdrawalCents,
            depositCents,
            balanceCents,
            channel: row[10] || '',
            details: row[12] || ''
        });
    }
    if (!result.length) throw new Error('No transactions found');
    const closing = rows.slice(0, header).find((row)=>row[7] === 'ยอดยกไป');
    if (closing && cents(closing[12], true) !== result[result.length - 1].balanceCents) throw new Error('Statement closing balance does not match');
    for (const [label, column] of [
        [
            'รวมถอนเงิน',
            'withdrawalCents'
        ],
        [
            'รวมฝากเงิน',
            'depositCents'
        ]
    ]){
        const summary = rows.slice(0, header).find((row)=>row[7] === label);
        const transactions = result.filter((row)=>row[column] > 0);
        if (summary && (Number(summary[9]) !== transactions.length || cents(summary[12], true) !== transactions.reduce((sum, row)=>sum + row[column], 0))) {
            throw new Error('Statement totals do not match transaction rows');
        }
    }
    return result;
}
}),
"[project]/src/lib/overtime.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BANGKOK_TIME_ZONE",
    ()=>BANGKOK_TIME_ZONE,
    "OT_MULTIPLIER_DENOMINATOR",
    ()=>OT_MULTIPLIER_DENOMINATOR,
    "OT_MULTIPLIER_NUMERATOR",
    ()=>OT_MULTIPLIER_NUMERATOR,
    "OT_WORKING_HOURS",
    ()=>OT_WORKING_HOURS,
    "calculateOvertime",
    ()=>calculateOvertime,
    "centsToAmount",
    ()=>centsToAmount,
    "formatBangkokDateTime",
    ()=>formatBangkokDateTime,
    "parseBangkokDateTime",
    ()=>parseBangkokDateTime
]);
const BANGKOK_TIME_ZONE = 'Asia/Bangkok';
const OT_WORKING_HOURS = 176;
const OT_MULTIPLIER_NUMERATOR = 3;
const OT_MULTIPLIER_DENOMINATOR = 2;
function parseBangkokDateTime(value) {
    if (typeof value !== 'string') return null;
    // datetime-local normally emits YYYY-MM-DDTHH:mm, but browsers may retain
    // a seconds component when a value is typed or restored from form state.
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
    if (!match) return null;
    const [, yearText, monthText, dayText, hourText, minuteText, secondText = '00'] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const hour = Number(hourText);
    const minute = Number(minuteText);
    const second = Number(secondText);
    if (month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
        return null;
    }
    // Bangkok is UTC+07:00. Construct UTC explicitly instead of relying on the
    // operating system timezone of the Next.js server.
    const date = new Date(Date.UTC(year, month - 1, day, hour - 7, minute, second));
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: BANGKOK_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).formatToParts(date);
    const actual = Object.fromEntries(parts.map((part)=>[
            part.type,
            part.value
        ]));
    if (actual.year !== yearText || actual.month !== monthText || actual.day !== dayText || actual.hour !== hourText || actual.minute !== minuteText || actual.second !== secondText) return null;
    return date;
}
function roundHalfUp(numerator, denominator) {
    return Math.floor((numerator * 2 + denominator) / (2 * denominator));
}
function calculateOvertime(salaryCents, startAt, endAt) {
    if (!Number.isSafeInteger(salaryCents) || salaryCents <= 0) return null;
    const durationMs = endAt.getTime() - startAt.getTime();
    if (durationMs <= 0 || durationMs % 60_000 !== 0) return null;
    const workedMinutes = durationMs / 60_000;
    // salary / 176 * 1.5 = salary * 3 / 352. Keep the rate rational until the
    // final monetary rounding so duration and salary are never binary floats.
    const rateDenominator = OT_WORKING_HOURS * OT_MULTIPLIER_DENOMINATOR;
    const rateNumerator = salaryCents * OT_MULTIPLIER_NUMERATOR;
    const hourlyRateCents = roundHalfUp(rateNumerator, rateDenominator);
    const otAmountCents = roundHalfUp(rateNumerator * workedMinutes, rateDenominator * 60);
    return {
        workedMinutes,
        hourlyRateCents,
        otAmountCents
    };
}
function formatBangkokDateTime(date) {
    return new Intl.DateTimeFormat('en-GB', {
        timeZone: BANGKOK_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(date).replace(',', '');
}
function centsToAmount(cents) {
    return cents / 100;
}
}),
"[project]/src/lib/request-approvals.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "approvalLabels",
    ()=>approvalLabels
]);
const approvalLabels = {
    LEAVE: 'การลา',
    WORKDAY_CHANGE: 'ขอเปลี่ยนวันทำงาน',
    OVERTIME: 'OT'
};
}),
"[project]/src/lib/taxes.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "parseTaxDate",
    ()=>parseTaxDate,
    "socialSecurityCents",
    ()=>socialSecurityCents,
    "taxDateText",
    ()=>taxDateText,
    "validTaxAmount",
    ()=>validTaxAmount,
    "vatAmounts",
    ()=>vatAmounts,
    "vatSettlement",
    ()=>vatSettlement
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$finance$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/finance.ts [app-ssr] (ecmascript)");
;
function socialSecurityCents(salaryCents, isOwner = false) {
    if (isOwner) return 0;
    return Math.min(87500, Math.round(Math.max(0, salaryCents || 0) * 5 / 100));
}
function vatAmounts(value, inclusive = false) {
    const cents = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$finance$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["amountToCents"])(value);
    const vatCents = inclusive ? Math.round(cents * 7 / 107) : Math.round(cents * 7 / 100);
    return {
        amountCents: inclusive ? cents - vatCents : cents,
        vatCents
    };
}
function parseTaxDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00+07:00`);
    return Number.isFinite(date.getTime()) && new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Bangkok'
    }).format(date) === value ? date : null;
}
const taxDateText = (date)=>new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Bangkok'
    }).format(date);
function validTaxAmount(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$finance$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["amountToCents"])(value) <= 2000000000 && Math.abs(value * 100 - Math.round(value * 100)) < 0.000001;
}
function vatSettlement(output, input, broughtForward, openingAdjustment, action) {
    const balance = output - input - broughtForward - openingAdjustment;
    const credit = Math.max(0, -balance);
    return {
        payable: Math.max(0, balance),
        carryForward: action === 'REFUND' ? 0 : credit,
        refundRequested: action === 'REFUND' ? credit : 0
    };
}
}),
"[project]/src/lib/vendor-payments.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "parseVendorPayment",
    ()=>parseVendorPayment,
    "renderVendorPaymentHtml",
    ()=>renderVendorPaymentHtml,
    "vendorPaymentMatch",
    ()=>vendorPaymentMatch
]);
function parseVendorPayment(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
    const value = body;
    if (typeof value.vendorName !== 'string' || !value.vendorName.trim() || value.vendorName.trim().length > 200 || typeof value.taxId !== 'string' || !value.taxId.trim() || value.taxId.trim().length > 30 || typeof value.description !== 'string' || value.description.length > 500 || ![
        'string',
        'number'
    ].includes(typeof value.amount) || !/^\d+(\.\d{1,2})?$/.test(String(value.amount)) || typeof value.paymentDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.paymentDate)) return null;
    const date = new Date(`${value.paymentDate}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value.paymentDate || Number(value.paymentDate.slice(0, 4)) < 2000) return null;
    const amountCents = Math.round(Number(value.amount) * 100);
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > 2_147_483_647) return null;
    return {
        vendorName: value.vendorName.trim(),
        taxId: value.taxId.trim(),
        description: value.description.trim(),
        paymentDate: value.paymentDate,
        amountCents
    };
}
const normalize = (text)=>text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
function vendorPaymentMatch(row, payment) {
    const reasons = [];
    let score = 0;
    if (!row.withdrawalCents || payment.status !== 'PRINTED') return {
        score,
        reasons
    };
    const text = normalize(`${row.bankDescription} ${row.details}`);
    if (text.includes(normalize(payment.paymentNumber))) {
        score += 100;
        reasons.push('เลขใบจ่ายตรงกัน');
    }
    const name = normalize(payment.vendorName.replace(/บริษัท|จำกัด|บจก\.?|มหาชน|company|limited|\bltd\b/gi, ''));
    if (name.length >= 4 && text.includes(name)) {
        score += 40;
        reasons.push('ชื่อ Vendor ตรงกัน');
    }
    const tax = normalize(payment.taxId);
    if (tax.length >= 6 && text.includes(tax)) {
        score += 40;
        reasons.push('Tax ID ตรงกัน');
    }
    if (payment.amountCents - payment.allocatedCents === row.withdrawalCents) {
        score += 20;
        reasons.push('ยอดเงินตรงกัน');
    }
    return {
        score,
        reasons
    };
}
function renderVendorPaymentHtml(payment) {
    const escape = (text)=>text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    const amount = new Intl.NumberFormat('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(payment.amountCents / 100);
    return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${escape(payment.paymentNumber)}</title><style>
    @page { size: A4; margin: 20mm; } body { font: 15px Tahoma, Arial, sans-serif; line-height: 1.8; color: #172033; }
    h1 { margin-bottom: 4px; } .meta { color: #475569; } table { width: 100%; border-collapse: collapse; margin: 28px 0; }
    td, th { border: 1px solid #cbd5e1; padding: 14px; text-align: left; } .amount { text-align: right; white-space: nowrap; }
    .description { white-space: pre-wrap; } footer { margin-top: 80px; display: flex; justify-content: space-between; }
    </style></head><body><h1>ใบสำคัญจ่าย / Payment Voucher</h1><p class="meta">${escape(payment.paymentNumber)} · วันที่ ${escape(payment.paymentDate)}</p>
    <p><strong>ผู้รับเงิน / Vendor:</strong> ${escape(payment.vendorName)}<br><strong>เลขประจำตัวผู้เสียภาษี / Tax ID:</strong> ${escape(payment.taxId)}</p>
    <table><thead><tr><th>รายการ / Description</th><th class="amount">ยอดชำระ (บาท) / THB</th></tr></thead><tbody><tr><td class="description">${escape(payment.description || 'Vendor payment')}</td><td class="amount">${amount}</td></tr></tbody></table>
    <footer><span>ผู้จัดทำ __________________</span><span>ผู้อนุมัติ __________________</span><span>ผู้รับเงิน __________________</span></footer></body></html>`;
}
}),
];

//# sourceMappingURL=src_lib_0-ri3gs._.js.map