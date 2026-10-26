/** Calendar boundaries shared by incentives and company reporting. */
export function parseFinanceMonth(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  const [year, month] = value.split('-').map(Number);
  if (year < 2000 || year > 9998) return null;
  return {
    key: value, year, month,
    start: new Date(Date.UTC(year, month - 1, 1, -7)),
    end: new Date(Date.UTC(year, month, 1, -7)),
  };
}

export function isInvoiceScheduled(period: string, issueMonth: number | null, month: number) {
  if (period === 'month') return true;
  if (!issueMonth) return false;
  if (period === 'year') return issueMonth === month;
  return period === 'quarter' && (month - issueMonth + 12) % 3 === 0;
}

export function amountToCents(value: number) {
  return Math.round((value + Number.EPSILON) * 100);
}

export type FinanceReport = {
  month: string;
  incomeBasis: 'scheduled' | 'issued';
  expenses: { salary: number; onsite: number; overtime: number; incentive: number; bonus: number; socialSecurity: number; purchases: number; total: number };
  income: { recurring: number; project: number; total: number };
  profit: number;
  employees: {
    id: string; name: string; department: string; isOwner: boolean; salary: number | null;
    onsite: number; overtime: number; incentive: number; bonus: number; socialSecurity: number; total: number;
  }[];
  incomeItems: { id: string; month: string; source: 'recurring' | 'project'; customer: string; description: string; amount: number }[];
  monthly: { month: string; expenses: FinanceReport['expenses']; income: FinanceReport['income']; profit: number }[];
};

export function combineFinanceReports(reports: Omit<FinanceReport, 'monthly'>[], period: string): FinanceReport {
  const sum = (values: number[]) => values.reduce((total, amount) => total + amountToCents(amount), 0) / 100;
  const employees = new Map<string, FinanceReport['employees'][number]>();
  for (const report of reports) for (const employee of report.employees) {
    const previous = employees.get(employee.id);
    employees.set(employee.id, previous ? {
      ...employee,
      salary: previous.salary === null || employee.salary === null ? null : sum([previous.salary, employee.salary]),
      onsite: sum([previous.onsite, employee.onsite]), overtime: sum([previous.overtime, employee.overtime]),
      incentive: sum([previous.incentive, employee.incentive]), total: sum([previous.total, employee.total]),
      bonus: sum([previous.bonus, employee.bonus]),
      socialSecurity: sum([previous.socialSecurity, employee.socialSecurity]),
    } : { ...employee });
  }
  return {
    month: period, incomeBasis: reports[0].incomeBasis,
    expenses: {
      salary: sum(reports.map(report => report.expenses.salary)), onsite: sum(reports.map(report => report.expenses.onsite)),
      overtime: sum(reports.map(report => report.expenses.overtime)), incentive: sum(reports.map(report => report.expenses.incentive)),
      bonus: sum(reports.map(report => report.expenses.bonus)),
      socialSecurity: sum(reports.map(report => report.expenses.socialSecurity)), purchases: sum(reports.map(report => report.expenses.purchases)),
      total: sum(reports.map(report => report.expenses.total)),
    },
    income: {
      recurring: sum(reports.map(report => report.income.recurring)), project: sum(reports.map(report => report.income.project)),
      total: sum(reports.map(report => report.income.total)),
    },
    profit: sum(reports.map(report => report.profit)),
    employees: Array.from(employees.values()), incomeItems: reports.flatMap(report => report.incomeItems),
    monthly: reports.map(({ month, expenses, income, profit }) => ({ month, expenses, income, profit })),
  };
}
