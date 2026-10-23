'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, Save } from 'lucide-react';
import type { SalaryHistoryEmployee } from '@/lib/salary-history';

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm disabled:opacity-50';
const money = (value: number | null) => value === null ? 'ยังไม่กำหนด' : value.toLocaleString('th-TH', { style: 'currency', currency: 'THB' });
const dateLabel = (value: string) => new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok' }).format(new Date());

export default function SalaryIncentiveManagement() {
  const [employees, setEmployees] = useState<SalaryHistoryEmployee[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState<{ employeeId: string; salary: string; fullIncentive: string; startDate: string } | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const response = await fetch('/api/salary-incentive-history', { cache: 'no-store', signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'โหลดประวัติไม่สำเร็จ');
      if (!signal?.aborted) setEmployees(data);
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : 'โหลดประวัติไม่สำเร็จ');
    } finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  function createForm(employeeId: string) {
    const employee = employees.find(row => row.id === employeeId);
    setForm({ employeeId, salary: employee?.salary === null ? '' : String(employee?.salary ?? ''),
      fullIncentive: String(employee?.fullIncentive ?? 0), startDate: today() });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form || saving) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/salary-incentive-history', { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, salary: Number(form.salary), fullIncentive: Number(form.fullIncentive) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ');
      setSelected(form.employeeId); setForm(null);
      setMessage('บันทึกประวัติและอัปเดตเงินเดือน / Full incentive ล่าสุดของพนักงานเรียบร้อยแล้ว');
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'บันทึกไม่สำเร็จ'); }
    finally { setSaving(false); }
  }

  const visible = employees.filter(employee => !selected || employee.id === selected);
  return <div className="space-y-5">
    <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="font-bold text-slate-800">เงินเดือนและ Full incentive รายพนักงาน</h3>
          <p className="text-sm text-slate-500 mt-1">วันสิ้นสุด = วันเริ่มต้นรายการถัดไป − 1 วัน รายการล่าสุดไม่มีวันสิ้นสุด</p>
          <p className="text-xs text-slate-500 mt-1">เงินเดือนและ Full incentive ในข้อมูลพนักงานใช้รายการที่มีวันเริ่มต้นล่าสุด รวมถึงวันที่ในอนาคต</p>
        </div>
        <div className="flex gap-2">
          <button type="button" aria-label="โหลดประวัติเงินเดือนใหม่" disabled={loading || saving || !!form} onClick={() => { setError(''); void load(); }} className="border border-slate-300 rounded-lg p-2.5 disabled:opacity-50"><RefreshCw className="w-4 h-4" /></button>
          <button type="button" disabled={loading || saving || !!form || !employees.length} onClick={() => { setError(''); setMessage(''); createForm(selected || employees[0].id); }} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-2 text-sm disabled:opacity-50"><Plus className="w-4 h-4" />เพิ่มเงินเดือน / Incentive</button>
        </div>
      </div>
      <div className="max-w-md"><label htmlFor="salary-history-filter" className="block text-sm font-medium mb-1">ดูประวัติพนักงาน</label>
        <select id="salary-history-filter" value={selected} disabled={saving} onChange={event => setSelected(event.target.value)} className={inputClass}>
          <option value="">พนักงานทั้งหมด</option>{employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name} — {employee.department}</option>)}
        </select>
      </div>
    </section>
    {error && <p role="alert" className="p-4 rounded-lg bg-red-50 text-red-700">{error}</p>}
    {message && <p role="status" className="p-4 rounded-lg bg-emerald-50 text-emerald-700">{message}</p>}
    {form && <form onSubmit={save} className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="font-semibold mb-4">เพิ่มรายการใหม่</h3>
      <fieldset disabled={saving} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label htmlFor="salary-history-employee" className="block text-sm font-medium mb-1">พนักงาน</label>
          <select id="salary-history-employee" required value={form.employeeId} onChange={event => createForm(event.target.value)} className={inputClass}>
            {employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
          </select></div>
        <div><label htmlFor="salary-history-start" className="block text-sm font-medium mb-1">วันเริ่มต้น</label><input id="salary-history-start" type="date" min="2000-01-01" max="9998-12-31" required value={form.startDate} onChange={event => setForm({ ...form, startDate: event.target.value })} className={inputClass} /></div>
        <div><label htmlFor="salary-history-salary" className="block text-sm font-medium mb-1">เงินเดือน (บาท / เดือน)</label><input id="salary-history-salary" type="number" min="0" max="21474836.47" step="0.01" required value={form.salary} onChange={event => setForm({ ...form, salary: event.target.value })} className={inputClass} /></div>
        <div><label htmlFor="salary-history-incentive" className="block text-sm font-medium mb-1">Full incentive (บาท / เดือน)</label><input id="salary-history-incentive" type="number" min="0" max="21474836.47" step="0.01" required value={form.fullIncentive} onChange={event => setForm({ ...form, fullIncentive: event.target.value })} className={inputClass} /></div>
        <p className="md:col-span-2 text-sm text-slate-500">ระบบกำหนดวันสิ้นสุดอัตโนมัติ และจะไม่เปลี่ยน Incentive รายเดือนที่บันทึกไว้แล้ว</p>
        <div className="md:col-span-2 flex gap-3"><button type="submit" className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"><Save className="w-4 h-4" />{saving ? 'กำลังบันทึก...' : 'บันทึกรายการ'}</button>
          <button type="button" onClick={() => setForm(null)} className="border border-slate-300 rounded-lg px-4 py-2">ยกเลิก</button></div>
      </fieldset>
    </form>}
    {loading ? <p role="status" className="p-8 text-center text-slate-500">กำลังโหลดประวัติ...</p> : !visible.length ? <p className="p-8 text-center text-slate-500">ไม่พบข้อมูลพนักงาน</p> : visible.map(employee => <section key={employee.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex flex-wrap justify-between gap-3"><div><h3 className="font-semibold">{employee.name}</h3><p className="text-xs text-slate-500">{employee.department}</p></div>
        <div className="text-sm text-slate-600">เงินเดือนล่าสุด: <strong>{money(employee.salary)}</strong> · Full incentive: <strong>{money(employee.fullIncentive)}</strong></div></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-600"><tr><th className="p-4">วันเริ่มต้น</th><th className="p-4">วันสิ้นสุด</th><th className="p-4 text-right">เงินเดือน (บาท)</th><th className="p-4 text-right">Full incentive (บาท)</th><th className="p-4">หมายเหตุ</th></tr></thead>
        <tbody>{employee.history.map((row, index) => <tr key={row.id} className="border-t border-slate-100">
          <td className="p-4 whitespace-nowrap">{dateLabel(row.startDate)}</td><td className="p-4 whitespace-nowrap">{row.endDate ? dateLabel(row.endDate) : 'ไม่มีกำหนด'}</td>
          <td className="p-4 text-right whitespace-nowrap">{money(row.salary)}</td><td className="p-4 text-right whitespace-nowrap">{money(row.fullIncentive)}</td>
          <td className="p-4">{index === 0 && <span className="text-indigo-700 font-medium">ล่าสุด</span>}{row.isOpening && <p className="text-xs text-slate-500 mt-1">ยอดตั้งต้นจากข้อมูลเดิม ใช้วันที่สร้างพนักงานเป็นวันเริ่มต้น</p>}</td>
        </tr>)}{!employee.history.length && <tr><td colSpan={5} className="p-6 text-center text-slate-500">ยังไม่มีประวัติ กรุณาเพิ่มรายการแรก</td></tr>}</tbody>
      </table></div>
    </section>)}
  </div>;
}
