import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionCookieName, verifySessionToken } from '@/lib/auth';
import {
  calculateOvertime,
  centsToAmount,
  formatBangkokDateTime,
  parseBangkokDateTime,
} from '@/lib/overtime';

type RequestBody = {
  employee_id?: unknown;
  start_at?: unknown;
  end_at?: unknown;
};

type StatusUpdateBody = {
  id?: unknown;
  status?: unknown;
};

class OverlapError extends Error {}

function getSession(request: Request) {
  const token = request.headers.get('cookie')
    ?.split(';')
    .map(value => value.trim())
    .find(value => value.startsWith(`${getSessionCookieName()}=`))
    ?.split('=')[1];
  return token ? verifySessionToken(token) : null;
}

async function requireUser(request: Request) {
  const session = getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Reload the user so role changes take effect immediately instead of relying
  // only on the role captured when the session cookie was issued.
  const user = await prisma.employee.findUnique({
    where: { id: session.employeeId },
    select: { id: true, role: true },
  });
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return { user };
}

async function requireAdmin(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.user.role.toUpperCase() !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return auth;
}

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

function parseBody(body: RequestBody) {
  const employeeId = typeof body.employee_id === 'string' ? body.employee_id.trim() : '';
  const startAt = parseBangkokDateTime(body.start_at);
  const endAt = parseBangkokDateTime(body.end_at);

  if (!startAt) return { error: 'Invalid OT start date/time. Use YYYY-MM-DDTHH:mm.' } as const;
  if (!endAt) return { error: 'Invalid OT end date/time. Use YYYY-MM-DDTHH:mm.' } as const;
  if (endAt.getTime() <= startAt.getTime()) {
    return { error: 'End date/time must be after start date/time.' } as const;
  }
  return { employeeId, startAt, endAt } as const;
}

function serializeOvertime(item: {
  id: string;
  employeeId: string;
  startAt: Date;
  endAt: Date;
  workedMinutes: number;
  hourlyRateCents: number;
  otAmountCents: number;
  createdById: string;
  createdAt: Date;
  employee: { name: string };
  status: string;
  approvedBy: { name: string } | null;
  approvedAt: Date | null;
}) {
  return {
    id: item.id,
    employee_id: item.employeeId,
    employee_name: item.employee.name,
    start_at: item.startAt.toISOString(),
    end_at: item.endAt.toISOString(),
    start_at_display: formatBangkokDateTime(item.startAt),
    end_at_display: formatBangkokDateTime(item.endAt),
    worked_minutes: item.workedMinutes,
    ot_hours: item.workedMinutes / 60,
    hourly_rate: centsToAmount(item.hourlyRateCents),
    ot_amount: centsToAmount(item.otAmountCents),
    created_by_id: item.createdById,
    created_at: item.createdAt.toISOString(),
    created_at_display: formatBangkokDateTime(item.createdAt),
    status: item.status,
    approved_by_name: item.approvedBy?.name || null,
    approved_at: item.approvedAt?.toISOString() || null,
  };
}

async function loadCalculation(body: RequestBody, employeeIdOverride?: string) {
  const parsed = parseBody(body);
  if ('error' in parsed) return parsed;

  const employeeId = employeeIdOverride || parsed.employeeId;
  if (!employeeId) return { error: 'Employee is required.' } as const;

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, name: true, monthlySalaryCents: true },
  });
  if (!employee) return { error: 'Employee does not exist.' } as const;
  if (!Number.isSafeInteger(employee.monthlySalaryCents) || employee.monthlySalaryCents <= 0) {
    return { error: 'Employee must have a valid monthly salary before recording overtime.' } as const;
  }

  const calculation = calculateOvertime(employee.monthlySalaryCents, parsed.startAt, parsed.endAt);
  if (!calculation) return { error: 'The overtime interval is invalid.' } as const;
  return { ...parsed, employeeId, employee, calculation } as const;
}

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const records = await prisma.overtime.findMany({
      orderBy: [{ startAt: 'desc' }, { createdAt: 'desc' }],
      where: auth.user.role.toUpperCase() === 'ADMIN'
        ? undefined
        : { employeeId: auth.user.id },
      include: {
        employee: { select: { name: true } },
        approvedBy: { select: { name: true } },
      },
    });
    return NextResponse.json(records.map(serializeOvertime));
  } catch (error) {
    console.error('Failed to load overtime records:', error);
    return NextResponse.json({ error: 'Unable to load overtime records.' }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;

  let body: RequestBody;
  try {
    body = await request.json() as RequestBody;
  } catch {
    return badRequest('Request body must be valid JSON.');
  }

  const calculation = await loadCalculation(
    body,
    auth.user.role.toUpperCase() === 'ADMIN' ? undefined : auth.user.id,
  );
  if (!('calculation' in calculation)) return badRequest(calculation.error);

  try {
    // SQLite has no exclusion constraint for time ranges. The interactive
    // transaction makes the overlap check and insert atomic; a concurrent
    // writer may still receive SQLite's busy error and should retry.
    const saved = await prisma.$transaction(async tx => {
      const overlap = await tx.overtime.findFirst({
        where: {
          employeeId: calculation.employeeId,
          startAt: { lt: calculation.endAt },
          endAt: { gt: calculation.startAt },
        },
        select: { id: true },
      });
      if (overlap) throw new OverlapError('This overtime interval overlaps an existing record.');

      return tx.overtime.create({
        data: {
          employeeId: calculation.employeeId,
          startAt: calculation.startAt,
          endAt: calculation.endAt,
          workedMinutes: calculation.calculation.workedMinutes,
          hourlyRateCents: calculation.calculation.hourlyRateCents,
          otAmountCents: calculation.calculation.otAmountCents,
          createdById: auth.user.id,
          status: 'PENDING_APPROVAL',
        },
        include: {
          employee: { select: { name: true } },
          approvedBy: { select: { name: true } },
        },
      });
    });

    return NextResponse.json(serializeOvertime(saved), { status: 201 });
  } catch (error) {
    if (error instanceof OverlapError) {
      return NextResponse.json({ error: error.message, code: 'OVERTIME_OVERLAP' }, { status: 409 });
    }
    console.error('Failed to save overtime record:', error);
    return NextResponse.json({ error: 'Unable to save overtime record.' }, { status: 500 });
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  let body: StatusUpdateBody;
  try {
    body = await request.json() as StatusUpdateBody;
  } catch {
    return badRequest('Request body must be valid JSON.');
  }

  const id = typeof body.id === 'string' ? body.id.trim() : '';
  const status = body.status === 'APPROVED' || body.status === 'REJECTED'
    ? body.status
    : null;
  if (!id || !status) {
    return badRequest('A valid overtime id and approval status are required.');
  }

  try {
    const existing = await prisma.overtime.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!existing) return NextResponse.json({ error: 'Overtime record does not exist.' }, { status: 404 });
    if (existing.status !== 'PENDING_APPROVAL') {
      return NextResponse.json({ error: 'Only pending overtime records can be approved or rejected.' }, { status: 409 });
    }

    const updated = await prisma.overtime.update({
      where: { id },
      data: {
        status,
        approvedById: auth.user.id,
        approvedAt: new Date(),
      },
      include: {
        employee: { select: { name: true } },
        approvedBy: { select: { name: true } },
      },
    });

    return NextResponse.json(serializeOvertime(updated));
  } catch (error) {
    console.error('Failed to update overtime approval status:', error);
    return NextResponse.json({ error: 'Unable to update overtime approval status.' }, { status: 500 });
  }
}
