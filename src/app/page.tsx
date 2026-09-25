'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Calendar, MapPin, Clock, FileText, Database, Plus, Search, Filter, 
  CheckCircle2, XCircle, AlertCircle, ArrowUpRight, Check, X, Download, RefreshCw, 
  Terminal, Play, ChevronRight, Car, DollarSign, Building2, UserCheck, Shield,
  Globe, LogIn, LogOut, FileSpreadsheet
} from 'lucide-react';

// ==========================================
// INITIAL MOCK DATA (Simulating SQLite DB)
// ==========================================
const INITIAL_EMPLOYEES = [
  { id: 'EMP001', name: 'เบญจมาศ แก้วภิรมย์ (White)', department: 'Functional', position: 'Senior Functional', status: 'Active' },
  { id: 'EMP002', name: 'ณัฐดนัย ศรีทิพากร (Ball)', department: 'Engineering', position: 'Senior Developer', status: 'Active' },
  { id: 'EMP003', name: 'กัลยรัตน์ ฉัตรทันใจ (Piano)', department: 'PM&HR', position: 'Manager', status: 'Active' },
  { id: 'EMP004', name: 'กนกพล อินทร์หอม (View)', department: 'Engineering', position: 'Software Developer', status: 'Active' },
  { id: 'EMP005', name: 'กัญจน์พณิช ชัยชนะ (Gun)', department: 'Engineering', position: 'Software DeveloperDevOps Engineer', status: 'Active' },
  { id: 'EMP006', name: 'พรทิพา พันธะวงศ์ (Khae)', department: 'Support', position: 'Customer Support', status: 'Active' },
  { id: 'EMP007', name: 'ธีรภัทร เกิดไพบูลย์ (Got)', department: 'Engineering', position: 'DevOps Engineer', status: 'Active' }
];

const INITIAL_ATTENDANCE = [
];

const INITIAL_LEAVES = [
];

const INITIAL_ONSITE = [
];

const INITIAL_WORKDAY_CHANGES = [
];

