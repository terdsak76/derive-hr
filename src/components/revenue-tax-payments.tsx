'use client';

import { useEffect, useState, type FormEvent } from 'react';
import type { RevenueTaxPaymentRecord } from '@/lib/revenue-tax-payments';

const inputClass = 'block w-full mt-1 border border-slate-300 bg-white rounded-lg px-3 py-2 text-sm';
const buttonClass = 'rounded-lg bg-indigo-600 text-white text-sm font-medium px-4 py-2 disabled:opacity-50';
const money = (value: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(value / 100);
const emptyForm = () => ({ paymentMonth: new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' }).slice(0, 7), amount: '' });

export default function RevenueTaxPayments({ onReconcile }: { onReconcile: () => void }) {
  const [payments, setPayments] = useState<RevenueTaxPaymentRecord[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('ALL');
  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/revenue-tax-payments', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load tax payments');
      setPayments(result);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load tax payments'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/revenue-tax-payments', { method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, ...(editingId ? { id: editingId } : {}) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save tax payment');
      setMessage(`บันทึก ${result.paymentNumber} เรียบร้อยแล้ว`); setEditingId(null); setForm(emptyForm()); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save'); }
    finally { setSaving(false); }
  }
  const filtered = payments.filter(payment => status === 'ALL' || payment.status === status);
  const withholdingPayables = payments.filter(payment => payment.vendorPaymentId);
  return <div className="space-y-5">
    <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <h3 className="font-bold">{editingId ? 'แก้ไขรายการชำระภาษี' : 'สร้างรายการชำระภาษีกรมสรรพากร'}</h3>
      <p className="text-sm text-slate-500">บันทึกเดือนที่ชำระและยอดเงินจริง แล้วจับคู่กับรายการถอนเงิน Kbiz เพื่อเปลี่ยนสถานะเป็น COMPLETED</p>
      <form onSubmit={save}><fieldset disabled={saving || loading} className="flex flex-wrap items-end gap-4 disabled:opacity-60">
        <label className="text-sm">เดือนที่ชำระ / Payment month<input required type="month" className={inputClass} value={form.paymentMonth} onChange={event => setForm({ ...form, paymentMonth: event.target.value })} /></label>
        <label className="text-sm">ยอดชำระ (บาท) / Amount<input required type="number" min="0.01" max="21474836.47" step="0.01" className={inputClass} value={form.amount} onChange={event => setForm({ ...form, amount: event.target.value })} /></label>
        <button type="submit" className={buttonClass}>{saving ? 'กำลังบันทึก…' : 'บันทึก / Save'}</button>
        {editingId && <button type="button" className="text-sm py-2" onClick={() => { setEditingId(null); setForm(emptyForm()); }}>ยกเลิก</button>}
      </fieldset></form>
      <p className="text-xs text-slate-500">INITIAL: ยังไม่จับคู่ · PARTIAL: จับคู่บางส่วน · COMPLETED: จับคู่ครบยอดชำระ</p>
    </section>
    {error && <p role="alert" className="bg-rose-50 rounded-lg p-3 text-sm text-rose-700">{error}</p>}
    {message && <p role="status" className="bg-emerald-50 rounded-lg p-3 text-sm text-emerald-700">{message}</p>}
    <section className="bg-indigo-50 rounded-xl p-4 space-y-2"><h3 className="font-bold text-indigo-900">ภาษีหัก ณ ที่จ่ายจาก Vendor</h3>
      <p className="text-sm">ยอดที่หักแล้ว {money(withholdingPayables.reduce((sum, item) => sum + item.amountCents, 0))} · นำส่งแล้ว {money(withholdingPayables.reduce((sum, item) => sum + item.allocatedCents, 0))} · ค้างนำส่ง {money(withholdingPayables.reduce((sum, item) => sum + item.amountCents - item.allocatedCents, 0))}</p>
      <p className="text-xs text-slate-600">รายการ 3% สร้างจากการจับคู่จ่าย Vendor โดยอัตโนมัติ เดือนในรายการคือเดือนที่หักภาษี จับคู่ยอดนำส่งกับรายการถอนให้กรมสรรพากรใน Kbiz เพื่อปิดยอดค้าง</p>
    </section>
    <div className="flex flex-wrap gap-3 items-end">
      <label className="text-sm">Status<select className={inputClass} value={status} onChange={event => setStatus(event.target.value)}>{['ALL', 'INITIAL', 'PARTIAL', 'COMPLETED'].map(value => <option key={value}>{value}</option>)}</select></label>
      <button type="button" className={buttonClass} onClick={onReconcile}>จับคู่รายการ Kbiz</button>
      <button type="button" disabled={saving || loading} className="border border-slate-300 rounded-lg px-4 py-2 text-sm disabled:opacity-50" onClick={() => { setError(''); void load(); }}>รีเฟรช</button>
    </div>
    <section className="bg-white rounded-xl border border-slate-200 overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm text-left">
      <thead className="bg-slate-100"><tr>{['เดือน / เลขรายการ', 'ที่มา / Vendor', 'ยอดชำระ', 'จับคู่แล้ว', 'คงเหลือ', 'Status', 'จัดการ'].map(title => <th key={title} className="p-3 whitespace-nowrap">{title}</th>)}</tr></thead>
      <tbody>{loading ? <tr><td colSpan={7} className="p-8 text-center text-slate-500">กำลังโหลด…</td></tr> : !filtered.length ? <tr><td colSpan={7} className="p-8 text-center text-slate-500">ยังไม่มีรายการตามเงื่อนไข</td></tr> : filtered.map(payment => <tr key={payment.id} className="border-t border-slate-100 align-top">
        <td className="p-3 whitespace-nowrap">{payment.paymentMonth}<p className="text-xs text-slate-500">{payment.paymentNumber}</p></td>
        <td className="p-3">{payment.vendorPayment ? <><strong>หัก ณ ที่จ่าย 3%</strong><p>{payment.vendorPayment.vendorName}</p><p className="text-xs text-slate-500">{payment.vendorPayment.taxId} · {payment.vendorPayment.paymentNumber}</p></> : 'บันทึกเอง'}</td>
        <td className="p-3 whitespace-nowrap font-medium">{money(payment.amountCents)}</td>
        <td className="p-3 whitespace-nowrap">{money(payment.allocatedCents)}{payment.allocations?.map(item => <p key={item.transactionId} className="text-xs text-slate-500 mt-1" title={item.transaction.details}>{item.transaction.transactionDate} · {money(item.amountCents)}</p>)}</td>
        <td className="p-3 whitespace-nowrap">{money(payment.amountCents - payment.allocatedCents)}</td>
        <td className={`p-3 font-medium ${payment.status === 'COMPLETED' ? 'text-emerald-700' : payment.status === 'PARTIAL' ? 'text-amber-700' : 'text-slate-500'}`}>{payment.status}</td>
        <td className="p-3">{payment.vendorPaymentId ? <span className="text-xs text-slate-500">คำนวณอัตโนมัติ</span> : !payment.allocatedCents && <button type="button" disabled={saving || loading} className="text-indigo-700 text-sm" onClick={() => { setEditingId(payment.id); setForm({ paymentMonth: payment.paymentMonth, amount: (payment.amountCents / 100).toFixed(2) }); }}>แก้ไข</button>}</td>
      </tr>)}</tbody>
    </table></div></section>
  </div>;
}
