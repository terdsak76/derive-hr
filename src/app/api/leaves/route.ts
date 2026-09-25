import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionCookieName, verifySessionToken } from '@/lib/auth';

export async function GET() {
  const leaves = await prisma.leave.findMany({
    include: { employee: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(leaves);
}

export async function POST(req: Request) {
  const token = req.headers.get('cookie')
    ?.split(';')
    .map(value => value.trim())
    .find(value => value.startsWith(`${getSessionCookieName()}=`))
    ?.split('=')[1];
  const session = token ? verifySessionToken(token) : null;

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

  return NextResponse.json(newLeave, { status: 201 });
}