const getDateInputValue = (date: Date): string => date.toISOString().split('T')[0];
const getDateAfter = (days: number): string => getDateInputValue(new Date(Date.now() + days * 86400000));

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

  // UI states
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showOnsiteModal, setShowOnsiteModal] = useState(false);
  const [showClockModal, setShowClockModal] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM employees LIMIT 10;');
  const [sqlResult, setSqlResult] = useState(null);
  const [sqlError, setSqlError] = useState(null);

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
    expense: '',
    vehicle: 'Private Car'
  });

  const [clockForm, setClockForm] = useState({
    employee_id: 'EMP001',
    type: 'in', // 'in' or 'out'
    note: ''
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

      } catch (error) {
        console.error('Failed to load employees from database:', error);
        setEmployees([]);
      }
    };

    loadEmployees();

    const localLeaves = localStorage.getItem('hr_sqlite_leaves');
    const localOnsite = localStorage.getItem('hr_sqlite_onsite');

    fetch('/api/attendance')
      .then(response => response.ok ? response.json() : [])
      .then(setAttendance)
      .catch(error => {
        console.error('Failed to load attendance from database:', error);
        setAttendance([]);
      });
    setLeaves(localLeaves ? JSON.parse(localLeaves) : INITIAL_LEAVES);
    setOnsite(localOnsite ? JSON.parse(localOnsite) : INITIAL_ONSITE);

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

  // Save locally-created activity records. Employee options always come from the database.
  useEffect(() => {
    if (attendance.length) localStorage.setItem('hr_sqlite_attendance', JSON.stringify(attendance));
    if (leaves.length) localStorage.setItem('hr_sqlite_leaves', JSON.stringify(leaves));
    if (onsite.length) localStorage.setItem('hr_sqlite_onsite', JSON.stringify(onsite));
  }, [attendance, leaves, onsite]);

  // Reset locally cached activity records without replacing database employees.
  const handleResetData = () => {
    setAttendance(INITIAL_ATTENDANCE);
    setLeaves(INITIAL_LEAVES);
    setOnsite(INITIAL_ONSITE);
    setWorkdayChanges(INITIAL_WORKDAY_CHANGES);
    localStorage.removeItem('hr_sqlite_attendance');
    localStorage.removeItem('hr_sqlite_leaves');
    localStorage.removeItem('hr_sqlite_onsite');
    alert('รีเซ็ตข้อมูลกิจกรรมเรียบร้อยแล้ว ข้อมูลพนักงานยังคงมาจากฐานข้อมูล');
  };

  // Create Leave Request
  const handleCreateLeave = (e) => {
    e.preventDefault();
    const startDate = new Date(leaveForm.start_date);
    const endDate = new Date(leaveForm.end_date);
    const timeDiff = endDate.getTime() - startDate.getTime();
    const days = Math.max(1, Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1);

    const newLeave = {
      id: Date.now(),
      ...leaveForm,
      employee_id: currentUser.id,
      days,
      status: 'Pending',
      created_at: new Date().toISOString().split('T')[0]
    };

    setLeaves([newLeave, ...leaves]);
    setShowLeaveModal(false);
    setLeaveForm({
      employee_id: currentUser.id,
      type: 'Sick Leave (ลาป่วย)',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0],
      reason: ''
    });
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
  const handleUpdateLeaveStatus = (id, newStatus) => {
    setLeaves(leaves.map(item => item.id === id ? { ...item, status: newStatus } : item));
  };

  // Create Onsite Travel
  const handleCreateOnsite = (e) => {
    e.preventDefault();
    const newOnsite = {
      id: Date.now(),
      ...onsiteForm,
      expense: parseFloat(onsiteForm.expense) || 0,
      status: 'In Progress'
    };

    setOnsite([newOnsite, ...onsite]);
    setShowOnsiteModal(false);
    setOnsiteForm({
      employee_id: 'EMP001',
      client_name: '',
      destination: '',
      date: new Date().toISOString().split('T')[0],
      purpose: '',
      expense: '',
      vehicle: 'Private Car'
    });
  };

  // Clock In / Out
  const handleClockSubmit = async (e) => {
    e.preventDefault();

    const response = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: clockForm.type }),
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
    setShowClockModal(false);
    setClockForm({ employee_id: currentUser.id, type: 'in', note: '' });
    return;

    const todayStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toTimeString().slice(0, 5);

    const existingIndex = attendance.findIndex(a => a.employee_id === clockForm.employee_id && a.date === todayStr);

    if (clockForm.type === 'in') {
      const isLate = timeStr > '09:00';
      if (existingIndex >= 0) {
        const updated = [...attendance];
        updated[existingIndex] = {
          ...updated[existingIndex],
          clock_in: timeStr,
          status: isLate ? 'Late' : 'Present',
          note: clockForm.note || (isLate ? 'เข้างานสาย' : 'มาตรงเวลา')
        };
        setAttendance(updated);
      } else {
        const newRecord = {
          id: Date.now(),
          employee_id: clockForm.employee_id,
          date: todayStr,
          clock_in: timeStr,
          clock_out: '-',
          status: isLate ? 'Late' : 'Present',
          note: clockForm.note || (isLate ? 'เข้างานสาย' : 'มาตรงเวลา')
        };
        setAttendance([newRecord, ...attendance]);
      }
    } else {
      if (existingIndex >= 0) {
        const updated = [...attendance];
        updated[existingIndex] = {
          ...updated[existingIndex],
          clock_out: timeStr,
          note: clockForm.note ? `${updated[existingIndex].note} / ${clockForm.note}` : updated[existingIndex].note
        };
        setAttendance(updated);
      } else {
        alert('ไม่พบบันทึกการลงเวลาเข้าของวันนี้ กรุณาตอกบัตรเข้าก่อน!');
        return;
      }
    }

    setShowClockModal(false);
    setClockForm({ employee_id: 'EMP001', type: 'in', note: '' });
  };

  const handleExecuteSQL = () => {
    setSqlError(null);
    setSqlResult(null);

    const cleanQuery = sqlQuery.trim().toLowerCase();
    
    try {
      if (cleanQuery.startsWith('select * from employees')) {
        setSqlResult({ columns: ['id', 'name', 'department', 'position', 'status'], rows: employees });
      } else if (cleanQuery.startsWith('select * from attendance')) {
        setSqlResult({ columns: ['id', 'employee_id', 'date', 'clock_in', 'clock_out', 'status', 'note'], rows: attendance });
      } else if (cleanQuery.startsWith('select * from leave_requests')) {
        setSqlResult({ columns: ['id', 'employee_id', 'type', 'start_date', 'end_date', 'days', 'reason', 'status'], rows: leaves });
      } else if (cleanQuery.startsWith('select * from onsite_travels')) {
        setSqlResult({ columns: ['id', 'employee_id', 'client_name', 'destination', 'date', 'purpose', 'expense', 'vehicle', 'status'], rows: onsite });
      } else {
        setSqlError('รองรับการคิวรีตัวอย่าง: SELECT * FROM [employees | attendance | leave_requests | onsite_travels]');
      }
    } catch (err) {
      setSqlError('ข้อผิดพลาดทางไวยากรณ์ SQL: ' + err.message);
    }
  };

  // Export DB as SQL dump script
  const handleExportSQL = () => {
    let sqlScript = `-- SQLite Database Export - HR Management System\n`;
    sqlScript += `-- Exported on: ${new Date().toLocaleString('th-TH')}\n\n`;

    // Table Employees
    sqlScript += `CREATE TABLE IF NOT EXISTS employees (\n  id TEXT PRIMARY KEY,\n  name TEXT,\n  department TEXT,\n  position TEXT,\n  status TEXT\n);\n`;
    employees.forEach(e => {
      sqlScript += `INSERT INTO employees VALUES ('${e.id}', '${e.name}', '${e.department}', '${e.position}', '${e.status}');\n`;
    });

    // Table Attendance
    sqlScript += `\nCREATE TABLE IF NOT EXISTS attendance (\n  id INTEGER PRIMARY KEY,\n  employee_id TEXT,\n  date TEXT,\n  clock_in TEXT,\n  clock_out TEXT,\n  status TEXT,\n  note TEXT\n);\n`;
    attendance.forEach(a => {
      sqlScript += `INSERT INTO attendance VALUES (${a.id}, '${a.employee_id}', '${a.date}', '${a.clock_in}', '${a.clock_out}', '${a.status}', '${a.note}');\n`;
    });

    // Table Leave Requests
    sqlScript += `\nCREATE TABLE IF NOT EXISTS leave_requests (\n  id INTEGER PRIMARY KEY,\n  employee_id TEXT,\n  type TEXT,\n  start_date TEXT,\n  end_date TEXT,\n  days INTEGER,\n  reason TEXT,\n  status TEXT\n);\n`;
    leaves.forEach(l => {
      sqlScript += `INSERT INTO leave_requests VALUES (${l.id}, '${l.employee_id}', '${l.type}', '${l.start_date}', '${l.end_date}', ${l.days}, '${l.reason}', '${l.status}');\n`;
    });

    // Table Onsite
    sqlScript += `\nCREATE TABLE IF NOT EXISTS onsite_travels (\n  id INTEGER PRIMARY KEY,\n  employee_id TEXT,\n  client_name TEXT,\n  destination TEXT,\n  date TEXT,\n  purpose TEXT,\n  expense REAL,\n  vehicle TEXT,\n  status TEXT\n);\n`;
    onsite.forEach(o => {
      sqlScript += `INSERT INTO onsite_travels VALUES (${o.id}, '${o.employee_id}', '${o.client_name}', '${o.destination}', '${o.date}', '${o.purpose}', ${o.expense}, '${o.vehicle}', '${o.status}');\n`;
    });

    const blob = new Blob([sqlScript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hr_database_sqlite_dump_${new Date().toISOString().split('T')[0]}.sql`;
    a.click();
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
            <h1 className="font-bold text-lg leading-tight" style={{ color: "#ffffff" }}>
                DeRIVE HR System
            </h1>
            <p className="text-xs text-slate-400" style={{ color: "#ffffff" }}>ระบบบริหารบุคคล</p>
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

          <div className="pt-4 border-t border-slate-800 my-2"></div>

          <button 
            onClick={() => setActiveTab('sqlite')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${activeTab === 'sqlite' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30' : 'hover:bg-slate-800 text-slate-300'}`}
          >
            <Database className="w-5 h-5" />
            <span>SQLite DB Studio</span>
          </button>
        </nav>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-800 space-y-2 text-xs text-slate-400">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-emerald-400" /> DB Engine:</span>
            <span className="bg-slate-800 px-2 py-0.5 rounded text-emerald-400 font-mono">SQLite 3.x</span>
          </div>
          <button 
            onClick={handleResetData}
            className="w-full flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-rose-900/50 text-slate-300 hover:text-rose-300 rounded border border-slate-700 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> รีเซ็ตข้อมูลเริ่มต้น
          </button>
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
              {activeTab === 'sqlite' && 'SQLite Database Architecture & SQL Console'}
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
              onClick={() => setShowClockModal(true)}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2 rounded-lg text-sm font-medium shadow transition"
            >
              <Clock className="w-4 h-4 text-emerald-400" /> ลงเวลา เข้า/ออก
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
                <button 
                  onClick={() => setShowClockModal(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition"
                >
                  <Clock className="w-4 h-4" /> บันทึกเวลา เข้า-ออก
                </button>
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
                <button 
                  onClick={() => setShowOnsiteModal(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition"
                >
                  <Plus className="w-4 h-4" /> บันทึกการไป Onsite
                </button>
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
                      <th className="p-3.5">ค่าใช้จ่ายเดินทาง</th>
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
                              <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-medium">{item.vehicle}</span>
                            </td>
                            <td className="p-3.5 font-mono font-semibold text-emerald-600">฿{item.expense.toLocaleString()}</td>
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
                  <p className="text-xs text-slate-500 mt-1">ตรวจสอบจำนวนวันลา จำนวนครั้งมาสาย และคำขอแลกวันทำงาน</p>
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
                    <tr><th className="p-3.5">พนักงาน</th><th className="p-3.5">แผนก</th><th className="p-3.5 text-center">วันลา</th><th className="p-3.5 text-center">มาสาย (ครั้ง)</th><th className="p-3.5 text-center">แลกวันทำงาน (คำขอ)</th><th className="p-3.5 text-right">ค่าเดินทาง (บาท)</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {summaryRows.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-slate-400">ไม่พบข้อมูลพนักงาน</td></tr> : summaryRows.map(employee => (
                      <tr key={employee.id} className="hover:bg-slate-50">
                        <td className="p-3.5 font-medium text-slate-800">{employee.name}<span className="block text-xs font-normal text-slate-400">{employee.email}</span></td>
                        <td className="p-3.5 text-slate-500">{employee.department}</td>
                        <td className="p-3.5 text-center"><span className="inline-flex min-w-8 justify-center px-2 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold">{employee.leaveDays}</span></td>
                        <td className="p-3.5 text-center"><span className="inline-flex min-w-8 justify-center px-2 py-1 rounded-full bg-rose-50 text-rose-700 font-semibold">{employee.lateCount}</span></td>
                        <td className="p-3.5 text-center"><span className="inline-flex min-w-8 justify-center px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 font-semibold">{employee.workdayChangeCount}</span></td>
                        <td className="p-3.5 text-right font-semibold text-emerald-700">฿{employee.travelExpenses.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'sqlite' && (
            <div className="space-y-6">
              {/* Architecture & SQL Console */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Tables Schema visualizer */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b pb-3 border-slate-200">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <Database className="w-5 h-5 text-indigo-600" /> SQLite Tables Schema
                    </h3>
                    <button 
                      onClick={handleExportSQL}
                      className="text-xs bg-slate-800 hover:bg-slate-900 text-white px-2.5 py-1.5 rounded flex items-center gap-1 transition"
                    >
                      <Download className="w-3.5 h-3.5" /> Export SQL Dump
                    </button>
                  </div>

                  <div className="space-y-3 text-xs font-mono">
                    <div className="p-3 bg-slate-50 border rounded-lg">
                      <p className="font-bold text-slate-800 mb-1">📋 employees</p>
                      <p className="text-slate-500">id (PK), name, department, position, status</p>
                    </div>
                    <div className="p-3 bg-slate-50 border rounded-lg">
                      <p className="font-bold text-slate-800 mb-1">⏰ attendance</p>
                      <p className="text-slate-500">id (PK), employee_id (FK), date, clock_in, clock_out, status, note</p>
                    </div>
                    <div className="p-3 bg-slate-50 border rounded-lg">
                      <p className="font-bold text-slate-800 mb-1">📅 leave_requests</p>
                      <p className="text-slate-500">id (PK), employee_id (FK), type, start_date, end_date, days, reason, status</p>
                    </div>
                    <div className="p-3 bg-slate-50 border rounded-lg">
                      <p className="font-bold text-slate-800 mb-1">🚗 onsite_travels</p>
                      <p className="text-slate-500">id (PK), employee_id (FK), client_name, destination, date, expense, vehicle, status</p>
                    </div>
                  </div>
                </div>

                {/* SQL Execution Console */}
                <div className="lg:col-span-2 bg-slate-900 text-slate-200 p-5 rounded-xl shadow-md flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-xs font-semibold text-emerald-400 font-mono flex items-center gap-1.5">
                        <Terminal className="w-4 h-4" /> SQLite Interactive Query Console
                      </span>
                      <span className="text-[11px] text-slate-400">Simulated SQLite Runtime</span>
                    </div>

                    <textarea
                      rows={3}
                      value={sqlQuery}
                      onChange={(e) => setSqlQuery(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      placeholder="SELECT * FROM employees;"
                    />

                    <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                        <button onClick={() => setSqlQuery('SELECT * FROM employees LIMIT 10;')} className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded font-mono">employees</button>
                        <button onClick={() => setSqlQuery('SELECT * FROM attendance;')} className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded font-mono">attendance</button>
                        <button onClick={() => setSqlQuery('SELECT * FROM leave_requests;')} className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded font-mono">leave_requests</button>
                        <button onClick={() => setSqlQuery('SELECT * FROM onsite_travels;')} className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded font-mono">onsite_travels</button>
                      </div>

                      <button 
                        onClick={handleExecuteSQL}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 shadow transition"
                      >
                        <Play className="w-3.5 h-3.5" /> Run Query
                      </button>
                    </div>
                  </div>

                  {/* SQL Result Table / Error Output */}
                  <div className="mt-4 pt-3 border-t border-slate-800 min-h-[140px] max-h-[220px] overflow-auto">
                    {sqlError && (
                      <div className="p-3 bg-rose-950/50 border border-rose-800 text-rose-300 text-xs font-mono rounded">
                        {sqlError}
                      </div>
                    )}

                    {sqlResult && (
                      <table className="w-full text-left text-xs font-mono text-slate-300">
                        <thead className="bg-slate-800 text-slate-400 sticky top-0">
                          <tr>
                            {sqlResult.columns.map((col, idx) => (
                              <th key={idx} className="p-2 border-b border-slate-700">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {sqlResult.rows.map((row, rowIdx) => (
                            <tr key={rowIdx} className="hover:bg-slate-800/50">
                              {sqlResult.columns.map((col, colIdx) => (
                                <td key={colIdx} className="p-2 whitespace-nowrap">{String(row[col] ?? '')}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {!sqlResult && !sqlError && (
                      <p className="text-xs text-slate-500 italic text-center py-8">คลิก Run Query เพื่อรันคำสั่ง SQL กับฐานข้อมูล</p>
                    )}
                  </div>
                </div>
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
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <MapPin className="w-5 h-5 text-indigo-600" /> บันทึกการปฏิบัติงาน Onsite
              </h3>
              <button onClick={() => setShowOnsiteModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOnsite} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">พนักงานผู้เดินทาง</label>
                <select 
                  value={onsiteForm.employee_id}
                  onChange={e => setOnsiteForm({ ...onsiteForm, employee_id: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.department})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ชื่อลูกค้า / บริษัท</label>
                <input 
                  type="text"
                  placeholder="เช่น บริษัท ABC จำกัด"
                  value={onsiteForm.client_name}
                  onChange={e => setOnsiteForm({ ...onsiteForm, client_name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">สถานที่ / ปลายทาง</label>
                <input 
                  type="text"
                  placeholder="เช่น อาคาร A ถ.สุขุมวิท"
                  value={onsiteForm.destination}
                  onChange={e => setOnsiteForm({ ...onsiteForm, destination: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">ยานพาหนะ</label>
                  <select 
                    value={onsiteForm.vehicle}
                    onChange={e => setOnsiteForm({ ...onsiteForm, vehicle: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="Private Car">รถส่วนตัว</option>
                    <option value="Company Car">รถบริษัท</option>
                    <option value="Taxi">แท็กซี่ / Grab</option>
                    <option value="BTS/MRT">รถไฟฟ้า</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">ค่าใช้จ่ายเดินทาง (บาท)</label>
                  <input 
                    type="number"
                    placeholder="0.00"
                    value={onsiteForm.expense}
                    onChange={e => setOnsiteForm({ ...onsiteForm, expense: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">วัตถุประสงค์ / รายละเอียดงาน</label>
                <textarea 
                  rows={2}
                  value={onsiteForm.purpose}
                  onChange={e => setOnsiteForm({ ...onsiteForm, purpose: e.target.value })}
                  placeholder="ระบุจุดประสงค์การลงพื้นที่..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowOnsiteModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">ยกเลิก</button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow">บันทึกข้อมูล Onsite</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Clock In / Out Modal */}
      {showClockModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600" /> ลงเวลาปฏิบัติงาน
              </h3>
              <button onClick={() => setShowClockModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleClockSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">เลือกพนักงาน</label>
                <select 
                  value={clockForm.employee_id}
                  onChange={e => setClockForm({ ...clockForm, employee_id: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                >
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.department})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">รายการลงเวลา</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setClockForm({ ...clockForm, type: 'in' })}
                    className={`py-2 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 border transition ${clockForm.type === 'in' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-600 border-slate-300'}`}
                  >
                    <LogIn className="w-4 h-4" /> เข้างาน (Clock In)
                  </button>
                  <button
                    type="button"
                    onClick={() => setClockForm({ ...clockForm, type: 'out' })}
                    className={`py-2 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 border transition ${clockForm.type === 'out' ? 'bg-rose-600 text-white border-rose-600' : 'bg-slate-50 text-slate-600 border-slate-300'}`}
                  >
                    <LogOut className="w-4 h-4" /> เลิกงาน (Clock Out)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">หมายเหตุเพิ่มเติม (ถ้ามี)</label>
                <input 
                  type="text"
                  placeholder="เช่น ทำงานล่วงเวลา / ไปพบลูกค้า"
                  value={clockForm.note}
                  onChange={e => setClockForm({ ...clockForm, note: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowClockModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">ยกเลิก</button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow">ยืนยันลงเวลา</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}