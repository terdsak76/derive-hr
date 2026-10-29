import { utils, write } from 'xlsx';

export type EmployeeSummaryRow = {
  id: string;
  name: string;
  email: string;
  department: string;
  leaveDays: number;
  lateCount: number;
  workdayChangeCount: number;
  travelExpenses: number;
  overtimeHours: number;
  overtimePay: number;
};

export function createEmployeeSummaryXls(rows: EmployeeSummaryRow[], year: number, month: number): ArrayBuffer {
  const period = `${year}-${String(month).padStart(2, '0')}`;
  const sheet = utils.aoa_to_sheet([
    ['สรุปข้อมูลรายเดือนของพนักงาน', period],
    [],
    ['รหัสพนักงาน', 'พนักงาน', 'อีเมล', 'แผนก', 'วันลา', 'มาสาย (ครั้ง)', 'แลกวันทำงาน (คำขอ)', 'ค่าเดินทาง (บาท)', 'OT (ชั่วโมง)', 'ค่าล่วงเวลา (บาท)'],
    ...rows.map(row => [row.id, row.name, row.email, row.department, row.leaveDays, row.lateCount,
      row.workdayChangeCount, row.travelExpenses, row.overtimeHours, row.overtimePay]),
  ]);
  sheet['!cols'] = [22, 30, 35, 24, 12, 18, 26, 22, 18, 24].map(wch => ({ wch }));
  sheet['!autofilter'] = { ref: `A3:J${rows.length + 3}` };
  rows.forEach((_, index) => {
    for (const column of ['E', 'H', 'I', 'J']) sheet[`${column}${index + 4}`].z = '#,##0.00';
  });
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, sheet, `Summary ${period}`);
  // BIFF8 preserves Thai text and numeric cells in a genuine Excel 97–2003 file.
  return new Uint8Array(write(workbook, { bookType: 'biff8', type: 'array' })).buffer;
}
