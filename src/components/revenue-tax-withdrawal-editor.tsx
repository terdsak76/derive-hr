'use client';

import { useState } from 'react';
import type { KbizRecord } from '@/lib/kbiz';
import { revenueTaxMatch, type RevenueTaxPaymentRecord } from '@/lib/revenue-tax-payments';

const money = (cents: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(cents / 100);
const inputClass = 'border border-slate-300 bg-white rounded-lg px-3 py-2 text-sm';
type Draft = { taxPaymentId: string; paymentNumber: string; paymentMonth: string; amount: string };

export default function RevenueTaxWithdrawalEditor({ row, payments, onSave, onClose }: {
  row: KbizRecord; payments: RevenueTaxPaymentRecord[]; onSave: (data: object) => Promise<void>; onClose: () => void;
}) {
  const [drafts, setDrafts] = useState<Draft[]>(row.taxAllocations.map(item => ({ taxPaymentId: item.taxPaymentId, ...item.taxPayment, amount: (item.amountCents / 100).toFixed(2) })));
  const [selected, setSelected] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const total = drafts.reduce((sum, item) => sum + Math.round(Number(item.amount) * 100), 0);
  const remaining = row.withdrawalCents - total;
  const options = payments.filter(payment => (payment.status !== 'COMPLETED' || row.taxAllocations.some(item => item.taxPaymentId === payment.id)) && !drafts.some(item => item.taxPaymentId === payment.id))
    .sort((a, b) => revenueTaxMatch(row, b).score - revenueTaxMatch(row, a).score);
  async function save() {
    setSaving(true); setError('');
    try {
      await onSave({ id: row.id, expenseKind: 'OTHER', expenseDescription: row.expenseDescription, vendorAllocations: [], employeeAllocations: [],
        taxAllocations: drafts.map(item => ({ taxPaymentId: item.taxPaymentId, amountCents: Math.round(Number(item.amount) * 100) })),
      });
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save'); }
    finally { setSaving(false); }
  }
  return <section aria-label="Revenue Department withdrawal reconciliation" className="bg-white rounded-xl border-2 border-indigo-200 p-5 space-y-4">
    <div className="flex justify-between gap-3"><div><h3 className="font-bold">จับคู่รายการชำระภาษีกรมสรรพากร</h3><p className="text-sm text-slate-500">{row.transactionDate} · ถอน {money(row.withdrawalCents)} · {row.accountNumber}</p></div><button type="button" disabled={saving} className={inputClass} onClick={onClose}>ปิด</button></div>
    <p className="text-sm">{row.bankDescription} · {row.details}</p>
    <fieldset disabled={saving} className="space-y-4">
      <p className="text-sm text-slate-500">เลือกเดือนและยอดที่บันทึกใน Revenue Department Tax Payments จับคู่ครบยอดแล้วรายการชำระภาษีจะเป็น COMPLETED</p>
      <div className="flex flex-wrap gap-2"><select aria-label="Tax payment" className={`${inputClass} flex-1 min-w-0`} value={selected} onChange={event => setSelected(event.target.value)}>
        <option value="">เลือกรายการชำระภาษี ({options.length})</option>{options.map(payment => <option key={payment.id} value={payment.id}>{revenueTaxMatch(row, payment).reasons.length ? `★ ${revenueTaxMatch(row, payment).reasons.join(', ')} · ` : ''}{payment.paymentMonth} · {payment.paymentNumber}{payment.vendorPayment ? ` · 3% ${payment.vendorPayment.vendorName}` : ''} · คงเหลือ {money(payment.amountCents - payment.allocatedCents)}</option>)}
      </select><button type="button" disabled={!selected || remaining <= 0} className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm disabled:opacity-50" onClick={() => {
        const payment = payments.find(item => item.id === selected); if (!payment) return;
        const original = row.taxAllocations.find(item => item.taxPaymentId === payment.id)?.amountCents || 0;
        setDrafts(items => [...items, { taxPaymentId: payment.id, paymentNumber: payment.paymentNumber, paymentMonth: payment.paymentMonth, amount: (Math.min(remaining, Math.max(0, payment.amountCents - payment.allocatedCents + original)) / 100).toFixed(2) }]); setSelected('');
      }}>เพิ่มรายการ</button></div>
      {!options.length && <p className="text-xs text-slate-500">กรุณาสร้างรายการใน Finance → Expenses → Revenue Department Tax Payments ก่อนจับคู่</p>}
      {drafts.map((draft, index) => <div key={draft.taxPaymentId} className="flex flex-wrap gap-3 items-center border border-slate-200 rounded-lg p-3">
        <div className="flex-1 text-sm"><strong>{draft.paymentMonth}</strong><p className="text-xs text-slate-500">{draft.paymentNumber}</p></div>
        <label className="text-xs">ยอดที่จับคู่ (บาท)<input type="number" min="0.01" step="0.01" className={`${inputClass} block mt-1 w-36`} value={draft.amount} onChange={event => setDrafts(items => items.map((item, i) => i === index ? { ...item, amount: event.target.value } : item))} /></label>
        <button type="button" className="text-sm text-rose-700" onClick={() => setDrafts(items => items.filter((_, i) => i !== index))}>นำออก</button>
      </div>)}
      <p className={`text-sm font-semibold ${remaining < 0 ? 'text-rose-700' : 'text-indigo-700'}`}>จับคู่แล้ว {money(total)} · คงเหลือรอจับคู่ {money(remaining)}</p>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <button type="button" onClick={() => void save()} disabled={remaining < 0 || drafts.some(item => !/^\d+(\.\d{1,2})?$/.test(item.amount) || Number(item.amount) <= 0)} className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm disabled:opacity-50">{saving ? 'กำลังบันทึก…' : 'บันทึกการจับคู่ / Save'}</button>
    </fieldset>
  </section>;
}
