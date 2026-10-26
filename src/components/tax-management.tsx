'use client';

import { formatBangkokDate } from '@/lib/bangkok-date';

import { useEffect, useState } from 'react';
import { Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { vatAmounts, type TaxReport, type TaxMonthSummary } from '@/lib/taxes';

const money = (value: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(value);
const inputClass = 'w-full p-2.5 border border-slate-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
const buttonClass = 'px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm disabled:opacity-50';
const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const today = () => formatBangkokDate();

async function saveJson(url: string, body: unknown, method = 'POST') {
  const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'บันทึกไม่สำเร็จ');
  return result;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-slate-700"><span className="block mb-1">{label}</span>{children}</label>;
}

function PurchaseEditor({ month, initial, onSaved, onCancel }: {
  month: string; initial?: TaxReport['purchases'][number]; onSaved: () => void; onCancel: () => void;
}) {
  const [form, setForm] = useState({ supplier: initial?.supplier || '', invoice_number: initial?.invoiceNumber || '', description: initial?.description || '',
    purchase_date: initial?.purchaseDate || (today().startsWith(month) ? today() : `${month}-01`),
    amount: initial ? String(Math.round((initial.amount + (initial.vatMode === 'inclusive' ? initial.vat : 0)) * 100) / 100) : '', vat_mode: initial?.vatMode || 'exclusive', creditable: initial?.creditable || false, expense: initial?.expense ?? true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const vat = { ...vatAmounts(Number(form.amount) || 0, form.vat_mode === 'inclusive'), ...(form.vat_mode === 'none' ? { vatCents: 0 } : {}) };
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
    try { await saveJson('/api/taxes/purchases', { ...form, month, id: initial?.id, amount: Number(form.amount) }); onSaved(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'บันทึกไม่สำเร็จ'); }
    finally { setSaving(false); }
  }
  return <section className="bg-white border border-slate-200 rounded-xl p-5">
    <h3 className="font-bold mb-4">{initial ? 'แก้ไขรายการซื้อ' : 'บันทึกซื้อสินค้า / บริการ'}</h3>
    <form onSubmit={submit}><fieldset disabled={saving} className="grid md:grid-cols-2 gap-3">
      <Field label="ผู้ขาย / ผู้ให้บริการ"><input required maxLength={254} value={form.supplier} onChange={event => setForm({ ...form, supplier: event.target.value })} className={inputClass} /></Field>
      <Field label="เลขที่ใบกำกับภาษี"><input required maxLength={100} value={form.invoice_number} onChange={event => setForm({ ...form, invoice_number: event.target.value })} className={inputClass} /></Field>
      <Field label="วันที่ใบกำกับภาษี"><input type="date" required value={form.purchase_date} onChange={event => setForm({ ...form, purchase_date: event.target.value })} className={inputClass} /></Field>
      <Field label="เดือนที่ใช้สิทธิภาษีซื้อ"><input readOnly value={month} className={`${inputClass} bg-slate-50`} /></Field>
      <Field label="มูลค่ารายการ (บาท)"><input type="number" min="0" max="20000000" step="0.01" required value={form.amount} onChange={event => setForm({ ...form, amount: event.target.value })} className={inputClass} /></Field>
      <Field label="จำนวนเงินที่กรอก"><select value={form.vat_mode} onChange={event => setForm({ ...form, vat_mode: event.target.value, creditable: event.target.value === 'none' ? false : form.creditable })} className={inputClass}><option value="exclusive">ยังไม่รวม VAT 7%</option><option value="inclusive">รวม VAT 7% แล้ว</option><option value="none">ไม่มี VAT</option></select></Field>
      <div className="md:col-span-2"><Field label="สินค้า / บริการ"><textarea required rows={2} maxLength={5000} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} className={inputClass} /></Field></div>
      <label className="md:col-span-2 flex gap-2 items-start text-sm"><input type="checkbox" disabled={form.vat_mode === 'none'} checked={form.creditable} onChange={event => setForm({ ...form, creditable: event.target.checked })} className="mt-1" />มีใบกำกับภาษีที่ถูกต้องและเป็นภาษีซื้อที่มีสิทธิหักได้</label>
      <label className="md:col-span-2 flex gap-2 items-start text-sm"><input type="checkbox" checked={form.expense} onChange={event => setForm({ ...form, expense: event.target.checked })} className="mt-1" />รวมรายการนี้เป็นค่าใช้จ่ายใน Finance</label>
      <p className="md:col-span-2 text-xs text-slate-500">ไม่เลือกรวมค่าใช้จ่าย หากบันทึกเป็น Onsite/รายจ่ายอื่นแล้ว หรือเป็นการซื้อทรัพย์สิน</p>
      <p className="md:col-span-2 text-sm bg-indigo-50 text-indigo-800 rounded-lg p-3">ก่อน VAT {money(vat.amountCents / 100)} • VAT {money(vat.vatCents / 100)} • ใช้หักภาษีขาย {money(form.creditable ? vat.vatCents / 100 : 0)}</p>
      {error && <p role="alert" className="md:col-span-2 text-rose-700 text-sm">{error}</p>}
      <div className="md:col-span-2 flex gap-3"><button className={buttonClass}>{saving ? 'กำลังบันทึก...' : 'บันทึกรายการซื้อ'}</button>{initial && <button type="button" onClick={onCancel} className="text-sm text-slate-600">ยกเลิก</button>}</div>
    </fieldset></form>
  </section>;
}

function SalesEditor({ month, invoices, invoiceMonth, onInvoiceMonth, initial, onSaved, onCancel }: {
  month: string; invoices: TaxReport['invoices']; invoiceMonth: string; onInvoiceMonth: (value: string) => void;
  initial?: TaxReport['sales'][number]; onSaved: () => void; onCancel: () => void;
}) {
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(initial?.taxDate || (today().startsWith(month) ? today() : `${month}-01`));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const selected = invoices.find(invoice => invoice.referenceKey === reference);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      await saveJson('/api/taxes/sales', initial ? { id: initial.id, tax_date: date } : {
        source_type: selected?.sourceType, source_id: selected?.sourceId, invoice_month: selected?.invoiceMonth, tax_date: date,
      }); onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'บันทึกไม่สำเร็จ'); }
    finally { setSaving(false); }
  }
  return <section className="bg-white border border-slate-200 rounded-xl p-5">
    <h3 className="font-bold mb-2">{initial ? 'แก้ไขวันที่ภาษีขาย' : 'บันทึกภาษีขาย / รับชำระ Invoice'}</h3>
    <p className="text-xs text-slate-500 mb-4">บันทึกเต็มยอด Invoice ครั้งเดียวต่อรอบบิล เลือกวันที่เกิดภาษี/รับชำระตามเอกสารจริง</p>
    <form onSubmit={submit}><fieldset disabled={saving} className="space-y-3">
      {!initial && <>
        <Field label="เดือนของ Invoice ที่ต้องการบันทึก"><input type="month" min="2000-01" max="9998-12" required value={invoiceMonth} onChange={event => { if (event.target.value) { setReference(''); onInvoiceMonth(event.target.value); } }} className={inputClass} /></Field>
        <Field label="Invoice ลูกค้า / โครงการ"><select required value={reference} onChange={event => setReference(event.target.value)} className={inputClass}><option value="">เลือก Invoice</option>{invoices.map(invoice => <option key={invoice.referenceKey} value={invoice.referenceKey} disabled={invoice.recorded}>{invoice.recorded ? '(บันทึกแล้ว) ' : ''}{invoice.customer} — {invoice.invoiceNumber || invoice.description} — {money(invoice.amount)}</option>)}</select></Field>
      </>}
      {initial && <p className="text-sm">{initial.invoiceNumber} — {initial.customer}</p>}
      <Field label="วันที่เกิดภาษี / รับชำระ"><input type="date" required value={date} onChange={event => setDate(event.target.value)} className={inputClass} /></Field>
      {(selected || initial) && <p className="text-sm bg-indigo-50 text-indigo-800 rounded-lg p-3">ก่อน VAT {money(initial?.amount ?? selected!.amount)} • VAT 7% {money(initial?.vat ?? vatAmounts(selected!.amount).vatCents / 100)}</p>}
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <div className="flex gap-3"><button disabled={!initial && !selected} className={buttonClass}>{saving ? 'กำลังบันทึก...' : 'บันทึกภาษีขาย'}</button>{initial && <button type="button" onClick={onCancel} className="text-sm text-slate-600">ยกเลิก</button>}</div>
    </fieldset></form>
  </section>;
}

