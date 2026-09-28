import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionCookieName, verifySessionToken } from '@/lib/auth';

const BANGKOK_TIME_ZONE = 'Asia/Bangkok';

function formatBangkokDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BANGKOK_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function formatBangkokTime(date: Date | null): string {
  if (!date) return '-';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: BANGKOK_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function getBangkokDayBounds(date: Date): { start: Date; end: Date } {
  const dateText = formatBangkokDate(date);
  const start = new Date(`${dateText}T00:00:00+07:00`);
  const end = new Date(`${dateText}T00:00:00+07:00`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

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
  project: string | null;
  jobDetail: string | null;
  status: string;
}) {
  return {
    id: item.id,
    employee_id: item.employeeId,
    date: formatBangkokDate(item.date),
    clock_in: formatBangkokTime(item.checkIn),
    clock_out: formatBangkokTime(item.checkOut),
    status: item.status === 'LATE' ? 'Late' : item.status === 'PRESENT' ? 'Present' : item.status,
    project: item.project || '',
    job_detail: item.jobDetail || '',
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
  const { start: todayStart, end: tomorrowStart } = getBangkokDayBounds(now);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const existing = await prisma.attendance.findFirst({
    where: { employeeId: session.employeeId, date: { gte: todayStart, lt: tomorrowStart } },
    orderBy: { date: 'desc' },
  });

  try {
    const bangkokTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: BANGKOK_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);
    const isLate = bangkokTime > '09:00';
    const saved = existing
      ? await prisma.attendance.update({
          where: { id: existing.id },
          data: type === 'in'
            ? {
                checkIn: now,
                status: isLate ? 'LATE' : 'PRESENT',
                project: String(body.project || '').trim() || null,
                jobDetail: String(body.job_detail || '').trim() || null,
              }
            : { checkOut: now },
        })
      : await prisma.attendance.create({
          data: {
            employeeId: session.employeeId,
            date: now,
            checkIn: type === 'in' ? now : null,
            status: type === 'in' && isLate ? 'LATE' : 'PRESENT',
            project: String(body.project || '').trim() || null,
            jobDetail: String(body.job_detail || '').trim() || null,
          },
        });

    return NextResponse.json(serializeAttendance(saved));
  } catch (error) {
    console.error('Failed to save attendance:', error);
    return NextResponse.json({ error: 'Unable to save attendance' }, { status: 500 });
  }
}
