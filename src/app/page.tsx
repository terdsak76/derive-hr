'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Calendar, MapPin, Clock, FileText, Plus, Search, Filter,
  CheckCircle2, XCircle, AlertCircle, ArrowUpRight, Check, X, RefreshCw,
  ChevronRight, Car, DollarSign, Building2, UserCheck, Shield,
  Globe, LogIn, LogOut, FileSpreadsheet, Timer, Printer
} from 'lucide-react';
import { parseBangkokDateTime } from '@/lib/overtime';

const getDateInputValue = (date: Date): string => date.toISOString().split('T')[0];
const getBangkokDateInputValue = (date: Date = new Date()): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {} as Record<string, string>);
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const getDateAfter = (days: number): string => getDateInputValue(new Date(Date.now() + days * 86400000));
const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const formatThaiDate = (value: string): string => {
  const [year, month, day] = String(value || '').split('-').map(Number);
  return year && month && day ? `${day} ${thaiMonths[month - 1]} ${year + 543}` : value;
};
const formatBaht = (value: number): string => new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value) || 0);
const formatInvoiceAmount = (value: number): string => new Intl.NumberFormat('th-TH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value) || 0);
const thaiNumberDigits = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const thaiNumberPositions = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];

function thaiNumberUnderMillion(value: number): string {
  if (value === 0) return '';
  const digits = String(value);
  let result = '';

  for (let index = 0; index < digits.length; index += 1) {
    const digit = Number(digits[index]);
    if (digit === 0) continue;

    const position = digits.length - index - 1;
    if (position === 1 && digit === 1) {
      result += '';
    } else if (position === 1 && digit === 2) {
      result += 'ยี่';
    } else if (position === 0 && digit === 1 && value > 1) {
      result += 'เอ็ด';
    } else {
      result += thaiNumberDigits[digit];
    }
    result += thaiNumberPositions[position];
  }

  return result;
}

function thaiNumberToWords(value: number): string {
  if (value === 0) return thaiNumberDigits[0];
  const millionPart = Math.floor(value / 1_000_000);
  const remainder = value % 1_000_000;
  const millionText = millionPart > 0 ? `${thaiNumberToWords(millionPart)}ล้าน` : '';
  return `${millionText}${thaiNumberUnderMillion(remainder)}`;
}

function bahtToThaiWords(value: number): string {
  const amountInSatang = Math.round((Number(value) || 0) * 100);
  const baht = Math.floor(amountInSatang / 100);
  const satang = amountInSatang % 100;
  const bahtText = `${thaiNumberToWords(baht)}บาท`;
  return satang === 0 ? `${bahtText}ถ้วน` : `${bahtText}${thaiNumberToWords(satang)}สตางค์`;
}
const escapeHtml = (value: unknown): string => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');
const overtimeStatusLabels = {
  PENDING_APPROVAL: 'รออนุมัติ',
  APPROVED: 'อนุมัติแล้ว',
  REJECTED: 'ไม่อนุมัติ',
};
const isAdminRole = (role: unknown): boolean => ['ADMIN', 'ROLE_ADMIN'].includes(String(role || '').trim().toUpperCase());

function parseOvertimeRange(startText: string, endText: string) {
  const startAt = parseBangkokDateTime(startText);
  const endAt = parseBangkokDateTime(endText);
  return startAt && endAt ? { startAt, endAt } : null;
}

