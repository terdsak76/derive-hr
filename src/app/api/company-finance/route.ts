import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireFinanceAdmin } from '@/lib/finance-access';
import { amountToCents, combineFinanceReports, isInvoiceScheduled, parseFinanceMonth, type FinanceReport } from '@/lib/finance';
import { socialSecurityCents } from '@/lib/taxes';

export async function GET(request: Request) {
  try {
    const user = await requireFinanceAdmin(request);
    if (user instanceof NextResponse) return user;
    const params = new URL(request.url).searchParams;
    const year = params.get('year');
    const selectedMonth = params.get('month');
    const annual = year !== null && (selectedMonth === 'all' || selectedMonth === null);
    const validYear = year !== null && /^\d{4}$/.test(year) && Number(year) >= 2000 && Number(year) <= 9998;
    if (year !== null && (!validYear || (!annual && !/^(0?[1-9]|1[0-2])$/.test(selectedMonth || '')))) {
      return NextResponse.json({ error: 'Invalid year or month.' }, { status: 400 });
    }
    const firstMonth = parseFinanceMonth(year === null ? selectedMonth : `${year}-${annual ? '01' : selectedMonth!.padStart(2, '0')}`);
    const basis = params.get('basis') || 'scheduled';
    if (!firstMonth || !['scheduled', 'issued'].includes(basis)) {
      return NextResponse.json({ error: 'Invalid month or income basis.' }, { status: 400 });
    }
    const months = annual
      ? Array.from({ length: 12 }, (_, index) => parseFinanceMonth(`${year}-${String(index + 1).padStart(2, '0')}`)!)
      : [firstMonth];
    const dates = { gte: firstMonth.start, lt: months[months.length - 1].end };
    const [employees, onsites, overtimes, incentives, schedules, projects, documents, purchases] = await Promise.all([
      prisma.employee.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, department: true, isOwner: true, monthlySalaryCents: true, createdAt: true },
      }),
      // Assign each trip's full recorded expense to its start month, once.
      prisma.onsite.findMany({ where: { startDate: dates, status: 'APPROVED' }, select: { employeeId: true, allowance: true, startDate: true } }),
      prisma.overtime.findMany({ where: { startAt: dates, status: 'APPROVED' }, select: { employeeId: true, otAmountCents: true, startAt: true } }),
      prisma.incentive.findMany({ where: { month: { in: months.map(month => month.key) } }, select: { employeeId: true, amountCents: true, month: true } }),
      prisma.invoiceSchedule.findMany({ orderBy: [{ name: 'asc' }, { id: 'asc' }], select: {
        id: true, name: true, description: true, period: true, issueMonth: true, amount: true,
      } }),
      prisma.projectInvoice.findMany({ where: { invoiceDate: dates }, orderBy: [{ invoiceDate: 'asc' }, { id: 'asc' }], select: {
        id: true, billingDescription: true, amount: true, invoiceDate: true, project: { select: { clientName: true } },
      } }),
      basis === 'issued' ? prisma.issuedDocument.findMany({
        where: { documentType: 'INVOICE' }, select: { sourceType: true, referenceKey: true },
      }) : Promise.resolve([]),
      prisma.vatPurchase.findMany({ where: { month: { in: months.map(month => month.key) }, expense: true }, select: { month: true, amountCents: true, vatCents: true, creditable: true } }),
    ]);
    const issued = new Set(documents.map(item => `${item.sourceType}:${item.referenceKey}`));
    const reports = months.map((month): Omit<FinanceReport, 'monthly'> => {
      const inMonth = (date: Date) => date >= month.start && date < month.end;
      const incomeItems: FinanceReport['incomeItems'] = [
        ...schedules.filter(item => isInvoiceScheduled(item.period, item.issueMonth, month.month)
          && (basis === 'scheduled' || issued.has(`RECURRING:recurring:${item.id}:${month.key}`)))
          .map(item => ({ id: item.id, month: month.key, source: 'recurring' as const, customer: item.name, description: item.description, amount: amountToCents(item.amount) / 100 })),
        ...projects.filter(item => inMonth(item.invoiceDate) && (basis === 'scheduled' || issued.has(`PROJECT:project:${item.id}`)))
          .map(item => ({ id: item.id, month: month.key, source: 'project' as const, customer: item.project.clientName, description: item.billingDescription, amount: amountToCents(item.amount) / 100 })),
      ];
      const employeeCosts = employees.filter(employee => employee.createdAt < month.end ||
        onsites.some(item => item.employeeId === employee.id && inMonth(item.startDate)) ||
        overtimes.some(item => item.employeeId === employee.id && inMonth(item.startAt)) ||
        incentives.some(item => item.employeeId === employee.id && item.month === month.key)).map(employee => {
        const salary = employee.createdAt < month.end ? employee.monthlySalaryCents : 0;
        const socialSecurity = socialSecurityCents(salary, employee.isOwner);
        const onsite = onsites.filter(item => item.employeeId === employee.id && inMonth(item.startDate)).reduce((sum, item) => sum + amountToCents(item.allowance || 0), 0);
        const overtime = overtimes.filter(item => item.employeeId === employee.id && inMonth(item.startAt)).reduce((sum, item) => sum + item.otAmountCents, 0);
        const incentive = incentives.filter(item => item.employeeId === employee.id && item.month === month.key).reduce((sum, item) => sum + item.amountCents, 0);
        return { id: employee.id, name: employee.name, department: employee.department, isOwner: employee.isOwner,
          salary: salary === null ? null : salary / 100, onsite: onsite / 100, overtime: overtime / 100, incentive: incentive / 100,
          socialSecurity: socialSecurity / 100, total: ((salary || 0) + onsite + overtime + incentive + socialSecurity) / 100 };
      });
      const sumCosts = (key: 'salary' | 'onsite' | 'overtime' | 'incentive' | 'socialSecurity' | 'total') =>
        employeeCosts.reduce((sum, item) => sum + amountToCents(item[key] || 0), 0) / 100;
      const recurring = incomeItems.filter(item => item.source === 'recurring').reduce((sum, item) => sum + amountToCents(item.amount), 0);
      const project = incomeItems.filter(item => item.source === 'project').reduce((sum, item) => sum + amountToCents(item.amount), 0);
      const purchaseExpense = purchases.filter(item => item.month === month.key).reduce((sum, item) => sum + item.amountCents + (item.creditable ? 0 : item.vatCents), 0) / 100;
      const expenses = { salary: sumCosts('salary'), onsite: sumCosts('onsite'), overtime: sumCosts('overtime'), incentive: sumCosts('incentive'), socialSecurity: sumCosts('socialSecurity'), purchases: purchaseExpense, total: (amountToCents(sumCosts('total')) + amountToCents(purchaseExpense)) / 100 };
      return {
        month: month.key, incomeBasis: basis as FinanceReport['incomeBasis'], expenses,
        income: { recurring: recurring / 100, project: project / 100, total: (recurring + project) / 100 },
        profit: (recurring + project - amountToCents(expenses.total)) / 100,
        employees: employeeCosts, incomeItems,
      };
    });
    const result = combineFinanceReports(reports, annual ? year! : firstMonth.key);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Failed to load company finance:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลดรายรับรายจ่ายได้' }, { status: 500 });
  }
}
