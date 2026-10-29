import assert from 'node:assert/strict';
import { test } from 'node:test';
import { read, utils } from 'xlsx';
import { createEmployeeSummaryXls } from '../src/lib/employee-summary-export';

test('XLS preserves Thai text, literal formula-like names, decimals and selected period', () => {
  const bytes = createEmployeeSummaryXls([{
    id: '001', name: '=1+1', email: 'employee@example.com', department: 'วิศวกรรม',
    leaveDays: 0.5, lateCount: 2, workdayChangeCount: 1,
    travelExpenses: 1234.5, overtimeHours: 1.75, overtimePay: 625.25,
  }], 2026, 2);
  assert.deepEqual([...new Uint8Array(bytes).slice(0, 8)], [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  const workbook = read(bytes, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  assert.equal(sheet.A1.v, 'สรุปข้อมูลรายเดือนของพนักงาน');
  assert.equal(sheet.B1.v, '2026-02');
  assert.equal(sheet.A4.v, '001');
  assert.equal(sheet.B4.v, '=1+1');
  assert.equal(sheet.B4.t, 's');
  assert.equal(sheet.B4.f, undefined);
  assert.equal(sheet.D4.v, 'วิศวกรรม');
  for (const [column, value] of Object.entries({ E: 0.5, F: 2, G: 1, H: 1234.5, I: 1.75, J: 625.25 })) {
    assert.equal(sheet[`${column}4`].t, 'n');
    assert.equal(sheet[`${column}4`].v, value);
  }
});

test('empty summaries produce a valid XLS with period and headers', () => {
  const workbook = read(createEmployeeSummaryXls([], 2026, 10), { type: 'array' });
  const rows = utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], ['สรุปข้อมูลรายเดือนของพนักงาน', '2026-10']);
});
