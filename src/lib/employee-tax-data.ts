import type { Prisma } from '@prisma/client';
import { annualSalary, type EmployeeTaxReport } from './employee-tax-summary';

export async function employeeTaxReport(db: Prisma.TransactionClient, year: number, now = new Date()): Promise<EmployeeTaxReport> {
  const current = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit' }).format(now);
  const through = year < Number(current.slice(0, 4)) ? 12 : year === Number(current.slice(0, 4)) ? Number(current.slice(5, 7)) : 0;
  const firstMonth = `${year}-01`;
  const lastMonth = `${year}-${String(through).padStart(2, '0')}`;
  const start = new Date(`${year}-01-01T00:00:00+07:00`);
  const end = new Date(Date.UTC(year, through, 1, -7));
  const [employees, incentives, bonuses, overtime] = await Promise.all([
    db.employee.findMany({ orderBy: [{ name: 'asc' }, { id: 'asc' }], select: {
      id: true, name: true, taxId: true, address: true, isOwner: true,
      salaryIncentiveHistory: { where: { startDate: { lt: new Date(Date.UTC(year, through, 1)) }, OR: [{ endDate: null }, { endDate: { gte: new Date(Date.UTC(year, 0, 1)) } }] }, orderBy: { startDate: 'desc' } },
    } }),
    db.incentive.findMany({ where: { month: { gte: firstMonth, lte: lastMonth }, status: { in: ['PAYMENT_PENDING', 'COMPLETED'] } }, select: { employeeId: true, amountCents: true } }),
    db.bonus.findMany({ where: { bonusYear: { expenseMonth: { gte: firstMonth, lte: lastMonth } }, status: { in: ['PAYMENT_PENDING', 'COMPLETED'] } }, select: { employeeId: true, amountCents: true } }),
    db.overtime.findMany({ where: { startAt: { gte: start, lt: end }, status: 'APPROVED' }, select: { employeeId: true, otAmountCents: true } }),
  ]);
  return { year, throughMonth: lastMonth, employees: employees.map(employee => {
    const salary = annualSalary(employee.salaryIncentiveHistory, year, through, employee.isOwner);
    const incentiveCents = incentives.filter(row => row.employeeId === employee.id).reduce((sum, row) => sum + row.amountCents, 0);
    const bonusCents = bonuses.filter(row => row.employeeId === employee.id).reduce((sum, row) => sum + row.amountCents, 0);
    const overtimeCents = overtime.filter(row => row.employeeId === employee.id).reduce((sum, row) => sum + row.otAmountCents, 0);
    return { id: employee.id, name: employee.name, taxId: employee.taxId, address: employee.address,
      salaryCents: salary.salaryCents, incentiveCents, bonusCents, overtimeCents, socialSecurityCents: salary.socialSecurityCents,
      totalCents: salary.salaryCents + incentiveCents + bonusCents + overtimeCents, withheldCents: 0,
      warnings: [
        ...(!employee.taxId || !employee.address ? ['กรุณาเพิ่มเลขผู้เสียภาษีและที่อยู่ในข้อมูลพนักงานก่อนพิมพ์'] : []),
        ...(salary.missingDays ? ['ประวัติเงินเดือนไม่ครบปี: คิดเฉพาะวันที่มีข้อมูล (รวมกรณีเริ่มงานระหว่างปี)'] : []),
        ...(employee.salaryIncentiveHistory.some(row => row.isOpening) ? ['มีประวัติเงินเดือนยกมา โปรดตรวจสอบวันเริ่มต้นและยอดจริง'] : []),
      ],
    };
  }) };
}
