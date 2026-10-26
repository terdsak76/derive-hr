'use client';

import { useEffect, useState } from 'react';
import { Printer, RefreshCw, X } from 'lucide-react';
import { certificateAmountKeys, type CertificateAmounts, type EmployeeTaxReport, type TaxSummaryRow } from '@/lib/employee-tax-summary';

const money = (cents: number) => (cents / 100).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const labels: Record<keyof CertificateAmounts, string> = { salaryCents: 'เงินเดือน', incentiveCents: 'Incentive', bonusCents: 'โบนัส', overtimeCents: 'OT', socialSecurityCents: 'ปกส. ลูกจ้างที่หักจริง' };
const currentYear = () => Number(new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok', year: 'numeric' }).format(new Date()));

export default function EmployeeTaxSummary({ onManageEmployees }: { onManageEmployees?: () => void }) {
  const [year, setYear] = useState(String(currentYear()));
  const [report, setReport] = useState<EmployeeTaxReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [review, setReview] = useState<TaxSummaryRow | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [printing, setPrinting] = useState(false);
  const hasTaxDetails = !!review && /^\d{13}$/.test(review.taxId) && !!review.address.trim();

  useEffect(() => {
    const controller = new AbortController();
    setReport(null); setReview(null); setError('');
    if (!/^\d{4}$/.test(year) || Number(year) < 2000 || Number(year) > 9998) { setLoading(false); return; }
    setLoading(true);
    void fetch(`/api/employee-tax-summary?year=${year}`, { signal: controller.signal, cache: 'no-store' }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'โหลดข้อมูลไม่สำเร็จ');
      if (!controller.signal.aborted) setReport(data);
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [year, revision]);

  function openReview(employee: TaxSummaryRow) {
    setAmounts(Object.fromEntries(certificateAmountKeys.map(key => [key, (employee[key] / 100).toFixed(2)])));
    setConfirmed(false); setError(''); setReview(employee);
  }

  async function print(event: React.FormEvent) {
    event.preventDefault();
    if (!review || !report || !hasTaxDetails || !confirmed || printing) return;
    const values = Object.fromEntries(certificateAmountKeys.map(key => [key, Math.round(Number(amounts[key]) * 100)]));
    // Open synchronously so the browser does not block the print preview popup.
    const popup = window.open('', '_blank');
    if (!popup) { setError('กรุณาอนุญาตหน้าต่างป๊อปอัปเพื่อพิมพ์เอกสาร'); return; }
    popup.opener = null;
    setPrinting(true); setError('');
    try {
      const response = await fetch('/api/employee-tax-summary/certificate', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: String(report.year), employeeId: review.id, confirmed: true, amounts: values }) });
      if (!response.ok) throw new Error((await response.json()).error || 'สร้างเอกสารไม่สำเร็จ');
      const html = await response.text();
      if (popup.closed) throw new Error('หน้าต่างพิมพ์ถูกปิด กรุณาลองใหม่');
      popup.document.open(); popup.document.write(html); popup.document.close();
    } catch (error) {
      popup.close(); setError(error instanceof Error ? error.message : 'พิมพ์ไม่สำเร็จ');
    } finally { setPrinting(false); }
  }

  const columns = ['salaryCents', 'incentiveCents', 'bonusCents', 'overtimeCents', 'totalCents', 'socialSecurityCents', 'withheldCents'] as const;
  return <section className="space-y-4">
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-sm font-medium">ปี ค.ศ.<input aria-label="ปีภาษี ค.ศ." type="number" min="2000" max="9998" value={year} onChange={event => setYear(event.target.value)} className="block border rounded-lg p-2 mt-1 w-32" /></label>
      <span className="text-sm text-slate-600">พ.ศ. {Number(year) + 543}</span>
      <button type="button" disabled={loading} onClick={() => setRevision(value => value + 1)} className="flex gap-2 items-center px-4 py-2 rounded-lg bg-blue-600 text-white"><RefreshCw size={16} /> รีเฟรช</button>
    </div>
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 space-y-1">
      <p>เงินเดือนตามประวัติ (เปลี่ยนระหว่างเดือนเฉลี่ยตามวันปฏิทิน) + Incentive/โบนัสที่อนุมัติตามเดือนรายจ่าย + OT ที่อนุมัติตามเดือนทำงาน ไม่ใช่ยอดจ่ายจริงจาก Kbiz</p>
      <p>ปกส. แสดงประมาณการเฉพาะส่วนลูกจ้าง ตามกฎเดิมของระบบ 5% สูงสุด 875 บาท/เดือน ไม่รวมส่วนบริษัท โปรดตรวจสอบอัตราและยอดหักจริงของปีที่เลือก</p>
      <p>ไม่มีการหักภาษีจากเงินเดือน: ภาษีหัก ณ ที่จ่าย 0.00 บาท · ต้องตรวจสอบยอดจ่ายจริงและ ปกส. ก่อนพิมพ์หนังสือรับรองฯ</p>
      {report && <p>แสดงถึงเดือน {report.throughMonth.endsWith('-00') ? 'ยังไม่เริ่มปีที่เลือก' : report.throughMonth} (ปีปัจจุบันรวมเงินเดือนทั้งเดือนปัจจุบัน)</p>}
    </div>
    {error && <p role="alert" className="text-rose-700">{error}</p>}
    {loading ? <p role="status">กำลังโหลด...</p> : report && <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm whitespace-nowrap"><thead className="bg-slate-100"><tr>{['พนักงาน / เลขผู้เสียภาษี', 'เงินเดือน', 'Incentive', 'โบนัส', 'OT', 'รวมรายได้', 'ปกส. ลูกจ้าง (คำนวณ)', 'ภาษีหัก ณ ที่จ่าย', 'หนังสือรับรองฯ'].map(label => <th key={label} className="p-3 text-left">{label}</th>)}</tr></thead>
        <tbody>{report.employees.map(employee => <tr key={employee.id} className="border-t border-slate-100">
          <td className="p-3"><p className="font-semibold">{employee.name}</p><p className="text-xs text-slate-500">{employee.taxId || 'ยังไม่มีเลขผู้เสียภาษี'}</p>{employee.warnings.map(text => <p key={text} className="text-xs text-amber-700 whitespace-normal max-w-xs mt-1">{text}</p>)}</td>
          {columns.map(key => <td key={key} className="p-3 text-right tabular-nums">{money(employee[key])}</td>)}
          <td className="p-3"><button type="button" disabled={printing} onClick={() => openReview(employee)} className="flex gap-2 items-center rounded-lg px-3 py-2 bg-blue-600 text-white disabled:opacity-40"><Printer size={16} /> ตรวจสอบ / พิมพ์</button></td>
        </tr>)}</tbody>
        <tfoot className="bg-blue-50 font-semibold"><tr><td className="p-3">รวมทั้งปี</td>{columns.map(key => <td key={key} className="p-3 text-right">{money(report.employees.reduce((sum, employee) => sum + employee[key], 0))}</td>)}<td /></tr></tfoot>
      </table>{!report.employees.length && <p className="p-5">ไม่พบพนักงาน</p>}
    </div>}
    {review && <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"><form onSubmit={print} role="dialog" aria-modal="true" aria-labelledby="certificate-title" className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4">
      <div className="flex justify-between items-center"><h3 id="certificate-title" className="font-bold">ตรวจสอบยอดจ่ายจริง — {review.name}</h3><button type="button" aria-label="ปิด" disabled={printing} onClick={() => setReview(null)}><X size={18} /></button></div>
      <p className="text-sm text-slate-600">ปรับยอดให้ตรงยอดที่จ่าย/หักจริงในปี {report?.year} ก่อนออกหนังสือรับรอง 50 ทวิ (2 ฉบับ) ยอดที่แก้ไขใช้กับการพิมพ์ครั้งนี้เท่านั้น ไม่เปลี่ยนข้อมูลรายงาน</p>
      <div className="rounded-lg border border-slate-200 p-3 text-sm space-y-1">
        <p>เลขผู้เสียภาษี: {review.taxId || 'ยังไม่ระบุ'}</p>
        <p className="whitespace-pre-wrap">ที่อยู่: {review.address || 'ยังไม่ระบุ'}</p>
      </div>
      {!hasTaxDetails && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 space-y-2">
        <p>ยังพิมพ์ไม่ได้: {[/^\d{13}$/.test(review.taxId) ? '' : 'กรุณาระบุเลขผู้เสียภาษี 13 หลัก', review.address.trim() ? '' : 'กรุณาระบุที่อยู่พนักงาน'].filter(Boolean).join(' และ ')}</p>
        <p>แก้ไขข้อมูลในเมนูจัดการพนักงาน แล้วกลับมาเปิดตรวจสอบ / พิมพ์อีกครั้ง</p>
        {onManageEmployees && <button type="button" onClick={onManageEmployees} className="text-blue-700 underline">ไปจัดการพนักงาน</button>}
      </div>}
      {certificateAmountKeys.map(key => <label key={key} className="block text-sm">{labels[key]} (บาท)<input required type="number" min="0" max="1000000000" step="0.01" value={amounts[key]} onChange={event => { setAmounts(current => ({ ...current, [key]: event.target.value })); setConfirmed(false); }} className="block w-full border rounded-lg p-2 mt-1" /></label>)}
      <p className="text-sm">ภาษีหัก ณ ที่จ่าย: 0.00 บาท</p>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required /> ยืนยันว่าได้ตรวจสอบยอดจ่ายจริง เลขผู้เสียภาษี ที่อยู่ และ ปกส. ที่หักจริงแล้ว</label>
      {error && <p role="alert" className="text-rose-700 text-sm">{error}</p>}
      <button disabled={!hasTaxDetails || !confirmed || printing} type="submit" className="w-full p-3 rounded-lg bg-blue-600 text-white disabled:opacity-40">{printing ? 'กำลังสร้างเอกสาร...' : 'เปิดเอกสารเพื่อพิมพ์'}</button>
    </form></div>}
  </section>;
}
