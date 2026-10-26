'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { parseKbizCsv, kbizReconciliationStatus, employeePaymentTypeLabel, type KbizEmployee, type KbizInvoice, type KbizRecord, type KbizRow } from '@/lib/kbiz';
import { kbizMatch } from '@/lib/kbiz-matching';
import type { VendorPaymentRecord } from '@/lib/vendor-payments';
import WithdrawalReconciliationEditor from '@/components/withdrawal-reconciliation-editor';
import type { RevenueTaxPaymentRecord } from '@/lib/revenue-tax-payments';

const money = (cents: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(cents / 100);
const inputClass = 'border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white';
const buttonClass = 'rounded-lg px-4 py-2 text-sm font-medium bg-indigo-600 text-white disabled:opacity-50';
const allocated = (row: KbizRecord) => row.allocations.reduce((sum, item) => sum + item.amountCents, 0);
const vendorAllocated = (row: KbizRecord) => row.vendorAllocations.reduce((sum, item) => sum + item.amountCents, 0);
const employeeAllocated = (row: KbizRecord) => row.employeeAllocations.reduce((sum, item) => sum + item.amountCents, 0);
const taxAllocated = (row: KbizRecord) => row.taxAllocations.reduce((sum, item) => sum + item.amountCents, 0);
const completed = (row: KbizRecord) => kbizReconciliationStatus(row) === 'COMPLETED';
type Draft = { referenceKey: string; invoiceNumber: string; customer: string; amount: string; basis: string; expectedCents: number };

function TransactionEditor({ row, invoices, invoiceMonth, setInvoiceMonth, onSave, onClose }: {
  row: KbizRecord; invoices: KbizInvoice[]; invoiceMonth: string; setInvoiceMonth: (value: string) => void;
  onSave: (data: object) => Promise<void>; onClose: () => void;
}) {
  const [description, setDescription] = useState(row.expenseDescription);
  const [drafts, setDrafts] = useState<Draft[]>(row.allocations.map(item => ({ ...item, amount: (item.amountCents / 100).toFixed(2) })));
  const [selected, setSelected] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const total = drafts.reduce((sum, item) => sum + Math.round(Number(item.amount) * 100), 0);
  const remaining = row.depositCents - total;
  const options = invoices.filter(item => item.status !== 'INITIAL' && !drafts.some(draft => draft.referenceKey === item.referenceKey) &&
    `${item.invoiceNumber} ${item.customer} ${item.description}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => kbizMatch(row, b).score - kbizMatch(row, a).score);
  function addInvoice() {
    const invoice = invoices.find(item => item.referenceKey === selected);
    if (!invoice) return;
    const original = row.allocations.find(item => item.referenceKey === invoice.referenceKey)?.amountCents || 0;
    const available = Math.max(0, invoice.netCents - invoice.allocatedCents + original);
    setDrafts(items => [...items, { ...invoice, amount: (Math.min(Math.max(0, remaining), available) / 100).toFixed(2), basis: 'NET', expectedCents: invoice.netCents }]);
    setSelected('');
  }
  function update(index: number, change: Partial<Draft>) { setDrafts(items => items.map((item, i) => i === index ? { ...item, ...change } : item)); }
  async function save() {
    setSaving(true); setError('');
    try {
      await onSave(row.withdrawalCents ? { id: row.id, expenseDescription: description } : {
        id: row.id, allocations: drafts.map(item => ({ referenceKey: item.referenceKey, amountCents: Math.round(Number(item.amount) * 100), basis: item.basis })),
      });
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save'); }
    finally { setSaving(false); }
  }
  return <section className="bg-white rounded-xl border-2 border-indigo-200 p-5 space-y-4" aria-label="Transaction editor">
    <div className="flex justify-between gap-3"><div><h3 className="font-bold">{row.withdrawalCents ? 'รายละเอียดรายจ่าย / Expense description' : 'จับคู่เงินฝากกับ Invoice'}</h3>
      <p className="text-sm text-slate-500">{row.transactionDate} {row.transactionTime} · {row.withdrawalCents ? 'ยอดถอน' : 'ยอดฝาก'} {money(row.depositCents || row.withdrawalCents)} · {row.accountNumber}</p></div>
      <button type="button" disabled={saving} onClick={onClose} className={inputClass}>ปิด</button></div>
    <p className="text-sm whitespace-pre-line">{row.bankDescription} · {row.details}</p>
    {row.withdrawalCents ? <label className="block text-sm">รายการ / Item description
      <input className={`${inputClass} block w-full mt-2`} value={description} maxLength={500} onChange={event => setDescription(event.target.value)} list="expense-descriptions" placeholder="เช่น เงินเดือน ก.ย. 2569 / Payroll September 2026" />
      <datalist id="expense-descriptions">{['Payroll / เงินเดือน', 'Social security / ประกันสังคม', 'Tax / ภาษี', 'Bank fee / ค่าธรรมเนียมธนาคาร', 'Reimbursement / เบิกค่าใช้จ่าย'].map(item => <option key={item} value={item} />)}</datalist>
      <p className="mt-2 text-xs text-slate-500">เว้นว่างแล้วบันทึกเพื่อล้างรายละเอียดและกลับเป็นรายการที่รอระบุ</p>
    </label> : <>
      <p className="text-sm text-slate-500">จับคู่กับ IssuedDocument ที่พิมพ์แล้วได้ทุกเดือน ระบบแนะนำจากเลขเอกสาร ชื่อลูกค้า คำอธิบาย และยอดเงิน กรุณาตรวจสอบก่อนบันทึก แบ่งเงินฝากหรือรับชำระบางส่วนได้</p>
      <div className="flex flex-wrap gap-2 items-end">
        <label className="text-sm">เดือน Invoice<input aria-label="Invoice month" type="month" value={invoiceMonth} onChange={event => { setInvoiceMonth(event.target.value); setSelected(''); }} className={`${inputClass} block mt-1`} /></label>
        <label className="text-sm flex-1">ค้นหา Invoice<input className={`${inputClass} block w-full mt-1`} value={search} onChange={event => { setSearch(event.target.value); setSelected(''); }} placeholder="เลข Invoice / ลูกค้า" /></label>
      </div>
      <div className="flex flex-wrap gap-2"><select aria-label="Select invoice" className={`${inputClass} flex-1 min-w-0`} value={selected} onChange={event => setSelected(event.target.value)}>
        <option value="">เลือก Invoice ({options.length})</option>{options.map(item => <option key={item.referenceKey} value={item.referenceKey}>
          {kbizMatch(row, item).reasons.length ? `★ ${kbizMatch(row, item).reasons.join(', ')} · ` : ''}{item.invoiceNumber} · {item.customer} · {item.status} · สุทธิ {money(item.netCents)} / รวม VAT {money(item.grossCents)} · จับคู่แล้ว {money(item.allocatedCents)}
        </option>)}</select><button type="button" className={buttonClass} disabled={!selected || saving} onClick={addInvoice}>เพิ่ม Invoice</button></div>
      {!options.length && <p className="text-sm text-slate-500">ไม่พบเอกสารที่พิมพ์แล้ว กรุณาพิมพ์ Invoice หรือใบเสร็จก่อนจับคู่ หรือล้างคำค้นหา</p>}
      <div className="space-y-3">{drafts.map((item, index) => {
        const current = invoices.find(invoice => invoice.referenceKey === item.referenceKey);
        return <div key={item.referenceKey} className="rounded-lg border border-slate-200 p-3 flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-40 text-sm"><strong>{item.invoiceNumber}</strong><div>{item.customer}</div>
            <p className="text-xs text-slate-500">ยอด Invoice {money(current ? item.basis === 'NET' ? current.netCents : current.grossCents : item.expectedCents)}</p></div>
          <label className="text-xs">วิธีรับเงิน<select aria-label={`Payment basis ${item.invoiceNumber}`} className={`${inputClass} block mt-1`} value={item.basis} disabled={!current || saving} onChange={event => update(index, { basis: event.target.value })}>
            <option value="NET">หัก ณ ที่จ่าย 3%</option><option value="GROSS">เต็มยอดรวม VAT</option></select></label>
          <label className="text-xs">ยอดที่จับคู่ (บาท)<input aria-label={`Allocation amount ${item.invoiceNumber}`} className={`${inputClass} block mt-1 w-36`} type="number" min="0.01" step="0.01" value={item.amount} onChange={event => update(index, { amount: event.target.value })} /></label>
          <button type="button" disabled={saving} onClick={() => setDrafts(items => items.filter((_, i) => i !== index))} className="text-rose-700 text-sm">นำออก</button>
        </div>;
      })}</div>
      <p className={`text-sm font-semibold ${remaining < 0 ? 'text-rose-700' : 'text-indigo-700'}`}>ยอดฝาก {money(row.depositCents)} · จับคู่แล้ว {money(total)} · คงเหลือรอจับคู่ {money(remaining)}</p>
    </>}
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    <button type="button" onClick={save} disabled={saving || (!row.withdrawalCents && (remaining < 0 || drafts.some(item => !/^\d+(\.\d{1,2})?$/.test(item.amount) || Number(item.amount) <= 0)))} className={buttonClass}>{saving ? 'กำลังบันทึก…' : 'บันทึก / Save'}</button>
  </section>;
}

export default function KbizReconciliation() {
  const [rows, setRows] = useState<KbizRecord[]>([]);
  const [invoices, setInvoices] = useState<KbizInvoice[]>([]);
  const [vendorPayments, setVendorPayments] = useState<VendorPaymentRecord[]>([]);
  const [employees, setEmployees] = useState<KbizEmployee[]>([]);
  const [taxPayments, setTaxPayments] = useState<RevenueTaxPaymentRecord[]>([]);
  const [invoiceMonth, setInvoiceMonth] = useState(() => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' }).slice(0, 7));
  const [month, setMonth] = useState('');
  const [kind, setKind] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<KbizRecord | null>(null);
  const [preview, setPreview] = useState<{ filename: string; csv: string; rows: KbizRow[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [matching, setMatching] = useState(false);
  const [matchingCustomers, setMatchingCustomers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const generation = useRef(0);
  const load = useCallback(async () => {
    const version = ++generation.current;
    setLoading(true);
    try {
      const response = await fetch(`/api/kbiz?invoice_month=${invoiceMonth}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (version === generation.current) { setRows(result.transactions); setInvoices(result.invoices); setVendorPayments(result.vendorPayments); setEmployees(result.employees); setTaxPayments(result.taxPayments); setError(''); }
    } catch (err) { if (version === generation.current) setError(err instanceof Error ? err.message : 'Unable to load'); }
    finally { if (version === generation.current) setLoading(false); }
  }, [invoiceMonth]);
  useEffect(() => { void load(); return () => { generation.current++; }; }, [load]);
  async function importCsv() {
    if (!preview) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/kbiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csv: preview.csv, filename: preview.filename }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setMessage(`นำเข้า ${result.imported} รายการ · ข้ามรายการซ้ำ ${result.skipped} รายการ`); setPreview(null);
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Import failed'); }
    finally { setBusy(false); }
  }
  async function matchEmployees() {
    if (busy || matching) return;
    const transactionIds = filtered.filter(row => row.withdrawalCents > 0 && !completed(row)).map(row => row.id);
    if (!transactionIds.length) return;
    setBusy(true); setMatching(true); setError(''); setMessage('');
    let matched = 0, unmatched = 0;
    try {
      for (let offset = 0; offset < transactionIds.length; offset += 25) {
        const response = await fetch('/api/kbiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'MATCH_EMPLOYEES', transactionIds: transactionIds.slice(offset, offset + 25) }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to match employee names');
        matched += result.matched; unmatched += result.unmatched;
        setMessage(`จับคู่พนักงาน ${matched} รายการ (รอเลือกประเภทการจ่าย) · ยังจับคู่ไม่ได้ ${unmatched} รายการ`);
      }
      await load();
    } catch (err) { await load(); setError(err instanceof Error ? err.message : 'Unable to match employee names'); }
    finally { setBusy(false); setMatching(false); }
  }
  async function matchCustomers() {
    if (busy) return;
    const transactionIds = filtered.filter(row => row.depositCents > 0 && !row.allocations.length && !row.depositSuggestions?.length).map(row => row.id);
    if (!transactionIds.length) return;
    setBusy(true); setMatchingCustomers(true); setError(''); setMessage('');
    let matched = 0, unmatched = 0;
    try {
      for (let offset = 0; offset < transactionIds.length; offset += 25) {
        const response = await fetch('/api/kbiz/deposit-matches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transactionIds: transactionIds.slice(offset, offset + 25) }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to suggest customer matches');
        matched += result.matched; unmatched += result.unmatched;
        setMessage(`แนะนำ ${matched} รายการ (รอยืนยัน) · ไม่พบคู่ที่ชัดเจน ${unmatched} รายการ`);
      }
      await load();
    } catch (err) { await load(); setError(err instanceof Error ? err.message : 'Unable to suggest customer matches'); }
    finally { setBusy(false); setMatchingCustomers(false); }
  }
  async function reviewCustomerMatch(id: string, decision: 'CONFIRMED' | 'REJECTED') {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/kbiz/deposit-matches', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: decision }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to review match');
      setMessage(decision === 'CONFIRMED' ? 'ยืนยันการจับคู่และบันทึกรับชำระแล้ว' : 'ปฏิเสธคำแนะนำแล้ว สามารถจับคู่ Invoice ด้วยตนเองได้');
      await load();
    } catch (err) { await load(); setError(err instanceof Error ? err.message : 'Unable to review match'); }
    finally { setBusy(false); }
  }
  const filtered = rows.filter(row => (!month || row.transactionDate.startsWith(month)) && (kind === 'ALL' || (kind === 'DEPOSIT' ? row.depositCents > 0 : row.withdrawalCents > 0)) &&
    (status === 'ALL' || (status === 'DONE' ? completed(row) : status === 'REVIEW' ? !!row.depositSuggestions?.length : !completed(row))) &&
    `${row.details} ${row.bankDescription} ${row.expenseDescription} ${row.accountNumber} ${row.allocations.map(item => `${item.invoiceNumber} ${item.customer}`).join(' ')} ${(row.depositSuggestions || []).map(item => `${item.invoiceNumber} ${item.customer} ${item.invoiceMonth}`).join(' ')} ${row.vendorAllocations.map(item => `${item.vendorPayment.paymentNumber} ${item.vendorPayment.vendorName}`).join(' ')} ${row.employeeAllocations.map(item => `${item.employeeName} ${item.paymentType} ${item.paymentMonth}`).join(' ')} ${row.taxAllocations.map(item => `กรมสรรพากร Revenue Department ${item.taxPayment.paymentNumber} ${item.taxPayment.paymentMonth}`).join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  const deposits = filtered.reduce((sum, row) => sum + row.depositCents, 0), expenses = filtered.reduce((sum, row) => sum + row.withdrawalCents, 0);
  async function saveTransaction(data: object) {
    const response = await fetch('/api/kbiz', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error);
    setEditing(null); setMessage('บันทึกเรียบร้อยแล้ว'); await load();
  }
  return <div className="space-y-5">
    <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
      <h3 className="font-bold">Kbiz Transaction Reconciliation</h3>
      <p className="text-sm text-slate-500">นำเข้า CSV รายการเดินบัญชีแบบมีรายละเอียด เพื่อจับคู่เงินฝากกับ Invoice และระบุรายจ่ายโดย Admin</p>
      <p className="text-xs text-slate-500">รายการนี้ใช้ตรวจสอบเงินเข้า–ออกธนาคาร แยกจากยอดรายรับ–รายจ่ายและ VAT ในรายงานบริษัท</p>
      <div className="space-y-2">
        <button type="button" className={buttonClass} disabled={busy || loading || !!editing || !filtered.some(row => row.depositCents > 0 && !row.allocations.length && !row.depositSuggestions?.length)} onClick={() => void matchCustomers()}>{matchingCustomers ? 'กำลังแนะนำคู่ลูกค้า…' : 'จับคู่เงินฝากกับลูกค้า / Match customer deposits'}</button>
        <p className="text-xs text-slate-500">ตรวจเงินฝากที่แสดงและยังไม่จับคู่ โดยเทียบชื่อ Customer หรือรหัส Client กับ Invoice ที่พิมพ์แล้วของเดือนก่อนหน้า เช่น Invoice ต.ค. กับเงินฝาก พ.ย. รายการที่ชัดเจนจะรอยืนยัน ยอดรับชำระจะบันทึกเมื่อกดยืนยันเท่านั้น</p>
        <button type="button" className={buttonClass} disabled={busy || loading || !!editing || !filtered.some(row => row.withdrawalCents > 0 && !completed(row))} onClick={() => void matchEmployees()}>{matching ? 'กำลังจับคู่…' : 'จับคู่ชื่อพนักงาน / Match employee names'}</button>
        <p className="text-xs text-slate-500">ตรวจเฉพาะรายการถอนที่แสดงตามตัวกรองปัจจุบันและยังไม่มีการจับคู่ โดยใช้ชื่อ Kbiz ของพนักงาน รายการที่ตรงกันจะรอ Admin เลือกประเภทการจ่าย</p>
      </div>
      <label className="block text-sm">เลือกไฟล์ K BIZ CSV<input type="file" accept=".csv,text/csv" disabled={busy} className="block mt-2 text-sm" onChange={async event => {
        const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
        setError(''); setMessage(''); setPreview(null);
        try {
          if (file.size > 2_000_000) throw new Error('Select a CSV file smaller than 2 MB');
          const csv = await file.text(); setPreview({ csv, filename: file.name, rows: parseKbizCsv(csv) });
        } catch (err) { setError(err instanceof Error ? err.message : 'Invalid CSV'); }
      }} /></label>
      {preview && <div className="rounded-lg bg-indigo-50 p-4 space-y-3 text-sm"><strong>{preview.filename}</strong>
        <p>บัญชี {preview.rows[0].accountNumber} · {preview.rows[0].transactionDate} ถึง {preview.rows[preview.rows.length - 1].transactionDate}</p>
        <p>{preview.rows.length} รายการ · ฝาก {money(preview.rows.reduce((sum, row) => sum + row.depositCents, 0))} · ถอน {money(preview.rows.reduce((sum, row) => sum + row.withdrawalCents, 0))}</p>
        <p>รายการซ้ำจะถูกข้าม โดยเก็บการจับคู่และรายละเอียดที่บันทึกไว้</p>
        <button type="button" className={buttonClass} disabled={busy} onClick={importCsv}>{busy ? 'กำลังนำเข้า…' : 'ยืนยันนำเข้า / Import'}</button>
        <button type="button" className="ml-3" disabled={busy} onClick={() => setPreview(null)}>ยกเลิก</button>
      </div>}
    </section>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-700 text-sm">{error}</p>}
    {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-emerald-700 text-sm">{message}</p>}
    <div className="flex flex-wrap gap-3 items-end">
      <label className="text-sm">เดือนธุรกรรม<select aria-label="Transaction month" className={`${inputClass} block mt-1`} value={month} onChange={event => setMonth(event.target.value)}><option value="">ทุกเดือน</option>{Array.from(new Set(rows.map(row => row.transactionDate.slice(0, 7)))).sort().reverse().map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="text-sm">ประเภท<select className={`${inputClass} block mt-1`} value={kind} onChange={event => setKind(event.target.value)}><option value="ALL">ทั้งหมด</option><option value="DEPOSIT">เงินฝาก</option><option value="EXPENSE">รายจ่าย</option></select></label>
      <label className="text-sm">สถานะ<select className={`${inputClass} block mt-1`} value={status} onChange={event => setStatus(event.target.value)}><option value="ALL">ทั้งหมด</option><option value="PENDING">รอดำเนินการ</option><option value="REVIEW">รอยืนยันคู่ลูกค้า</option><option value="DONE">ดำเนินการแล้ว</option></select></label>
      <label className="text-sm flex-1">ค้นหา<input className={`${inputClass} block mt-1 w-full`} value={search} onChange={event => setSearch(event.target.value)} placeholder="รายละเอียด / รายจ่าย / Invoice" /></label>
      <button type="button" className={inputClass} disabled={loading || busy} onClick={() => void load()}>รีเฟรช</button>
    </div>
    <div className="grid sm:grid-cols-3 gap-3">{[['เงินฝาก', money(deposits)], ['รายจ่าย', money(expenses)], ['รอดำเนินการ', `${filtered.filter(row => !completed(row)).length} / ${filtered.length} รายการ`]].map(([label, value]) => <div key={label} className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">{label}</p><p className="text-xl font-bold mt-1">{value}</p></div>)}</div>
    {editing && (editing.withdrawalCents ? <WithdrawalReconciliationEditor key={editing.id} row={editing} payments={loading ? [] : vendorPayments} employees={loading ? [] : employees} taxPayments={loading ? [] : taxPayments} onClose={() => setEditing(null)} onSave={saveTransaction} /> :
      <TransactionEditor key={editing.id} row={editing} invoices={loading ? [] : invoices} invoiceMonth={invoiceMonth} setInvoiceMonth={setInvoiceMonth} onClose={() => setEditing(null)} onSave={saveTransaction} />)}
    <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <h3 className="font-bold p-4">Document status · INITIAL → ISSUED → COMPLETED</h3>
      <p className="px-4 pb-3 text-xs text-slate-500">INITIAL: ยังไม่พิมพ์ · ISSUED: พิมพ์แล้ว / รับเงินบางส่วน · COMPLETED: จับคู่รับเงินครบแล้ว</p>
      <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-100"><tr>{['Invoice / Receipt', 'เดือน', 'ลูกค้า', 'Status', 'ยอด Invoice (รวม VAT)', 'จับคู่แล้ว'].map(title => <th key={title} className="p-3">{title}</th>)}</tr></thead>
        <tbody>{invoices.map(invoice => <tr key={invoice.referenceKey} className="border-t border-slate-100"><td className="p-3">{invoice.invoiceNumber}</td><td className="p-3">{invoice.month}</td><td className="p-3">{invoice.customer}</td><td className={`p-3 font-medium ${invoice.status === 'COMPLETED' ? 'text-emerald-700' : invoice.status === 'ISSUED' ? 'text-indigo-700' : 'text-slate-500'}`}>{invoice.status}</td><td className="p-3 whitespace-nowrap">{money(invoice.grossCents)}</td><td className="p-3 whitespace-nowrap">{money(invoice.allocatedCents)}</td></tr>)}</tbody>
      </table></div>
    </section>
    <section className="bg-white rounded-xl border border-slate-200 overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm text-left">
      <thead className="bg-slate-100 text-slate-600"><tr>{['วันที่ / เวลา', 'รายการธนาคาร', 'ถอน', 'ฝาก', 'คงเหลือ', 'Invoice / รายละเอียดรายจ่าย', 'สถานะ', ''].map((title, index) => <th key={index} className="p-3 whitespace-nowrap">{title}</th>)}</tr></thead>
      <tbody>{loading ? <tr><td colSpan={8} className="p-8 text-center text-slate-500">กำลังโหลด…</td></tr> : !filtered.length ? <tr><td colSpan={8} className="p-8 text-center text-slate-500">{rows.length ? 'ไม่มีรายการตามเงื่อนไข' : 'ยังไม่มีรายการ กรุณานำเข้าไฟล์ CSV'}</td></tr> : filtered.map(row => <tr key={row.id} className={`border-t border-slate-100 ${editing?.id === row.id ? 'bg-indigo-50' : ''}`}>
        <td className="p-3 whitespace-nowrap">{row.transactionDate}<div className="text-xs text-slate-500">{row.transactionTime}<br />{row.accountNumber}</div></td>
        <td className="p-3 min-w-52"><div>{row.bankDescription}</div><p className="text-xs text-slate-500 mt-1">{row.details}<br />{row.channel}</p></td>
        <td className="p-3 whitespace-nowrap text-rose-700">{row.withdrawalCents ? money(row.withdrawalCents) : '—'}</td>
        <td className="p-3 whitespace-nowrap text-emerald-700">{row.depositCents ? money(row.depositCents) : '—'}</td>
        <td className="p-3 whitespace-nowrap">{money(row.balanceCents)}</td>
        <td className="p-3 min-w-52">{row.withdrawalCents ? <>
          {row.expenseDescription || (!row.vendorAllocations.length && !row.employeeAllocations.length && !row.taxAllocations.length && <span className="text-slate-400">ยังไม่ระบุรายการ</span>)}
          {row.vendorAllocations.map(item => <div key={item.vendorPaymentId} className="my-2"><strong>{item.vendorPayment.paymentNumber}</strong><p className="text-xs text-slate-500">{item.vendorPayment.vendorName} · {money(item.amountCents)}</p></div>)}
          {!!row.vendorAllocations.length && vendorAllocated(row) < row.withdrawalCents && <p className="text-xs text-amber-700">รอจับคู่ {money(row.withdrawalCents - vendorAllocated(row))}</p>}
          {row.employeeAllocations.map(item => <div key={`${item.employeeId}:${item.paymentType}:${item.paymentMonth}`} className="my-2"><strong>{item.employeeName}</strong><p className="text-xs text-slate-500">{employeePaymentTypeLabel(item.paymentType)} · {item.paymentMonth} · {money(item.amountCents)}</p></div>)}
          {!!row.employeeAllocations.length && employeeAllocated(row) < row.withdrawalCents && <p className="text-xs text-amber-700">รอจับคู่ {money(row.withdrawalCents - employeeAllocated(row))}</p>}
          {row.taxAllocations.map(item => <div key={item.taxPaymentId} className="my-2"><strong>กรมสรรพากร · {item.taxPayment.paymentMonth}</strong><p className="text-xs text-slate-500">{item.taxPayment.paymentNumber} · {money(item.amountCents)}</p></div>)}
          {!!row.taxAllocations.length && taxAllocated(row) < row.withdrawalCents && <p className="text-xs text-amber-700">รอจับคู่ {money(row.withdrawalCents - taxAllocated(row))}</p>}
        </> : <>{row.allocations.map(item => <div key={item.referenceKey} className="mb-2"><strong>{item.invoiceNumber}</strong><p className="text-xs text-slate-500">{item.customer} · {money(item.amountCents)}</p></div>)}
          {(row.depositSuggestions || []).map(item => <div key={item.id} className="my-2 min-w-64 rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
            <p className="text-xs font-bold text-amber-800">PENDING APPROVAL / รอยืนยัน</p>
            <strong>{item.invoiceNumber}</strong><p className="text-sm">{item.customer} · Invoice {item.invoiceMonth}</p>
            <p className="text-xs">แนะนำ {money(item.amountCents)} จากยอด Invoice {money(item.expectedCents)} · {item.basis === 'NET' ? 'หัก ณ ที่จ่าย 3%' : 'เต็มยอดรวม VAT'}</p>
            <p className="text-xs text-slate-600">{item.reason}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={buttonClass} disabled={busy || loading || !!editing} onClick={() => void reviewCustomerMatch(item.id, 'CONFIRMED')}>ยืนยันจับคู่</button>
              <button type="button" className={inputClass} disabled={busy || loading || !!editing} onClick={() => void reviewCustomerMatch(item.id, 'REJECTED')}>ไม่ใช่คู่นี้</button>
            </div>
          </div>)}
          {allocated(row) < row.depositCents && <p className="text-xs text-amber-700">รอจับคู่ {money(row.depositCents - allocated(row))}</p>}</>}</td>
        <td className={`p-3 whitespace-nowrap text-xs ${completed(row) ? 'text-emerald-700' : 'text-amber-700'}`}>{completed(row) ? 'COMPLETED / ดำเนินการแล้ว' : kbizReconciliationStatus(row) === 'PENDING' ? row.depositCents ? 'PENDING APPROVAL / รอยืนยัน' : 'PENDING / รอเลือกประเภท' : kbizReconciliationStatus(row) === 'PARTIAL' ? 'PARTIAL / จับคู่บางส่วน' : 'INITIAL / รอดำเนินการ'}</td>
        <td className="p-3"><button type="button" className={inputClass} disabled={busy} onClick={() => { setEditing(row); setMessage(''); }}>{row.withdrawalCents ? 'จับคู่รายจ่าย' : 'จับคู่ Invoice'}</button></td>
      </tr>)}</tbody>
    </table></div></section>
  </div>;
}
