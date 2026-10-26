'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  Building2, Calendar, ChevronDown, Clock, DollarSign, FileSpreadsheet,
  FileText, MapPin, Shield, Timer, UserCheck, Users, type LucideIcon,
} from 'lucide-react';

type Item = { tab: string; label: string; icon: LucideIcon };
const employeeItems: Item[] = [
  { tab: 'attendance', label: 'บันทึกเวลา (Attendance)', icon: Clock },
  { tab: 'leaves', label: 'แจ้งลา / ขาดงาน (Leaves)', icon: Calendar },
  { tab: 'onsite', label: 'การเดินทาง Onsite', icon: MapPin },
  { tab: 'workday', label: 'ขอเปลี่ยนวันทำงาน', icon: Calendar },
  { tab: 'overtime', label: 'บันทึก OT', icon: Timer },
  { tab: 'summary', label: 'สรุปสถิติพนักงาน', icon: FileText },
];
const incomeItems: Item[] = [
  { tab: 'invoices', label: 'Invoice ลูกค้า', icon: FileSpreadsheet },
  { tab: 'project-invoices', label: 'Invoice โครงการ', icon: FileText },
];
const expenseItems: Item[] = [
  { tab: 'revenue-tax-payments', label: 'Revenue Department Tax Payments / ภาษีกรมสรรพากร', icon: FileSpreadsheet },
  { tab: 'vat', label: 'VAT ชำระ / ขอคืน', icon: FileSpreadsheet },
  { tab: 'vendor-payments', label: 'Vendor Payments / จ่ายผู้ขาย', icon: FileText },
  { tab: 'salary-incentive-history', label: 'Salary & Incentive Management', icon: DollarSign },
  { tab: 'incentives', label: 'Incentive พนักงาน', icon: UserCheck },
  { tab: 'bonuses', label: 'Bonus', icon: DollarSign },
  { tab: 'employee-tax-summary', label: 'สรุปยอดภาษีพนักงาน', icon: FileText },
  { tab: 'social-security', label: 'ประกันสังคม', icon: Shield },
];

function MenuGroup({ id, label, icon: Icon, active, nested = false, children }: {
  id: string; label: string; icon: LucideIcon; active: boolean; nested?: boolean; children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  useEffect(() => { if (active) setOpen(true); }, [active]);
  return <section className={`app-menu-group ${nested ? 'space-y-1' : 'space-y-1.5'}`}>
    <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}
      className={`w-full flex items-center gap-2.5 rounded-lg text-left transition ${nested ? 'px-3 py-2 text-xs font-semibold text-slate-500' : 'app-menu-primary px-3 py-3 text-sm font-bold'}`}>
      <Icon className={nested ? 'w-4 h-4 shrink-0' : 'w-5 h-5 shrink-0'} />
      <span className="flex-1">{label}</span>
      <ChevronDown aria-hidden="true" className={`w-4 h-4 shrink-0 transition-transform ${open ? '' : '-rotate-90'}`} />
    </button>
    <div id={id} hidden={!open} className="app-menu-items ml-3 pl-2 border-l border-slate-200 space-y-1">{children}</div>
  </section>;
}

export default function AppNavigation({ activeTab, onSelect, isAdmin }: {
  activeTab: string; onSelect: (tab: string) => void; isAdmin: boolean;
}) {
  function item({ tab, label, icon: Icon }: Item) {
    return <button key={tab} type="button" onClick={() => onSelect(tab)} aria-current={activeTab === tab ? 'page' : undefined}
      className="app-tab-button w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left font-semibold transition">
      <Icon className="w-4 h-4 mt-0.5 shrink-0" /><span>{label}</span>
    </button>;
  }
  const employeeActive = employeeItems.some(item => item.tab === activeTab) || activeTab === 'employees' || activeTab === 'request-approvals';
  const incomeActive = incomeItems.some(item => item.tab === activeTab);
  const expenseActive = expenseItems.some(item => item.tab === activeTab);
  return <nav aria-label="เมนูหลัก" className="p-3 space-y-4 flex-1">
    {item({ tab: 'dashboard', label: 'ภาพรวม (Dashboard)', icon: Building2 })}
    <MenuGroup id="employee-menu" label="Employee" icon={Users} active={employeeActive}>
      {employeeItems.map(item)}
      {isAdmin && item({ tab: 'request-approvals', label: 'Request Approval', icon: UserCheck })}
      <div className="pt-2 mt-2 border-t border-slate-200">
        {item({ tab: 'employees', label: isAdmin ? 'จัดการพนักงาน' : 'ข้อมูลพนักงานของฉัน', icon: Users })}
      </div>
    </MenuGroup>
    {isAdmin && <MenuGroup id="finance-menu" label="Finance" icon={DollarSign} active={incomeActive || expenseActive || activeTab === 'company-finance' || activeTab === 'kbiz'}>
      {item({ tab: 'kbiz', label: 'Kbiz Reconciliation', icon: FileSpreadsheet })}
      <MenuGroup id="finance-income-menu" label="Income" icon={FileSpreadsheet} active={incomeActive} nested>
        {incomeItems.map(item)}
      </MenuGroup>
      <MenuGroup id="finance-expenses-menu" label="Expenses" icon={DollarSign} active={expenseActive} nested>
        {expenseItems.map(item)}
      </MenuGroup>
      <div className="pt-2 mt-2 border-t border-slate-200">
        {item({ tab: 'company-finance', label: 'สรุปรายรับ–รายจ่ายบริษัท', icon: FileText })}
      </div>
    </MenuGroup>}
  </nav>;
}
