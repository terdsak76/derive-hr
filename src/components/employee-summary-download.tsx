'use client';

import { useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';

export default function EmployeeSummaryDownload({ month, year }: { month: number; year: number }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState('');

  async function download() {
    if (isDownloading) return;
    setIsDownloading(true);
    setError('');
    try {
      const response = await fetch(`/api/employee-summary?month=${month}&year=${year}&format=xls`);
      if (!response.ok) throw new Error('ไม่สามารถดาวน์โหลดข้อมูลได้ กรุณาลองใหม่');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `employee-summary-${year}-${String(month).padStart(2, '0')}.xls`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'ไม่สามารถดาวน์โหลดข้อมูลได้');
    } finally {
      setIsDownloading(false);
    }
  }

  return <div>
    <button type="button" onClick={() => void download()} disabled={isDownloading} className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
      <FileSpreadsheet className="w-4 h-4" />{isDownloading ? 'กำลังดาวน์โหลด...' : 'ดาวน์โหลด XLS'}
    </button>
    {error && <p role="alert" className="text-xs text-rose-600 mt-2">{error}</p>}
  </div>;
}