function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'เข้าสู่ระบบไม่สำเร็จ');
      onLogin(result.user);
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <section className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">HR Connect Pro</h1>
            <p className="text-sm text-slate-500">เข้าสู่ระบบบริหารบุคคล</p>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900">ยินดีต้อนรับ</h2>
          <p className="text-sm text-slate-500 mt-1">กรุณาเข้าสู่ระบบด้วยอีเมลบริษัท</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">อีเมล</label>
            <input
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="name@company.com"
              autoComplete="email"
              required
              className="w-full px-3.5 py-3 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">รหัสผ่าน</label>
            <input
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder="กรอกรหัสผ่าน"
              autoComplete="current-password"
              required
              className="w-full px-3.5 py-3 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-3 rounded-lg transition shadow-lg shadow-indigo-600/20"
          >
            <LogIn className="w-4 h-4" />
            {isSubmitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
      </section>
    </main>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [summaryMonth, setSummaryMonth] = useState(new Date().getMonth() + 1);
  const [summaryYear, setSummaryYear] = useState(new Date().getFullYear());
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [onsite, setOnsite] = useState([]);
  const [workdayChanges, setWorkdayChanges] = useState([]);
  const [summaryRows, setSummaryRows] = useState([]);
  const [invoiceMonth, setInvoiceMonth] = useState(new Date().getMonth() + 1);
  const [invoiceYear, setInvoiceYear] = useState(new Date().getFullYear());
  const [invoiceSchedules, setInvoiceSchedules] = useState([]);
  const [isInvoiceLoading, setIsInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState('');
  const [projects, setProjects] = useState([]);
  const [projectInvoices, setProjectInvoices] = useState([]);
  const [isProjectInvoiceLoading, setIsProjectInvoiceLoading] = useState(false);
  const [isProjectSaving, setIsProjectSaving] = useState(false);
  const [projectInvoiceError, setProjectInvoiceError] = useState('');
  const [projectForm, setProjectForm] = useState({
    name: '',
    budget: '',
    client_name: '',
    address: '',
    tax_id: '',
  });
  const [projectInvoiceForm, setProjectInvoiceForm] = useState({
    project_id: '',
    installment: '',
    invoice_date: getBangkokDateInputValue(),
    billing_description: '',
    amount: '',
  });
  const [documentPrintRequest, setDocumentPrintRequest] = useState(null);
  const [documentNumber, setDocumentNumber] = useState('');
  const [isDocumentNumberLoading, setIsDocumentNumberLoading] = useState(false);
  const [documentNumberError, setDocumentNumberError] = useState('');
  const [isDocumentNumberIssued, setIsDocumentNumberIssued] = useState(false);
  const [receiptDate, setReceiptDate] = useState(getBangkokDateInputValue());
  const [accountEmployees, setAccountEmployees] = useState([]);
  const [overtimeRecords, setOvertimeRecords] = useState([]);
  const [overtimeQuote, setOvertimeQuote] = useState(null);
  const [overtimeQuoteLoading, setOvertimeQuoteLoading] = useState(false);
  const [isOvertimeLoading, setIsOvertimeLoading] = useState(false);
  const [overtimeError, setOvertimeError] = useState('');
  const [isOvertimeSaving, setIsOvertimeSaving] = useState(false);
  const [overtimeStatusSavingId, setOvertimeStatusSavingId] = useState(null);

  // UI states
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showOnsiteModal, setShowOnsiteModal] = useState(false);
  const [showTravelConfigModal, setShowTravelConfigModal] = useState(false);
  const [isOnsiteSaving, setIsOnsiteSaving] = useState(false);
  const [isTravelConfigLoading, setIsTravelConfigLoading] = useState(false);
  const [isTravelConfigSaving, setIsTravelConfigSaving] = useState(false);
  const [isClockSaving, setIsClockSaving] = useState(false);
  const [filterText, setFilterText] = useState('');

  const [workdayForm, setWorkdayForm] = useState({
    from_date: getDateInputValue(new Date()),
    to_date: getDateAfter(2),
    job_detail: '',
    project: '',
  });

  // Form states
  const [leaveForm, setLeaveForm] = useState({
    employee_id: 'EMP001',
    type: 'Sick Leave (ลาป่วย)',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    reason: ''
  });

  const [onsiteForm, setOnsiteForm] = useState({
    employee_id: 'EMP001',
    client_name: '',
    destination: '',
    date: new Date().toISOString().split('T')[0],
    purpose: '',
    vehicle: 'CAR',
    outbound_distance: '',
    return_distance: '',
    toll_fee: '',
    taxi_fare: '',
  });

  const [travelConfig, setTravelConfig] = useState({
    month: new Date().toISOString().slice(0, 7),
    fuel_price: '35.00',
    car_km_per_liter: '12.00',
    motorcycle_km_per_liter: '35.00',
    depreciation_per_km: '2.00',
  });

  const [clockForm, setClockForm] = useState({
    employee_id: 'EMP001',
    type: 'in', // 'in' or 'out'
    note: '',
    project: '',
    job_detail: ''
  });

  const [accountForm, setAccountForm] = useState({
    id: '',
    email: '',
    password: ''
  });

  const [overtimeForm, setOvertimeForm] = useState({
    employee_id: '',
    start_at: '',
    end_at: '',
  });

  useEffect(() => {
    fetch('/api/auth/me')
      .then(response => response.ok ? response.json() : { user: null })
      .then(result => setCurrentUser(result.user))
      .catch(() => setCurrentUser(null))
      .finally(() => setIsAuthLoading(false));
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setCurrentUser(null);
  };

  const loadAccountEmployees = async () => {
    try {
        const response = await fetch('/api/employees');
        if (!response.ok) {
          throw new Error('Unable to load employees');
        }

        const databaseEmployees = await response.json();
      setAccountEmployees(databaseEmployees);

      if (databaseEmployees.length > 0 && currentUser?.role === 'ADMIN') {
        setAccountForm({
          id: databaseEmployees[0].id,
          email: databaseEmployees[0].email || '',
          password: ''
        });
      }
      } catch (error) {
      console.error('Failed to load employees for account management:', error);
      setAccountEmployees([]);
      }
    };

  const handleAccountSave = async (event) => {
    event.preventDefault();
    try {
      const response = await fetch('/api/auth/update-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accountForm),
      });
      if (!response.ok) throw new Error('Failed to update account');
      alert('บัญชีอัปเดตสำเร็จ');
    } catch (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    }
  };

  const todayDate = getDateInputValue(new Date());
  const myTodayAttendance = currentUser
    ? attendance.find(item => item.employee_id === currentUser.id && item.date === todayDate)
    : null;
  const nextClockType = myTodayAttendance?.clock_in && myTodayAttendance.clock_in !== '-' &&
    (!myTodayAttendance.clock_out || myTodayAttendance.clock_out === '-')
      ? 'out'
      : 'in';
  const hasCompletedToday = Boolean(
    myTodayAttendance?.clock_in && myTodayAttendance.clock_in !== '-' &&
    myTodayAttendance?.clock_out && myTodayAttendance.clock_out !== '-'
  );

  // Clock toggle: API decides whether the requested transition is valid.
  const handleClockToggle = async () => {
    if (isClockSaving || hasCompletedToday) return;

    setIsClockSaving(true);
    try {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: nextClockType,
          project: clockForm.project,
          job_detail: clockForm.job_detail,
        }),
      });

      const savedAttendance = await response.json();
      if (!response.ok) {
        alert(savedAttendance.error || 'Unable to save attendance');
        return;
      }

      setAttendance(current => [
        savedAttendance,
        ...current.filter(item => item.id !== savedAttendance.id),
      ]);

      if (nextClockType === 'out') {
        setClockForm(current => ({ ...current, project: '', job_detail: '' }));
      }
    } catch (error) {
      console.error('Failed to save attendance:', error);
      alert('ไม่สามารถบันทึกเวลาได้');
    } finally {
      setIsClockSaving(false);
    }
  };

  // Load employee options from the employees database table.
  useEffect(() => {
    if (!currentUser) return;

    setLeaveForm(current => ({ ...current, employee_id: currentUser.id }));
    setOnsiteForm(current => ({ ...current, employee_id: currentUser.id }));
    setClockForm(current => ({ ...current, employee_id: currentUser.id }));

    const loadEmployees = async () => {
      try {
        const response = await fetch('/api/employees');
        if (!response.ok) {
          throw new Error('Unable to load employees');
        }

        const databaseEmployees = await response.json();
        setEmployees(databaseEmployees);
        setOvertimeForm(current => ({
          ...current,
          employee_id: currentUser.role?.toUpperCase() === 'ADMIN'
            ? current.employee_id || databaseEmployees[0]?.id || ''
            : currentUser.id,
        }));

      } catch (error) {
        console.error('Failed to load employees from database:', error);
        setEmployees([]);
      }
  };

    loadEmployees();

    fetch('/api/attendance')
      .then(response => response.ok ? response.json() : [])
      .then(setAttendance)
      .catch(error => {
        console.error('Failed to load attendance from database:', error);
        setAttendance([]);
      });
    fetch('/api/leaves')
      .then(response => response.ok ? response.json() : [])
      .then(setLeaves)
      .catch(error => {
        console.error('Failed to load leave requests from database:', error);
        setLeaves([]);
      });

    fetch('/api/onsite')
      .then(response => response.ok ? response.json() : [])
      .then(setOnsite)
      .catch(error => {
        console.error('Failed to load onsite records from database:', error);
        setOnsite([]);
      });

    fetch('/api/workday-changes')
      .then(response => response.ok ? response.json() : [])
      .then(setWorkdayChanges)
      .catch(error => {
        console.error('Failed to load workday change requests:', error);
        setWorkdayChanges([]);
      });
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser) {
      setSummaryRows([]);
      return;
    }

    const loadSummary = async () => {
      try {
        const response = await fetch(`/api/employee-summary?month=${summaryMonth}&year=${summaryYear}`);
        if (!response.ok) throw new Error('Unable to load employee summary');
        setSummaryRows(await response.json());
      } catch (error) {
        console.error('Failed to load employee summary:', error);
        setSummaryRows([]);
      }
    };

    loadSummary();
  }, [currentUser?.id, summaryMonth, summaryYear]);

  useEffect(() => {
    if (currentUser && ['invoices', 'project-invoices'].includes(activeTab) && !isAdminRole(currentUser.role)) {
      setActiveTab('dashboard');
    }
  }, [currentUser?.id, currentUser?.role, activeTab]);

  useEffect(() => {
    if (!currentUser || !isAdminRole(currentUser.role)) {
      setInvoiceSchedules([]);
      return;
    }

    const loadInvoiceSchedules = async () => {
      setIsInvoiceLoading(true);
      setInvoiceError('');
      try {
        const selectedMonth = `${invoiceYear}-${String(invoiceMonth).padStart(2, '0')}`;
        const response = await fetch(`/api/invoice-schedules?month=${selectedMonth}`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to load invoice schedules');
        setInvoiceSchedules(result);
      } catch (error) {
        console.error('Failed to load invoice schedules:', error);
        setInvoiceError(error instanceof Error ? error.message : 'Unable to load invoice schedules');
        setInvoiceSchedules([]);
      } finally {
        setIsInvoiceLoading(false);
      }
    };

    loadInvoiceSchedules();
  }, [currentUser?.id, currentUser?.role, invoiceMonth, invoiceYear]);

  const loadProjectInvoices = async () => {
    if (!currentUser || !isAdminRole(currentUser.role)) return;
    setIsProjectInvoiceLoading(true);
    setProjectInvoiceError('');
    try {
      const selectedMonth = `${invoiceYear}-${String(invoiceMonth).padStart(2, '0')}`;
      const response = await fetch(`/api/project-invoices?month=${selectedMonth}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load project invoices');
      setProjectInvoices(result);
    } catch (error) {
      console.error('Failed to load project invoices:', error);
      setProjectInvoiceError(error instanceof Error ? error.message : 'Unable to load project invoices');
      setProjectInvoices([]);
    } finally {
      setIsProjectInvoiceLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser || !isAdminRole(currentUser.role)) {
      setProjects([]);
      setProjectInvoices([]);
      return;
    }

    fetch('/api/projects')
      .then(response => response.ok ? response.json() : [])
      .then(result => {
        setProjects(result);
        setProjectInvoiceForm(current => ({ ...current, project_id: current.project_id || result[0]?.id || '' }));
      })
      .catch(error => {
        console.error('Failed to load projects:', error);
        setProjects([]);
      });
  }, [currentUser?.id, currentUser?.role]);

  useEffect(() => {
    loadProjectInvoices();
  }, [currentUser?.id, currentUser?.role, invoiceMonth, invoiceYear]);

  const handleCreateProject = async (event) => {
    event.preventDefault();
    setIsProjectSaving(true);
    setProjectInvoiceError('');
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectForm),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save project');
      setProjects(current => [...current, result].sort((left, right) => left.name.localeCompare(right.name, 'th')));
      setProjectInvoiceForm(current => ({ ...current, project_id: current.project_id || result.id }));
      setProjectForm({ name: '', budget: '', client_name: '', address: '', tax_id: '' });
    } catch (error) {
      setProjectInvoiceError(error instanceof Error ? error.message : 'Unable to save project');
    } finally {
      setIsProjectSaving(false);
    }
  };

  const handleCreateProjectInvoice = async (event) => {
    event.preventDefault();
    setIsProjectSaving(true);
    setProjectInvoiceError('');
    try {
      const response = await fetch('/api/project-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectInvoiceForm),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save project invoice');
      await loadProjectInvoices();
      setInvoiceMonth(Number(result.invoice_date.slice(5, 7)));
      setInvoiceYear(Number(result.invoice_date.slice(0, 4)));
      setProjectInvoiceForm(current => ({
        ...current,
        installment: '',
        invoice_date: getBangkokDateInputValue(),
        billing_description: '',
        amount: '',
      }));
    } catch (error) {
      setProjectInvoiceError(error instanceof Error ? error.message : 'Unable to save project invoice');
    } finally {
      setIsProjectSaving(false);
    }
  };

  const toPrintableProjectInvoice = (invoice) => ({
    ...invoice,
    issue_day: Number(invoice.invoice_date.slice(8, 10)),
    period: 'project',
    description: invoice.billing_description,
    service: `งวดงาน ${invoice.installment}`,
    name: invoice.client_name,
    tax_id: invoice.tax_id,
    invoice_number: invoice.invoice_number,
    receipt_number: invoice.invoice_number.replace('INV', 'REC'),
  });

  const openDocumentPrint = async ({ invoice, invoiceIndex, project, documentType }) => {
    const sourceType = project ? 'PROJECT' : 'RECURRING';
    const year = project ? Number(String(invoice.invoice_date).slice(0, 4)) : invoiceYear;
    const month = project ? String(invoice.invoice_date).slice(0, 7) : `${invoiceYear}-${String(invoiceMonth).padStart(2, '0')}`;
    const referenceKey = project ? `project:${invoice.id}` : `recurring:${invoice.id}:${month}`;
    const prefix = project
      ? (documentType === 'INVOICE' ? 'P-INV' : 'P-REC')
      : (documentType === 'INVOICE' ? 'INV' : 'REC');
    const fallbackNumber = project
      ? (documentType === 'INVOICE' ? invoice.invoice_number : invoice.receipt_number)
      : (documentType === 'INVOICE'
        ? (invoice.invoice_number || `INV-${invoiceYear}-${String(invoiceIndex + 1).padStart(3, '0')}`)
        : (invoice.receipt_number || `REC-${invoiceYear}/${String(invoiceIndex + 1).padStart(3, '0')}`));

    setDocumentPrintRequest({ invoice, invoiceIndex, project, documentType, sourceType, referenceKey, year });
    setDocumentNumber('');
    setDocumentNumberError('');
    setIsDocumentNumberIssued(false);
    if (documentType === 'RECEIPT') setReceiptDate(getBangkokDateInputValue());
    setIsDocumentNumberLoading(true);
    try {
      const params = new URLSearchParams({
        document_type: documentType,
        source_type: sourceType,
        reference_key: referenceKey,
        source_id: invoice.id,
        prefix,
        year: String(year),
      });
      if (fallbackNumber) params.set('fallback_number', fallbackNumber);
      const response = await fetch(`/api/issued-documents?${params.toString()}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load document number');
      setDocumentNumber(result.document_number);
      setIsDocumentNumberIssued(Boolean(result.issued));
    } catch (error) {
      setDocumentNumberError(error instanceof Error ? error.message : 'ไม่สามารถโหลดเลขที่เอกสารได้');
    } finally {
      setIsDocumentNumberLoading(false);
    }
  };

  const getProjectInvoiceAmounts = (invoice) => {
    const subtotalSatang = Math.round((Number(invoice.amount) || 0) * 100);
    const vatSatang = Math.round(subtotalSatang * 7 / 100);
    const totalSatang = subtotalSatang + vatSatang;
    const withholdingSatang = Math.round(subtotalSatang * 3 / 100);
    return {
      subtotal: subtotalSatang / 100,
      vat: vatSatang / 100,
      total: totalSatang / 100,
      net: (totalSatang - withholdingSatang) / 100,
    };
  };

  const getProjectInstallmentParts = (installment) => {
    const value = String(installment || '');
    const number = value.match(/(?:งวด(?:งาน)?\s*(?:ที่)?\s*)?(\d+(?:\.\d+)?)/i)?.[1] || value || '-';
    const percentage = value.match(/(\d+(?:\.\d+)?)\s*%/)?.[1];
    return { number, percentage: percentage ? `${percentage}%` : '-', percentageValue: percentage ? Number(percentage) : 0 };
  };

  const printProjectInvoice = (invoice, options: { invoiceNumber?: string } = {}) => {
    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) {
      setProjectInvoiceError('ไม่สามารถเปิดหน้าต่างพิมพ์ได้ กรุณาอนุญาตให้เปิดป๊อปอัป');
      return;
    }

    const amounts = getProjectInvoiceAmounts(invoice);
    const installment = getProjectInstallmentParts(invoice.installment);
    const derivedProjectBudget = installment.percentageValue > 0 ? amounts.subtotal / (installment.percentageValue / 100) : null;
    const projectBudget = Number(invoice.project_budget) > 0 ? Number(invoice.project_budget) : derivedProjectBudget;
    const amount = formatInvoiceAmount(amounts.subtotal);
    const vat = formatInvoiceAmount(amounts.vat);
    const grandTotal = formatInvoiceAmount(amounts.total);
    const netAmount = formatInvoiceAmount(amounts.net);
    const amountWords = `(   ***${bahtToThaiWords(amounts.total)}***   )`;
    const invoiceNumber = options.invoiceNumber || invoice.invoice_number;

    printWindow.document.write(`<!doctype html>
      <html lang="th">
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(invoiceNumber)}</title>
          <style>
            @page { size: A4 portrait; margin: 8mm 9mm 7mm; }
            * { box-sizing: border-box; }
            body { margin: 0; color: #111827; font-family: Arial, "Noto Sans Thai", Tahoma, sans-serif; font-size: 11px; }
            .document { width: 100%; max-width: 192mm; margin: 0 auto; }
            .header { display: grid; grid-template-columns: 48% 52%; min-height: 32mm; align-items: start; }
            .brand { padding-top: 1mm; }
            .brand-mark { display: inline-block; color: #fff; background: #1f2937; letter-spacing: 7px; font-size: 24px; line-height: 31px; padding: 0 7px 0 10px; }
            .brand-subtitle { color: #6b7280; font-size: 8px; letter-spacing: 2.5px; margin: 1px 0 8px 2px; }
            .issuer-name { font-size: 13px; font-weight: 700; margin-bottom: 4px; }
            .issuer-detail { line-height: 1.45; font-size: 10px; }
            .document-title { text-align: center; font-size: 24px; font-weight: 700; padding-top: 3mm; }
            .document-title small { display: block; font-size: 12px; font-weight: 400; margin-top: 2px; }
            .rule { border-top: 2px solid #111; margin: 4px 0 7px; }
            .customer { display: grid; grid-template-columns: 58% 42%; min-height: 28mm; border-bottom: 1px solid #111; padding: 0 2px 7px; }
            .customer-left { line-height: 1.65; padding-right: 8px; }
            .customer-left .label { display: inline-block; min-width: 63px; }
            .customer-left .value { font-weight: 600; }
            .customer-right { line-height: 1.75; padding-left: 8px; }
            .meta-row { display: flex; gap: 7px; }
            .meta-label { min-width: 83px; font-weight: 600; white-space: nowrap; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            .items { margin-top: 10px; }
            th, td { border: 1px solid #111; padding: 5px 6px; vertical-align: middle; overflow-wrap: anywhere; }
            th { background: #d9e2f3; text-align: center; font-weight: 700; }
            .items thead tr:first-child th { height: 9mm; }
            .items thead tr:last-child th { height: 8mm; }
            .project-col { width: 25%; }
            .detail-col { width: 37%; }
            .installment-col { width: 11%; text-align: center; }
            .percent-col { width: 11%; text-align: center; }
            .amount-col { width: 16%; text-align: right; white-space: nowrap; }
            .items tbody td { height: 31mm; vertical-align: top; }
            .project-name { font-weight: 700; line-height: 1.55; }
            .muted { display: block; color: #4b5563; font-size: 10px; margin-top: 4px; }
            .center { text-align: center; }
            .right { text-align: right; }
            .summary { display: flex; justify-content: flex-end; }
            .summary table { width: 38%; }
            .summary td { height: 7mm; padding: 4px 6px; }
            .summary .label { width: 57.8947%; background: #f3f4f6; font-weight: 600; }
            .summary .money { width: 42.1053%; text-align: right; white-space: nowrap; }
            .summary .grand td { font-weight: 700; font-size: 13px; }
            .amount-words { border-bottom: 1px solid #111; padding: 6px 2px; font-weight: 700; min-height: 8mm; }
            .withholding-note { display: block; padding: 5px 2px 0; margin-bottom: 2px; font-size: 11px; line-height: 1.5; }
            .balance { display: flex; justify-content: flex-end; gap: 8px; padding: 5px 2px 4px; font-size: 11px; }
            .balance strong { min-width: 30mm; text-align: right; }
            .payment { border-top: 1px solid #111; padding-top: 5px; line-height: 1.55; min-height: 28mm; }
            .payment-title { font-weight: 700; margin-bottom: 2px; }
            .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9mm; margin-top: 13mm; text-align: center; }
            .signature { border-top: 1px solid #6b7280; padding-top: 9mm; min-height: 16mm; }
            .print-note { margin-top: 5px; color: #6b7280; font-size: 9px; text-align: center; }
            .document + .document { break-before: page; page-break-before: always; }
            @media print { .print-note { display: none; } }
          </style>
        </head>
        <body>
          <main class="document">
            <section class="header">
              <div class="brand">
                <div class="brand-mark">DeRIVE</div>
                <div class="brand-subtitle">Innovation Company Limited</div>
                <div class="issuer-name">บริษัท ดีไรฟ์ อินโนเวชั่น จำกัด</div>
                <div class="issuer-detail">653/37 ถ.จรัญสนิทวงศ์ แขวงอรุณอมรินทร์ เขตบางกอกน้อย กรุงเทพมหานคร 10700<br />Tax ID: 0105556107148 สำนักงานใหญ่ (061-5202649)</div>
              </div>
              <div class="document-title">ใบแจ้งหนี้<small class="copy-label">(ต้นฉบับ)</small></div>
            </section>
            <div class="rule"></div>
            <section class="customer">
              <div class="customer-left">
                <div><span class="label">Attention:</span></div>
                <div><span class="label">Company:</span><span class="value">${escapeHtml(invoice.client_name)}</span></div>
                <div><span class="label"></span>${escapeHtml(invoice.address)}</div>
                <div><span class="label"></span>เลขประจำตัวผู้เสียภาษี : ${escapeHtml(invoice.tax_id)}</div>
              </div>
              <div class="customer-right">
                <div class="meta-row"><span class="meta-label">เลขที่/ No. :</span><span>${escapeHtml(invoiceNumber)}</span></div>
                <div class="meta-row"><span class="meta-label">วันที่ Date :</span><span>${escapeHtml(formatThaiDate(invoice.invoice_date))}</span></div>
              </div>
            </section>
            <table class="items">
              <colgroup><col style="width: 25%" /><col style="width: 37%" /><col style="width: 11%" /><col style="width: 11%" /><col style="width: 16%" /></colgroup>
              <thead>
                <tr><th class="project-col" rowspan="2">โครงการ / งบประมาณโครงการ</th><th class="detail-col" rowspan="2">รายละเอียดงวดงานตามสัญญา</th><th colspan="3">รายการจ่ายเงินงวด</th></tr>
                <tr><th class="installment-col">งวดงานที่</th><th class="percent-col">เปอร์เซ็น</th><th class="amount-col">Amount</th></tr>
              </thead>
              <tbody><tr><td><span class="project-name">${escapeHtml(invoice.project_name)}</span><span class="muted">งบประมาณโครงการ: ${projectBudget === null ? '-' : formatInvoiceAmount(projectBudget)}</span></td><td>${escapeHtml(invoice.billing_description)}</td><td class="center">${escapeHtml(installment.number)}</td><td class="center">${escapeHtml(installment.percentage)}</td><td class="right">${amount}</td></tr></tbody>
            </table>
            <section class="summary">
              <table>
                <tr><td class="label">รวมเป็นเงิน</td><td class="money">${amount}</td></tr>
                <tr><td class="label">ภาษีมูลค่าเพิ่ม 7%</td><td class="money">${vat}</td></tr>
                <tr class="grand"><td class="label">รวมทั้งสิ้น</td><td class="money">${grandTotal}</td></tr>
              </table>
            </section>
            <div class="amount-words">${escapeHtml(amountWords)}</div>
            <div class="withholding-note"><strong>หมายเหตุ: ยอดเงินหน้าเช็ค หรือ รับเงินสด หลังหักภาษี ณ ที่จ่าย 3%</strong></div>
            <div class="balance"><span>คงเหลือยอดเงิน</span><strong>${netAmount}</strong><span>บาท</span></div>
            <section class="payment">
              <div class="payment-title">วิธีการชำระเงิน</div>
              <div>1. ฝากเข้าบัญชีธนาคาร : ชื่อบัญชี บจก.ดีไรฟ์ อินโนเวชั่น เลขที่ 016-8-53748-4 ธนาคารกสิกรไทย สาขาวรจักร</div>
              <div>2. เช็คสั่งจ่าย “บริษัท ดีไรฟ์ อินโนเวชั่น จำกัด” โดยขีดคร่อมเช็ค และขีดฆ่า “หรือผู้ถือ”</div>
              <div>3. Payment Terms: Payment is due within 14 days from the invoice date</div>
            </section>
            <section class="signatures"><div class="signature">ผู้รับใบแจ้งหนี้ :</div><div class="signature">ผู้จัดทำ :</div><div class="signature">ผู้อนุมัติ :</div></section>
            <div class="print-note">ตรวจสอบข้อมูลก่อนพิมพ์เอกสารฉบับจริง</div>
          </main>
          <script>
            window.onload = function () {
              const original = document.querySelector('.document');
              if (original) {
                const copy = original.cloneNode(true);
                const copyLabel = copy.querySelector('.copy-label');
                if (copyLabel) copyLabel.textContent = '(สำเนา)';
                original.after(copy);
              }
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>`);
    printWindow.document.close();
  };

  const printProjectReceipt = (invoice, selectedReceiptDate, options: { receiptNumber?: string; invoiceNumber?: string } = {}) => {
    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) {
      setProjectInvoiceError('ไม่สามารถเปิดหน้าต่างพิมพ์ได้ กรุณาอนุญาตให้เปิดป๊อปอัป');
      return;
    }

    const amounts = getProjectInvoiceAmounts(invoice);
    const installment = getProjectInstallmentParts(invoice.installment);
    const derivedProjectBudget = installment.percentageValue > 0 ? amounts.subtotal / (installment.percentageValue / 100) : null;
    const projectBudget = Number(invoice.project_budget) > 0 ? Number(invoice.project_budget) : derivedProjectBudget;
    const amount = formatInvoiceAmount(amounts.subtotal);
    const vat = formatInvoiceAmount(amounts.vat);
    const grandTotal = formatInvoiceAmount(amounts.total);
    const netAmount = formatInvoiceAmount(amounts.net);
    const amountWords = `(   ***${bahtToThaiWords(amounts.total)}***   )`;
    const receiptDateLabel = formatThaiDate(selectedReceiptDate);
    const receiptNumber = options.receiptNumber || invoice.receipt_number;
    const invoiceNumber = options.invoiceNumber || invoice.invoice_number;

    printWindow.document.write(`<!doctype html>
      <html lang="th">
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(receiptNumber)}</title>
          <style>
            @page { size: A4 portrait; margin: 8mm 9mm 7mm; }
            * { box-sizing: border-box; }
            body { margin: 0; color: #111827; font-family: Arial, "Noto Sans Thai", Tahoma, sans-serif; font-size: 11px; }
            .document { width: 100%; max-width: 192mm; margin: 0 auto; }
            .header { display: grid; grid-template-columns: 48% 52%; min-height: 32mm; align-items: start; }
            .brand { padding-top: 1mm; }
            .brand-mark { display: inline-block; color: #fff; background: #1f2937; letter-spacing: 7px; font-size: 24px; line-height: 31px; padding: 0 7px 0 10px; }
            .brand-subtitle { color: #6b7280; font-size: 8px; letter-spacing: 2.5px; margin: 1px 0 8px 2px; }
            .issuer-name { font-size: 13px; font-weight: 700; margin-bottom: 4px; }
            .issuer-detail { line-height: 1.45; font-size: 10px; }
            .document-title { text-align: center; font-size: 20px; font-weight: 700; padding-top: 2mm; line-height: 1.35; }
            .document-title small { display: block; font-size: 11px; font-weight: 400; margin-top: 2px; }
            .rule { border-top: 2px solid #111; margin: 4px 0 7px; }
            .customer { display: grid; grid-template-columns: 58% 42%; min-height: 28mm; border-bottom: 1px solid #111; padding: 0 2px 7px; }
            .customer-left { line-height: 1.65; padding-right: 8px; }
            .customer-left .label { display: inline-block; min-width: 63px; }
            .customer-left .value { font-weight: 600; }
            .customer-right { line-height: 1.75; padding-left: 8px; }
            .meta-row { display: flex; gap: 7px; }
            .meta-label { min-width: 83px; font-weight: 600; white-space: nowrap; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            .items { margin-top: 10px; }
            th, td { border: 1px solid #111; padding: 5px 6px; vertical-align: middle; overflow-wrap: anywhere; }
            th { background: #d9e2f3; text-align: center; font-weight: 700; }
            .items thead tr:first-child th { height: 9mm; }
            .items thead tr:last-child th { height: 8mm; }
            .project-col { width: 25%; }
            .detail-col { width: 37%; }
            .installment-col { width: 11%; text-align: center; }
            .percent-col { width: 11%; text-align: center; }
            .amount-col { width: 16%; text-align: right; white-space: nowrap; }
            .items tbody td { height: 27mm; vertical-align: top; }
            .project-name { font-weight: 700; line-height: 1.55; }
            .muted { display: block; color: #4b5563; font-size: 10px; margin-top: 4px; }
            .center { text-align: center; }
            .right { text-align: right; }
            .summary { display: flex; justify-content: flex-end; }
            .summary table { width: 38%; }
            .summary td { height: 7mm; padding: 4px 6px; }
            .summary .label { width: 57.8947%; background: #f3f4f6; font-weight: 600; }
            .summary .money { width: 42.1053%; text-align: right; white-space: nowrap; }
            .summary .grand td { font-weight: 700; font-size: 13px; }
            .amount-words { border-bottom: 1px solid #111; padding: 6px 2px; font-weight: 700; min-height: 8mm; }
            .withholding-note { display: block; padding: 5px 2px 0; margin-bottom: 2px; font-size: 11px; line-height: 1.5; }
            .balance { display: flex; justify-content: flex-end; gap: 8px; padding: 5px 2px 4px; font-size: 11px; }
            .balance strong { min-width: 30mm; text-align: right; }
            .payment { border-top: 1px solid #111; padding-top: 5px; line-height: 1.55; min-height: 36mm; }
            .payment-title { font-weight: 700; margin-bottom: 2px; }
            .signatures { display: grid; grid-template-columns: repeat(2, 1fr); gap: 35mm; margin-top: 9mm; text-align: center; }
            .signature { border-top: 1px solid #6b7280; padding-top: 9mm; min-height: 16mm; }
            .print-note { margin-top: 5px; color: #6b7280; font-size: 9px; text-align: center; }
            .document + .document { break-before: page; page-break-before: always; }
            @media print { .print-note { display: none; } }
          </style>
        </head>
        <body>
          <main class="document">
            <section class="header">
              <div class="brand">
                <div class="brand-mark">DeRIVE</div>
                <div class="brand-subtitle">Innovation Company Limited</div>
                <div class="issuer-name">บริษัท ดีไรฟ์ อินโนเวชั่น จำกัด</div>
                <div class="issuer-detail">653/37 ถ.จรัญสนิทวงศ์ แขวงอรุณอมรินทร์ เขตบางกอกน้อย กรุงเทพมหานคร 10700<br />Tax ID: 0105556107148 สำนักงานใหญ่</div>
              </div>
              <div class="document-title">ใบเสร็จรับเงิน / ใบกำกับภาษี<small>(Receipt / Tax Invoice)</small><small class="copy-label">(ต้นฉบับ)</small></div>
            </section>
            <div class="rule"></div>
            <section class="customer">
              <div class="customer-left">
                <div><span class="label">Attention:</span></div>
                <div><span class="label">Company:</span><span class="value">${escapeHtml(invoice.client_name)}</span></div>
                <div><span class="label"></span>${escapeHtml(invoice.address)}</div>
                <div><span class="label"></span>เลขประจำตัวผู้เสียภาษี : ${escapeHtml(invoice.tax_id)}</div>
              </div>
              <div class="customer-right">
                <div class="meta-row"><span class="meta-label">เล่มที่</span><span>001</span></div>
                <div class="meta-row"><span class="meta-label">เลขที่/ No. :</span><span>${escapeHtml(receiptNumber)}</span></div>
                <div class="meta-row"><span class="meta-label">อ้างอิง Invoice :</span><span>${escapeHtml(invoiceNumber)}</span></div>
                <div class="meta-row"><span class="meta-label">วันที่ Date :</span><span>${escapeHtml(receiptDateLabel)}</span></div>
              </div>
            </section>
            <table class="items">
              <colgroup><col style="width: 25%" /><col style="width: 37%" /><col style="width: 11%" /><col style="width: 11%" /><col style="width: 16%" /></colgroup>
              <thead>
                <tr><th class="project-col" rowspan="2">โครงการ / งบประมาณโครงการ</th><th class="detail-col" rowspan="2">รายละเอียดงวดงานตามสัญญา</th><th colspan="3">รายการจ่ายเงินงวด</th></tr>
                <tr><th class="installment-col">งวดงานที่</th><th class="percent-col">เปอร์เซ็น</th><th class="amount-col">Amount</th></tr>
              </thead>
              <tbody><tr><td><span class="project-name">${escapeHtml(invoice.project_name)}</span><span class="muted">งบประมาณโครงการ: ${projectBudget === null ? '-' : formatInvoiceAmount(projectBudget)}</span></td><td>${escapeHtml(invoice.billing_description)}</td><td class="center">${escapeHtml(installment.number)}</td><td class="center">${escapeHtml(installment.percentage)}</td><td class="right">${amount}</td></tr></tbody>
            </table>
            <section class="summary">
              <table>
                <tr><td class="label">รวมเป็นเงิน</td><td class="money">${amount}</td></tr>
                <tr><td class="label">ภาษีมูลค่าเพิ่ม 7%</td><td class="money">${vat}</td></tr>
                <tr class="grand"><td class="label">รวมทั้งสิ้น</td><td class="money">${grandTotal}</td></tr>
              </table>
            </section>
            <div class="amount-words">${escapeHtml(amountWords)}</div>
            <div class="withholding-note"><strong>หมายเหตุ: ยอดเงินหน้าเช็ค หรือ รับเงินสด หลังหักภาษี ณ ที่จ่าย 3%</strong></div>
            <div class="balance"><span>คงเหลือยอดเงิน</span><strong>${netAmount}</strong><span>บาท</span></div>
            <section class="payment">
              <div class="payment-title">ชำระเงินโดย</div>
              <div>(   ) เงินสด ( Cash)</div>
              <div>(   ) เช็ค (Cheque) ธนาคาร/Bank __________________ เลขที่/No. __________________ ลงวันที่/Date ______________</div>
              <div>(   ) โอนเข้าบัญชี เลขที่ 016-8-53748-4 ธนาคาร/Bank กสิกรไทย สาขา/Branch วรจักร วันที่/Date ______________</div>
              <div class="muted">ในกรณีชำระด้วยเช็ค โปรดสั่งจ่ายและขีดคร่อมในนาม “บริษัท ดีไรฟ์ อินโนเวชั่น จำกัด” เท่านั้น</div>
            </section>
            <section class="signatures"><div class="signature">ผู้รับเงิน / Collector By</div><div class="signature">ผู้อนุมัติ / Authorized Signature</div></section>
            <div class="print-note">วันที่ในใบเสร็จนี้คือวันที่พิมพ์เอกสาร</div>
          </main>
          <script>
            window.onload = function () {
              const original = document.querySelector('.document');
              if (original) {
                const copy = original.cloneNode(true);
                const copyLabel = copy.querySelector('.copy-label');
                if (copyLabel) copyLabel.textContent = '(สำเนา)';
                original.after(copy);
              }
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>`);
    printWindow.document.close();
  };

  const printInvoice = (invoice, invoiceIndex, options: { issueDate?: string; invoiceNumber?: string } = {}) => {
    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) {
      setInvoiceError('ไม่สามารถเปิดหน้าต่างพิมพ์ได้ กรุณาอนุญาตให้เปิดป๊อปอัป');
      return;
    }

    const issueDate = options.issueDate || `${invoice.issue_day} ${thaiMonths[invoiceMonth - 1]} ${invoiceYear + 543}`;
    const periodLabel = invoice.period === 'project' ? 'ตามงวดงาน' : invoice.period === 'year' ? 'รายปี' : invoice.period === 'quarter' ? 'รายไตรมาส' : 'รายเดือน';
    const invoiceNumber = options.invoiceNumber || invoice.invoice_number || `INV-${invoiceYear}-${String(invoiceIndex + 1).padStart(3, '0')}`;
    const serviceAmountSatang = Math.round((Number(invoice.amount) || 0) * 100);
    const vatAmountSatang = Math.round(serviceAmountSatang * 7 / 100);
    const totalAmountSatang = serviceAmountSatang + vatAmountSatang;
    const netAmountSatang = Math.round(totalAmountSatang * 97 / 100);
    const serviceAmount = serviceAmountSatang / 100;
    const vatAmount = vatAmountSatang / 100;
    const totalAmount = totalAmountSatang / 100;
    const netAmount = netAmountSatang / 100;
    const amount = formatInvoiceAmount(serviceAmount);
    const vat = formatInvoiceAmount(vatAmount);
    const grandTotal = formatInvoiceAmount(totalAmount);
    const netAmountText = formatInvoiceAmount(netAmount);

    printWindow.document.write(`<!doctype html>
      <html lang="th">
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(invoiceNumber)}</title>
          <style>
            @page { size: A4 portrait; margin: 12mm 10mm; }
            * { box-sizing: border-box; }
            body { margin: 0; color: #111827; font-family: Arial, "Noto Sans Thai", Tahoma, sans-serif; font-size: 12px; }
            .invoice { width: 100%; max-width: 190mm; margin: 0 auto; }
            .top { display: flex; justify-content: space-between; align-items: flex-start; min-height: 30mm; }
            .brand { width: 55%; }
            .brand-mark { display: inline-block; color: #fff; background: #1f2937; letter-spacing: 8px; font-size: 27px; line-height: 34px; padding: 0 8px 0 12px; }
            .brand-subtitle { color: #6b7280; font-size: 9px; letter-spacing: 3px; margin: 2px 0 14px 2px; }
            .issuer-name { font-size: 15px; font-weight: 700; margin-bottom: 8px; }
            .issuer-detail { line-height: 1.65; }
            .title { width: 42%; text-align: right; font-size: 25px; font-weight: 700; padding-top: 0; }
            .copy { display: block; font-size: 13px; font-weight: 400; margin-top: 2px; }
            .rule { border-top: 2px solid #111; margin: 10px 0 12px; }
            .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; min-height: 34mm; border-bottom: 1px solid #111; padding-bottom: 12px; }
            .party { line-height: 1.8; }
            .party-label { display: inline-block; min-width: 72px; }
            .party-value { font-weight: 600; }
            .meta { line-height: 2; text-align: left; }
            .meta-row { display: flex; justify-content: space-between; gap: 12px; }
            .meta-label { font-weight: 600; white-space: nowrap; }
            .meta-value { min-width: 120px; text-align: left; }
            table { width: 100%; border-collapse: collapse; margin-top: 14px; table-layout: fixed; }
            th, td { border: 1px solid #111; padding: 8px 7px; vertical-align: top; min-width: 0; }
            th { background: #173b64; color: #fff; text-align: center; font-size: 12px; }
            th small { display: block; font-size: 11px; margin-top: 7px; font-weight: 400; }
            td { min-height: 55mm; }
            .item { width: 8%; text-align: center; }
            .description { width: 43%; overflow-wrap: anywhere; }
            .price { width: 18%; text-align: right; white-space: nowrap; font-size: 11px; }
            .quantity { width: 12%; text-align: center; }
            .total { width: 19%; text-align: right; white-space: nowrap; font-size: 11px; }
            .description strong { display: block; margin-bottom: 8px; }
            .description p { margin: 4px 0; line-height: 1.7; }
            .summary { display: flex; justify-content: flex-end; margin-top: 0; }
            .summary table { width: 49%; margin-top: 0; table-layout: fixed; }
            .summary td { min-height: 0; padding: 7px; }
            .summary .label { width: 61.2245%; font-weight: 600; background: #f3f4f6; }
            .summary .total { width: 38.7755%; padding-left: 4px; padding-right: 4px; text-align: right; white-space: nowrap; overflow: hidden; font-size: 12px; }
            .summary .grand-total td { font-size: 14px; font-weight: 700; }
            .amount-words { margin-top: 10px; font-size: 13px; font-weight: 700; }
            .withholding-note { margin-top: 8px; font-size: 12px; line-height: 1.7; }
            .footer { display: flex; justify-content: space-between; margin-top: 25mm; text-align: center; }
            .signature { width: 38%; padding-top: 12mm; border-top: 1px solid #6b7280; }
            .print-note { margin-top: 12px; color: #6b7280; font-size: 10px; }
            .invoice + .invoice { break-before: page; page-break-before: always; }
            @media print { .print-note { display: none; } }
          </style>
        </head>
        <body>
          <main class="invoice">
            <section class="top">
              <div class="brand">
                <div class="brand-mark">DeRIVE</div>
                <div class="brand-subtitle">Innovation Company Limited</div>
                <div class="issuer-name">บริษัท ดิไรฟ์ อินโนเวชั่น จำกัด</div>
                <div class="issuer-detail">653/37 ถนนจรัญสนิทวงศ์ แขวงบางอ้อ เขตบางพลัด กรุงเทพมหานคร 10700<br />Tax ID: 0105556107148 สำนักงานใหญ่</div>
              </div>
              <div class="title">ใบแจ้งหนี้<span class="copy copy-label">(ต้นฉบับ)</span></div>
            </section>
            <div class="rule"></div>
            <section class="parties">
              <div class="party">
                <div><span class="party-label">Attention:</span></div>
                <div><span class="party-label">Company:</span><span class="party-value">${escapeHtml(invoice.name)}</span></div>
                <div><span class="party-label"></span>${escapeHtml(invoice.address)}</div>
                <div><span class="party-label"></span>เลขประจำตัวผู้เสียภาษี: ${escapeHtml(invoice.tax_id)} (สำนักงานใหญ่)</div>
              </div>
              <div class="meta">
                <div class="meta-row"><span class="meta-label">เลขที่ No. :</span><span class="meta-value">${escapeHtml(invoiceNumber)}</span></div>
                <div class="meta-row"><span class="meta-label">วันที่ Date :</span><span class="meta-value">${escapeHtml(issueDate)}</span></div>
              </div>
            </section>
            <table>
              <thead>
                <tr><th class="item">ลำดับที่<small>ITEM</small></th><th class="description">รายการ<small>DESCRIPTION</small></th><th class="price">ราคา/หน่วย<small>Price/Unit</small></th><th class="quantity">จำนวน (ปี)<small>Quantity</small></th><th class="total">จำนวนเงิน<small>Amount</small></th></tr>
              </thead>
              <tbody>
                <tr>
                  <td class="item">1</td>
                  <td class="description"><strong>${escapeHtml(invoice.description)}</strong><p>รอบการออกเอกสาร: ${escapeHtml(periodLabel)}</p><p>รายละเอียดบริการ: ${escapeHtml(invoice.service)}</p></td>
                  <td class="price">${amount}</td>
                  <td class="quantity">1</td>
                  <td class="total">${amount}</td>
                </tr>
              </tbody>
            </table>
            <section class="summary">
              <table>
                <tr><td class="label">รวมเป็นเงิน</td><td class="total">${amount}</td></tr>
                <tr><td class="label">ภาษีมูลค่าเพิ่ม 7%</td><td class="total">${vat}</td></tr>
                <tr class="grand-total"><td class="label">จำนวนเงินทั้งสิ้น</td><td class="total">${grandTotal}</td></tr>
              </table>
            </section>
            <div class="amount-words">(${escapeHtml(bahtToThaiWords(totalAmount))})</div>
            <div class="withholding-note"><strong>หมายเหตุ:</strong> ยอดเงินหน้าเช็ค หรือ รับเงินสด หลังหักภาษี ณ ที่จ่าย 3%<br />คงเหลือยอดเงิน <strong>${netAmountText} บาท</strong></div>
            <section class="footer"><div class="signature">ผู้จัดทำ / Prepared by</div><div class="signature">ผู้รับวางบิล / Received by</div></section>
            <div class="print-note">ตรวจสอบข้อมูลก่อนพิมพ์เอกสารฉบับจริง</div>
          </main>
          <script>
            window.onload = function () {
              const original = document.querySelector('.invoice');
              if (original) {
                const copy = original.cloneNode(true);
                const copyLabel = copy.querySelector('.copy-label');
                if (copyLabel) copyLabel.textContent = '(สำเนา)';
                original.after(copy);
              }
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>`);
    printWindow.document.close();
  };

  const printReceipt = (invoice, invoiceIndex, selectedReceiptDate, options: { receiptNumber?: string; invoiceNumber?: string } = {}) => {
    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) {
      setInvoiceError('ไม่สามารถเปิดหน้าต่างพิมพ์ได้ กรุณาอนุญาตให้เปิดป๊อปอัป');
      return;
    }

    const receiptNumber = options.receiptNumber || invoice.receipt_number || `REC-${invoiceYear}/${String(invoiceIndex + 1).padStart(3, '0')}`;
    const invoiceNumber = options.invoiceNumber || invoice.invoice_number || `INV-${invoiceYear}-${String(invoiceIndex + 1).padStart(3, '0')}`;
    const [receiptYear, receiptMonth, receiptDay] = selectedReceiptDate.split('-').map(Number);
    const printingDate = `${receiptDay} ${thaiMonths[receiptMonth - 1]} ${receiptYear + 543}`;
    const periodLabel = invoice.period === 'project' ? 'ตามงวดงาน' : invoice.period === 'year' ? 'รายปี' : invoice.period === 'quarter' ? 'รายไตรมาส' : 'รายเดือน';
    const serviceAmountSatang = Math.round((Number(invoice.amount) || 0) * 100);
    const vatAmountSatang = Math.round(serviceAmountSatang * 7 / 100);
    const totalAmountSatang = serviceAmountSatang + vatAmountSatang;
    const netAmountSatang = Math.round(totalAmountSatang * 97 / 100);
    const serviceAmount = serviceAmountSatang / 100;
    const vatAmount = vatAmountSatang / 100;
    const totalAmount = totalAmountSatang / 100;
    const netAmount = netAmountSatang / 100;
    const amount = formatInvoiceAmount(serviceAmount);
    const vat = formatInvoiceAmount(vatAmount);
    const grandTotal = formatInvoiceAmount(totalAmount);
    const netAmountText = formatInvoiceAmount(netAmount);

    printWindow.document.write(`<!doctype html>
      <html lang="th">
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(receiptNumber)}</title>
          <style>
            @page { size: A4 portrait; margin: 12mm 10mm; }
            * { box-sizing: border-box; }
            body { margin: 0; color: #111827; font-family: Arial, "Noto Sans Thai", Tahoma, sans-serif; font-size: 12px; }
            .receipt { width: 100%; max-width: 190mm; margin: 0 auto; }
            .top { display: flex; justify-content: space-between; align-items: flex-start; min-height: 30mm; }
            .brand { width: 55%; }
            .brand-mark { display: inline-block; color: #fff; background: #1f2937; letter-spacing: 8px; font-size: 27px; line-height: 34px; padding: 0 8px 0 12px; }
            .brand-subtitle { color: #6b7280; font-size: 9px; letter-spacing: 3px; margin: 2px 0 14px 2px; }
            .issuer-name { font-size: 15px; font-weight: 700; margin-bottom: 8px; }
            .issuer-detail { line-height: 1.65; }
            .title { width: 42%; text-align: right; font-size: 22px; font-weight: 700; line-height: 1.35; }
            .title small { display: block; font-size: 12px; font-weight: 400; }
            .copy { display: block; font-size: 12px; font-weight: 400; margin-top: 5px; }
            .rule { border-top: 2px solid #111; margin: 10px 0 12px; }
            .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; min-height: 34mm; border-bottom: 1px solid #111; padding-bottom: 12px; }
            .party { line-height: 1.8; }
            .party-label { display: inline-block; min-width: 72px; }
            .party-value { font-weight: 600; }
            .meta { line-height: 2; text-align: left; }
            .meta-row { display: flex; justify-content: space-between; gap: 12px; }
            .meta-label { font-weight: 600; white-space: nowrap; }
            .meta-value { min-width: 120px; text-align: left; }
            table { width: 100%; border-collapse: collapse; margin-top: 14px; table-layout: fixed; }
            th, td { border: 1px solid #111; padding: 8px 7px; vertical-align: top; min-width: 0; }
            th { background: #173b64; color: #fff; text-align: center; font-size: 12px; }
            th small { display: block; font-size: 11px; margin-top: 7px; font-weight: 400; }
            td { min-height: 48mm; }
            .item { width: 8%; text-align: center; }
            .description { width: 43%; overflow-wrap: anywhere; }
            .price { width: 18%; text-align: right; white-space: nowrap; font-size: 11px; }
            .quantity { width: 12%; text-align: center; }
            .total { width: 19%; text-align: right; white-space: nowrap; font-size: 11px; }
            .description strong { display: block; margin-bottom: 8px; }
            .description p { margin: 4px 0; line-height: 1.7; }
            .summary { display: flex; justify-content: flex-end; }
            .summary table { width: 49%; margin-top: 0; table-layout: fixed; }
            .summary td { min-height: 0; padding: 7px; }
            .summary .label { width: 61.2245%; font-weight: 600; background: #f3f4f6; }
            .summary .total { width: 38.7755%; padding-left: 4px; padding-right: 4px; text-align: right; white-space: nowrap; overflow: hidden; font-size: 12px; }
            .summary .grand-total td { font-size: 14px; font-weight: 700; }
            .amount-words { margin-top: 10px; font-size: 13px; font-weight: 700; }
            .payment { margin-top: 13px; line-height: 1.8; }
            .payment-title { font-weight: 700; }
            .note { margin-top: 8px; line-height: 1.7; }
            .signatures { display: flex; justify-content: space-between; gap: 35mm; margin-top: 20mm; text-align: center; }
            .signature { flex: 1; padding-top: 12mm; border-top: 1px solid #6b7280; }
            .print-note { margin-top: 12px; color: #6b7280; font-size: 10px; }
            .receipt + .receipt { break-before: page; page-break-before: always; }
            @media print { .print-note { display: none; } }
          </style>
        </head>
        <body>
          <main class="receipt">
            <section class="top">
              <div class="brand">
                <div class="brand-mark">DeRIVE</div>
                <div class="brand-subtitle">Innovation Company Limited</div>
                <div class="issuer-name">บริษัท ดีไรฟ์ อินโนเวชั่น จำกัด</div>
                <div class="issuer-detail">653/37 ถ.จรัญสนิทวงศ์ แขวงอรุณอมรินทร์ เขตบางกอกน้อย กรุงเทพมหานคร 10700<br />Tax ID: 0105556107148 สำนักงานใหญ่</div>
              </div>
              <div class="title">ใบเสร็จรับเงิน / ใบกำกับภาษี<small>( Receipt / Tax Invoice)</small><span class="copy copy-label">(ต้นฉบับ)</span></div>
            </section>
            <div class="rule"></div>
            <section class="parties">
              <div class="party">
                <div><span class="party-label">Attention:</span></div>
                <div><span class="party-label">Company:</span><span class="party-value">${escapeHtml(invoice.name)}</span></div>
                <div><span class="party-label"></span>${escapeHtml(invoice.address)}</div>
                <div><span class="party-label"></span>เลขประจำตัวผู้เสียภาษี: ${escapeHtml(invoice.tax_id)} (สำนักงานใหญ่)</div>
              </div>
              <div class="meta">
                <div class="meta-row"><span class="meta-label">เล่มที่</span><span class="meta-value">001</span></div>
                <div class="meta-row"><span class="meta-label">เลขที่/ No. :</span><span class="meta-value">${escapeHtml(receiptNumber)}</span></div>
                <div class="meta-row"><span class="meta-label">อ้างอิง Invoice :</span><span class="meta-value">${escapeHtml(invoiceNumber)}</span></div>
                <div class="meta-row"><span class="meta-label">วันที่ Date :</span><span class="meta-value">${escapeHtml(printingDate)}</span></div>
              </div>
            </section>
            <table>
              <thead><tr><th class="item">ลำดับที่<small>ITEM</small></th><th class="description">รายการ<small>DESCRIPTION</small></th><th class="price">ราคา/หน่วย<small>Price/Unit</small></th><th class="quantity">จำนวน<small>Quantity</small></th><th class="total">จำนวนเงิน<small>Amount</small></th></tr></thead>
              <tbody><tr><td class="item">1</td><td class="description"><strong>${escapeHtml(invoice.description)}</strong><p>รอบการออกเอกสาร: ${escapeHtml(periodLabel)}</p><p>รายละเอียดบริการ: ${escapeHtml(invoice.service)}</p></td><td class="price">${amount}</td><td class="quantity">1</td><td class="total">${amount}</td></tr></tbody>
            </table>
            <section class="summary">
              <table>
                <tr><td class="label">รวมเงิน</td><td class="total">${amount}</td></tr>
                <tr><td class="label">ภาษีมูลค่าเพิ่ม 7%</td><td class="total">${vat}</td></tr>
                <tr class="grand-total"><td class="label">รวมทั้งสิ้น</td><td class="total">${grandTotal}</td></tr>
              </table>
            </section>
            <div class="amount-words">(${escapeHtml(bahtToThaiWords(totalAmount))})</div>
            <section class="payment">
              <div class="payment-title">ชำระเงินโดย</div>
              <div>(   ) เงินสด ( Cash)</div>
              <div>(   ) เช็ค (Cheque) ธนาคาร/Bank __________________ เลขที่/No. __________________ ลงวันที่/Date ______________</div>
              <div>(   ) โอนเข้าบัญชี ธนาคาร/Bank __________________ สาขา/Branch __________________ วันที่/Date ______________</div>
            </section>
            <div class="note"><strong>หมายเหตุ:</strong> ยอดเงินหน้าเช็ค หรือ รับเงินสด หลังหักภาษี ณ ที่จ่าย 3%<br />คงเหลือเงิน <strong>${netAmountText} บาท</strong></div>
            <section class="signatures"><div class="signature">ผู้รับเงิน / Collector By</div><div class="signature">ผู้อนุมัติ / Authorized Signature</div></section>
            <div class="print-note">วันที่ในใบเสร็จนี้คือวันที่พิมพ์เอกสาร</div>
          </main>
          <script>
            window.onload = function () {
              const original = document.querySelector('.receipt');
              if (original) {
                const copy = original.cloneNode(true);
                const copyLabel = copy.querySelector('.copy-label');
                if (copyLabel) copyLabel.textContent = '(สำเนา)';
                original.after(copy);
              }
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>`);
    printWindow.document.close();
  };

  const loadOvertimeRecords = async () => {
    if (!currentUser) return;
    setIsOvertimeLoading(true);
    try {
      const response = await fetch('/api/overtime');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load overtime records');
      setOvertimeRecords(result);
    } catch (error) {
      console.error('Failed to load overtime records:', error);
      setOvertimeError(error instanceof Error ? error.message : 'Unable to load overtime records');
      setOvertimeRecords([]);
    } finally {
      setIsOvertimeLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser) {
      setOvertimeRecords([]);
      return;
    }
    loadOvertimeRecords();
  }, [currentUser?.id, currentUser?.role]);

  // The quote is always returned by the backend. Any input change invalidates
  // the previous quote until the latest request succeeds.
  useEffect(() => {
    setOvertimeQuote(null);
    setOvertimeError('');
    const range = parseOvertimeRange(overtimeForm.start_at, overtimeForm.end_at);
    if (
      !currentUser ||
      !overtimeForm.employee_id ||
      !overtimeForm.start_at ||
      !overtimeForm.end_at ||
      !range ||
      range.endAt.getTime() <= range.startAt.getTime()
    ) {
      setOvertimeQuoteLoading(false);
      return;
    }

    let active = true;
    setOvertimeQuoteLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/overtime/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(overtimeForm),
        });
        const result = await response.json();
        if (!active) return;
        if (!response.ok) throw new Error(result.error || 'Unable to calculate overtime');
        setOvertimeQuote(result);
      } catch (error) {
        if (active) setOvertimeError(error instanceof Error ? error.message : 'Unable to calculate overtime');
      } finally {
        if (active) setOvertimeQuoteLoading(false);
      }
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [currentUser?.role, overtimeForm.employee_id, overtimeForm.start_at, overtimeForm.end_at]);

  const updateOvertimeForm = (changes) => {
    setOvertimeForm(current => ({ ...current, ...changes }));
    setOvertimeQuote(null);
    setOvertimeError('');
  };

  const handleCreateOvertime = async (event) => {
    event.preventDefault();
    if (isOvertimeSaving) return;
    if (!overtimeForm.employee_id || !overtimeForm.start_at || !overtimeForm.end_at) {
      setOvertimeError('กรุณากรอกพนักงาน วันเวลาเริ่มต้น และวันเวลาสิ้นสุด');
      return;
    }
    const range = parseOvertimeRange(overtimeForm.start_at, overtimeForm.end_at);
    if (!range) {
      setOvertimeError('กรุณาระบุวันเวลา OT เป็นเวลาไทยในรูปแบบที่ถูกต้อง');
      return;
    }
    if (range.endAt.getTime() <= range.startAt.getTime()) {
      setOvertimeError('วันเวลาสิ้นสุดต้องอยู่หลังวันเวลาเริ่มต้น');
      return;
    }

    setIsOvertimeSaving(true);
    setOvertimeError('');
    try {
      const response = await fetch('/api/overtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Financial values are intentionally not sent; the server recalculates them.
        body: JSON.stringify(overtimeForm),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save overtime record');

      await loadOvertimeRecords();
      setOvertimeForm(current => ({ ...current, start_at: '', end_at: '' }));
      setOvertimeQuote(null);
      alert('บันทึก OT แล้ว และส่งคำขอรออนุมัติเรียบร้อย');
    } catch (error) {
      setOvertimeError(error instanceof Error ? error.message : 'Unable to save overtime record');
    } finally {
      setIsOvertimeSaving(false);
    }
  };

  const handleUpdateOvertimeStatus = async (id, status) => {
    if (overtimeStatusSavingId) return;
    setOvertimeStatusSavingId(id);
    setOvertimeError('');
    try {
      const response = await fetch('/api/overtime', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      const updated = await response.json();
      if (!response.ok) throw new Error(updated.error || 'Unable to update overtime status');
      setOvertimeRecords(current => current.map(item => item.id === id ? updated : item));
    } catch (error) {
      setOvertimeError(error instanceof Error ? error.message : 'Unable to update overtime status');
    } finally {
      setOvertimeStatusSavingId(null);
    }
  };

  // Create Leave Request in Turso through the API.
  const handleCreateLeave = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: leaveForm.type,
          startDate: leaveForm.start_date,
          endDate: leaveForm.end_date,
          reason: leaveForm.reason,
        }),
      });
      const saved = await response.json();
      if (!response.ok) throw new Error(saved.error || 'ไม่สามารถบันทึกคำขอลาได้');

      setLeaves(current => [saved, ...current]);
      setShowLeaveModal(false);
      setLeaveForm({
        employee_id: currentUser.id,
        type: 'Sick Leave (ลาป่วย)',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
        reason: '',
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'ไม่สามารถบันทึกคำขอลาได้');
    }
  };

  const handleCreateWorkdayChange = async (event) => {
    event.preventDefault();
    const response = await fetch('/api/workday-changes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workdayForm),
    });
    const request = await response.json();
    if (!response.ok) {
      alert(request.error || 'ไม่สามารถสร้างคำขอได้');
      return;
    }

    setWorkdayChanges([request, ...workdayChanges]);
    setWorkdayForm({ from_date: getDateInputValue(new Date()), to_date: getDateAfter(2), job_detail: '', project: '' });
  };

  const handleUpdateWorkdayStatus = async (id, status) => {
    const response = await fetch('/api/workday-changes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    const updated = await response.json();
    if (!response.ok) {
      alert(updated.error || 'ไม่สามารถอัปเดตคำขอได้');
      return;
    }
    setWorkdayChanges(workdayChanges.map(item => item.id === id ? updated : item));
  };

  // Approval Handler
  const handleUpdateLeaveStatus = async (id, newStatus) => {
    try {
      const response = await fetch('/api/leaves', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      const updated = await response.json();
      if (!response.ok) throw new Error(updated.error || 'ไม่สามารถอัปเดตสถานะใบลาได้');
      setLeaves(current => current.map(item => item.id === id ? updated : item));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'ไม่สามารถอัปเดตสถานะใบลาได้');
    }
  };

  const loadTravelConfig = async (month) => {
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    setIsTravelConfigLoading(true);
    try {
      const response = await fetch(`/api/travel-config?month=${encodeURIComponent(targetMonth)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load travel config');

      const config = {
        month: result.month || targetMonth,
        fuel_price: String(result.fuel_price ?? ''),
        car_km_per_liter: String(result.car_km_per_liter ?? ''),
        motorcycle_km_per_liter: String(result.motorcycle_km_per_liter ?? ''),
        depreciation_per_km: String(result.depreciation_per_km ?? ''),
      };
      setTravelConfig(config);
      return config;
    } catch (error) {
      console.error('Failed to load travel config:', error);
      const emptyConfig = {
        month: targetMonth,
        fuel_price: '',
        car_km_per_liter: '',
        motorcycle_km_per_liter: '',
        depreciation_per_km: '',
      };
      setTravelConfig(emptyConfig);
      return emptyConfig;
    } finally {
      setIsTravelConfigLoading(false);
    }
  };

  const openTravelConfig = async (dateText = onsiteForm.date) => {
    const month = (dateText || new Date().toISOString().split('T')[0]).slice(0, 7);
    await loadTravelConfig(month);
    setShowTravelConfigModal(true);
  };

  useEffect(() => {
    if (!currentUser || !onsiteForm.date) return;
    loadTravelConfig(onsiteForm.date.slice(0, 7));
  }, [currentUser?.id, onsiteForm.date]);

  const calculateTravelExpense = (form, config) => {
    const outbound = Number(form.outbound_distance) || 0;
    const returnDistance = Number(form.return_distance) || 0;
    const totalDistance = outbound + returnDistance;
    const tollFee = Number(form.toll_fee) || 0;

    if (form.vehicle === 'TAXI') {
      return Math.round(((Number(form.taxi_fare) || 0) + tollFee) * 100) / 100;
    }

    const kmPerLiter = form.vehicle === 'MOTORCYCLE'
      ? Number(config.motorcycle_km_per_liter) || 0
      : Number(config.car_km_per_liter) || 0;
    const fuelPrice = Number(config.fuel_price) || 0;
    const depreciation = Number(config.depreciation_per_km) || 0;
    const fuelCost = kmPerLiter > 0 ? (totalDistance / kmPerLiter) * fuelPrice : 0;

    return Math.round((fuelCost + (totalDistance * depreciation) + tollFee) * 100) / 100;
  };

  const handleSaveTravelConfig = async (event) => {
    event.preventDefault();
    if (isTravelConfigSaving) return;

    setIsTravelConfigSaving(true);
    try {
      const response = await fetch('/api/travel-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(travelConfig),
      });
      const saved = await response.json();
      if (!response.ok) throw new Error(saved.error || 'Unable to save travel config');

      setTravelConfig({
        month: saved.month,
        fuel_price: String(saved.fuel_price),
        car_km_per_liter: String(saved.car_km_per_liter),
        motorcycle_km_per_liter: String(saved.motorcycle_km_per_liter),
        depreciation_per_km: String(saved.depreciation_per_km),
      });
      setShowTravelConfigModal(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'ไม่สามารถบันทึก Travel Config ได้');
    } finally {
      setIsTravelConfigSaving(false);
    }
  };

  // Create Onsite Travel and calculate reimbursement at save time.
  const handleCreateOnsite = async (e) => {
    e.preventDefault();
    if (isOnsiteSaving) return;

    const month = onsiteForm.date.slice(0, 7);
    const config = travelConfig.month === month
      ? travelConfig
      : await loadTravelConfig(month);
    const expense = calculateTravelExpense(onsiteForm, config);

    if (onsiteForm.vehicle !== 'TAXI') {
      const efficiency = onsiteForm.vehicle === 'MOTORCYCLE'
        ? Number(config.motorcycle_km_per_liter)
        : Number(config.car_km_per_liter);
      if (!Number(config.fuel_price) || !efficiency || Number(config.depreciation_per_km) < 0) {
        alert('ยังไม่มี Travel Config สำหรับเดือนนี้ กรุณาให้ Admin ตั้งค่าก่อนบันทึก');
        setTravelConfig(config);
        setShowTravelConfigModal(true);
        return;
      }
    }

    setIsOnsiteSaving(true);
    try {
      const response = await fetch('/api/onsite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...onsiteForm,
          expense,
        }),
      });
      const saved = await response.json();
      if (!response.ok) throw new Error(saved.error || 'Unable to save onsite record');

      setOnsite(current => [saved, ...current.filter(item => item.id !== saved.id)]);
      setShowOnsiteModal(false);
      setOnsiteForm({
        employee_id: currentUser.id,
        client_name: '',
        destination: '',
        date: new Date().toISOString().split('T')[0],
        purpose: '',
        vehicle: 'CAR',
        outbound_distance: '',
        return_distance: '',
        toll_fee: '',
        taxi_fare: '',
      });
    } catch (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setIsOnsiteSaving(false);
    }
  };


  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayAttendance = attendance.filter(a => a.date === today);
    const onLeaveCount = leaves.filter(l => l.status === 'Approved' && l.start_date <= today && l.end_date >= today).length;
    const onsiteCount = onsite.filter(o => o.date === today).length;
    const absentCount = todayAttendance.filter(a => a.status === 'Absent').length;

    return {
      totalEmployees: employees.length,
      presentToday: todayAttendance.filter(a => a.status === 'Present' || a.status === 'Late').length,
      onLeaveToday: onLeaveCount,
      onsiteToday: onsiteCount,
      absentToday: absentCount
    };
  }, [employees, attendance, leaves, onsite]);

  // Helper Employee Finder
  const getEmp = (empId) => employees.find(e => e.id === empId) || { name: empId, department: 'N/A' };

  if (isAuthLoading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">กำลังตรวจสอบการเข้าสู่ระบบ...</div>;
  }

  if (!currentUser) {
    return <LoginPage onLogin={setCurrentUser} />;
  }
                        return (
    <div className="app-shell min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col md:flex-row">
          {}
      <aside className="app-sidebar w-full md:w-64 bg-slate-900 text-slate-200 flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg text-white">
            <Building2 className="w-6 h-6" />
                </div>
                    <div>
            <h1 className="font-bold text-lg leading-tight" style={{ color: "#0f172a" }}>
                DeRIVE HR System
            </h1>
            <p className="text-xs text-slate-400" style={{ color: "#64748b" }}>ระบบบริหารบุคคล</p>
                    </div>
                    </div>

        <nav className="p-4 space-y-1.5 flex-1">
                    <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'hover:bg-slate-800 text-slate-300'}`}
                    >
            <Users className="w-5 h-5" />
            <span>ภาพรวม (Dashboard)</span>
                </button>
                <button
            onClick={() => setActiveTab('attendance')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${activeTab === 'attendance' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'hover:bg-slate-800 text-slate-300'}`}
                >
            <Clock className="w-5 h-5" />
            <span>บันทึกเวลา (Attendance)</span>
                </button>
                  <button
            onClick={() => setActiveTab('leaves')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${activeTab === 'leaves' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'hover:bg-slate-800 text-slate-300'}`}
                  >
            <Calendar className="w-5 h-5" />
            <span>แจ้งลา / ขาดงาน (Leaves)</span>
                    </button>
                  <button
            onClick={() => setActiveTab('onsite')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${activeTab === 'onsite' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'hover:bg-slate-800 text-slate-300'}`}
                      >
            <MapPin className="w-5 h-5" />
            <span>การเดินทาง Onsite</span>
                      </button>
                  <button
            onClick={() => setActiveTab('workday')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${activeTab === 'workday' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'hover:bg-slate-800 text-slate-300'}`}
                  >
            <Calendar className="w-5 h-5" />
            <span>ขอเปลี่ยนวันทำงาน</span>
                  </button>

                  <button
            onClick={() => setActiveTab('summary')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${activeTab === 'summary' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'hover:bg-slate-800 text-slate-300'}`}
                  >
            <FileText className="w-5 h-5" />
            <span>สรุปสถิติพนักงาน</span>
                  </button>

          <button
            onClick={() => setActiveTab('overtime')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${activeTab === 'overtime' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'hover:bg-slate-800 text-slate-300'}`}
          >
            <Timer className="w-5 h-5" />
            <span>บันทึก OT</span>
          </button>

          {isAdminRole(currentUser.role) && (
            <button
              onClick={() => setActiveTab('invoices')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${activeTab === 'invoices' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'hover:bg-slate-800 text-slate-300'}`}
            >
              <FileSpreadsheet className="w-5 h-5" />
              <span>ตาราง Invoice ลูกค้า</span>
            </button>
          )}

          {isAdminRole(currentUser.role) && (
            <button
              onClick={() => setActiveTab('project-invoices')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${activeTab === 'project-invoices' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'hover:bg-slate-800 text-slate-300'}`}
            >
              <FileText className="w-5 h-5" />
              <span>Invoice / Receipt โครงการ</span>
            </button>
          )}

          <div className="pt-4 border-t border-slate-800 my-2"></div>

          <button
            onClick={() => {
              setActiveTab('account');
              loadAccountEmployees();
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${activeTab === 'account' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'hover:bg-slate-800 text-slate-300'}`}
          >
            <Users className="w-5 h-5" />
            <span>แก้ไขบัญชี</span>
          </button>

        </nav>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-800 space-y-2 text-xs text-slate-400">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-emerald-400" /> DB Engine:</span>
            <span className="bg-slate-800 px-2 py-0.5 rounded text-emerald-400 font-mono">Turso / libSQL</span>
          </div>
        </div>
      </aside>
      {}
      <main className="app-main flex-1 flex flex-col overflow-y-auto">
        {/* Header Bar */}
        <header className="app-header bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 z-10">
                    <div>
            <h2 className="text-xl font-bold text-slate-800">
              {activeTab === 'dashboard' && 'ภาพรวมระบบ HR (HR Overview)'}
              {activeTab === 'attendance' && 'ระบบบันทึกเวลาการเข้า-ออกงาน (Attendance Tracker)'}
              {activeTab === 'leaves' && 'ระบบจัดการวันลาและขาดงาน (Leave Management)'}
              {activeTab === 'onsite' && 'ระบบบันทึกการปฏิบัติงาน Onsite (Onsite Travel Log)'}
              {activeTab === 'workday' && 'คำขอเปลี่ยนวันทำงาน (Working Day Change)'}
              {activeTab === 'summary' && 'สรุปสถิติการลา สาย และแลกวันทำงาน'}
              {activeTab === 'overtime' && 'บันทึกและคำนวณค่าล่วงเวลา (Overtime)'}
              {activeTab === 'invoices' && 'ตาราง Invoice ลูกค้าตามรอบวางบิล'}
              {activeTab === 'project-invoices' && 'Invoice / Receipt สำหรับโครงการ'}
              {activeTab === 'account' && 'จัดการบัญชีผู้ใช้ (Account Settings)'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">จัดการข้อมูล ขาด ลา การทำงานนอกสถานที่ ย้ายวันทำงาน</p>
              </div>

          <div className="flex items-center gap-3">
            <div className="hidden lg:block text-right mr-1">
              <p className="text-sm font-semibold text-slate-700">{currentUser.name}</p>
              <p className="text-[11px] text-slate-500">{currentUser.role === 'ADMIN' ? 'ผู้ดูแลระบบ' : 'พนักงาน'}</p>
              </div>
            <button
              onClick={handleLogout}
              className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
              title="ออกจากระบบ"
            >
              <LogOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveTab('attendance')}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2 rounded-lg text-sm font-medium shadow transition"
            >
              <Clock className="w-4 h-4 text-emerald-400" /> ลงเวลาทำงาน
            </button>
            <button
              onClick={() => setShowLeaveModal(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-lg text-sm font-medium shadow transition"
            >
              <Plus className="w-4 h-4" /> แจ้งการลา
            </button>
    </div>
        </header>

        {/* Dynamic Main Body */}
        <div className="app-content p-6 space-y-6 flex-1">
          {}
          {activeTab === 'account' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4">Account Settings</h2>
              {currentUser.role === 'ADMIN' && accountEmployees.length > 1 && (
                <select value={accountForm.id} onChange={event => { const employee = accountEmployees.find(item => item.id === event.target.value); setAccountForm({ id: employee.id, email: employee.email || '', password: '' }); }} className="w-full p-2.5 mb-3 border border-slate-300 rounded-lg">
                  <option value="">Select employee</option>
                  {accountEmployees.map(employee => <option key={employee.id} value={employee.id}>{employee.name} ({employee.email})</option>)}
                </select>
              )}
              <form onSubmit={handleAccountSave} className="max-w-lg space-y-3">
                <input type="email" required value={accountForm.email || ''} onChange={event => setAccountForm({ ...accountForm, email: event.target.value })} placeholder="Email" className="w-full p-2.5 border border-slate-300 rounded-lg" />
                <input type="password" required value={accountForm.password || ''} onChange={event => setAccountForm({ ...accountForm, password: event.target.value })} placeholder="New password" className="w-full p-2.5 border border-slate-300 rounded-lg" />
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg">Save account</button>
              </form>
    </div>
          )}

          {activeTab === 'dashboard' && (
            <>
              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">พนักงานทั้งหมด</span>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-3xl font-bold text-slate-800">{stats.totalEmployees}</span>
                    <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-full font-medium"> คน</span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between border-l-4 border-l-emerald-500">
                  <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">เข้างานวันนี้</span>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-3xl font-bold text-emerald-700">{stats.presentToday}</span>
                    <span className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full font-medium"> มาทำงาน</span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between border-l-4 border-l-amber-500">
                  <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">ลาหยุดวันนี้</span>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-3xl font-bold text-amber-700">{stats.onLeaveToday}</span>
                    <span className="text-xs px-2 py-1 bg-amber-50 text-amber-700 rounded-full font-medium"> ลา</span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between border-l-4 border-l-blue-500">
                  <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">ไป Onsite วันนี้</span>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-3xl font-bold text-blue-700">{stats.onsiteToday}</span>
                    <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full font-medium"> นอกสถานที่</span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between border-l-4 border-l-rose-500">
                  <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider">ขาดงานวันนี้</span>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-3xl font-bold text-rose-700">{stats.absentToday}</span>
                    <span className="text-xs px-2 py-1 bg-rose-50 text-rose-700 rounded-full font-medium"> ขาด</span>
                  </div>
                </div>
              </div>

              {/* Quick Summary Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pending Leave Requests */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-amber-500" />
                      คำขอรออนุมัติลา (Pending Requests)
                    </h3>
                    <button onClick={() => setActiveTab('leaves')} className="text-xs text-indigo-600 hover:underline font-medium">ดูทั้งหมด</button>
                  </div>
                  <div className="space-y-3">
                    {leaves.filter(l => l.status === 'Pending').length === 0 ? (
                      <p className="text-sm text-slate-400 py-4 text-center">ไม่มีคำขอลาที่รอการอนุมัติ</p>
                    ) : (
                      leaves.filter(l => l.status === 'Pending').map(item => {
                        const emp = getEmp(item.employee_id);
                        return (
                          <div key={item.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-slate-800 text-sm">{emp.name} <span className="text-xs text-slate-500 font-normal">({emp.department})</span></p>
                              <p className="text-xs text-slate-600 mt-1">{item.type} • {item.start_date} ถึง {item.end_date} ({item.days} วัน)</p>
                              <p className="text-xs text-slate-400 italic mt-0.5">"{item.reason}"</p>
                            </div>
                            {currentUser.role === 'ADMIN' && (
                              <div className="flex gap-1.5 shrink-0">
                                <button onClick={() => handleUpdateLeaveStatus(item.id, 'Approved')} className="p-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded transition" title="อนุมัติ">
                                  <Check className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleUpdateLeaveStatus(item.id, 'Rejected')} className="p-1.5 bg-rose-100 text-rose-700 hover:bg-rose-200 rounded transition" title="ไม่อนุมัติ">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
  );
                      })
                    )}
                  </div>
                </div>

                {/* Today's Onsite Movements */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-blue-500" />
                      ปฏิบัติงานนอกสถานที่วันนี้ (Onsite Visits)
                    </h3>
                    <button onClick={() => setShowOnsiteModal(true)} className="text-xs text-indigo-600 hover:underline font-medium">+ เพิ่ม Onsite</button>
                  </div>
                  <div className="space-y-3">
                    {onsite.length === 0 ? (
                      <p className="text-sm text-slate-400 py-4 text-center">ไม่มีบันทึกการลงพื้นที่ Onsite</p>
                    ) : (
                      onsite.slice(0, 4).map(item => {
                        const emp = getEmp(item.employee_id);
                        return (
                          <div key={item.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-800 text-sm">{emp.name}</span>
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{item.vehicle}</span>
                              </div>
                              <p className="text-xs text-slate-600">ลูกค้า: <strong className="text-slate-800">{item.client_name}</strong> ({item.destination})</p>
                              <p className="text-xs text-slate-500">จุดประสงค์: {item.purpose}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-xs font-bold text-emerald-600">฿{item.expense.toLocaleString()}</span>
                              <p className="text-[10px] text-slate-400 mt-1">{item.status}</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {}
          {activeTab === 'attendance' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ค้นหาชื่อพนักงาน หรือรหัส..."
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex flex-col lg:flex-row lg:items-end gap-3">
                  {nextClockType === 'in' && !hasCompletedToday && (
                    <>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">Project</label>
                        <input
                          value={clockForm.project}
                          onChange={event => setClockForm(current => ({ ...current, project: event.target.value }))}
                          placeholder="Project name"
                          className="w-40 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">Job Detail</label>
                        <input
                          value={clockForm.job_detail}
                          onChange={event => setClockForm(current => ({ ...current, job_detail: event.target.value }))}
                          placeholder="Job detail"
                          className="w-44 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                        />
                      </div>
                    </>
                  )}

                  <div className="flex items-center gap-3">
                    <div className="text-right min-w-[92px]">
                      <p className="text-[11px] text-slate-500">สถานะวันนี้</p>
                      <p className={`text-sm font-semibold ${
                        hasCompletedToday
                          ? 'text-slate-600'
                          : nextClockType === 'out'
                            ? 'text-emerald-600'
                            : 'text-slate-700'
                      }`}>
                        {hasCompletedToday ? 'ลงเวลาครบแล้ว' : nextClockType === 'out' ? 'กำลังทำงาน' : 'ยังไม่เข้างาน'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleClockToggle}
                      disabled={isClockSaving || hasCompletedToday}
                      className={`relative inline-flex h-11 w-48 items-center rounded-full transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60 ${
                        hasCompletedToday
                          ? 'bg-slate-300'
                          : nextClockType === 'in'
                            ? 'bg-emerald-600'
                            : 'bg-rose-600'
                      }`}
                      title={hasCompletedToday ? 'วันนี้ลงเวลาเข้าและออกแล้ว' : nextClockType === 'in' ? 'กดเพื่อเข้างาน' : 'กดเพื่อออกงาน'}
                    >
                      <span
                        className={`absolute top-1 h-9 w-[92px] rounded-full bg-white shadow transition-all duration-300 ${
                          nextClockType === 'in' ? 'left-1' : 'left-[92px]'
                        }`}
                      />
                      <span className={`relative z-10 flex-1 text-center text-sm font-semibold ${nextClockType === 'in' ? 'text-emerald-700' : 'text-white'}`}>
                        {isClockSaving && nextClockType === 'in' ? 'บันทึก...' : 'เข้า'}
                      </span>
                      <span className={`relative z-10 flex-1 text-center text-sm font-semibold ${nextClockType === 'out' ? 'text-rose-700' : 'text-white'}`}>
                        {isClockSaving && nextClockType === 'out' ? 'บันทึก...' : 'ออก'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">วันที่</th>
                      <th className="p-3.5">รหัส/ชื่อพนักงาน</th>
                      <th className="p-3.5">แผนก</th>
                      <th className="p-3.5">เวลาเข้า</th>
                      <th className="p-3.5">เวลาออก</th>
                      <th className="p-3.5">สถานะ</th>
                      <th className="p-3.5">หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {attendance
                      .filter(a => {
                        const emp = getEmp(a.employee_id);
                        return emp.name.toLowerCase().includes(filterText.toLowerCase()) || a.employee_id.toLowerCase().includes(filterText.toLowerCase());
                      })
                      .map(row => {
                        const emp = getEmp(row.employee_id);
                        return (
                          <tr key={row.id} className="hover:bg-slate-50">
                            <td className="p-3.5 font-mono text-xs">{row.date}</td>
                            <td className="p-3.5 font-medium text-slate-800">
                              {emp.name} <span className="text-xs font-mono text-slate-400">({row.employee_id})</span>
                            </td>
                            <td className="p-3.5 text-xs text-slate-500">{emp.department}</td>
                            <td className="p-3.5 font-mono text-xs text-emerald-600 font-semibold">{row.clock_in}</td>
                            <td className="p-3.5 font-mono text-xs text-slate-500">{row.clock_out}</td>
                            <td className="p-3.5">
                              {row.status === 'Present' && <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-full font-medium">มาตรงเวลา</span>}
                              {row.status === 'Late' && <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-full font-medium">สาย</span>}
                              {row.status === 'Onsite' && <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-1 rounded-full font-medium">Onsite</span>}
                              {row.status === 'Leave' && <span className="bg-purple-100 text-purple-800 text-xs px-2.5 py-1 rounded-full font-medium">ลา</span>}
                              {row.status === 'Absent' && <span className="bg-rose-100 text-rose-800 text-xs px-2.5 py-1 rounded-full font-medium">ขาดงาน</span>}
                            </td>
                            <td className="p-3.5 text-xs text-slate-500">{row.note || '-'}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {}
          {activeTab === 'leaves' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ค้นหาประวัติการลา..."
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  onClick={() => setShowLeaveModal(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition"
                >
                  <Plus className="w-4 h-4" /> ยื่นใบลาใหม่
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">พนักงาน</th>
                      <th className="p-3.5">ประเภทการลา</th>
                      <th className="p-3.5">ช่วงวันที่</th>
                      <th className="p-3.5">จำนวนวัน</th>
                      <th className="p-3.5">เหตุผล</th>
                      <th className="p-3.5">สถานะ</th>
                      <th className="p-3.5 text-right">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {leaves
                      .filter(l => {
                        const emp = getEmp(l.employee_id);
                        return emp.name.toLowerCase().includes(filterText.toLowerCase()) || l.type.toLowerCase().includes(filterText.toLowerCase());
                      })
                      .map(item => {
                        const emp = getEmp(item.employee_id);
                        return (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="p-3.5 font-medium text-slate-800">
                              {emp.name}
                              <p className="text-xs font-normal text-slate-400">{emp.department}</p>
                            </td>
                            <td className="p-3.5 font-medium text-slate-700">{item.type}</td>
                            <td className="p-3.5 text-xs font-mono text-slate-600">{item.start_date} ~ {item.end_date}</td>
                            <td className="p-3.5 text-xs font-semibold text-slate-700">{item.days} วัน</td>
                            <td className="p-3.5 text-xs text-slate-500 max-w-xs truncate">{item.reason}</td>
                            <td className="p-3.5">
                              {item.status === 'Approved' && <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-full font-medium">อนุมัติแล้ว</span>}
                              {item.status === 'Pending' && <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-full font-medium">รออนุมัติ</span>}
                              {item.status === 'Rejected' && <span className="bg-rose-100 text-rose-800 text-xs px-2.5 py-1 rounded-full font-medium">ปฏิเสธ</span>}
                            </td>
                            <td className="p-3.5 text-right">
                              {currentUser.role === 'ADMIN' && item.status === 'Pending' && (
                                <div className="flex justify-end gap-1">
                                  <button onClick={() => handleUpdateLeaveStatus(item.id, 'Approved')} className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded transition">อนุมัติ</button>
                                  <button onClick={() => handleUpdateLeaveStatus(item.id, 'Rejected')} className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs rounded transition">ปฏิเสธ</button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {}
          {activeTab === 'onsite' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ค้นหาข้อมูลสถานที่ หรือบริษัทลูกค้า..."
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      openTravelConfig(onsiteForm.date);
                    }}
                    className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-sm font-medium px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition"
                  >
                    <DollarSign className="w-4 h-4" /> ตั้งค่าค่าเดินทาง
                  </button>
                  <button
                    onClick={() => setShowOnsiteModal(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition"
                  >
                    <Plus className="w-4 h-4" /> บันทึกการเดินทาง
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">วันที่</th>
                      <th className="p-3.5">พนักงานผู้เดินทาง</th>
                      <th className="p-3.5">ชื่อลูกค้า/บริษัท</th>
                      <th className="p-3.5">สถานที่ปลายทาง</th>
                      <th className="p-3.5">พาหนะ</th>
                      <th className="p-3.5 text-right">ระยะทางรวม</th>
                      <th className="p-3.5 text-right">ค่าทางด่วน</th>
                      <th className="p-3.5 text-right">ค่าเดินทาง</th>
                      <th className="p-3.5">สถานะงาน</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {onsite
                      .filter(o => {
                        const emp = getEmp(o.employee_id);
                        return emp.name.toLowerCase().includes(filterText.toLowerCase()) || o.client_name.toLowerCase().includes(filterText.toLowerCase());
                      })
                      .map(item => {
                        const emp = getEmp(item.employee_id);
                        return (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="p-3.5 font-mono text-xs">{item.date}</td>
                            <td className="p-3.5 font-medium text-slate-800">{emp.name}</td>
                            <td className="p-3.5 font-medium text-slate-800">{item.client_name}</td>
                            <td className="p-3.5 text-xs text-slate-600">{item.destination}</td>
                            <td className="p-3.5 text-xs text-slate-600">
                              <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-medium">
                                {item.vehicle === 'CAR' ? 'รถยนต์' : item.vehicle === 'MOTORCYCLE' ? 'รถมอเตอร์ไซค์' : 'รถแท็กซี่'}
                              </span>
                            </td>
                            <td className="p-3.5 text-right font-mono text-xs">{((Number(item.outbound_distance) || 0) + (Number(item.return_distance) || 0)).toLocaleString()} กม.</td>
                            <td className="p-3.5 text-right font-mono text-xs">฿{(Number(item.toll_fee) || 0).toLocaleString()}</td>
                            <td className="p-3.5 text-right font-mono font-semibold text-emerald-600">฿{(Number(item.expense) || 0).toLocaleString()}</td>
                            <td className="p-3.5">
                              {item.status === 'Completed' ? (
                                <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-full font-medium">เสร็จสิ้น</span>
                              ) : (
                                <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-1 rounded-full font-medium">กำลังดำเนินการ</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {}
          {activeTab === 'workday' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-1 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <div className="mb-5">
                  <h3 className="font-bold text-slate-800">สร้างคำขอเปลี่ยนวันทำงาน</h3>
                  <p className="text-xs text-slate-500 mt-1">คำขอจะมีสถานะรออนุมัติจนกว่า Admin จะตรวจสอบ</p>
                </div>
                <form onSubmit={handleCreateWorkdayChange} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">วันที่ทำงานเดิม</label>
                      <input type="date" required value={workdayForm.from_date} onChange={event => setWorkdayForm({ ...workdayForm, from_date: event.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">วันที่ทำงานชดเชย</label>
                      <input type="date" required value={workdayForm.to_date} onChange={event => setWorkdayForm({ ...workdayForm, to_date: event.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">โครงการ / Project</label>
                    <input required value={workdayForm.project} onChange={event => setWorkdayForm({ ...workdayForm, project: event.target.value })} placeholder="เช่น DeRIVE HR" className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">รายละเอียดงาน</label>
                    <textarea required rows={4} value={workdayForm.job_detail} onChange={event => setWorkdayForm({ ...workdayForm, job_detail: event.target.value })} placeholder="อธิบายงานที่ต้องดำเนินการในวันดังกล่าว..." className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm" />
                  </div>
                  <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition">ส่งคำขออนุมัติ</button>
                </form>
              </div>

              <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-200">
                  <h3 className="font-bold text-slate-800">รายการคำขอเปลี่ยนวันทำงาน</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-100 text-slate-700 font-semibold">
                      <tr><th className="p-3.5">พนักงาน</th><th className="p-3.5">เปลี่ยนวัน</th><th className="p-3.5">Project / รายละเอียดงาน</th><th className="p-3.5">สถานะ</th><th className="p-3.5 text-right">จัดการ</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {workdayChanges.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-slate-400">ยังไม่มีคำขอเปลี่ยนวันทำงาน</td></tr> : workdayChanges.map(item => {
                        const employee = getEmp(item.employee_id);
                        return <tr key={item.id} className="hover:bg-slate-50">
                          <td className="p-3.5 font-medium text-slate-800">{employee.name}<p className="text-xs font-normal text-slate-400">{item.created_at}</p></td>
                          <td className="p-3.5 font-medium">{item.from_date} <span className="text-indigo-500">→</span> {item.to_date}</td>
                          <td className="p-3.5"><p className="font-medium text-slate-800">{item.project}</p><p className="text-xs text-slate-500 max-w-xs">{item.job_detail}</p></td>
                          <td className="p-3.5">{item.status === 'APPROVED' ? <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-full">อนุมัติแล้ว</span> : item.status === 'REJECTED' ? <span className="bg-rose-100 text-rose-800 text-xs px-2.5 py-1 rounded-full">ไม่อนุมัติ</span> : <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-full">รอ Admin อนุมัติ</span>}</td>
                          <td className="p-3.5 text-right">{currentUser.role === 'ADMIN' && item.status === 'WAITING_FOR_APPROVAL' && <div className="flex justify-end gap-1"><button onClick={() => handleUpdateWorkdayStatus(item.id, 'APPROVED')} className="px-2 py-1 bg-emerald-600 text-white text-xs rounded">อนุมัติ</button><button onClick={() => handleUpdateWorkdayStatus(item.id, 'REJECTED')} className="px-2 py-1 bg-rose-600 text-white text-xs rounded">ปฏิเสธ</button></div>}</td>
                        </tr>;
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'summary' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h3 className="font-bold text-slate-800">สรุปข้อมูลรายเดือนของพนักงาน</h3>
                  <p className="text-xs text-slate-500 mt-1">ตรวจสอบวันลา มาสาย แลกวันทำงาน และ OT ที่อนุมัติแล้ว</p>
                </div>
                <div className="flex gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">เดือน</label>
                    <select value={summaryMonth} onChange={event => setSummaryMonth(Number(event.target.value))} className="p-2.5 bg-white border border-slate-300 rounded-lg text-sm">
                      {['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'].map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">ปี</label>
                    <select value={summaryYear} onChange={event => setSummaryYear(Number(event.target.value))} className="p-2.5 bg-white border border-slate-300 rounded-lg text-sm">
                      {[summaryYear - 2, summaryYear - 1, summaryYear, summaryYear + 1, summaryYear + 2].map(year => <option key={year} value={year}>{year}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr><th className="p-3.5">พนักงาน</th><th className="p-3.5">แผนก</th><th className="p-3.5 text-center">วันลา</th><th className="p-3.5 text-center">มาสาย (ครั้ง)</th><th className="p-3.5 text-center">แลกวันทำงาน (คำขอ)</th><th className="p-3.5 text-right">ค่าเดินทาง (บาท)</th><th className="p-3.5 text-right">OT (ชั่วโมง)</th><th className="p-3.5 text-right">ค่าล่วงเวลา (บาท)</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {summaryRows.length === 0 ? <tr><td colSpan={8} className="p-8 text-center text-slate-400">ไม่พบข้อมูลพนักงาน</td></tr> : summaryRows.map(employee => (
                      <tr key={employee.id} className="hover:bg-slate-50">
                        <td className="p-3.5 font-medium text-slate-800">{employee.name}<span className="block text-xs font-normal text-slate-400">{employee.email}</span></td>
                        <td className="p-3.5 text-slate-500">{employee.department}</td>
                        <td className="p-3.5 text-center"><span className="inline-flex min-w-8 justify-center px-2 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold">{employee.leaveDays}</span></td>
                        <td className="p-3.5 text-center"><span className="inline-flex min-w-8 justify-center px-2 py-1 rounded-full bg-rose-50 text-rose-700 font-semibold">{employee.lateCount}</span></td>
                        <td className="p-3.5 text-center"><span className="inline-flex min-w-8 justify-center px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 font-semibold">{employee.workdayChangeCount}</span></td>
                        <td className="p-3.5 text-right font-semibold text-emerald-700">฿{employee.travelExpenses.toLocaleString()}</td>
                        <td className="p-3.5 text-right font-semibold text-indigo-700">{Number(employee.overtimeHours || 0).toFixed(2)}</td>
                        <td className="p-3.5 text-right font-semibold text-violet-700">{formatBaht(employee.overtimePay || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'invoices' && isAdminRole(currentUser.role) && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h3 className="font-bold text-slate-800">Invoice Schedule</h3>
                  <p className="text-xs text-slate-500 mt-1">รายการ Invoice ของลูกค้าที่มีกำหนดออกในเดือนที่เลือก</p>
                </div>
                <div className="flex gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">เดือน</label>
                    <select value={invoiceMonth} onChange={event => setInvoiceMonth(Number(event.target.value))} className="p-2.5 bg-white border border-slate-300 rounded-lg text-sm">
                      {['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'].map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">ปี</label>
                    <select value={invoiceYear} onChange={event => setInvoiceYear(Number(event.target.value))} className="p-2.5 bg-white border border-slate-300 rounded-lg text-sm">
                      {[invoiceYear - 2, invoiceYear - 1, invoiceYear, invoiceYear + 1, invoiceYear + 2].map(year => <option key={year} value={year}>{year}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {invoiceError && <p className="m-5 text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{invoiceError}</p>}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">Client</th>
                      <th className="p-3.5">Product</th>
                      <th className="p-3.5">Service</th>
                      <th className="p-3.5 min-w-64">Description</th>
                      <th className="p-3.5">Period</th>
                      <th className="p-3.5">Date of issue</th>
                      <th className="p-3.5 text-right">Amount</th>
                      <th className="p-3.5 min-w-64">Customer</th>
                      <th className="p-3.5">Tax ID</th>
                      <th className="p-3.5 min-w-72">Address</th>
                      <th className="p-3.5 text-center">พิมพ์เอกสาร</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {isInvoiceLoading ? (
                      <tr><td colSpan={11} className="p-8 text-center text-slate-400">กำลังโหลดตาราง Invoice...</td></tr>
                    ) : invoiceSchedules.length === 0 ? (
                      <tr><td colSpan={11} className="p-8 text-center text-slate-400">ไม่พบ Invoice ในเดือนที่เลือก</td></tr>
                    ) : invoiceSchedules.map((invoice, invoiceIndex) => (
                      <tr key={invoice.id} className="hover:bg-slate-50 align-top">
                        <td className="p-3.5 font-semibold text-slate-800">{invoice.client}</td>
                        <td className="p-3.5 font-medium text-indigo-700">{invoice.product}</td>
                        <td className="p-3.5">{invoice.service}</td>
                        <td className="p-3.5 min-w-64">{invoice.description}</td>
                        <td className="p-3.5 whitespace-nowrap">{invoice.period === 'year' ? 'รายปี' : invoice.period === 'quarter' ? 'รายไตรมาส' : 'รายเดือน'}</td>
                        <td className="p-3.5 whitespace-nowrap">{invoice.issue_date}</td>
                        <td className="p-3.5 text-right font-semibold text-emerald-700 whitespace-nowrap">{formatBaht(invoice.amount)}</td>
                        <td className="p-3.5 min-w-64 font-medium text-slate-800">{invoice.name}</td>
                        <td className="p-3.5 whitespace-nowrap">{invoice.tax_id}</td>
                        <td className="p-3.5 min-w-72">{invoice.address}</td>
                        <td className="p-3.5 text-center"><div className="flex flex-col items-center gap-1.5"><button onClick={() => openDocumentPrint({ invoice, invoiceIndex, project: false, documentType: 'INVOICE' })} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium" title="พิมพ์ Invoice"><Printer className="w-3.5 h-3.5" />Invoice</button><button onClick={() => openDocumentPrint({ invoice, invoiceIndex, project: false, documentType: 'RECEIPT' })} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium" title="พิมพ์ใบเสร็จรับเงิน"><FileText className="w-3.5 h-3.5" />ใบเสร็จ</button></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'project-invoices' && isAdminRole(currentUser.role) && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <div className="mb-5">
                    <h3 className="font-bold text-slate-800">เพิ่มข้อมูลโครงการ</h3>
                    <p className="text-xs text-slate-500 mt-1">เก็บข้อมูลลูกค้าไว้เลือกใช้กับ Invoice / Receipt</p>
                  </div>
                  <form onSubmit={handleCreateProject} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">ชื่อโครงการ</label>
                      <input required value={projectForm.name} onChange={event => setProjectForm({ ...projectForm, name: event.target.value })} placeholder="เช่น โครงการพัฒนาระบบ HR" className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">งบประมาณโครงการ (บาท)</label>
                      <input type="number" min="0" step="0.01" required value={projectForm.budget} onChange={event => setProjectForm({ ...projectForm, budget: event.target.value })} placeholder="0.00" className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">ชื่อลูกค้า</label>
                      <input required value={projectForm.client_name} onChange={event => setProjectForm({ ...projectForm, client_name: event.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">ที่อยู่</label>
                      <textarea required rows={3} value={projectForm.address} onChange={event => setProjectForm({ ...projectForm, address: event.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">เลขประจำตัวผู้เสียภาษี</label>
                      <input required value={projectForm.tax_id} onChange={event => setProjectForm({ ...projectForm, tax_id: event.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm" />
                    </div>
                    <button type="submit" disabled={isProjectSaving} className="w-full bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition">{isProjectSaving ? 'กำลังบันทึก...' : 'บันทึกโครงการ'}</button>
                  </form>
                </section>

                <section className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <div className="mb-5">
                    <h3 className="font-bold text-slate-800">สร้าง Invoice โครงการ</h3>
                    <p className="text-xs text-slate-500 mt-1">เลือกโครงการ แล้วระบุงวดงาน วันที่ รายละเอียด และจำนวนเงิน</p>
                  </div>
                  <form onSubmit={handleCreateProjectInvoice} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">โครงการ</label>
                        <select required value={projectInvoiceForm.project_id} onChange={event => setProjectInvoiceForm({ ...projectInvoiceForm, project_id: event.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm">
                          <option value="">เลือกโครงการ</option>
                          {projects.map(project => <option key={project.id} value={project.id}>{project.name} — {project.client_name} — ฿{formatInvoiceAmount(project.budget)}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">งวดงาน</label>
                        <input required value={projectInvoiceForm.installment} onChange={event => setProjectInvoiceForm({ ...projectInvoiceForm, installment: event.target.value })} placeholder="เช่น งวดที่ 1 / 30%" className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">วันที่</label>
                        <input type="date" required value={projectInvoiceForm.invoice_date} onChange={event => setProjectInvoiceForm({ ...projectInvoiceForm, invoice_date: event.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">จำนวนเงินก่อน VAT (บาท)</label>
                        <input type="number" min="0" step="0.01" required value={projectInvoiceForm.amount} onChange={event => setProjectInvoiceForm({ ...projectInvoiceForm, amount: event.target.value })} placeholder="0.00" className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">คำอธิบายรายการเรียกเก็บเงิน</label>
                      <textarea required rows={3} value={projectInvoiceForm.billing_description} onChange={event => setProjectInvoiceForm({ ...projectInvoiceForm, billing_description: event.target.value })} placeholder="รายละเอียดงานหรือรายการที่เรียกเก็บเงิน" className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm" />
                    </div>
                    <button type="submit" disabled={isProjectSaving || projects.length === 0} className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium px-5 py-2.5 rounded-lg transition">{isProjectSaving ? 'กำลังบันทึก...' : 'บันทึก Invoice โครงการ'}</button>
                    {projects.length === 0 && <p className="text-xs text-amber-600 mt-2">กรุณาเพิ่มข้อมูลโครงการก่อนสร้าง Invoice</p>}
                  </form>
                </section>
              </div>

              {projectInvoiceError && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{projectInvoiceError}</p>}

              <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-slate-800">รายการ Invoice / Receipt โครงการ</h3>
                    <p className="text-xs text-slate-500 mt-1">แสดงรายการตามเดือนและปีของวันที่ Invoice</p>
                  </div>
                  <div className="flex gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">เดือน</label>
                      <select value={invoiceMonth} onChange={event => setInvoiceMonth(Number(event.target.value))} className="p-2.5 bg-white border border-slate-300 rounded-lg text-sm">
                        {thaiMonths.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">ปี</label>
                      <select value={invoiceYear} onChange={event => setInvoiceYear(Number(event.target.value))} className="p-2.5 bg-white border border-slate-300 rounded-lg text-sm">
                        {[invoiceYear - 2, invoiceYear - 1, invoiceYear, invoiceYear + 1, invoiceYear + 2].map(year => <option key={year} value={year}>{year}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-3.5">วันที่</th>
                        <th className="p-3.5">โครงการ / ลูกค้า</th>
                        <th className="p-3.5">งวดงาน</th>
                        <th className="p-3.5 min-w-72">คำอธิบายรายการเรียกเก็บเงิน</th>
                        <th className="p-3.5 text-right">จำนวนเงิน</th>
                        <th className="p-3.5">เลขที่ Invoice</th>
                        <th className="p-3.5 text-center">พิมพ์เอกสาร</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {isProjectInvoiceLoading ? (
                        <tr><td colSpan={7} className="p-8 text-center text-slate-400">กำลังโหลดรายการ Invoice โครงการ...</td></tr>
                      ) : projectInvoices.length === 0 ? (
                        <tr><td colSpan={7} className="p-8 text-center text-slate-400">ไม่พบรายการในเดือนที่เลือก</td></tr>
                      ) : projectInvoices.map((invoice, invoiceIndex) => {
                        const printableInvoice = toPrintableProjectInvoice(invoice);
                        return (
                          <tr key={invoice.id} className="hover:bg-slate-50 align-top">
                            <td className="p-3.5 whitespace-nowrap font-mono text-xs">{invoice.invoice_date}</td>
                            <td className="p-3.5 min-w-64"><div className="font-semibold text-slate-800">{invoice.project_name}</div><div className="text-xs text-slate-500 mt-1">{invoice.client_name}</div></td>
                            <td className="p-3.5 whitespace-nowrap">{invoice.installment}</td>
                            <td className="p-3.5 min-w-72">{invoice.billing_description}</td>
                            <td className="p-3.5 text-right font-semibold text-emerald-700 whitespace-nowrap">{formatBaht(invoice.amount)}</td>
                            <td className="p-3.5 whitespace-nowrap font-mono text-xs">{invoice.invoice_number}</td>
                            <td className="p-3.5 text-center"><div className="flex flex-col items-center gap-1.5"><button onClick={() => openDocumentPrint({ invoice: printableInvoice, invoiceIndex, project: true, documentType: 'INVOICE' })} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium" title="พิมพ์ Invoice"><Printer className="w-3.5 h-3.5" />Invoice</button><button onClick={() => openDocumentPrint({ invoice: printableInvoice, invoiceIndex, project: true, documentType: 'RECEIPT' })} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium" title="พิมพ์ใบเสร็จรับเงิน"><FileText className="w-3.5 h-3.5" />ใบเสร็จ</button></div></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'overtime' && currentUser.role?.toUpperCase() === 'ADMIN' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <section className="xl:col-span-1 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <div className="mb-5">
                    <h3 className="font-bold text-slate-800">บันทึกเวลาทำ OT</h3>
                    <p className="text-xs text-slate-500 mt-1">ระบบคำนวณตามเงินเดือนปัจจุบันของพนักงาน และเก็บค่าอัตราไว้เป็นประวัติ</p>
                  </div>
                  <form onSubmit={handleCreateOvertime} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">พนักงาน</label>
                      {currentUser.role?.toUpperCase() === 'ADMIN' ? (
                        <select
                          required
                          value={overtimeForm.employee_id}
                          onChange={event => updateOvertimeForm({ employee_id: event.target.value })}
                          className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                        >
                          <option value="">เลือกพนักงาน</option>
                          {employees.map(employee => (
                            <option key={employee.id} value={employee.id}>{employee.name}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-700">
                          {currentUser.name}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">เริ่ม OT (เวลาไทย)</label>
                      <input
                        type="datetime-local"
                        required
                        step="60"
                        value={overtimeForm.start_at}
                        onChange={event => updateOvertimeForm({ start_at: event.target.value })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">สิ้นสุด OT (เวลาไทย)</label>
                      <input
                        type="datetime-local"
                        required
                        step="60"
                        value={overtimeForm.end_at}
                        onChange={event => updateOvertimeForm({ end_at: event.target.value })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>

                    <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-4 space-y-2">
                      <div className="flex justify-between gap-3 text-sm"><span className="text-slate-600">เงินเดือน</span><strong>{overtimeQuote ? formatBaht(overtimeQuote.monthly_salary) : '-'}</strong></div>
                      <div className="flex justify-between gap-3 text-sm"><span className="text-slate-600">อัตรา OT / ชั่วโมง</span><strong>{overtimeQuote ? formatBaht(overtimeQuote.hourly_rate) : '-'}</strong></div>
                      <div className="flex justify-between gap-3 text-sm"><span className="text-slate-600">จำนวนชั่วโมง</span><strong>{overtimeQuote ? Number(overtimeQuote.ot_hours).toFixed(2) : '-'}</strong></div>
                      <div className="flex justify-between gap-3 text-sm border-t border-indigo-100 pt-2"><span className="font-semibold text-slate-700">ยอด OT</span><strong className="text-indigo-700">{overtimeQuote ? formatBaht(overtimeQuote.ot_amount) : '-'}</strong></div>
                      {overtimeQuoteLoading && <p className="text-xs text-indigo-600 pt-1">กำลังคำนวณจากข้อมูลล่าสุด...</p>}
                    </div>

                    {overtimeError && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{overtimeError}</p>}
                    <button
                      type="submit"
                      disabled={isOvertimeSaving || overtimeQuoteLoading}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition"
                    >
                      {isOvertimeSaving ? 'กำลังบันทึก...' : 'บันทึก OT'}
                    </button>
                  </form>
                </section>

                <section className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-800">รายการ OT</h3>
                      <p className="text-xs text-slate-500 mt-1">เรียงตามเวลาเริ่ม OT ล่าสุด</p>
                    </div>
                    <button onClick={loadOvertimeRecords} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg" title="โหลดข้อมูลใหม่"><RefreshCw className="w-4 h-4" /></button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                      <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="p-3.5">พนักงาน</th>
                          <th className="p-3.5">ช่วงเวลา</th>
                          <th className="p-3.5 text-right">ชั่วโมง</th>
                          <th className="p-3.5 text-right">อัตรา/ชม.</th>
                          <th className="p-3.5 text-right">ยอด OT</th>
                          <th className="p-3.5">สถานะ</th>
                          <th className="p-3.5">การอนุมัติ</th>
                          <th className="p-3.5">บันทึกเมื่อ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {isOvertimeLoading ? (
                          <tr><td colSpan={8} className="p-8 text-center text-slate-400">กำลังโหลดรายการ OT...</td></tr>
                        ) : overtimeRecords.length === 0 ? (
                          <tr><td colSpan={8} className="p-8 text-center text-slate-400">ยังไม่มีรายการ OT</td></tr>
                        ) : overtimeRecords.map(item => (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="p-3.5 font-medium text-slate-800">{item.employee_name}</td>
                            <td className="p-3.5 text-xs whitespace-nowrap"><div>{item.start_at_display}</div><div className="text-slate-400">ถึง {item.end_at_display}</div></td>
                            <td className="p-3.5 text-right font-mono">{Number(item.ot_hours).toFixed(2)}</td>
                            <td className="p-3.5 text-right whitespace-nowrap">{formatBaht(item.hourly_rate)}</td>
                            <td className="p-3.5 text-right font-semibold text-emerald-700 whitespace-nowrap">{formatBaht(item.ot_amount)}</td>
                            <td className="p-3.5 whitespace-nowrap">
                              <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${item.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : item.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                                {overtimeStatusLabels[item.status] || item.status}
                              </span>
                            </td>
                            <td className="p-3.5 whitespace-nowrap">
                              {currentUser.role?.toUpperCase() === 'ADMIN' && item.status === 'PENDING_APPROVAL' ? (
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={() => handleUpdateOvertimeStatus(item.id, 'APPROVED')}
                                    disabled={Boolean(overtimeStatusSavingId)}
                                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs rounded transition"
                                  >อนุมัติ</button>
                                  <button
                                    onClick={() => handleUpdateOvertimeStatus(item.id, 'REJECTED')}
                                    disabled={Boolean(overtimeStatusSavingId)}
                                    className="px-2 py-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs rounded transition"
                                  >ปฏิเสธ</button>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">{item.approved_by_name || '-'}</span>
                              )}
                            </td>
                            <td className="p-3.5 text-xs whitespace-nowrap">{item.created_at_display}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </div>
          )}

        </div>
      </main>

      {}
      {/* 1. Leave Request Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" /> ยื่นใบแจ้งลา (Leave Request)
              </h3>
              <button onClick={() => setShowLeaveModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLeave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ผู้ยื่นใบลา</label>
                <div className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-700">
                  {currentUser.name}
                  <span className="block text-xs text-slate-400 mt-0.5">{currentUser.email}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ประเภทการลา</label>
                <select
                  value={leaveForm.type}
                  onChange={e => setLeaveForm({ ...leaveForm, type: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Sick Leave (ลาป่วย)">ลาป่วย (Sick Leave)</option>
                  <option value="Personal Leave (ลากิจ)">ลากิจ (Personal Leave)</option>
                  <option value="Annual Leave (ลาพักร้อน)">ลาพักร้อน (Annual Leave)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">วันที่เริ่มต้น</label>
                  <input
                    type="date"
                    value={leaveForm.start_date}
                    onChange={e => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">วันที่สิ้นสุด</label>
                  <input
                    type="date"
                    value={leaveForm.end_date}
                    onChange={e => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">เหตุผลการลา</label>
                <textarea
                  rows={3}
                  value={leaveForm.reason}
                  onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  placeholder="ระบุรายละเอียดเพิ่มเติม..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowLeaveModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">ยกเลิก</button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow">บันทึกคำขอลา</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Onsite Travel Modal */}
      {showOnsiteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <MapPin className="w-5 h-5 text-indigo-600" /> บันทึกการเดินทาง Onsite
              </h3>
              <button onClick={() => setShowOnsiteModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleCreateOnsite} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">พนักงานผู้เดินทาง</label>
                  <div className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-sm">{currentUser.name}</div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">วันที่เดินทาง</label>
                  <input type="date" required value={onsiteForm.date} onChange={e => setOnsiteForm({ ...onsiteForm, date: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">ชื่อลูกค้า / บริษัท</label>
                  <input type="text" required value={onsiteForm.client_name} onChange={e => setOnsiteForm({ ...onsiteForm, client_name: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">สถานที่ / ปลายทาง</label>
                  <input type="text" required value={onsiteForm.destination} onChange={e => setOnsiteForm({ ...onsiteForm, destination: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">พาหนะ</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ['CAR', 'รถยนต์'],
                    ['TAXI', 'รถแท็กซี่'],
                    ['MOTORCYCLE', 'รถมอเตอร์ไซค์'],
                  ].map(([value, label]) => (
                    <button key={value} type="button" onClick={() => setOnsiteForm({ ...onsiteForm, vehicle: value })} className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition ${onsiteForm.vehicle === value ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}>{label}</button>
                  ))}
                </div>
              </div>

              {onsiteForm.vehicle !== 'TAXI' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">ระยะทางขาไป (กม.)</label>
                    <input type="number" min="0" step="0.1" required value={onsiteForm.outbound_distance} onChange={e => setOnsiteForm({ ...onsiteForm, outbound_distance: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">ระยะทางขากลับ (กม.)</label>
                    <input type="number" min="0" step="0.1" required value={onsiteForm.return_distance} onChange={e => setOnsiteForm({ ...onsiteForm, return_distance: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">ค่าทางด่วน (บาท)</label>
                    <input type="number" min="0" step="0.01" value={onsiteForm.toll_fee} onChange={e => setOnsiteForm({ ...onsiteForm, toll_fee: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">ค่าแท็กซี่ (บาท)</label>
                    <input type="number" min="0" step="0.01" required value={onsiteForm.taxi_fare} onChange={e => setOnsiteForm({ ...onsiteForm, taxi_fare: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">ค่าทางด่วน (บาท)</label>
                    <input type="number" min="0" step="0.01" value={onsiteForm.toll_fee} onChange={e => setOnsiteForm({ ...onsiteForm, toll_fee: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm" />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">วัตถุประสงค์ / รายละเอียดงาน</label>
                <textarea rows={2} required value={onsiteForm.purpose} onChange={e => setOnsiteForm({ ...onsiteForm, purpose: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm" />
              </div>

              <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-indigo-600 font-semibold">ค่าเดินทางโดยประมาณ</p>
                  <p className="text-[11px] text-slate-500 mt-1">ระบบจะคำนวณใหม่อีกครั้งเมื่อกดบันทึก</p>
                </div>
                <div className="text-2xl font-bold text-indigo-700">฿{calculateTravelExpense(onsiteForm, travelConfig).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>

              <div className="pt-2 flex justify-between gap-2">
                <button type="button" onClick={() => openTravelConfig(onsiteForm.date)} className="px-4 py-2 text-sm border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg">ตั้งค่าคำนวณ</button>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowOnsiteModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">ยกเลิก</button>
                  <button type="submit" disabled={isOnsiteSaving} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg font-medium shadow">{isOnsiteSaving ? 'กำลังบันทึก...' : 'บันทึกและคำนวณ'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Travel reimbursement configuration */}
      {showTravelConfigModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">ตั้งค่าค่าเดินทาง</h3>
                <p className="text-xs text-slate-500 mt-1">กำหนดแยกตามเดือน และใช้กับรถยนต์/มอเตอร์ไซค์</p>
              </div>
              <button onClick={() => setShowTravelConfigModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSaveTravelConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">เดือน</label>
                <input type="month" required value={travelConfig.month} onChange={e => loadTravelConfig(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">ราคาน้ำมัน (บาท/ลิตร)</label>
                  <input type="number" min="0" step="0.01" required value={travelConfig.fuel_price} onChange={e => setTravelConfig({ ...travelConfig, fuel_price: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">ค่าเสื่อม (บาท/กม.)</label>
                  <input type="number" min="0" step="0.01" required value={travelConfig.depreciation_per_km} onChange={e => setTravelConfig({ ...travelConfig, depreciation_per_km: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">รถยนต์ (กม./ลิตร)</label>
                  <input type="number" min="0.1" step="0.1" required value={travelConfig.car_km_per_liter} onChange={e => setTravelConfig({ ...travelConfig, car_km_per_liter: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">มอเตอร์ไซค์ (กม./ลิตร)</label>
                  <input type="number" min="0.1" step="0.1" required value={travelConfig.motorcycle_km_per_liter} onChange={e => setTravelConfig({ ...travelConfig, motorcycle_km_per_liter: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm" />
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg border border-slate-200 p-3 text-xs text-slate-600 leading-5">
                รถยนต์/มอเตอร์ไซค์ = ค่าน้ำมัน + ค่าเสื่อมตามระยะทาง + ค่าทางด่วน<br />
                รถแท็กซี่ = ค่าแท็กซี่จริง + ค่าทางด่วน
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowTravelConfigModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">ยกเลิก</button>
                <button type="submit" disabled={isTravelConfigSaving || isTravelConfigLoading || currentUser.role !== 'ADMIN'} className="px-4 py-2 text-sm bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-lg font-medium">{isTravelConfigSaving ? 'กำลังบันทึก...' : currentUser.role === 'ADMIN' ? 'บันทึก Config' : 'Admin เท่านั้น'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {documentPrintRequest && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-5">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">พิมพ์{documentPrintRequest.documentType === 'RECEIPT' ? 'ใบเสร็จรับเงิน' : 'Invoice'}</h3>
                <p className="text-xs text-slate-500 mt-1">{documentPrintRequest.documentType === 'RECEIPT' ? 'อ้างอิง Invoice: ' : 'เลขที่ Invoice: '}{documentPrintRequest.invoice.invoice_number || `INV-${invoiceYear}-${String(documentPrintRequest.invoiceIndex + 1).padStart(3, '0')}`}</p>
              </div>
              <button type="button" onClick={() => setDocumentPrintRequest(null)} className="text-slate-400 hover:text-slate-600" title="ปิด"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={async event => {
              event.preventDefault();
              if (isDocumentNumberLoading || !documentNumber.trim()) return;
              setDocumentNumberError('');
              setIsDocumentNumberLoading(true);
              try {
                const response = await fetch('/api/issued-documents', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    document_type: documentPrintRequest.documentType,
                    source_type: documentPrintRequest.sourceType,
                    reference_key: documentPrintRequest.referenceKey,
                    source_id: documentPrintRequest.invoice.id,
                    document_number: documentNumber.trim(),
                  }),
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Unable to issue document number');

                let printableInvoice = documentPrintRequest.invoice;
                if (documentPrintRequest.project && documentPrintRequest.documentType === 'INVOICE') {
                  printableInvoice = {
                    ...printableInvoice,
                    invoice_number: result.document_number,
                    receipt_number: result.document_number.replace('INV', 'REC'),
                  };
                  setProjectInvoices(current => current.map(item => item.id === printableInvoice.id
                    ? { ...item, invoice_number: result.document_number }
                    : item));
                }

                if (documentPrintRequest.documentType === 'INVOICE') {
                  if (documentPrintRequest.project) {
                    printProjectInvoice(printableInvoice, { invoiceNumber: result.document_number });
                  } else {
                    printInvoice(printableInvoice, documentPrintRequest.invoiceIndex, { invoiceNumber: result.document_number });
                  }
                } else if (documentPrintRequest.project) {
                  printProjectReceipt(printableInvoice, receiptDate, {
                    invoiceNumber: printableInvoice.invoice_number,
                    receiptNumber: result.document_number,
                  });
                } else {
                  printReceipt(printableInvoice, documentPrintRequest.invoiceIndex, receiptDate, {
                    invoiceNumber: printableInvoice.invoice_number,
                    receiptNumber: result.document_number,
                  });
                }
                setDocumentPrintRequest(null);
              } catch (error) {
                setDocumentNumberError(error instanceof Error ? error.message : 'ไม่สามารถออกเลขที่เอกสารได้');
              } finally {
                setIsDocumentNumberLoading(false);
              }
            }} className="space-y-5">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">เลขที่{documentPrintRequest.documentType === 'RECEIPT' ? 'ใบเสร็จ' : 'Invoice'}</label>
                <input required value={documentNumber} onChange={event => setDocumentNumber(event.target.value)} disabled={isDocumentNumberLoading} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60" placeholder="เช่น INV-2026-001" />
                <p className="text-xs text-slate-500">{isDocumentNumberLoading ? 'กำลังโหลดเลขที่ปัจจุบัน...' : isDocumentNumberIssued ? 'เอกสารนี้ออกเลขที่นี้แล้ว การพิมพ์ซ้ำต้องใช้เลขเดิม' : 'เลขปัจจุบันที่ระบบแนะนำ สามารถแก้ไขได้ก่อนออกเอกสาร'}</p>
              </div>
              {documentNumberError && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{documentNumberError}</p>}
              {documentPrintRequest.documentType === 'RECEIPT' && <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">วันที่ใบเสร็จ</label>
                <input type="date" required value={receiptDate} onChange={event => setReceiptDate(event.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <p className="text-xs text-slate-500 mt-2">วันที่นี้จะแสดงในใบเสร็จรับเงิน และไม่เปลี่ยนวันที่ของ Invoice</p>
              </div>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setDocumentPrintRequest(null)} className="px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">ยกเลิก</button>
                <button type="submit" disabled={isDocumentNumberLoading || !documentNumber.trim()} className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm ${documentPrintRequest.documentType === 'RECEIPT' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'} disabled:opacity-60 text-white rounded-lg font-medium`}><Printer className="w-4 h-4" />พิมพ์{documentPrintRequest.documentType === 'RECEIPT' ? 'ใบเสร็จ' : 'Invoice'}</button>
              </div>
            </form>
          </div>
        </div>
      )}


    </div>
  );
}
