import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionCookieName, verifySessionToken } from '@/lib/auth';

function getSession(request: Request) {
  const token = request.headers.get('cookie')
    ?.split(';')
    .map(value => value.trim())
    .find(value => value.startsWith(`${getSessionCookieName()}=`))
    ?.split('=')[1];

  return token ? verifySessionToken(token) : null;
}

function daysInRange(start: Date, end: Date, monthStart: Date, monthEnd: Date): number {
  const effectiveStart = Math.max(start.getTime(), monthStart.getTime());
  const effectiveEnd = Math.min(end.getTime(), monthEnd.getTime());
  if (effectiveEnd < effectiveStart) return 0;

  return Math.floor((effectiveEnd - effectiveStart) / 86_400_000) + 1;
}

export async function GET(request: Request): Promise<NextResponse> {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const month = Number(url.searchParams.get('month'));
  const year = Number(url.searchParams.get('year'));
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) {
    return NextResponse.json({ error: 'Invalid month or year' }, { status: 400 });
  }

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  const employeeWhere = session.role.toUpperCase() === 'ADMIN'
    ? undefined
    : { id: session.employeeId };
  const activityWhere = session.role.toUpperCase() === 'ADMIN'
    ? undefined
    : { employeeId: session.employeeId };

  try {
    const [employees, attendances, leaves, workdayChanges, onsites] = await Promise.all([
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
          startDate: { lte: monthEnd },
          endDate: { gte: monthStart },
        },
        select: { employeeId: true, startDate: true, endDate: true },
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
    ]);

    const rows = employees.map(employee => ({
      ...employee,
      leaveDays: leaves
        .filter(item => item.employeeId === employee.id)
        .reduce((total, item) => total + daysInRange(item.startDate, item.endDate, monthStart, monthEnd), 0),
      lateCount: attendances.filter(item =>
        item.employeeId === employee.id && item.status.toUpperCase() === 'LATE',
      ).length,
      workdayChangeCount: workdayChanges.filter(item => item.employeeId === employee.id).length,
      travelExpenses: onsites
        .filter(item => item.employeeId === employee.id)
        .reduce((total, item) => total + (item.allowance || 0), 0),
    }));

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Failed to load employee summary:', error);
    return NextResponse.json({ error: 'Unable to load employee summary' }, { status: 500 });
  }
}
