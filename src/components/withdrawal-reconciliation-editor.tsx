'use client';

import { useState } from 'react';
import type { KbizEmployee, KbizRecord } from '@/lib/kbiz';
import type { VendorPaymentRecord } from '@/lib/vendor-payments';
import EmployeeWithdrawalEditor from './employee-withdrawal-editor';
import VendorWithdrawalEditor from './vendor-withdrawal-editor';
import RevenueTaxWithdrawalEditor from './revenue-tax-withdrawal-editor';
import type { RevenueTaxPaymentRecord } from '@/lib/revenue-tax-payments';

export default function WithdrawalReconciliationEditor({ row, payments, employees, taxPayments, onSave, onClose }: {
  row: KbizRecord; payments: VendorPaymentRecord[]; employees: KbizEmployee[];
  taxPayments: RevenueTaxPaymentRecord[];
  onSave: (data: object) => Promise<void>; onClose: () => void;
}) {
  const [mode, setMode] = useState(row.taxAllocations.length ? 'TAX' : row.expenseKind === 'EMPLOYEE' || row.employeeAllocations.length ? 'EMPLOYEE' : 'VENDOR');
  const [saving, setSaving] = useState(false);
  async function save(data: object) {
    setSaving(true);
    try { await onSave(data); } finally { setSaving(false); }
  }
  return <div className="space-y-3">
    <fieldset disabled={saving} className="flex flex-wrap gap-4 text-sm">
      <legend className="font-semibold mb-2">ประเภทการจับคู่รายจ่าย</legend>
      <label><input type="radio" name="withdrawal-match-type" checked={mode === 'VENDOR'} onChange={() => setMode('VENDOR')} /> Vendor / รายจ่ายอื่น</label>
      <label><input type="radio" name="withdrawal-match-type" checked={mode === 'EMPLOYEE'} onChange={() => setMode('EMPLOYEE')} /> พนักงาน / Payroll / Incentive</label>
      <label><input type="radio" name="withdrawal-match-type" checked={mode === 'TAX'} onChange={() => setMode('TAX')} /> กรมสรรพากร / Revenue Department</label>
    </fieldset>
    {((mode !== 'VENDOR' && row.vendorAllocations.length > 0) || (mode !== 'EMPLOYEE' && row.employeeAllocations.length > 0) || (mode !== 'TAX' && row.taxAllocations.length > 0)) &&
      <p className="text-sm text-amber-700">เมื่อบันทึก การจับคู่เดิมจะถูกแทนที่ด้วยประเภทที่เลือก</p>}
    {mode === 'TAX' ? <RevenueTaxWithdrawalEditor row={row} payments={taxPayments} onSave={save} onClose={onClose} /> :
      mode === 'EMPLOYEE' ? <EmployeeWithdrawalEditor row={row} employees={employees} onSave={data => save({ ...data, taxAllocations: [] })} onClose={onClose} /> :
      <VendorWithdrawalEditor row={row} payments={payments} onClose={onClose} onSave={data => save({ ...data, employeeAllocations: [], taxAllocations: [] })} />}
  </div>;
}
