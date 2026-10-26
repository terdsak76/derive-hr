'use client';

import { useEffect, useState } from 'react';
import { Check, RefreshCw, Save } from 'lucide-react';
import { calculateIncentiveCents } from '@/lib/incentives';

type Row = { id: string; name: string; department: string; month: string; fullIncentive: number; score: number | null; amount: number | null; status: string | null; paymentDate: string | null; approvedAt: string | null };
const statusLabels: Record<string, string> = { INITIAL: 'Initial / รออนุมัติ', PAYMENT_PENDING: 'Payment pending / รอจ่ายเงิน', COMPLETED: 'Completed / จ่ายแล้ว' };
const statusColors: Record<string, string> = { INITIAL: 'bg-slate-100 text-slate-700', PAYMENT_PENDING: 'bg-amber-100 text-amber-800', COMPLETED: 'bg-emerald-100 text-emerald-800' };
const money = (value: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(value);
const inputClass = 'w-full min-w-24 p-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60';

function IncentiveRow({ row, onSaved, onBusy }: { row: Row; onSaved: (row: Row) => void; onBusy: (delta: number) => void }) {
  const [score, setScore] = useState(row.score === null ? '' : String(row.score));
  const locked = row.status === 'COMPLETED' || !!row.paymentDate;
  const amount = locked ? row.amount : score === '' ? null : calculateIncentiveCents(Math.round(row.fullIncentive * 100), Number(score)) / 100;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const dirty = (score !== '' && Number(score) !== row.score) || amount !== row.amount || (row.score !== null && score === '');
  const formId = `incentive-${row.id}`;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving || !dirty || locked) return;
    setSaving(true); onBusy(1); setError(''); setSuccess('');
    try {
      const response = await fetch('/api/incentives', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: row.id, month: row.month, score: Number(score) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'บันทึกไม่สำเร็จ');
      onSaved({ ...row, score: result.score, amount: result.amount, fullIncentive: result.fullIncentive, status: result.status, paymentDate: result.paymentDate, approvedAt: result.approvedAt });
      setScore(String(result.score)); setSuccess('บันทึกแล้ว');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'บันทึกไม่สำเร็จ'); }
    finally { setSaving(false); onBusy(-1); }
  }

  async function approve() {
    if (saving || dirty || row.status !== 'INITIAL') return;
    setSaving(true); onBusy(1); setError(''); setSuccess('');
    try {
      const response = await fetch('/api/incentives', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: row.id, month: row.month, action: 'APPROVE', score: row.score, amountCents: Math.round(row.amount * 100) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'อนุมัติไม่สำเร็จ');
      onSaved({ ...row, status: result.status, paymentDate: result.paymentDate, approvedAt: result.approvedAt });
      setSuccess('อนุมัติแล้ว');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'อนุมัติไม่สำเร็จ'); }
    finally { setSaving(false); onBusy(-1); }
  }

  return <tr className="border-t border-slate-100 align-top">
    <td className="p-4 font-medium text-slate-800">{row.name}<div className="text-xs text-slate-500 mt-1">{row.department}</div></td>
    <td className="p-4 text-right whitespace-nowrap">{money(row.fullIncentive)}{row.fullIncentive === 0 && <p className="text-xs text-amber-700 mt-1">ตั้งค่าได้ใน Salary &amp; Incentive Management</p>}</td>
    <td className="p-4"><input aria-label={`คะแนน ${row.name}`} form={formId} type="number" min="0" max="100" step="0.01" required value={score} disabled={saving || locked} onChange={event => { setScore(event.target.value); setSuccess(''); }} placeholder="0–100" className={inputClass} /></td>
    <td className="p-4 text-right whitespace-nowrap"><output aria-label={`Incentive ที่คำนวณ ${row.name}`}>{amount === null ? '—' : money(amount)}</output></td>
    <td className="p-4 text-right whitespace-nowrap">{row.amount === null ? 'ยังไม่บันทึก' : money(row.amount)}</td>
    <td className="p-4 whitespace-nowrap">{row.status ? <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusColors[row.status] || statusColors.INITIAL}`}>{statusLabels[row.status] || row.status}</span> : '—'}</td>
    <td className="p-4 whitespace-nowrap">{row.paymentDate || '—'}{row.paymentDate && row.status === 'PAYMENT_PENDING' && <p className="text-xs text-amber-700 mt-1">จ่ายบางส่วนแล้ว</p>}</td>
    <td className="p-4"><form id={formId} onSubmit={save}>
      <div className="flex gap-2">
        <button disabled={saving || locked || !dirty || score === ''} className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50"><Save className="w-4 h-4" />{saving ? 'กำลังดำเนินการ...' : 'บันทึก'}</button>
        {row.status === 'INITIAL' && <button type="button" onClick={() => void approve()} disabled={saving || dirty} className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"><Check className="w-4 h-4" />อนุมัติ</button>}
      </div>
      {error && <p role="alert" className="text-xs text-rose-700 mt-2 max-w-60">{error}</p>}
      {success && !dirty && <p role="status" className="text-xs text-emerald-700 mt-2">{success}</p>}
      {dirty && <p className="text-xs text-amber-700 mt-2">ยังไม่บันทึก</p>}
      {locked && <p className="text-xs text-slate-500 mt-2 max-w-60">ยกเลิกการจับคู่ Kbiz ก่อนแก้ไข</p>}
    </form></td>
  </tr>;
}

export default function IncentiveManagement() {
  const [month, setMonth] = useState(() => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok' }).format(new Date()).slice(0, 7));
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setRows([]);
    async function load() {
      try {
        const response = await fetch(`/api/incentives?month=${month}`, { signal: controller.signal, cache: 'no-store' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'โหลดไม่สำเร็จ');
        if (!controller.signal.aborted) setRows(result);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'โหลดไม่สำเร็จ');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [month, refresh]);

  return <div className="space-y-5">
    <section className="bg-white rounded-xl border border-slate-200 p-5 flex flex-wrap justify-between items-end gap-4">
      <div><h3 className="font-bold text-slate-800">Incentive ตามผลงานประจำเดือน</h3><p className="text-sm text-slate-500 mt-1">Incentive = Full incentive × คะแนน / 100 (ปัดเป็น 2 ตำแหน่ง) ตั้งค่า Full incentive ใน Salary &amp; Incentive Management แล้วกรอกคะแนนและบันทึกรายเดือน</p><p className="text-xs text-slate-500 mt-1">ยอดที่บันทึกไว้จะไม่เปลี่ยนตาม Full incentive จนกว่าจะบันทึกเดือนนั้นใหม่</p></div>
      <div className="flex items-end gap-3"><div><label htmlFor="incentive-month" className="block text-xs font-semibold mb-1">เดือน</label><input id="incentive-month" type="month" min="2000-01" max="9998-12" required value={month} disabled={pending > 0} onChange={event => { if (event.target.value) setMonth(event.target.value); }} className={inputClass} /></div>
        <button type="button" aria-label="โหลด Incentive ใหม่" disabled={loading || pending > 0} onClick={() => setRefresh(value => value + 1)} className="p-2.5 border border-slate-300 rounded-lg disabled:opacity-50"><RefreshCw className="w-4 h-4" /></button></div>
    </section>
    <p className="text-sm text-slate-600">Initial → Admin อนุมัติ → Payment pending → จับคู่ Kbiz ครบยอด → Completed วันที่จ่ายเงินอ้างอิงรายการธนาคารล่าสุดที่จับคู่กับ Incentive ของเดือนนี้ หากแก้ไขยอดก่อนจ่ายจะต้องอนุมัติใหม่</p>
    {error && <p role="alert" className="p-3 text-rose-700 bg-rose-50 rounded-lg">{error}</p>}
    {!loading && !error && <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5"><p className="text-sm text-indigo-700">Incentive ที่บันทึกแล้ว เดือน {month}</p><p className="text-2xl font-bold text-indigo-900 mt-1">{money(rows.reduce((sum, row) => sum + Math.round((row.amount || 0) * 100), 0) / 100)}</p></div>}
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm text-left">
      <thead className="bg-slate-100 text-slate-600"><tr><th className="p-4">พนักงาน</th><th className="p-4 text-right">Full incentive (บาท)</th><th className="p-4">คะแนน (เต็ม 100)</th><th className="p-4 text-right">Incentive ที่คำนวณ (บาท)</th><th className="p-4 text-right">ยอดที่บันทึก</th><th className="p-4">สถานะ</th><th className="p-4">วันที่จ่ายเงิน</th><th className="p-4">จัดการ</th></tr></thead>
      <tbody>{loading ? <tr><td colSpan={8} className="p-8 text-center text-slate-400">กำลังโหลด...</td></tr> : rows.length === 0 ? <tr><td colSpan={8} className="p-8 text-center text-slate-400">{error ? 'โหลดข้อมูลไม่สำเร็จ' : 'ไม่มีพนักงานในเดือนที่เลือก'}</td></tr> : rows.map(row => <IncentiveRow key={`${month}:${refresh}:${row.id}`} row={row} onSaved={saved => setRows(current => current.map(item => item.id === saved.id ? saved : item))} onBusy={delta => setPending(value => value + delta)} />)}</tbody>
    </table></div></section>
  </div>;
}
