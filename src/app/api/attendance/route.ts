import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getEmployeeSession as getSession } from '@/lib/employee-access';
import { BANGKOK_TIME_ZONE, formatBangkokDate } from '@/lib/bangkok-date';

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
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const attendance = await prisma.attendance.findMany({
    where: session.role.toUpperCase() === 'ADMIN' ? undefined : { employeeId: session.employeeId },
    orderBy: { date: 'desc' },
  });

  return NextResponse.json(attendance.map(serializeAttendance));
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const type = body.type === 'out' ? 'out' : 'in';
  const now = new Date();
  const { start: todayStart, end: tomorrowStart } = getBangkokDayBounds(now);
  const existing = await prisma.attendance.findFirst({
    where: { employeeId: session.employeeId, date: { gte: todayStart, lt: tomorrowStart } },
    orderBy: { date: 'desc' },
  });

  try {
    if (type === 'out' && (!existing || !existing.checkIn)) {
      return NextResponse.json({ error: 'กรุณาลงเวลาเข้างานก่อนออกงาน' }, { status: 400 });
    }

    if (type === 'in' && existing?.checkIn) {
      return NextResponse.json({ error: 'วันนี้ลงเวลาเข้างานแล้ว' }, { status: 409 });
    }

    if (type === 'out' && existing?.checkOut) {
      return NextResponse.json({ error: 'วันนี้ลงเวลาออกงานแล้ว' }, { status: 409 });
    }

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
          data: { checkOut: now },
        })
      : await prisma.attendance.create({
          data: {
            employeeId: session.employeeId,
            date: now,
            checkIn: now,
            status: isLate ? 'LATE' : 'PRESENT',
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
