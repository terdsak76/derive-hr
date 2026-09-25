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

function serializeAttendance(item: {
  id: string;
  employeeId: string;
  date: Date;
  checkIn: Date | null;
  checkOut: Date | null;
  status: string;
}) {
  return {
    id: item.id,
    employee_id: item.employeeId,
    date: item.date.toISOString().split('T')[0],
    clock_in: item.checkIn?.toISOString().slice(11, 16) || '-',
    clock_out: item.checkOut?.toISOString().slice(11, 16) || '-',
    status: item.status === 'LATE' ? 'Late' : item.status === 'PRESENT' ? 'Present' : item.status,
    note: '',
  };
}

export async function GET(request: Request): Promise<NextResponse> {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const attendance = await prisma.attendance.findMany({
    where: session.role.toUpperCase() === 'ADMIN' ? undefined : { employeeId: session.employeeId },
    orderBy: { date: 'desc' },
  });

  return NextResponse.json(attendance.map(serializeAttendance));
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const type = body.type === 'out' ? 'out' : 'in';
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const existing = await prisma.attendance.findFirst({
    where: { employeeId: session.employeeId, date: { gte: todayStart, lt: tomorrowStart } },
    orderBy: { date: 'desc' },
  });

  try {
    const isLate = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 0);
    const saved = existing
      ? await prisma.attendance.update({
          where: { id: existing.id },
          data: type === 'in'
            ? { checkIn: now, status: isLate ? 'LATE' : 'PRESENT' }
            : { checkOut: now },
        })
      : await prisma.attendance.create({
          data: {
            employeeId: session.employeeId,
            date: now,
            checkIn: type === 'in' ? now : null,
            status: type === 'in' && isLate ? 'LATE' : 'PRESENT',
          },
        });

    return NextResponse.json(serializeAttendance(saved));
  } catch (error) {
    console.error('Failed to save attendance:', error);
    return NextResponse.json({ error: 'Unable to save attendance' }, { status: 500 });
  }
}
