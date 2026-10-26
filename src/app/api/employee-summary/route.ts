import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getEmployeeSession as getSession } from '@/lib/employee-access';
import { countLeaveDays } from '@/lib/leaves';

export async function GET(request: Request): Promise<NextResponse> {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const month = Number(url.searchParams.get('month'));
  const year = Number(url.searchParams.get('year'));
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) {
    return NextResponse.json({ error: 'Invalid month or year' }, { status: 400 });
  }

  // Summary months are calendar months in Thailand, not UTC calendar months.
  const monthStart = new Date(Date.UTC(year, month - 1, 1, -7));
  const nextMonthStart = new Date(Date.UTC(year, month, 1, -7));
  const monthEnd = new Date(nextMonthStart.getTime() - 1);
  // Leave dates are stored as date-only values at UTC midnight.
  const leaveMonthStart = new Date(Date.UTC(year, month - 1, 1));
  const leaveMonthEnd = new Date(Date.UTC(year, month, 0));
  const employeeWhere = session.role.toUpperCase() === 'ADMIN'
    ? undefined
    : { id: session.employeeId };
  const activityWhere = session.role.toUpperCase() === 'ADMIN'
    ? undefined
    : { employeeId: session.employeeId };

  try {
    const [employees, attendances, leaves, workdayChanges, onsites, overtimes] = await Promise.all([
      prisma.employee.findMany({
        where: employeeWhere,
        orderBy: { name: 'asc' },
        select: { id: true, name: true, department: true, email: true },
      }),
      prisma.attendance.findMany({
        where: {
          ...activityWhere,
          date: { gte: monthStart, lte: monthEnd },
        },
        select: { employeeId: true, status: true },
      }),
      prisma.leave.findMany({
        where: {
          ...activityWhere,
          startDate: { lte: leaveMonthEnd },
          endDate: { gte: leaveMonthStart },
        },
        select: { employeeId: true, startDate: true, endDate: true, period: true },
      }),
      prisma.workdayChangeRequest.findMany({
        where: {
          ...activityWhere,
          fromDate: { gte: monthStart, lte: monthEnd },
        },
        select: { employeeId: true },
      }),
      prisma.onsite.findMany({
        where: {
          ...activityWhere,
          startDate: { lte: monthEnd },
          endDate: { gte: monthStart },
        },
        select: { employeeId: true, allowance: true },
      }),
      prisma.overtime.findMany({
        where: {
          ...activityWhere,
          startAt: { gte: monthStart, lte: monthEnd },
          status: 'APPROVED',
        },
        select: { employeeId: true, workedMinutes: true, otAmountCents: true },
      }),
    ]);

    const rows = employees.map(employee => ({
      ...employee,
      leaveDays: leaves
        .filter(item => item.employeeId === employee.id)
        .reduce((total, item) => total + countLeaveDays(
          new Date(Math.max(item.startDate.getTime(), leaveMonthStart.getTime())),
          new Date(Math.min(item.endDate.getTime(), leaveMonthEnd.getTime())), item.period,
        ), 0),
      lateCount: attendances.filter(item =>
        item.employeeId === employee.id && item.status.toUpperCase() === 'LATE',
      ).length,
      workdayChangeCount: workdayChanges.filter(item => item.employeeId === employee.id).length,
      travelExpenses: onsites
        .filter(item => item.employeeId === employee.id)
        .reduce((total, item) => total + (item.allowance || 0), 0),
      overtimeHours: overtimes
        .filter(item => item.employeeId === employee.id)
        .reduce((total, item) => total + item.workedMinutes, 0) / 60,
      overtimePay: overtimes
        .filter(item => item.employeeId === employee.id)
        .reduce((total, item) => total + item.otAmountCents, 0) / 100,
    }));

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Failed to load employee summary:', error);
    return NextResponse.json({ error: 'Unable to load employee summary' }, { status: 500 });
  }
}
