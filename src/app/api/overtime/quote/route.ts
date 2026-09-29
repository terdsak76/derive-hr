import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionCookieName, verifySessionToken } from '@/lib/auth';
import { calculateOvertime, centsToAmount, parseBangkokDateTime } from '@/lib/overtime';

type RequestBody = {
  employee_id?: unknown;
  start_at?: unknown;
  end_at?: unknown;
};

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
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.employee.findUnique({
    where: { id: session.employeeId },
    select: { id: true, role: true },
  });
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return { user };
}

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;

  let body: RequestBody;
  try {
    body = await request.json() as RequestBody;
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const requestedEmployeeId = typeof body.employee_id === 'string' ? body.employee_id.trim() : '';
  const employeeId = auth.user.role.toUpperCase() === 'ADMIN'
    ? requestedEmployeeId
    : auth.user.id;
  const startAt = parseBangkokDateTime(body.start_at);
  const endAt = parseBangkokDateTime(body.end_at);
  if (!employeeId) return NextResponse.json({ error: 'Employee is required.' }, { status: 400 });
  if (!startAt) return NextResponse.json({ error: 'Invalid OT start date/time. Use YYYY-MM-DDTHH:mm.' }, { status: 400 });
  if (!endAt) return NextResponse.json({ error: 'Invalid OT end date/time. Use YYYY-MM-DDTHH:mm.' }, { status: 400 });
  if (endAt.getTime() <= startAt.getTime()) {
    return NextResponse.json({ error: 'End date/time must be after start date/time.' }, { status: 400 });
  }

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, name: true, monthlySalaryCents: true },
  });
  if (!employee) return NextResponse.json({ error: 'Employee does not exist.' }, { status: 400 });
  if (!Number.isSafeInteger(employee.monthlySalaryCents) || employee.monthlySalaryCents <= 0) {
    return NextResponse.json({ error: 'Employee must have a valid monthly salary before recording overtime.' }, { status: 400 });
  }

  const calculation = calculateOvertime(employee.monthlySalaryCents, startAt, endAt);
  if (!calculation) return NextResponse.json({ error: 'The overtime interval is invalid.' }, { status: 400 });

  return NextResponse.json({
    employee_id: employee.id,
    employee_name: employee.name,
    monthly_salary: centsToAmount(employee.monthlySalaryCents),
    hourly_rate: centsToAmount(calculation.hourlyRateCents),
    worked_minutes: calculation.workedMinutes,
    ot_hours: calculation.workedMinutes / 60,
    ot_amount: centsToAmount(calculation.otAmountCents),
  });
}
