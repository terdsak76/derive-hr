'use client';

import { useCallback, useEffect, useState } from 'react';
import { approvalLabels, type ApprovalDecision, type ApprovalRequest, type ApprovalType } from '@/lib/request-approvals';
import { workdayTimeRange } from '@/lib/workday-changes';

function displayDate(value: string, includeTime = false) {
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok', dateStyle: 'medium', ...(includeTime ? { timeStyle: 'short' as const } : {}),
  }).format(new Date(value));
}

export default function RequestApprovals({ onDecision }: { onDecision: (decision: ApprovalDecision) => void }) {
  const [rows, setRows] = useState<ApprovalRequest[]>([]);
  const [filter, setFilter] = useState<ApprovalType | ''>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/request-approvals', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'โหลดคำขอไม่สำเร็จ');
      setRows(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดคำขอไม่สำเร็จ');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function decide(row: ApprovalRequest, status: ApprovalDecision['status']) {
    if (!window.confirm(`${status === 'APPROVED' ? 'อนุมัติ' : 'ไม่อนุมัติ'}${approvalLabels[row.type]}ของ ${row.employeeName}?`)) return;
    setBusy(`${row.type}:${row.id}`);
    setError('');
    setMessage('');
    try {
      const decision = { id: row.id, type: row.type, status };
      const response = await fetch('/api/request-approvals', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(decision),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) await load();
        throw new Error(result.error || 'บันทึกการอนุมัติไม่สำเร็จ');
      }
      setRows(current => current.filter(item => item.id !== row.id || item.type !== row.type));
      setMessage(`${status === 'APPROVED' ? 'อนุมัติ' : 'ไม่อนุมัติ'}คำขอเรียบร้อยแล้ว`);
      onDecision(decision);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'บันทึกการอนุมัติไม่สำเร็จ');
    } finally { setBusy(''); }
  }

  const visible = rows.filter(row => (!filter || row.type === filter) &&
    `${row.employeeName} ${row.department} ${row.description}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="space-y-4" aria-label="Request Approval">
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {(Object.keys(approvalLabels) as ApprovalType[]).map(type => <div key={type} className="bg-white border border-slate-200 rounded-xl p-4">
        <p className="text-sm text-slate-500">{approvalLabels[type]}</p>
        <p className="text-2xl font-bold text-indigo-700">{rows.filter(row => row.type === type).length} <span className="text-sm font-normal">รออนุมัติ</span></p>
      </div>)}
    </div>
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 p-4 border-b border-slate-200">
        <label className="text-sm">ประเภทคำขอ <select className="border rounded-lg p-2 ml-2" value={filter} onChange={event => setFilter(event.target.value as ApprovalType | '')}>
          <option value="">ทั้งหมด ({rows.length})</option>
          {(Object.keys(approvalLabels) as ApprovalType[]).map(type => <option key={type} value={type}>{approvalLabels[type]}</option>)}
        </select></label>
        <input aria-label="ค้นหาคำขอ" placeholder="ค้นหาพนักงาน / รายละเอียด" className="border rounded-lg p-2 text-sm flex-1 min-w-0" value={search} onChange={event => setSearch(event.target.value)} />
        <button type="button" disabled={loading || !!busy} onClick={() => void load()} className="border rounded-lg px-3 py-2 text-sm disabled:opacity-50">รีเฟรช</button>
      </div>
      {error && <p role="alert" className="p-4 text-red-700 bg-red-50">{error}</p>}
      {message && <p role="status" className="p-4 text-emerald-700 bg-emerald-50">{message}</p>}
      {loading ? <p role="status" className="p-8 text-center text-slate-500">กำลังโหลดคำขอ...</p> :
        <div className="overflow-x-auto"><table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600"><tr>
            <th className="p-4">พนักงาน / ยื่นเมื่อ</th><th className="p-4">ประเภท / วันเวลา</th><th className="p-4">รายละเอียด</th><th className="p-4">ดำเนินการ</th>
          </tr></thead>
          <tbody>{visible.map(row => <tr key={`${row.type}:${row.id}`} className="border-t border-slate-100">
            <td className="p-4 align-top"><p className="font-semibold">{row.employeeName}</p><p className="text-slate-500">{row.department}</p><p className="text-xs text-slate-500 mt-1">{displayDate(row.submittedAt, true)}</p></td>
            <td className="p-4 align-top"><p className="font-semibold text-indigo-700">{approvalLabels[row.type]}</p><p className="mt-1">{displayDate(row.start, row.type === 'OVERTIME')}</p>
              {row.type === 'WORKDAY_CHANGE' && <p className="text-xs text-slate-500">{workdayTimeRange(row.fromDateStart, row.fromDateEnd)}</p>}
              <p>{row.type === 'WORKDAY_CHANGE' ? 'ย้ายไป' : 'ถึง'} {displayDate(row.end, row.type === 'OVERTIME')}</p>
              {row.type === 'WORKDAY_CHANGE' && <p className="text-xs text-slate-500">{workdayTimeRange(row.toDateStart, row.toDateEnd)}</p>}
            </td>
            <td className="p-4 align-top whitespace-pre-wrap break-words">{row.description}
              {row.type === 'OVERTIME' && <p className="mt-1 font-medium">{row.hours?.toFixed(2)} ชั่วโมง · {row.amount?.toLocaleString('th-TH', { style: 'currency', currency: 'THB' })}</p>}
            </td>
            <td className="p-4 align-top"><div className="flex flex-col gap-2">
              <button type="button" disabled={!!busy} onClick={() => void decide(row, 'APPROVED')} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-2 disabled:opacity-50">อนุมัติ</button>
              <button type="button" disabled={!!busy} onClick={() => void decide(row, 'REJECTED')} className="border border-red-200 text-red-700 hover:bg-red-50 rounded-lg px-3 py-2 disabled:opacity-50">ไม่อนุมัติ</button>
              {busy === `${row.type}:${row.id}` && <span role="status" className="text-xs text-slate-500">กำลังบันทึก...</span>}
            </div></td>
          </tr>)}{!visible.length && <tr><td colSpan={4} className="p-8 text-center text-slate-500">{rows.length ? 'ไม่พบคำขอที่ตรงกับการค้นหา' : 'ไม่มีคำขอที่รออนุมัติ'}</td></tr>}</tbody>
        </table></div>}
    </div>
  </section>;
}
