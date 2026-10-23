import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionCookieName, verifySessionToken } from '@/lib/auth';
import { isInvoiceScheduled } from '@/lib/finance';

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

    return NextResponse.json(schedules.filter(schedule => isInvoiceScheduled(
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

export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid invoice description request' }, { status: 400 });
    }
    const { id, description } = body as Record<string, unknown>;
    if (typeof id !== 'string' || !id.trim() || typeof description !== 'string'
      || !description.trim() || description.length > 5000) {
      return NextResponse.json({ error: 'กรุณาระบุคำอธิบายรายการ 1–5,000 ตัวอักษร' }, { status: 400 });
    }

    const saved = await prisma.invoiceSchedule.update({
      where: { id: id.trim() },
      data: { description: description.trim() },
      select: { id: true, description: true },
    });
    return NextResponse.json(saved);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json({ error: 'ไม่พบรายการ Invoice' }, { status: 404 });
    }
    console.error('Failed to save invoice description:', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึกคำอธิบายได้' }, { status: 500 });
  }
}
