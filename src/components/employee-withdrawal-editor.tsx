'use client';

import { useState } from 'react';
import type { KbizEmployee, KbizRecord } from '@/lib/kbiz';
import { employeePaymentTypes } from '@/lib/kbiz';

const money = (cents: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(cents / 100);
const inputClass = 'border border-slate-300 bg-white rounded-lg px-3 py-2 text-sm';
type Draft = { employeeId: string; employeeName: string; paymentType: string; paymentMonth: string; amount: string };

export default function EmployeeWithdrawalEditor({ row, employees, onSave, onClose }: {
  row: KbizRecord; employees: KbizEmployee[]; onSave: (data: object) => Promise<void>; onClose: () => void;
}) {
  const [drafts, setDrafts] = useState<Draft[]>(row.employeeAllocations.map(item => ({ ...item, amount: (item.amountCents / 100).toFixed(2) })));
  const [description, setDescription] = useState(row.expenseDescription);
  const [employeeId, setEmployeeId] = useState('');
  const [paymentType, setPaymentType] = useState('PAYROLL');
  const [paymentMonth, setPaymentMonth] = useState(row.transactionDate.slice(0, 7));
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const total = drafts.reduce((sum, item) => sum + Math.round(Number(item.amount) * 100), 0);
  const remaining = row.withdrawalCents - total;
  const pending = drafts.some(item => item.paymentType === 'PENDING');
  const duplicate = drafts.some(item => item.employeeId === employeeId && item.paymentType === paymentType && item.paymentMonth === paymentMonth);
  const available = employees.filter(employee => `${employee.name} ${employee.department}`.toLowerCase().includes(search.toLowerCase()));
  function update(index: number, amount: string) { setDrafts(items => items.map((item, i) => i === index ? { ...item, amount } : item)); }
  async function save() {
    if (pending) { setError('Select Salary, Incentive, Onsite or Others for each matched employee.'); return; }
    setSaving(true); setError('');
    try {
      await onSave({ id: row.id, expenseKind: 'EMPLOYEE', expenseDescription: description, vendorAllocations: [],
        employeeAllocations: drafts.map(item => ({ employeeId: item.employeeId, paymentType: item.paymentType, paymentMonth: item.paymentMonth, amountCents: Math.round(Number(item.amount) * 100) })),
      });
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save employee payments'); }
    finally { setSaving(false); }
  }
  return <section aria-label="Employee withdrawal reconciliation" className="bg-white rounded-xl border-2 border-indigo-200 p-5 space-y-4">
    <div className="flex justify-between gap-3"><div><h3 className="font-bold">จับคู่การจ่ายเงินพนักงาน / Employee payments</h3><p className="text-sm text-slate-500">{row.transactionDate} {row.transactionTime} · ถอน {money(row.withdrawalCents)} · {row.accountNumber}</p></div>
      <button type="button" disabled={saving} className={inputClass} onClick={onClose}>ปิด</button></div>
    <p className="text-sm">{row.bankDescription} · {row.details}</p>
    <fieldset disabled={saving} className="space-y-4">
      <p className="text-sm text-slate-500">เลือกพนักงาน ประเภทการจ่าย และเดือนที่จ่ายให้ จับคู่ยอดถอนครบแล้วจะเป็น COMPLETED ไม่ต้องสร้างใบจ่าย Vendor</p>
      {pending && <p role="status" className="text-sm text-amber-700">จับคู่ชื่อจากธนาคารอัตโนมัติแล้ว รอ Admin เลือก Salary / Incentive / Onsite / Others</p>}
      <label className="block text-sm">ค้นหาพนักงาน<input className={`${inputClass} block mt-1 w-full`} value={search} onChange={event => { setSearch(event.target.value); setEmployeeId(''); }} placeholder="ชื่อ / แผนก" /></label>
      <div className="grid sm:grid-cols-3 gap-3">
        <label className="text-sm">พนักงาน<select aria-label="Employee" className={`${inputClass} block mt-1 w-full`} value={employeeId} onChange={event => setEmployeeId(event.target.value)}><option value="">เลือกพนักงาน</option>{available.map(employee => <option key={employee.id} value={employee.id}>{employee.name} · {employee.department}</option>)}</select></label>
        <label className="text-sm">ประเภท<select aria-label="Employee payment type" className={`${inputClass} block mt-1 w-full`} value={paymentType} onChange={event => setPaymentType(event.target.value)}>{employeePaymentTypes.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
        <label className="text-sm">เดือนที่จ่ายให้<input aria-label="Employee payment month" type="month" className={`${inputClass} block mt-1 w-full`} value={paymentMonth} onChange={event => setPaymentMonth(event.target.value)} /></label>
      </div>
      <button type="button" disabled={!employeeId || !paymentMonth || duplicate || remaining <= 0} className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm disabled:opacity-50" onClick={() => {
        const employee = employees.find(item => item.id === employeeId); if (!employee || duplicate) return;
        setDrafts(items => [...items, { employeeId, employeeName: employee.name, paymentType, paymentMonth, amount: (Math.max(0, remaining) / 100).toFixed(2) }]);
      }}>เพิ่มพนักงาน / Add employee</button>
      {duplicate && <p className="text-xs text-amber-700">รายการนี้มีอยู่แล้ว กรุณาแก้ไขยอดเงินในรายการเดิม</p>}
      {drafts.map((draft, index) => <div key={index} className="flex flex-wrap gap-3 items-center border border-slate-200 rounded-lg p-3">
        <div className="flex-1 text-sm"><strong>{draft.employeeName}</strong><p className="text-xs text-slate-500">{draft.paymentMonth}</p></div>
        <label className="text-xs">ประเภท<select aria-label={`Payment type for ${draft.employeeName}`} className={`${inputClass} block mt-1`} value={draft.paymentType} onChange={event => setDrafts(items => items.map((item, i) => i === index ? { ...item, paymentType: event.target.value } : item))}><option value="PENDING" disabled>Pending / รอเลือกประเภท</option>{employeePaymentTypes.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
        <label className="text-xs">เดือนที่จ่ายให้<input aria-label={`Payment month for ${draft.employeeName}`} type="month" className={`${inputClass} block mt-1`} value={draft.paymentMonth} onChange={event => setDrafts(items => items.map((item, i) => i === index ? { ...item, paymentMonth: event.target.value } : item))} /></label>
        <label className="text-xs">ยอดที่จ่าย (บาท)<input aria-label={`Employee amount ${draft.employeeName} ${draft.paymentType}`} type="number" min="0.01" step="0.01" className={`${inputClass} block mt-1 w-36`} value={draft.amount} onChange={event => update(index, event.target.value)} /></label>
        <button type="button" className="text-sm text-rose-700" onClick={() => setDrafts(items => items.filter((_, i) => i !== index))}>นำออก</button>
      </div>)}
      <label className="block text-sm">หมายเหตุ (ไม่บังคับ)<input maxLength={500} className={`${inputClass} block mt-1 w-full`} value={description} onChange={event => setDescription(event.target.value)} /></label>
      <p className={`text-sm font-semibold ${remaining < 0 ? 'text-rose-700' : remaining === 0 && !pending ? 'text-emerald-700' : 'text-amber-700'}`}>จับคู่แล้ว {money(total)} · คงเหลือ {money(remaining)} · {pending ? 'PENDING / รอเลือกประเภท' : drafts.length && remaining === 0 ? 'COMPLETED เมื่อบันทึก' : drafts.length ? 'PARTIAL' : 'INITIAL'}</p>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <button type="button" onClick={() => void save()} disabled={pending || remaining < 0 || drafts.some(item => !/^\d+(\.\d{1,2})?$/.test(item.amount) || Number(item.amount) <= 0)} className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm disabled:opacity-50">{saving ? 'กำลังบันทึก…' : !pending && remaining === 0 && drafts.length ? 'บันทึกและปิดรายการ / Complete' : 'บันทึก / Save'}</button>
    </fieldset>
  </section>;
}
