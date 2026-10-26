'use client';

import { bangkokYear } from '@/lib/bangkok-date';

import { useEffect, useState } from 'react';
import { Check, RefreshCw, Save } from 'lucide-react';
import { calculateBonusCents } from '@/lib/bonuses';

type SavedBonus = { id: string; score: number; salaryCents: number; leaveDays: number; maxLeaveDays: number; baseCents: number; deductionCents: number; amountCents: number; updatedAt: string; status: string; paymentDate: string | null };
type Employee = { id: string; name: string; department: string; salaryCents: number | null; leaveDays: number; saved: SavedBonus | null };
const money = (cents: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(cents / 100);
const inputClass = 'p-2.5 border border-slate-300 rounded-lg bg-white text-sm disabled:opacity-60';
const statusLabels: Record<string, string> = { INITIAL: 'Initial / รออนุมัติ', PAYMENT_PENDING: 'Payment pending / รอจ่ายเงิน', COMPLETED: 'Completed / จ่ายแล้ว' };
const statusColors: Record<string, string> = { INITIAL: 'bg-slate-100 text-slate-700', PAYMENT_PENDING: 'bg-amber-100 text-amber-800', COMPLETED: 'bg-emerald-100 text-emerald-800' };

export default function BonusManagement() {
  const [currentYear] = useState(() => bangkokYear());
  const [year, setYear] = useState(currentYear);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [maxLeaveDays, setMaxLeaveDays] = useState('0');
  const [expenseMonth, setExpenseMonth] = useState(`${year}-12`);
  const [loadedExpenseMonth, setLoadedExpenseMonth] = useState(`${year}-12`);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setEmployees([]); setScores({});
    async function load() {
      try {
        const response = await fetch(`/api/bonuses?year=${year}`, { cache: 'no-store', signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'โหลด Bonus ไม่สำเร็จ');
        if (!controller.signal.aborted) {
          setEmployees(result.employees); setMaxLeaveDays(String(result.maxLeaveDays)); setExpenseMonth(result.expenseMonth);
          setLoadedExpenseMonth(result.expenseMonth);
          setScores(Object.fromEntries(result.employees.map((employee: Employee) => [employee.id, employee.saved ? String(employee.saved.score) : ''])));
        }
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'โหลด Bonus ไม่สำเร็จ'); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [year, refresh]);

  const calculations = employees.map(employee => {
    const locked = !!employee.saved && employee.saved.status !== 'INITIAL';
    const text = scores[employee.id] ?? '';
    const score = Number(text), allowance = Number(maxLeaveDays);
    const valid = text !== '' && employee.salaryCents !== null && Number.isFinite(score) && score >= 0 && score <= 200 &&
      maxLeaveDays !== '' && Number.isFinite(allowance) && allowance >= 0 && allowance <= 366;
    const calculation = locked ? { ...employee.saved!, excessLeaveDays: Math.max(0, employee.saved!.leaveDays - employee.saved!.maxLeaveDays) } : valid ? calculateBonusCents(employee.salaryCents!, score, employee.leaveDays, allowance) : null;
    const canApprove = !locked && employee.saved && valid && score === employee.saved.score && allowance === employee.saved.maxLeaveDays &&
      employee.salaryCents === employee.saved.salaryCents && employee.leaveDays === employee.saved.leaveDays && expenseMonth === loadedExpenseMonth;
    return { employee, calculation, locked, canApprove };
  });

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving || loading) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/bonuses', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        year, maxLeaveDays: Number(maxLeaveDays), expenseMonth,
        scores: employees.filter(employee => (!employee.saved || employee.saved.status === 'INITIAL') && (scores[employee.id] ?? '') !== '').map(employee => ({ employeeId: employee.id, score: Number(scores[employee.id]) })),
      }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'บันทึก Bonus ไม่สำเร็จ');
      setMessage(`บันทึกการตั้งค่าและ Bonus ${result.saved} คนเรียบร้อยแล้ว`); setRefresh(value => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'บันทึก Bonus ไม่สำเร็จ'); }
    finally { setSaving(false); }
  }

  async function approve(bonus: SavedBonus) {
    if (saving || loading) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/bonuses', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: bonus.id, action: 'APPROVE', updatedAt: bonus.updatedAt }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'อนุมัติ Bonus ไม่สำเร็จ');
      setMessage('อนุมัติ Bonus แล้ว สามารถจับคู่รายการจ่ายใน Kbiz ได้'); setRefresh(value => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'อนุมัติ Bonus ไม่สำเร็จ'); }
    finally { setSaving(false); }
  }

  return <form onSubmit={save} className="space-y-5">
    <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-slate-800">Bonus ตามผลงานพนักงาน</h3>
        <p className="text-sm text-slate-600 mt-1">คะแนนรายคน 0–200% โดย 100% เท่ากับเงินเดือน 1 เดือน ไม่รวมเจ้าของกิจการ</p></div>
        <button type="button" aria-label="โหลด Bonus ใหม่" disabled={loading || saving} onClick={() => { setMessage(''); setRefresh(value => value + 1); }} className="p-2.5 border rounded-lg"><RefreshCw className="w-4 h-4" /></button>
      </div>
      <div className="flex flex-wrap gap-4 items-end">
        <label className="text-sm" htmlFor="bonus-year">ปีที่ประเมิน<select id="bonus-year" value={year} disabled={saving} onChange={event => { setYear(Number(event.target.value)); setMessage(''); }} className={`${inputClass} block mt-1`}>
          {Array.from({ length: currentYear + 6 - 2000 }, (_, index) => 2000 + index).reverse().map(value => <option key={value} value={value}>{value}</option>)}
        </select></label>
        <label className="text-sm" htmlFor="bonus-leave-allowance">วันลาสูงสุดที่ไม่หัก Bonus<input id="bonus-leave-allowance" type="number" min="0" max="366" step="0.5" required value={maxLeaveDays} disabled={loading || saving} onChange={event => { setMaxLeaveDays(event.target.value); setMessage(''); }} className={`${inputClass} block mt-1 w-48`} /></label>
        <label className="text-sm" htmlFor="bonus-expense-month">เดือนบันทึกรายจ่าย<input id="bonus-expense-month" type="month" min="2000-01" max="9998-12" required value={expenseMonth} disabled={loading || saving || employees.some(employee => employee.saved && employee.saved.status !== 'INITIAL')} onChange={event => { setExpenseMonth(event.target.value); setMessage(''); }} className={`${inputClass} block mt-1`} /></label>
      </div>
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900 space-y-1">
        <p>Bonus = เงินเดือน × คะแนน / 100 − (วันลาส่วนเกิน × เงินเดือน / 22) โดยยอดสุทธิไม่ต่ำกว่า 0 บาท</p>
        <p>นับวันลาที่อนุมัติแล้วตั้งแต่ 1 ม.ค. ถึง 31 ธ.ค. {year} รวมทุกประเภท ครึ่งวันนับ 0.5 และวันที่ซ้ำกันนับไม่เกิน 1 วัน</p>
        <p>ใช้เงินเดือนปัจจุบัน ไม่เฉลี่ยตามอายุงาน • บันทึกเพื่อคำนวณใหม่ตามคะแนน วันลา และเงินเดือนล่าสุด • เว้นคะแนนว่างสำหรับคนที่ยังไม่ประเมิน</p>
        <p>Initial → Admin อนุมัติ → Payment pending → จับคู่ Kbiz ครบยอด → Completed โดยวันที่จ่ายเงินใช้วันที่ธนาคารล่าสุดที่จับคู่</p>
        <p>Bonus ที่อนุมัติแล้วจะคงคะแนนและยอดเดิม การเปลี่ยนวันลาหรือเงินเดือนจะไม่คำนวณรายการที่อนุมัติแล้วใหม่</p>
      </div>
    </section>
    {error && <p role="alert" className="p-3 bg-rose-50 text-rose-700 rounded-lg">{error}</p>}
    {message && <p role="status" className="p-3 bg-emerald-50 text-emerald-700 rounded-lg">{message}</p>}
    {!loading && employees.some(employee => employee.salaryCents === null) && <p className="p-3 bg-amber-50 text-amber-800 rounded-lg text-sm">กรุณาตั้งค่าเงินเดือนใน Salary &amp; Incentive Management สำหรับพนักงานที่ยังไม่มีเงินเดือน ก่อนกรอกคะแนน</p>}
    <div className="grid sm:grid-cols-3 gap-3">
      {[
        ['Bonus ก่อนหัก (ตัวอย่าง)', calculations.reduce((sum, row) => sum + (row.calculation?.baseCents || 0), 0)],
        ['Bonus สุทธิ (ตัวอย่าง)', calculations.reduce((sum, row) => sum + (row.calculation?.amountCents || 0), 0)],
        ['ยอดที่บันทึกแล้ว', employees.reduce((sum, employee) => sum + (employee.saved?.amountCents || 0), 0)],
      ].map(([label, value]) => <div key={label} className="bg-white border border-slate-200 rounded-xl p-4"><p className="text-sm text-slate-500">{label}</p><p className="text-2xl font-bold text-blue-800 mt-1">{money(Number(value))}</p></div>)}
    </div>
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm text-left">
      <thead className="bg-slate-100 text-slate-600"><tr>{['พนักงาน', 'เงินเดือน / เดือน', 'จำนวนวันลาในรอบปี (วัน)', 'คะแนน (%)', 'Bonus ก่อนหัก', 'วันลาส่วนเกิน', 'หักวันลา', 'Bonus สุทธิ', 'ยอดที่บันทึกแล้ว', 'สถานะ', 'วันที่จ่ายเงิน', 'อนุมัติ'].map(label => <th key={label} className="p-3.5 whitespace-nowrap">{label}</th>)}</tr></thead>
      <tbody>{loading ? <tr><td colSpan={12} className="p-8 text-center text-slate-500">กำลังโหลด...</td></tr> : calculations.length === 0 ? <tr><td colSpan={12} className="p-8 text-center text-slate-500">ไม่มีพนักงานที่เข้าเงื่อนไขในปีนี้</td></tr> : calculations.map(({ employee, calculation, locked, canApprove }) => <tr key={employee.id} className="border-t border-slate-100">
        <td className="p-3.5 font-medium">{employee.name}<p className="text-xs text-slate-500">{employee.department}</p></td>
        <td className="p-3.5 whitespace-nowrap">{locked ? money(employee.saved!.salaryCents) : employee.salaryCents === null ? 'ยังไม่ระบุ' : money(employee.salaryCents)}</td>
        <td className="p-3.5 text-center whitespace-nowrap"><span className="inline-flex min-w-10 justify-center rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-800">{employee.leaveDays}</span>
          {locked && employee.saved!.leaveDays !== employee.leaveDays && <p className="mt-1 text-xs text-slate-500">ใช้คำนวณ Bonus: {employee.saved!.leaveDays} วัน</p>}
        </td>
        <td className="p-3.5"><input aria-label={`คะแนน Bonus ${employee.name}`} type="number" min="0" max="200" step="0.01" value={scores[employee.id] ?? ''} placeholder="0–200" disabled={saving || locked || employee.salaryCents === null} onChange={event => { setScores(current => ({ ...current, [employee.id]: event.target.value })); setMessage(''); }} className={`${inputClass} w-28`} /></td>
        <td className="p-3.5 whitespace-nowrap">{calculation ? money(calculation.baseCents) : '—'}</td>
        <td className="p-3.5 text-center">{calculation?.excessLeaveDays ?? '—'}</td>
        <td className="p-3.5 whitespace-nowrap text-rose-700">{calculation ? money(calculation.deductionCents) : '—'}</td>
        <td className="p-3.5 whitespace-nowrap font-bold text-blue-800">{calculation ? money(calculation.amountCents) : '—'}</td>
        <td className="p-3.5 whitespace-nowrap">{employee.saved ? <><p>{money(employee.saved.amountCents)}</p><p className="text-xs text-slate-500">เงินเดือน {money(employee.saved.salaryCents)} · คะแนน {employee.saved.score}%</p></> : 'ยังไม่บันทึก'}</td>
        <td className="p-3.5 whitespace-nowrap">{employee.saved ? <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusColors[employee.saved.status] || statusColors.INITIAL}`}>{statusLabels[employee.saved.status] || employee.saved.status}</span> : '—'}</td>
        <td className="p-3.5 whitespace-nowrap">{employee.saved?.paymentDate || '—'}{employee.saved?.paymentDate && employee.saved.status === 'PAYMENT_PENDING' && <p className="text-xs text-amber-700">จ่ายบางส่วนแล้ว</p>}</td>
        <td className="p-3.5">{employee.saved?.status === 'INITIAL' ? <><button type="button" disabled={saving || !canApprove} onClick={() => void approve(employee.saved!)} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 bg-blue-600 text-white disabled:opacity-50"><Check className="w-4 h-4" />อนุมัติ</button>{!canApprove && <p className="text-xs text-amber-700 mt-1">บันทึกยอดล่าสุดก่อนอนุมัติ</p>}</> : locked ? <span className="text-xs text-slate-500">อนุมัติแล้ว</span> : '—'}</td>
      </tr>)}</tbody>
    </table></div></section>
    <button type="submit" disabled={loading || saving} className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 bg-blue-600 text-white font-semibold disabled:opacity-50"><Save className="w-4 h-4" />{saving ? 'กำลังบันทึก...' : 'คำนวณและบันทึก Bonus'}</button>
  </form>;
}
