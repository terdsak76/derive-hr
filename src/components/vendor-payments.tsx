'use client';

import { formatBangkokDate } from '@/lib/bangkok-date';

import { useEffect, useState, type FormEvent } from 'react';
import { renderVendorPaymentHtml, vendorPaymentAmounts, type VendorPaymentRecord } from '@/lib/vendor-payments';

const inputClass = 'block w-full mt-1 border border-slate-300 bg-white rounded-lg px-3 py-2 text-sm';
const buttonClass = 'rounded-lg bg-indigo-600 text-white text-sm font-medium px-4 py-2 disabled:opacity-50';
const money = (value: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(value / 100);
const emptyForm = () => ({ vendorName: '', taxId: '', amount: '', paymentDate: formatBangkokDate(), description: '', withholdingEnabled: false, withholdingBase: '' });

export default function VendorPayments() {
  const [payments, setPayments] = useState<VendorPaymentRecord[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');

  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/vendor-payments', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load payments');
      setPayments(result);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load payments'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/vendor-payments', { method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, ...(editingId ? { id: editingId, action: 'UPDATE' } : {}) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save vendor payment');
      setMessage(`บันทึก ${result.paymentNumber} เรียบร้อยแล้ว`); setForm(emptyForm()); setEditingId(null); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save'); }
    finally { setBusy(false); }
  }
  async function print(payment: VendorPaymentRecord) {
    // Open synchronously so the browser can associate the popup with the click.
    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) { setError('กรุณาอนุญาต Popup เพื่อพิมพ์ใบสำคัญจ่าย'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/vendor-payments', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: payment.id, action: 'PRINT' }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to print');
      printWindow.opener = null;
      printWindow.document.open(); printWindow.document.write(renderVendorPaymentHtml(result)); printWindow.document.close();
      printWindow.focus(); printWindow.print();
      setMessage(`เปิดพิมพ์ ${result.paymentNumber} · ${result.status}`); await load();
    } catch (err) { printWindow.close(); setError(err instanceof Error ? err.message : 'Unable to print'); }
    finally { setBusy(false); }
  }
  const filtered = payments.filter(payment => (status === 'ALL' || payment.status === status) &&
    `${payment.paymentNumber} ${payment.vendorName} ${payment.taxId} ${payment.description}`.toLowerCase().includes(search.toLowerCase()));
  const preview = vendorPaymentAmounts({ amountCents: Math.round((Number(form.amount) || 0) * 100), withholdingRate: form.withholdingEnabled ? 3 : 0, withholdingBaseCents: Math.round((Number(form.withholdingBase) || 0) * 100) });
  return <div className="space-y-5">
    <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <h3 className="font-bold">{editingId ? 'แก้ไขใบจ่าย / Edit payment' : 'สร้างใบจ่าย Vendor / New vendor payment'}</h3>
      <p className="text-sm text-slate-500">INITIAL → PRINTED → COMPLETED · พิมพ์ใบสำคัญจ่าย แล้วจับคู่กับรายการถอนเงินใน Kbiz Reconciliation</p>
      <form onSubmit={save}>
        <fieldset disabled={busy || loading} className="grid sm:grid-cols-2 gap-4 disabled:opacity-60">
          <label className="text-sm">ชื่อ Vendor / Name<input required maxLength={200} className={inputClass} value={form.vendorName} onChange={event => setForm({ ...form, vendorName: event.target.value })} /></label>
          <label className="text-sm">เลขประจำตัวผู้เสียภาษี / Tax ID<input required maxLength={30} className={inputClass} value={form.taxId} onChange={event => setForm({ ...form, taxId: event.target.value })} /></label>
          <label className="text-sm">ยอดก่อนหัก ณ ที่จ่าย (บาท) / Gross payment<input required type="number" min="0.01" max="21474836.47" step="0.01" className={inputClass} value={form.amount} onChange={event => setForm({ ...form, amount: event.target.value })} /></label>
          <label className="text-sm">วันที่จ่าย / Payment date<input required type="date" className={inputClass} value={form.paymentDate} onChange={event => setForm({ ...form, paymentDate: event.target.value })} /></label>
          <label className="text-sm sm:col-span-2">รายละเอียด (ไม่บังคับ) / Description<textarea maxLength={500} rows={2} className={inputClass} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></label>
          <label className="text-sm sm:col-span-2"><input type="checkbox" checked={form.withholdingEnabled} onChange={event => setForm({ ...form, withholdingEnabled: event.target.checked, withholdingBase: form.withholdingBase || form.amount })} /> หักภาษี ณ ที่จ่าย 3% / Withholding payable</label>
          {form.withholdingEnabled && <label className="text-sm">ฐานหัก ณ ที่จ่าย ไม่รวม VAT (บาท)<input required type="number" min="0.01" step="0.01" max={form.amount || undefined} className={inputClass} value={form.withholdingBase} onChange={event => setForm({ ...form, withholdingBase: event.target.value })} /></label>}
          <p className="text-sm sm:col-span-2 text-indigo-700">หัก ณ ที่จ่าย {money(preview.withholdingCents)} · สุทธิโอนให้ Vendor {money(preview.netCents)}</p>
          <div className="sm:col-span-2 flex gap-3"><button type="submit" className={buttonClass}>{busy ? 'กำลังบันทึก…' : 'บันทึก / Save'}</button>
            {editingId && <button type="button" className="text-sm" onClick={() => { setEditingId(null); setForm(emptyForm()); }}>ยกเลิก</button>}</div>
        </fieldset>
      </form>
      <p className="text-xs text-slate-500">Kbiz จับคู่ยอดสุทธิหลังหัก ณ ที่จ่าย เมื่อจับคู่แล้วระบบจะสร้างยอดหัก ณ ที่จ่ายค้างนำส่งใน Revenue Department Tax Payments ตามเดือนที่จ่ายเงินจริง</p>
    </section>
    {error && <p role="alert" className="bg-rose-50 rounded-lg p-3 text-sm text-rose-700">{error}</p>}
    {message && <p role="status" className="bg-emerald-50 rounded-lg p-3 text-sm text-emerald-700">{message}</p>}
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-sm flex-1">ค้นหา Vendor / Tax ID / เลขใบจ่าย<input className={inputClass} value={search} onChange={event => setSearch(event.target.value)} /></label>
      <label className="text-sm">Status<select className={inputClass} value={status} onChange={event => setStatus(event.target.value)}>{['ALL', 'INITIAL', 'PRINTED', 'COMPLETED'].map(value => <option key={value}>{value}</option>)}</select></label>
      <button type="button" className={buttonClass} disabled={busy || loading} onClick={() => { setError(''); void load(); }}>รีเฟรช</button>
    </div>
    <section className="bg-white rounded-xl border border-slate-200 overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm text-left">
      <thead className="bg-slate-100"><tr>{['วันที่ / เลขใบจ่าย', 'Vendor / Tax ID', 'รายละเอียด', 'ยอดก่อนหัก', 'หัก ณ ที่จ่าย', 'สุทธิจ่าย Vendor', 'จับคู่แล้ว', 'Status', 'จัดการ'].map(title => <th key={title} className="p-3 whitespace-nowrap">{title}</th>)}</tr></thead>
      <tbody>{loading ? <tr><td colSpan={9} className="p-8 text-center text-slate-500">กำลังโหลด…</td></tr> : !filtered.length ? <tr><td colSpan={9} className="p-8 text-center text-slate-500">ยังไม่มีรายการตามเงื่อนไข</td></tr> : filtered.map(payment => <tr key={payment.id} className="border-t border-slate-100 align-top">
        <td className="p-3 whitespace-nowrap">{payment.paymentDate}<p className="text-xs text-slate-500">{payment.paymentNumber}</p></td>
        <td className="p-3"><strong>{payment.vendorName}</strong><p className="text-xs text-slate-500">{payment.taxId}</p></td>
        <td className="p-3 whitespace-pre-line min-w-40">{payment.description || '—'}</td>
        <td className="p-3 whitespace-nowrap font-medium">{money(payment.amountCents)}</td>
        <td className="p-3 whitespace-nowrap">{money(vendorPaymentAmounts(payment).withholdingCents)}{payment.withholdingRate ? <p className="text-xs text-slate-500">3% × {money(payment.withholdingBaseCents || 0)}</p> : null}</td>
        <td className="p-3 whitespace-nowrap font-medium">{money(vendorPaymentAmounts(payment).netCents)}</td>
        <td className="p-3 whitespace-nowrap">{money(payment.allocatedCents)}{payment.allocations?.map(item => <p key={item.transactionId} className="text-xs text-slate-500 mt-1" title={item.transaction.details}>{item.transaction.transactionDate} · {money(item.amountCents)}</p>)}</td>
        <td className={`p-3 font-medium ${payment.status === 'COMPLETED' ? 'text-emerald-700' : payment.status === 'PRINTED' ? 'text-indigo-700' : 'text-slate-500'}`}>{payment.status}</td>
        <td className="p-3"><div className="flex gap-3 whitespace-nowrap">
          {payment.status === 'INITIAL' && <button type="button" disabled={busy || loading} className="text-indigo-700" onClick={() => { setEditingId(payment.id); setForm({ vendorName: payment.vendorName, taxId: payment.taxId, amount: (payment.amountCents / 100).toFixed(2), paymentDate: payment.paymentDate, description: payment.description, withholdingEnabled: payment.withholdingRate === 3, withholdingBase: payment.withholdingBaseCents ? (payment.withholdingBaseCents / 100).toFixed(2) : '' }); }}>{'แก้ไข'}</button>}
          <button type="button" disabled={busy || loading} onClick={() => void print(payment)} className={buttonClass}>{payment.status === 'INITIAL' ? 'พิมพ์' : 'พิมพ์ซ้ำ'}</button>
        </div></td>
      </tr>)}</tbody>
    </table></div></section>
  </div>;
}
