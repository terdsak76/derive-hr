'use client';

import { bangkokMonth } from '@/lib/bangkok-date';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { FinanceReport } from '@/lib/finance';

const money = (value: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(value);
const inputClass = 'p-2.5 border border-slate-300 rounded-lg bg-white text-sm';
const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

export default function CompanyFinance() {
  const [currentMonth] = useState(() => bangkokMonth());
  const [year, setYear] = useState(currentMonth.slice(0, 4));
  const [month, setMonth] = useState(currentMonth.slice(5, 7));
  const [basis, setBasis] = useState('scheduled');
  const [report, setReport] = useState<FinanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setReport(null); setError('');
    async function load() {
      try {
        const response = await fetch(`/api/company-finance?year=${year}&month=${month}&basis=${basis}`, { signal: controller.signal, cache: 'no-store' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'โหลดไม่สำเร็จ');
        if (!controller.signal.aborted) setReport(result);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'โหลดไม่สำเร็จ');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load(); return () => controller.abort();
  }, [year, month, basis, refresh]);

  return <div className="space-y-5">
    <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap justify-between items-end gap-4">
      <div><h3 className="font-bold text-slate-800">รายรับ–รายจ่ายบริษัท</h3><p className="text-sm text-slate-500 mt-1">{month === 'all' ? 'ทุกเดือน' : thaiMonths[Number(month) - 1]} ปี {year} — ข้อมูลพนักงานและ Invoice</p></div>
      <div className="flex flex-wrap items-end gap-3">
        <div><label htmlFor="finance-year" className="block text-xs font-semibold mb-1">ปี</label><select id="finance-year" value={year} onChange={event => setYear(event.target.value)} className={inputClass}>{Array.from({ length: Number(currentMonth.slice(0, 4)) + 6 - 2000 }, (_, index) => 2000 + index).reverse().map(value => <option key={value} value={value}>{value}</option>)}</select></div>
        <div><label htmlFor="finance-month" className="block text-xs font-semibold mb-1">เดือน</label><select id="finance-month" value={month} onChange={event => setMonth(event.target.value)} className={inputClass}><option value="all">ทุกเดือน (All months)</option>{thaiMonths.map((name, index) => <option key={name} value={String(index + 1).padStart(2, '0')}>{name}</option>)}</select></div>
        <div><label htmlFor="finance-basis" className="block text-xs font-semibold mb-1">รายรับจาก Invoice</label><select id="finance-basis" value={basis} onChange={event => setBasis(event.target.value)} className={inputClass}><option value="scheduled">ตามรอบบิล / ประมาณการ</option><option value="issued">เฉพาะที่ออกเอกสารแล้ว</option></select></div>
        <button type="button" aria-label="โหลดรายรับรายจ่ายใหม่" disabled={loading} onClick={() => setRefresh(value => value + 1)} className="p-2.5 border border-slate-300 rounded-lg disabled:opacity-50"><RefreshCw className="w-4 h-4" /></button>
      </div>
    </section>
    {loading && <p className="text-center text-slate-500 p-8">กำลังคำนวณรายรับรายจ่าย...</p>}
    {error && <p role="alert" className="p-3 bg-rose-50 text-rose-700 rounded-lg">{error}</p>}
    {report && <>
      <div className="grid sm:grid-cols-3 gap-4">
        {[{ label: 'รายรับก่อน VAT', value: report.income.total, style: 'text-emerald-700' }, { label: 'รายจ่ายรวม', value: report.expenses.total, style: 'text-rose-700' }, { label: 'ส่วนต่างรายรับ–รายจ่าย', value: report.profit, style: report.profit >= 0 ? 'text-indigo-700' : 'text-rose-700' }].map(card => <div key={card.label} className="bg-white border border-slate-200 rounded-xl p-5"><p className="text-sm text-slate-500">{card.label}</p><p className={`text-2xl font-bold mt-2 ${card.style}`}>{money(card.value)}</p></div>)}
      </div>
      <section className="bg-slate-100 border border-slate-200 rounded-xl p-4 text-sm text-slate-600 space-y-1">
        <p>รายรับเป็นยอด Invoice ก่อน VAT ของช่วงเวลาที่เลือก ยังไม่ได้ยืนยันการรับชำระเงิน</p>
        <p>เงินเดือนใช้อัตราปัจจุบันเต็มเดือน ไม่ใช่ประวัติเงินเดือนที่จ่ายจริง • ประกันสังคมรวมเฉพาะนายจ้าง 5% สูงสุด 875 บาท/คน • Onsite และ OT นับเฉพาะที่อนุมัติ โดยใช้เดือนที่เริ่มงาน/เดินทาง</p>
        {report.employees.some(employee => employee.salary === null) && <p role="status" className="text-amber-800">ยังไม่มีข้อมูลเงินเดือน: {report.employees.filter(employee => employee.salary === null).map(employee => employee.name).join(', ')} — ยอดรายจ่ายจึงยังไม่ครบ</p>}
      </section>
      {month === 'all' && <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <h4 className="font-bold p-5">สรุปรายเดือน ปี {year}</h4>
        <div className="overflow-x-auto"><table className="w-full text-sm text-left">
          <thead className="bg-slate-100 text-slate-600"><tr><th className="p-3.5">เดือน</th><th className="p-3.5 text-right">รายรับก่อน VAT</th><th className="p-3.5 text-right">รายจ่ายรวม</th><th className="p-3.5 text-right">ส่วนต่าง</th></tr></thead>
          <tbody>{report.monthly.map(row => <tr key={row.month} className="border-t border-slate-100"><td className="p-3.5">{thaiMonths[Number(row.month.slice(5)) - 1]}</td><td className="p-3.5 text-right whitespace-nowrap text-emerald-700">{money(row.income.total)}</td><td className="p-3.5 text-right whitespace-nowrap text-rose-700">{money(row.expenses.total)}</td><td className={`p-3.5 text-right whitespace-nowrap ${row.profit >= 0 ? 'text-indigo-700' : 'text-rose-700'}`}>{money(row.profit)}</td></tr>)}</tbody>
          <tfoot className="bg-slate-100 font-bold"><tr><td className="p-3.5">รวมทั้งปี</td><td className="p-3.5 text-right whitespace-nowrap">{money(report.income.total)}</td><td className="p-3.5 text-right whitespace-nowrap">{money(report.expenses.total)}</td><td className="p-3.5 text-right whitespace-nowrap">{money(report.profit)}</td></tr></tfoot>
        </table></div>
      </section>}
      <div className="grid md:grid-cols-2 gap-5">
        <section className="bg-white border border-slate-200 rounded-xl p-5"><h4 className="font-bold mb-3">รายจ่ายแยกประเภท</h4>{[['เงินเดือน', report.expenses.salary], ['Onsite', report.expenses.onsite], ['OT', report.expenses.overtime], ['Incentive', report.expenses.incentive], ['Bonus', report.expenses.bonus], ['ประกันสังคมนายจ้าง', report.expenses.socialSecurity], ['ซื้อสินค้า / บริการ', report.expenses.purchases]].map(([label, amount]) => <div key={label} className="flex justify-between py-2 border-b border-slate-100 text-sm"><span>{label}</span><span className="font-medium">{money(Number(amount))}</span></div>)}<div className="flex justify-between pt-3 font-bold"><span>รวมรายจ่าย</span><span className="text-rose-700">{money(report.expenses.total)}</span></div></section>
        <section className="bg-white border border-slate-200 rounded-xl p-5"><h4 className="font-bold mb-3">รายรับแยกประเภท</h4>{[['Invoice ลูกค้า', report.income.recurring], ['Invoice โครงการ', report.income.project]].map(([label, amount]) => <div key={label} className="flex justify-between py-2 border-b border-slate-100 text-sm"><span>{label}</span><span className="font-medium">{money(Number(amount))}</span></div>)}<div className="flex justify-between pt-3 font-bold"><span>รวมรายรับ</span><span className="text-emerald-700">{money(report.income.total)}</span></div></section>
      </div>
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden"><h4 className="font-bold p-5">รายจ่ายรายพนักงาน</h4><div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-100 text-slate-600"><tr>{['พนักงาน', 'เงินเดือน', 'Onsite', 'OT', 'Incentive', 'Bonus', 'ประกันสังคมนายจ้าง', 'รวม'].map((title, index) => <th key={title} className={`p-3.5 ${index ? 'text-right' : ''}`}>{title}</th>)}</tr></thead><tbody>{report.employees.length === 0 ? <tr><td colSpan={8} className="p-6 text-center text-slate-400">ไม่มีรายจ่ายพนักงาน</td></tr> : report.employees.map(employee => <tr key={employee.id} className="border-t border-slate-100"><td className="p-3.5 font-medium">{employee.name}{employee.isOwner && <span className="ml-2 text-xs text-amber-800">Owner</span>}<div className="text-xs text-slate-500">{employee.department}</div></td>{[employee.salary, employee.onsite, employee.overtime, employee.incentive, employee.bonus, employee.socialSecurity, employee.total].map((amount, index) => <td key={index} className="p-3.5 text-right whitespace-nowrap">{amount === null ? 'ยังไม่ระบุ' : money(amount)}</td>)}</tr>)}</tbody></table></div></section>
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden"><h4 className="font-bold p-5">รายการรายรับ</h4><div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-100 text-slate-600"><tr><th className="p-3.5">เดือน</th><th className="p-3.5">ประเภท</th><th className="p-3.5">ลูกค้า</th><th className="p-3.5">รายละเอียด</th><th className="p-3.5 text-right">ก่อน VAT</th></tr></thead><tbody>{report.incomeItems.length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-slate-400">ไม่มี Invoice ตามเงื่อนไขที่เลือก</td></tr> : report.incomeItems.map(item => <tr key={`${item.month}:${item.source}:${item.id}`} className="border-t border-slate-100"><td className="p-3.5 whitespace-nowrap">{item.month}</td><td className="p-3.5 whitespace-nowrap">{item.source === 'recurring' ? 'Invoice ลูกค้า' : 'Invoice โครงการ'}</td><td className="p-3.5">{item.customer}</td><td className="p-3.5 whitespace-pre-line">{item.description}</td><td className="p-3.5 text-right whitespace-nowrap">{money(item.amount)}</td></tr>)}</tbody></table></div></section>
    </>}
  </div>;
}