function CreditEditor({ summary, onSaved }: { summary: TaxMonthSummary; onSaved: () => void }) {
  const [opening, setOpening] = useState(String(summary.openingCredit));
  const [action, setAction] = useState(summary.creditAction);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
    try { await saveJson('/api/taxes', { month: summary.month, opening_credit: Number(opening), credit_action: action }, 'PUT'); onSaved(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'บันทึกไม่สำเร็จ'); }
    finally { setSaving(false); }
  }
  return <section className="bg-white border border-slate-200 rounded-xl p-5"><h3 className="font-bold mb-3">จัดการเครดิต VAT เดือน {summary.month}</h3>
    <form onSubmit={submit}><fieldset disabled={saving} className="grid md:grid-cols-3 items-end gap-3">
      <Field label="เครดิตยกมาเพิ่มเติมจากนอกระบบ (บาท)"><input type="number" min="0" max="20000000" step="0.01" required value={opening} onChange={event => setOpening(event.target.value)} className={inputClass} /></Field>
      <Field label="เมื่อมีภาษีซื้อเกินภาษีขาย"><select value={action} onChange={event => setAction(event.target.value)} className={inputClass}><option value="CARRY">ยกเครดิตไปเดือนถัดไป</option><option value="REFUND">ขอคืน (ไม่นำไปใช้เดือนถัดไป)</option></select></Field>
      <button className={buttonClass}>{saving ? 'กำลังบันทึก...' : 'บันทึกเครดิต'}</button>
      <p className="md:col-span-3 text-xs text-slate-500">เครดิตจากเดือนก่อนในระบบ {money(summary.broughtForward)} คำนวณให้อัตโนมัติ ห้ามกรอกซ้ำในช่องเครดิตเพิ่มเติม การเลือกขอคืนเป็นการบันทึกความประสงค์ ยังไม่ได้ยื่นหรือรับเงินคืน</p>
      {error && <p role="alert" className="md:col-span-3 text-sm text-rose-700">{error}</p>}
    </fieldset></form>
  </section>;
}

