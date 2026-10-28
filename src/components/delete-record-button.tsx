'use client';

import { useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';

export default function DeleteRecordButton({ label, onDelete, disabled = false }: {
  label: string;
  onDelete: () => Promise<void>;
  disabled?: boolean;
}) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function remove() {
    if (pending.current || disabled || !window.confirm(`ลบ${label}? รายการนี้จะถูกลบถาวร กรุณาตรวจสอบก่อนยืนยัน`)) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await onDelete();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ไม่สามารถลบรายการได้');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return <div className="inline-flex flex-col items-end gap-1">
    <button type="button" aria-label={`ลบ${label}`} disabled={disabled || busy} onClick={() => void remove()}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50 whitespace-nowrap">
      <Trash2 className="w-4 h-4" aria-hidden="true" />{busy ? 'กำลังลบ...' : 'ลบ'}
    </button>
    {error && <span role="alert" className="text-xs text-rose-700">{error}</span>}
  </div>;
}
