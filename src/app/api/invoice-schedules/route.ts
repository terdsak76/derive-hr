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

function isAdminRole(role: string): boolean {
  return ['ADMIN', 'ROLE_ADMIN'].includes(role.trim().toUpperCase());
}

async function requireAdmin(request: Request) {
  const session = getSession(request);
  if (!session) return null;

  const user = await prisma.employee.findUnique({
    where: { id: session.employeeId },
    select: { role: true },
  });
  return user && isAdminRole(user.role) ? user : null;
}

function isScheduledInMonth(period: string, issueMonth: number | null, selectedMonth: number): boolean {
  if (period === 'month') return true;
  if (!issueMonth) return false;
  if (period === 'year') return issueMonth === selectedMonth;
  if (period === 'quarter') return (selectedMonth - issueMonth + 12) % 3 === 0;
  return false;
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(request.url);
    const selectedMonth = url.searchParams.get('month') || '';
    const match = /^(\d{4})-(\d{2})$/.exec(selectedMonth);
    if (!match) return NextResponse.json({ error: 'Invalid month. Use YYYY-MM.' }, { status: 400 });

    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month < 1 || month > 12) {
      return NextResponse.json({ error: 'Invalid month. Use YYYY-MM.' }, { status: 400 });
    }

    const schedules = await prisma.invoiceSchedule.findMany({
      where: {
        OR: [
          { period: 'month' },
          { period: 'year', issueMonth: month },
          { period: 'quarter' },
        ],
      },
      orderBy: [{ client: 'asc' }, { product: 'asc' }, { issueDay: 'asc' }],
    });

    return NextResponse.json(schedules.filter(schedule => isScheduledInMonth(
      schedule.period,
      schedule.issueMonth,
      month,
    )).map(schedule => ({
      id: schedule.id,
      client: schedule.client,
      product: schedule.product,
      service: schedule.service,
      description: schedule.description,
      period: schedule.period,
      issue_day: schedule.issueDay,
      issue_month: schedule.issueMonth,
      issue_date: schedule.period === 'year'
        ? `${String(schedule.issueDay).padStart(2, '0')}/${String(schedule.issueMonth).padStart(2, '0')}`
        : `${String(schedule.issueDay).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`,
      amount: schedule.amount,
      address: schedule.address,
      name: schedule.name,
      tax_id: schedule.taxId,
    })));
  } catch (error) {
    console.error('Failed to load invoice schedules:', error);
    return NextResponse.json({ error: 'Unable to load invoice schedules' }, { status: 500 });
  }
}
