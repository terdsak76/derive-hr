'use client';

import { useEffect, useState } from 'react';
import { Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import type { AuthUser } from '@/lib/auth';

type Employee = AuthUser & { department: string; position: string; isOwner: boolean; fullIncentive: number };
type EmployeeForm = { id: string; name: string; department: string; position: string; email: string; password: string; isOwner: boolean; fullIncentive: string };
const emptyForm: EmployeeForm = { id: '', name: '', department: '', position: '', email: '', password: '', isOwner: false, fullIncentive: '0' };
const inputClass = 'w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

export default function EmployeeManagement({ currentUser, onEmployeesChange }: {
  currentUser: AuthUser;
  onEmployeesChange: (employees: Employee[]) => void;
}) {
  const isAdmin = ['ADMIN', 'ROLE_ADMIN'].includes(currentUser.role.trim().toUpperCase());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [form, setForm] = useState<EmployeeForm | null>(null);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);

  function editEmployee(employee: Employee) {
    setError('');
    setSuccess('');
    setForm({ id: employee.id, name: employee.name, department: employee.department, position: employee.position, email: employee.email, password: '', isOwner: employee.isOwner, fullIncentive: String(employee.fullIncentive) });
  }

  async function loadEmployees(signal?: AbortSignal) {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/employees', { signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'ไม่สามารถโหลดข้อมูลพนักงานได้');
      setEmployees(result);
      onEmployeesChange(result);
    } catch (loadError) {
      if (signal?.aborted) return;
      setEmployees([]);
      setError(loadError instanceof Error ? loadError.message : 'ไม่สามารถโหลดข้อมูลพนักงานได้');
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void loadEmployees(controller.signal);
    return () => controller.abort();
  }, [currentUser.id, currentUser.role]);

  async function saveEmployee(event: React.FormEvent) {
    event.preventDefault();
    if (!form || isSaving) return;
    setIsSaving(true);
    setError('');
    setSuccess('');
    try {
      const { isOwner, fullIncentive, ...profile } = form;
      const response = await fetch('/api/employees', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isAdmin ? { ...profile, isOwner, fullIncentive: Number(fullIncentive) } : profile),
      });
      const saved = await response.json();
      if (!response.ok) throw new Error(saved.error || 'ไม่สามารถบันทึกข้อมูลพนักงานได้');
      const next = [...employees.filter(employee => employee.id !== saved.id), saved]
        .sort((a, b) => a.name.localeCompare(b.name));
      setEmployees(next);
      onEmployeesChange(next);
      setForm(null);
      setSuccess('บันทึกข้อมูลพนักงานเรียบร้อยแล้ว');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'ไม่สามารถบันทึกข้อมูลพนักงานได้');
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteEmployee() {
    if (!deleteTarget || isSaving) return;
    setIsSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/employees', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTarget.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'ไม่สามารถลบพนักงานได้');
      const next = employees.filter(employee => employee.id !== deleteTarget.id);
      setEmployees(next);
      onEmployeesChange(next);
      if (form?.id === deleteTarget.id) setForm(null);
      setDeleteTarget(null);
      setSuccess('ลบข้อมูลพนักงานเรียบร้อยแล้ว');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'ไม่สามารถลบพนักงานได้');
      setDeleteTarget(null);
    } finally {
      setIsSaving(false);
    }
  }

  const filteredEmployees = employees.filter(employee =>
    [employee.name, employee.email, employee.department, employee.position].some(value => value.toLowerCase().includes(search.trim().toLowerCase())),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-800">{isAdmin ? 'จัดการพนักงาน' : 'ข้อมูลพนักงานของฉัน'}</h3>
          <p className="text-sm text-slate-500 mt-1">{isAdmin ? 'สร้าง แก้ไข และลบบัญชีพนักงาน' : 'ดูและแก้ไขข้อมูลส่วนตัว อีเมล และรหัสผ่านของคุณ'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void loadEmployees()} disabled={isLoading || isSaving || !!form} title="โหลดข้อมูลใหม่" aria-label="โหลดข้อมูลพนักงานใหม่" className="p-2.5 rounded-lg border border-slate-200 text-slate-500 hover:text-indigo-600 disabled:opacity-50"><RefreshCw className="w-4 h-4" /></button>
          {isAdmin && <button type="button" disabled={isLoading || isSaving} onClick={() => { setForm({ ...emptyForm }); setError(''); setSuccess(''); }} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"><Plus className="w-4 h-4" />เพิ่มพนักงาน</button>}
        </div>
      </div>

      {error && <p role="alert" className="p-3 rounded-lg border border-rose-100 bg-rose-50 text-rose-700 text-sm">{error}</p>}
      {success && <p role="status" className="p-3 rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-700 text-sm">{success}</p>}

      {form && (
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-slate-800">{form.id ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงานใหม่'}</h3>
            <button type="button" disabled={isSaving} onClick={() => setForm(null)} aria-label="ปิดแบบฟอร์ม" className="p-1 text-slate-500 hover:text-slate-800"><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={saveEmployee}>
            <fieldset disabled={isSaving} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label htmlFor="employee-name" className="block text-sm font-medium text-slate-700 mb-1">ชื่อพนักงาน</label><input id="employee-name" required maxLength={254} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className={inputClass} /></div>
              <div><label htmlFor="employee-department" className="block text-sm font-medium text-slate-700 mb-1">แผนก</label><input id="employee-department" required maxLength={254} value={form.department} onChange={event => setForm({ ...form, department: event.target.value })} className={inputClass} /></div>
              <div><label htmlFor="employee-position" className="block text-sm font-medium text-slate-700 mb-1">ตำแหน่ง</label><input id="employee-position" required maxLength={254} value={form.position} onChange={event => setForm({ ...form, position: event.target.value })} className={inputClass} /></div>
              <div><label htmlFor="employee-email" className="block text-sm font-medium text-slate-700 mb-1">อีเมล</label><input id="employee-email" type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} className={inputClass} /></div>
              <div><label htmlFor="employee-password" className="block text-sm font-medium text-slate-700 mb-1">{form.id ? 'รหัสผ่านใหม่ (ไม่บังคับ)' : 'รหัสผ่าน'}</label><input id="employee-password" type="password" autoComplete="new-password" required={!form.id} minLength={8} maxLength={128} value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} aria-describedby="employee-password-help" className={inputClass} /><p id="employee-password-help" className="text-xs text-slate-500 mt-1">อย่างน้อย 8 ตัวอักษร{form.id ? ' เว้นว่างเพื่อใช้รหัสผ่านเดิม' : ''}</p></div>
              {isAdmin && <label className="md:col-span-2 flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.isOwner} onChange={event => setForm({ ...form, isOwner: event.target.checked })} className="mt-1" /><span>เจ้าของกิจการ (Owner)<span className="block text-xs text-slate-500 mt-1">ไม่นำมาคำนวณเงินสมทบประกันสังคมทั้งฝ่ายนายจ้างและลูกจ้าง</span></span></label>}
              {isAdmin && <div><label htmlFor="employee-full-incentive" className="block text-sm font-medium text-slate-700 mb-1">Full incentive (บาท / เดือน)</label><input id="employee-full-incentive" type="number" min="0" max="21474836.47" step="0.01" required value={form.fullIncentive} onChange={event => setForm({ ...form, fullIncentive: event.target.value })} className={inputClass} /><p className="text-xs text-slate-500 mt-1">จำนวนเงินเมื่อได้คะแนน 100 — ใช้คำนวณตอนบันทึก Incentive รายเดือน ไม่เปลี่ยนยอดเดือนที่บันทึกไว้แล้ว</p></div>}
              <div className="md:col-span-2 flex items-center gap-3 pt-2">
                <button type="submit" className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium">{isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}</button>
                <button type="button" onClick={() => setForm(null)} className="px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-600">ยกเลิก</button>
              </div>
            </fieldset>
          </form>
        </section>
      )}

      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isAdmin && <div className="p-4 border-b border-slate-200"><div className="relative max-w-md"><Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" /><input type="search" aria-label="ค้นหาพนักงาน" value={search} onChange={event => setSearch(event.target.value)} placeholder="ค้นหาชื่อ อีเมล แผนก หรือตำแหน่ง" className={`${inputClass} pl-10`} /></div></div>}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-100 text-slate-700"><tr><th className="p-4">พนักงาน</th><th className="p-4">แผนก / ตำแหน่ง</th><th className="p-4">อีเมล</th><th className="p-4">สิทธิ์</th><th className="p-4 text-right">Full incentive (บาท / เดือน)</th><th className="p-4 text-right">จัดการ</th></tr></thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading ? <tr><td colSpan={6} className="p-8 text-center text-slate-400">กำลังโหลดข้อมูลพนักงาน...</td></tr> : filteredEmployees.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-slate-400">ไม่พบข้อมูลพนักงาน</td></tr> : filteredEmployees.map(employee => (
                <tr key={employee.id} className="hover:bg-slate-50">
                  <td className="p-4"><p className="font-semibold text-slate-800">{employee.name} {employee.isOwner && <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-800 rounded-full">Owner</span>}</p><p className="text-xs text-slate-400 mt-1">{employee.id}</p></td>
                  <td className="p-4"><p>{employee.department}</p><p className="text-xs text-slate-500 mt-1">{employee.position}</p></td>
                  <td className="p-4">{employee.email}</td>
                  <td className="p-4">{['ADMIN', 'ROLE_ADMIN'].includes(employee.role.trim().toUpperCase()) ? 'Admin' : 'User'}</td>
                  <td className="p-4 text-right whitespace-nowrap">{employee.fullIncentive.toLocaleString('th-TH', { style: 'currency', currency: 'THB' })}</td>
                  <td className="p-4"><div className="flex justify-end gap-2">
                    <button type="button" disabled={isSaving} onClick={() => editEmployee(employee)} aria-label={`แก้ไข ${employee.name}`} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"><Pencil className="w-4 h-4" />แก้ไข</button>
                    {isAdmin && employee.id !== currentUser.id && <button type="button" disabled={isSaving} onClick={() => setDeleteTarget(employee)} aria-label={`ลบ ${employee.name}`} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50"><Trash2 className="w-4 h-4" />ลบ</button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {deleteTarget && <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
        <section role="dialog" aria-modal="true" aria-labelledby="delete-employee-title" aria-describedby="delete-employee-description" className="w-full max-w-md bg-white rounded-xl shadow-xl p-6">
          <h3 id="delete-employee-title" className="text-lg font-bold text-slate-900">ลบพนักงาน {deleteTarget.name}?</h3>
          <p id="delete-employee-description" className="text-sm text-slate-600 mt-3">บัญชีและประวัติการลงเวลา วันลา Onsite การเปลี่ยนวันทำงาน และ OT ของพนักงานนี้จะถูกลบถาวร กรุณาตรวจสอบก่อนยืนยัน</p>
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" autoFocus disabled={isSaving} onClick={() => setDeleteTarget(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm">ยกเลิก</button>
            <button type="button" disabled={isSaving} onClick={() => void deleteEmployee()} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-sm">{isSaving ? 'กำลังลบ...' : 'ยืนยันการลบ'}</button>
          </div>
        </section>
      </div>}
    </div>
  );
}
