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

function serializeLeave(item: {
  id: string;
  employeeId: string;
  type: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  status: string;
  createdAt: Date;
}) {
  const days = Math.max(1, Math.ceil((item.endDate.getTime() - item.startDate.getTime()) / 86_400_000) + 1);
  return {
    id: item.id,
    employee_id: item.employeeId,
    type: item.type,
    start_date: item.startDate.toISOString().split('T')[0],
    end_date: item.endDate.toISOString().split('T')[0],
    days,
    reason: item.reason,
    status: item.status === 'APPROVED' ? 'Approved' : item.status === 'REJECTED' ? 'Rejected' : 'Pending',
    created_at: item.createdAt.toISOString().split('T')[0],
  };
}

export async function GET(request: Request) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const leaves = await prisma.leave.findMany({
    where: session.role.toUpperCase() === 'ADMIN' ? undefined : { employeeId: session.employeeId },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(leaves.map(serializeLeave));
}

export async function POST(req: Request) {
  const session = getSession(req);

  if (!session) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนยื่นใบลา' }, { status: 401 });
  }

  const body = await req.json();
  const { type, startDate, endDate, reason } = body;

  const newLeave = await prisma.leave.create({
    data: {
      employeeId: session.employeeId,
      type,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reason,
    },
  });

  return NextResponse.json(serializeLeave(newLeave), { status: 201 });
}