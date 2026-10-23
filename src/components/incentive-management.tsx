'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Save } from 'lucide-react';

type Row = { id: string; name: string; department: string; month: string; score: number | null; amount: number | null };
const money = (value: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(value);
const inputClass = 'w-full min-w-24 p-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60';

function IncentiveRow({ row, onSaved, onBusy }: { row: Row; onSaved: (row: Row) => void; onBusy: (delta: number) => void }) {
  const [score, setScore] = useState(row.score === null ? '' : String(row.score));
  const [amount, setAmount] = useState(row.amount === null ? '' : String(row.amount));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const dirty = (score !== '' && Number(score) !== row.score) || (amount !== '' && Number(amount) !== row.amount)
    || (row.score !== null && score === '') || (row.amount !== null && amount === '');
  const formId = `incentive-${row.id}`;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving || !dirty) return;
    setSaving(true); onBusy(1); setError(''); setSuccess(false);
    try {
      const response = await fetch('/api/incentives', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: row.id, month: row.month, score: Number(score), amount: Number(amount) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'บันทึกไม่สำเร็จ');
      onSaved({ ...row, score: result.score, amount: result.amount });
      setScore(String(result.score)); setAmount(String(result.amount)); setSuccess(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'บันทึกไม่สำเร็จ'); }
    finally { setSaving(false); onBusy(-1); }
  }

  return <tr className="border-t border-slate-100 align-top">
    <td className="p-4 font-medium text-slate-800">{row.name}<div className="text-xs text-slate-500 mt-1">{row.department}</div></td>
    <td className="p-4"><input aria-label={`คะแนน ${row.name}`} form={formId} type="number" min="0" max="100" step="0.01" required value={score} disabled={saving} onChange={event => { setScore(event.target.value); setSuccess(false); }} placeholder="0–100" className={inputClass} /></td>
    <td className="p-4"><input aria-label={`Incentive ${row.name}`} form={formId} type="number" min="0" max="21474836.47" step="0.01" required value={amount} disabled={saving} onChange={event => { setAmount(event.target.value); setSuccess(false); }} placeholder="0.00" className={inputClass} /></td>
    <td className="p-4 text-right whitespace-nowrap">{row.amount === null ? 'ยังไม่บันทึก' : money(row.amount)}</td>
    <td className="p-4"><form id={formId} onSubmit={save}>
      <button disabled={saving || !dirty || score === '' || amount === ''} className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50"><Save className="w-4 h-4" />{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
      {error && <p role="alert" className="text-xs text-rose-700 mt-2 max-w-60">{error}</p>}
      {success && !dirty && <p role="status" className="text-xs text-emerald-700 mt-2">บันทึกแล้ว</p>}
      {dirty && <p className="text-xs text-amber-700 mt-2">ยังไม่บันทึก</p>}
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
      <div><h3 className="font-bold text-slate-800">Incentive ตามผลงานประจำเดือน</h3><p className="text-sm text-slate-500 mt-1">กรอกคะแนน 0–100 และจำนวนเงินด้วยตนเอง บันทึกแยกรายพนักงานและรายเดือน</p></div>
      <div className="flex items-end gap-3"><div><label htmlFor="incentive-month" className="block text-xs font-semibold mb-1">เดือน</label><input id="incentive-month" type="month" min="2000-01" max="9998-12" required value={month} disabled={pending > 0} onChange={event => { if (event.target.value) setMonth(event.target.value); }} className={inputClass} /></div>
        <button type="button" aria-label="โหลด Incentive ใหม่" disabled={loading || pending > 0} onClick={() => setRefresh(value => value + 1)} className="p-2.5 border border-slate-300 rounded-lg disabled:opacity-50"><RefreshCw className="w-4 h-4" /></button></div>
    </section>
    {error && <p role="alert" className="p-3 text-rose-700 bg-rose-50 rounded-lg">{error}</p>}
    {!loading && !error && <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5"><p className="text-sm text-indigo-700">Incentive ที่บันทึกแล้ว เดือน {month}</p><p className="text-2xl font-bold text-indigo-900 mt-1">{money(rows.reduce((sum, row) => sum + Math.round((row.amount || 0) * 100), 0) / 100)}</p></div>}
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm text-left">
      <thead className="bg-slate-100 text-slate-600"><tr><th className="p-4">พนักงาน</th><th className="p-4">คะแนน (เต็ม 100)</th><th className="p-4">Incentive (บาท)</th><th className="p-4 text-right">ยอดที่บันทึก</th><th className="p-4">จัดการ</th></tr></thead>
      <tbody>{loading ? <tr><td colSpan={5} className="p-8 text-center text-slate-400">กำลังโหลด...</td></tr> : rows.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-slate-400">{error ? 'โหลดข้อมูลไม่สำเร็จ' : 'ไม่มีพนักงานในเดือนที่เลือก'}</td></tr> : rows.map(row => <IncentiveRow key={`${month}:${refresh}:${row.id}`} row={row} onSaved={saved => setRows(current => current.map(item => item.id === saved.id ? saved : item))} onBusy={delta => setPending(value => value + delta)} />)}</tbody>
    </table></div></section>
  </div>;
}
