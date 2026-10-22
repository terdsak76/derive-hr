import assert from 'node:assert/strict';
import test from 'node:test';
import { getInvoiceAmounts, renderInvoiceHtml } from '../src/lib/invoice-template';

const details = {
  name: 'บริษัท ที ดับเบิ้ลยู เอส โซลูชั่นส์ จำกัด',
  address: '71 หมู่ 3 ถนนตัดใหม่ ต.บ้านใหม่ อ.ปากเกร็ด จ.นนทบุรี 11120',
  tax_id: '0125559009490', product: 'TMS (VaRP) BP', service: 'MA',
  description: 'ค่าใช้งานโปรแกรม VaRP ไม่รวมค่า Implement ประจำเดือนมิถุนายน 69',
  period: 'month', amount: 15000,
};
const options = {
  invoice: details, invoiceNumber: 'INV-2026/026', issueDate: '23 มิถุนายน 2569',
  amountWords: 'หนึ่งหมื่นหกพันห้าสิบบาทถ้วน', assetBaseUrl: 'https://example.test/invoice',
};

test('totals match the workbook, withholding on the pre-VAT amount', () => {
  assert.deepEqual(getInvoiceAmounts(15000), {
    subtotal: 15000, vat: 1050, total: 16050, withholding: 450, net: 15600,
  });
  assert.deepEqual(getInvoiceAmounts(100.05), {
    subtotal: 100.05, vat: 7, total: 107.05, withholding: 3, net: 104.05,
  });
});

test('prints original and copy with workbook payment details and amounts', () => {
  const html = renderInvoiceHtml(options);
  assert.equal((html.match(/<main class="invoice">/g) || []).length, 2);
  assert.equal(html.split(details.description).length - 1, 2);
  assert.ok(!html.includes('เรียกเก็บค่าบริการ:'));
  assert.ok(!html.includes(`${details.product} — ${details.service}`));
  for (const text of ['(ต้นฉบับ)', '(สำเนา)', '15,000.00', '1,050.00', '16,050.00', '15,600.00',
    '016-8-53748-4', '1 เดือน', details.description, options.invoiceNumber, options.issueDate,
    'image1.jpeg', 'image2.png', 'image3.png', options.amountWords]) {
    assert.ok(html.includes(text), `Missing ${text}`);
  }
});

test('quantity follows the billing period', () => {
  for (const [period, quantity] of [['month', '1 เดือน'], ['quarter', '1 ไตรมาส'], ['year', '1 ปี']]) {
    assert.ok(renderInvoiceHtml({ ...options, invoice: { ...details, period } }).includes(quantity));
  }
});

test('escapes customer data and document metadata in the print window', () => {
  const html = renderInvoiceHtml({
    ...options, invoiceNumber: '<script>bad()</script>',
    invoice: { ...details, name: '<img src=x onerror=bad()>', description: 'A & B < C' },
  });
  assert.ok(!html.includes('<script>bad()'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;img src=x onerror=bad()&gt;'));
  assert.ok(html.includes('A &amp; B &lt; C'));
});