export default function TaxManagement({ mode }: { mode: 'vat' | 'social-security' }) {
  const isSocialSecurity = mode === 'social-security';
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [invoiceMonth, setInvoiceMonth] = useState(month);
  const [report, setReport] = useState<TaxReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [purchaseEdit, setPurchaseEdit] = useState<TaxReport['purchases'][number]>();
  const [saleEdit, setSaleEdit] = useState<TaxReport['sales'][number]>();
  function saved() { setPurchaseEdit(undefined); setSaleEdit(undefined); setSuccess('บันทึกแล้ว'); setRefresh(value => value + 1); }
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    async function load() {
      try {
        const response = await fetch(`/api/taxes?month=${month}&invoice_month=${invoiceMonth}`, { signal: controller.signal, cache: 'no-store' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'โหลดไม่สำเร็จ');
        if (!controller.signal.aborted) setReport(result);
      } catch (cause) { if (!controller.signal.aborted) { setReport(null); setError(cause instanceof Error ? cause.message : 'โหลดไม่สำเร็จ'); } }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load(); return () => controller.abort();
  }, [month, invoiceMonth, refresh]);
  async function remove(kind: 'sales' | 'purchases', id: string) {
    if (!window.confirm('ลบรายการนี้และคำนวณ VAT ใหม่?')) return;
    setDeleting(true); setError('');
    try { await saveJson(`/api/taxes/${kind}`, { id }, 'DELETE'); saved(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'ลบไม่สำเร็จ'); }
    finally { setDeleting(false); }
  }
  const summary = report?.summary;
  return <div className="space-y-5">
    <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap justify-between items-end gap-4">
      <div><h3 className="font-bold">{isSocialSecurity ? 'ประกันสังคมรายเดือน' : 'VAT ชำระ / ขอคืน'}</h3><p className="text-sm text-slate-500 mt-1">{isSocialSecurity ? 'เงินสมทบ 5% สูงสุดฝ่ายละ 875 บาท ยกเว้นเจ้าของกิจการ' : 'ภาษีขาย หักภาษีซื้อที่มีสิทธิ และเครดิตยกมา'}</p></div>
      <div className="flex gap-3 items-end"><Field label="เดือน"><input type="month" min="2000-01" max="9998-12" required value={month} onChange={event => { if (event.target.value) { setMonth(event.target.value); setInvoiceMonth(event.target.value); setPurchaseEdit(undefined); setSaleEdit(undefined); setSuccess(''); } }} className={inputClass} /></Field><button aria-label="โหลดข้อมูลภาษีใหม่" disabled={loading || deleting} onClick={() => setRefresh(value => value + 1)} className="p-3 border border-slate-300 rounded-lg disabled:opacity-50"><RefreshCw className="w-4 h-4" /></button></div>
    </section>
    {error && <p role="alert" className="p-3 bg-rose-50 text-rose-700 rounded-lg">{error}</p>}
    {success && <p role="status" className="text-emerald-700 text-sm">{success}</p>}
    {loading && <p className="text-center text-slate-500">กำลังคำนวณ...</p>}
    {report && summary && report.month === month && <>
      <div className={`grid sm:grid-cols-2 ${isSocialSecurity ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-4`}>{(isSocialSecurity ? [
        ['ประกันสังคมนายจ้าง (ค่าใช้จ่ายบริษัท)', summary.employerSocialSecurity], ['หักประกันสังคมลูกจ้าง', summary.employeeSocialSecurity], ['รวมประกันสังคมที่นำส่ง 2 ฝ่าย', summary.totalSocialSecurity],
      ] : [
        ['ภาษีขาย', summary.outputVat], ['ภาษีซื้อที่มีสิทธิ', summary.inputVat], ['VAT ต้องชำระกรมสรรพากร', summary.payable], ['เครดิตยกไป / ยอดขอคืน', summary.carryForward + summary.refundRequested],
      ]).map(([label, value]) => <div key={label} className="bg-white border border-slate-200 rounded-xl p-5"><p className="text-sm text-slate-500">{label}</p><p className="text-2xl font-bold text-indigo-800 mt-2">{money(Number(value))}</p></div>)}</div>
      {isSocialSecurity && <p className="bg-indigo-50 rounded-xl p-4 text-sm text-indigo-900">Finance รวมเฉพาะเงินสมทบฝ่ายนายจ้าง เงินสมทบลูกจ้างหักจากเงินเดือนจึงไม่บวกเป็นค่าใช้จ่ายซ้ำ</p>}
      {!isSocialSecurity && <>
      <section className="bg-indigo-50 rounded-xl p-4 text-sm text-indigo-900 space-y-1"><p>VAT เดือน {month}: ภาษีขาย {money(summary.outputVat)} − ภาษีซื้อที่มีสิทธิ {money(summary.inputVat)} − เครดิตเดิม/เพิ่มเติม {money(summary.broughtForward + summary.openingCredit)} = ต้องชำระ {money(summary.payable)}</p><p>เครดิตยกไป {money(summary.carryForward)} • ยอดขอคืน {money(summary.refundRequested)} (ยังไม่ใช่เงินคืนที่ได้รับ)</p><p>VAT ที่หักได้ไม่ใช่ค่าใช้จ่ายใน Finance</p><p>บันทึกวันที่เกิดภาษีตามเอกสารจริง กรณีออกใบกำกับภาษีก่อนรับเงินอาจต้องรับรู้ภาษีก่อนวันรับชำระ</p></section>
      <div className="grid xl:grid-cols-2 gap-5">
        <SalesEditor key={`sale:${month}:${saleEdit?.id || refresh}`} month={month} invoices={loading ? [] : report.invoices} invoiceMonth={invoiceMonth} onInvoiceMonth={setInvoiceMonth} initial={saleEdit} onSaved={saved} onCancel={() => setSaleEdit(undefined)} />
        <PurchaseEditor key={`purchase:${month}:${purchaseEdit?.id || refresh}`} month={month} initial={purchaseEdit} onSaved={saved} onCancel={() => setPurchaseEdit(undefined)} />
      </div>
      <CreditEditor key={`credit:${month}:${refresh}`} summary={summary} onSaved={saved} />
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden"><h3 className="font-bold p-5">ภาษีขายที่บันทึกเดือน {month}</h3><div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-100"><tr>{['วันที่เกิดภาษี', 'Invoice / ลูกค้า', 'ก่อน VAT', 'VAT', 'จัดการ'].map(title => <th key={title} className="p-3">{title}</th>)}</tr></thead><tbody>{report.sales.length ? report.sales.map(sale => <tr key={sale.id} className="border-t border-slate-100"><td className="p-3 whitespace-nowrap">{sale.taxDate}</td><td className="p-3">{sale.invoiceNumber}<div className="text-xs text-slate-500">{sale.customer}</div></td><td className="p-3 whitespace-nowrap">{money(sale.amount)}</td><td className="p-3 whitespace-nowrap">{money(sale.vat)}</td><td className="p-3"><div className="flex gap-3"><button onClick={() => setSaleEdit(sale)} aria-label={`แก้ไข ${sale.invoiceNumber}`}><Pencil className="w-4 h-4" /></button><button disabled={deleting} onClick={() => void remove('sales', sale.id)} aria-label={`ลบ ${sale.invoiceNumber}`} className="text-rose-600"><Trash2 className="w-4 h-4" /></button></div></td></tr>) : <tr><td colSpan={5} className="p-5 text-center text-slate-400">ยังไม่มีภาษีขายที่บันทึก (Invoice ที่ยังไม่บันทึกจะไม่รวม VAT)</td></tr>}</tbody></table></div></section>
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden"><h3 className="font-bold p-5">รายการซื้อเดือน {month}</h3><div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-100"><tr>{['ผู้ขาย / เลขที่เอกสาร', 'รายการ', 'ก่อน VAT', 'VAT', 'สิทธิภาษีซื้อ', 'จัดการ'].map(title => <th key={title} className="p-3">{title}</th>)}</tr></thead><tbody>{report.purchases.length ? report.purchases.map(purchase => <tr key={purchase.id} className="border-t border-slate-100"><td className="p-3">{purchase.supplier}<div className="text-xs text-slate-500">{purchase.invoiceNumber} • {purchase.purchaseDate}</div></td><td className="p-3">{purchase.description}</td><td className="p-3 whitespace-nowrap">{money(purchase.amount)}</td><td className="p-3 whitespace-nowrap">{money(purchase.vat)}</td><td className="p-3">{purchase.creditable ? 'ใช้สิทธิ' : 'ไม่ใช้สิทธิ'}{purchase.expense && <div className="text-xs text-slate-500">รวมค่าใช้จ่าย Finance</div>}</td><td className="p-3"><div className="flex gap-3"><button onClick={() => setPurchaseEdit(purchase)} aria-label={`แก้ไข ${purchase.invoiceNumber}`}><Pencil className="w-4 h-4" /></button><button disabled={deleting} onClick={() => void remove('purchases', purchase.id)} aria-label={`ลบ ${purchase.invoiceNumber}`} className="text-rose-600"><Trash2 className="w-4 h-4" /></button></div></td></tr>) : <tr><td colSpan={6} className="p-5 text-center text-slate-400">ไม่มีรายการซื้อ</td></tr>}</tbody></table></div></section>
      </>}
      {isSocialSecurity && <section className="bg-white border border-slate-200 rounded-xl overflow-hidden"><h3 className="font-bold p-5">ประกันสังคมรายพนักงาน เดือน {month}</h3><p className="px-5 pb-3 text-xs text-slate-500">ใช้อัตราเงินเดือนปัจจุบัน และสูตร 5% ไม่เกิน 875 บาทตามที่กำหนด</p>{report.employees.some(employee => !employee.isOwner && employee.salary === null) && <p className="px-5 pb-3 text-sm text-amber-800">ยังไม่มีเงินเดือน: {report.employees.filter(employee => !employee.isOwner && employee.salary === null).map(employee => employee.name).join(', ')} — ยอดเงินสมทบยังไม่ครบ</p>}<div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-100"><tr>{['พนักงาน', 'เงินเดือน', 'หักลูกจ้าง', 'นายจ้างสมทบ', 'นำส่งรวม'].map(title => <th key={title} className="p-3">{title}</th>)}</tr></thead><tbody>{report.employees.map(employee => <tr key={employee.id} className="border-t border-slate-100"><td className="p-3">{employee.name}{employee.isOwner && <div className="text-xs text-amber-800 mt-1">Owner — ไม่ส่งประกันสังคม</div>}</td>{[employee.salary, employee.employee, employee.employer, employee.total].map((value, index) => <td key={index} className="p-3 whitespace-nowrap">{value === null ? 'ยังไม่ระบุ' : money(value)}</td>)}</tr>)}</tbody></table></div></section>}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden"><h3 className="font-bold p-5">{isSocialSecurity ? 'ประกันสังคมรายเดือน' : 'VAT และเครดิตรายเดือน'} ปี {month.slice(0, 4)}</h3><div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-100"><tr>{(isSocialSecurity ? ['เดือน', 'นายจ้างสมทบ', 'หักลูกจ้าง', 'นำส่งรวม'] : ['เดือน', 'VAT ขาย', 'VAT ซื้อมีสิทธิ', 'เครดิตเดิม/เพิ่ม', 'VAT ต้องชำระ', 'เครดิตยกไป', 'ขอคืน']).map(title => <th key={title} className="p-3 whitespace-nowrap">{title}</th>)}</tr></thead><tbody>{report.monthly.map(row => <tr key={row.month} className={row.month === month ? 'bg-indigo-50' : 'border-t border-slate-100'}><td className="p-3"><button onClick={() => { setMonth(row.month); setInvoiceMonth(row.month); setSaleEdit(undefined); setPurchaseEdit(undefined); }} className="text-indigo-700 underline">{months[Number(row.month.slice(5)) - 1]}</button></td>{(isSocialSecurity ? [row.employerSocialSecurity, row.employeeSocialSecurity, row.totalSocialSecurity] : [row.outputVat, row.inputVat, row.broughtForward + row.openingCredit, row.payable, row.carryForward, row.refundRequested]).map((value, index) => <td key={index} className="p-3 whitespace-nowrap">{money(value)}</td>)}</tr>)}</tbody></table></div></section>
    </>}
  </div>;
}
