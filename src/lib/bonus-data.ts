import type { Prisma } from '@prisma/client';
import { countBonusLeaveDays } from './bonuses';

export async function bonusEmployees(db: Prisma.TransactionClient, year: number) {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
  const [employees, leaves] = await Promise.all([
    db.employee.findMany({ where: { isOwner: false, createdAt: { lt: new Date(Date.UTC(year + 1, 0, 1, -7)) } },
      orderBy: [{ name: 'asc' }, { id: 'asc' }], select: {
        id: true, name: true, department: true, monthlySalaryCents: true,
        bonuses: { where: { year }, select: { id: true, score: true, salaryCents: true, leaveDays: true, maxLeaveDays: true, baseCents: true, deductionCents: true, amountCents: true, updatedAt: true, status: true, paymentDate: true, approvedAt: true } },
      } }),
    db.leave.findMany({ where: { status: 'APPROVED', startDate: { lt: yearEnd }, endDate: { gte: yearStart }, employee: { isOwner: false } },
      select: { employeeId: true, startDate: true, endDate: true, period: true } }),
  ]);
  return employees.map(({ bonuses, monthlySalaryCents, ...employee }) => ({
    ...employee, salaryCents: monthlySalaryCents,
    leaveDays: countBonusLeaveDays(leaves.filter(leave => leave.employeeId === employee.id), year),
    saved: bonuses[0] || null,
  }));
}
