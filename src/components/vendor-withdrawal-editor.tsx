'use client';

import { useState } from 'react';
import type { KbizRecord } from '@/lib/kbiz';
import { vendorPaymentMatch, vendorPaymentAmounts, type VendorPaymentRecord } from '@/lib/vendor-payments';

const money = (cents: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(cents / 100);
const inputClass = 'border border-slate-300 bg-white rounded-lg px-3 py-2 text-sm';
type Draft = { vendorPaymentId: string; amount: string; paymentNumber: string; vendorName: string };

export default function VendorWithdrawalEditor({ row, payments, onSave, onClose }: {
  row: KbizRecord; payments: VendorPaymentRecord[]; onSave: (data: object) => Promise<void>; onClose: () => void;
}) {
  const [description, setDescription] = useState(row.expenseDescription);
  const [drafts, setDrafts] = useState<Draft[]>(row.vendorAllocations.map(item => ({ vendorPaymentId: item.vendorPaymentId, ...item.vendorPayment, amount: (item.amountCents / 100).toFixed(2) })));
  const [selected, setSelected] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const total = drafts.reduce((sum, draft) => sum + Math.round(Number(draft.amount) * 100), 0);
  const remaining = row.withdrawalCents - total;
  const options = payments.filter(payment => payment.status !== 'INITIAL' &&
    (payment.status !== 'COMPLETED' || row.vendorAllocations.some(item => item.vendorPaymentId === payment.id)) &&
    !drafts.some(item => item.vendorPaymentId === payment.id) && `${payment.paymentNumber} ${payment.vendorName} ${payment.taxId} ${payment.description}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => vendorPaymentMatch(row, b).score - vendorPaymentMatch(row, a).score);
  async function save() {
    setSaving(true); setError('');
    try {
      await onSave({ id: row.id, expenseKind: drafts.length ? 'VENDOR' : 'OTHER', expenseDescription: description, vendorAllocations: drafts.map(item => ({ vendorPaymentId: item.vendorPaymentId, amountCents: Math.round(Number(item.amount) * 100) })) });
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save'); }
    finally { setSaving(false); }
  }
  return <section className="bg-white rounded-xl border-2 border-indigo-200 p-5 space-y-4" aria-label="Withdrawal reconciliation editor">
    <div className="flex justify-between gap-3"><div><h3 className="font-bold">รายจ่าย / จับคู่ Vendor Payment</h3><p className="text-sm text-slate-500">{row.transactionDate} {row.transactionTime} · ถอน {money(row.withdrawalCents)} · {row.accountNumber}</p></div>
      <button type="button" className={inputClass} disabled={saving} onClick={onClose}>ปิด</button></div>
    <p className="text-sm">{row.bankDescription} · {row.details}</p>
    <fieldset disabled={saving} className="space-y-4">
      <label className="block text-sm">รายการ / Expense description<input className={`${inputClass} block w-full mt-1`} maxLength={500} list="withdrawal-descriptions" value={description} onChange={event => setDescription(event.target.value)} placeholder="เงินเดือน / ประกันสังคม / จ่าย Vendor" />
        <datalist id="withdrawal-descriptions">{['Payroll / เงินเดือน', 'Social security / ประกันสังคม', 'Tax / ภาษี', 'Bank fee / ค่าธรรมเนียมธนาคาร', 'Vendor payment / จ่ายผู้ขาย'].map(item => <option key={item}>{item}</option>)}</datalist>
      </label>
      <p className="text-xs text-slate-500">เลือกใบจ่ายที่พิมพ์แล้ว แบ่งยอดให้หลาย Vendor หรือจ่ายบางส่วนได้ รายการที่ไม่ใช่ Vendor สามารถบันทึกเฉพาะรายละเอียดรายจ่าย</p>
      <input aria-label="Search vendor payments" className={`${inputClass} w-full`} value={search} onChange={event => { setSearch(event.target.value); setSelected(''); }} placeholder="ค้นหาชื่อ Vendor / Tax ID / เลขใบจ่าย" />
      <div className="flex flex-wrap gap-2"><select aria-label="Select vendor payment" className={`${inputClass} flex-1 min-w-0`} value={selected} onChange={event => setSelected(event.target.value)}>
        <option value="">เลือก Vendor Payment ({options.length})</option>{options.map(payment => <option key={payment.id} value={payment.id}>
          {vendorPaymentMatch(row, payment).reasons.length ? `★ ${vendorPaymentMatch(row, payment).reasons.join(', ')} · ` : ''}{payment.paymentNumber} · {payment.vendorName} · สุทธิคงเหลือ {money(vendorPaymentAmounts(payment).netCents - payment.allocatedCents)}{payment.withholdingRate ? ` · หัก ณ ที่จ่าย 3% ${money(vendorPaymentAmounts(payment).withholdingCents)}` : ''}
        </option>)}
      </select><button type="button" className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm disabled:opacity-50" disabled={!selected} onClick={() => {
        const payment = payments.find(item => item.id === selected); if (!payment) return;
        const original = row.vendorAllocations.find(item => item.vendorPaymentId === payment.id)?.amountCents || 0;
        const available = Math.max(0, vendorPaymentAmounts(payment).netCents - payment.allocatedCents + original);
        setDrafts(items => [...items, { vendorPaymentId: payment.id, paymentNumber: payment.paymentNumber, vendorName: payment.vendorName, amount: (Math.min(Math.max(0, remaining), available) / 100).toFixed(2) }]); setSelected('');
      }}>เพิ่มใบจ่าย</button></div>
      {!options.length && <p className="text-xs text-slate-500">ไม่มีใบจ่ายที่เลือกได้ กรุณาสร้างและพิมพ์จาก Finance → Expenses → Vendor Payments</p>}
      {drafts.map((draft, index) => <div key={draft.vendorPaymentId} className="border border-slate-200 rounded-lg p-3 flex flex-wrap gap-3 items-center">
        <div className="flex-1 text-sm"><strong>{draft.paymentNumber}</strong><p>{draft.vendorName}</p></div>
        <label className="text-xs">ยอดจับคู่ (บาท)<input className={`${inputClass} block mt-1 w-36`} type="number" min="0.01" step="0.01" value={draft.amount} onChange={event => setDrafts(items => items.map((item, i) => i === index ? { ...item, amount: event.target.value } : item))} /></label>
        <button type="button" className="text-sm text-rose-700" onClick={() => setDrafts(items => items.filter((_, i) => i !== index))}>นำออก</button>
      </div>)}
      {!!drafts.length && <p className={`text-sm font-medium ${remaining < 0 ? 'text-rose-700' : 'text-indigo-700'}`}>จับคู่แล้ว {money(total)} · คงเหลือ {money(remaining)}</p>}
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <button type="button" onClick={() => void save()} disabled={remaining < 0 || drafts.some(item => !/^\d+(\.\d{1,2})?$/.test(item.amount) || Number(item.amount) <= 0)} className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm disabled:opacity-50">{saving ? 'กำลังบันทึก…' : 'บันทึก / Save'}</button>
    </fieldset>
  </section>;
}
