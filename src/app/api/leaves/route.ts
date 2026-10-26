import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formatBangkokDate } from '@/lib/bangkok-date';
import { getEmployeeSession as getSession } from '@/lib/employee-access';
import { countLeaveDays, leavePeriodLabels, parseLeaveDate } from '@/lib/leaves';

function serializeLeave(item: {
  id: string;
  employeeId: string;
  type: string;
  period: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  status: string;
  createdAt: Date;
}) {
  const days = countLeaveDays(item.startDate, item.endDate, item.period);
  return {
    id: item.id,
    employee_id: item.employeeId,
    type: item.type,
    period: item.period,
    start_date: item.startDate.toISOString().split('T')[0],
    end_date: item.endDate.toISOString().split('T')[0],
    days,
    reason: item.reason,
    status: item.status === 'APPROVED' ? 'Approved' : item.status === 'REJECTED' ? 'Rejected' : 'Pending',
    created_at: formatBangkokDate(item.createdAt),
  };
}

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const leaves = await prisma.leave.findMany({
    where: session.role.toUpperCase() === 'ADMIN' ? undefined : { employeeId: session.employeeId },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(leaves.map(serializeLeave));
}

export async function POST(req: Request) {
  const session = await getSession(req);

  if (!session) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนยื่นใบลา' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'ข้อมูลใบลาไม่ถูกต้อง' }, { status: 400 });
  const { type, reason, period = 'FULL_DAY' } = body;
  const startDate = parseLeaveDate(body.startDate);
  const endDate = parseLeaveDate(body.endDate);
  if (typeof period !== 'string' || !Object.hasOwn(leavePeriodLabels, period) ||
      !startDate || !endDate || endDate < startDate ||
      typeof type !== 'string' || !type.trim() || typeof reason !== 'string' || !reason.trim()) {
    return NextResponse.json({ error: 'กรุณาระบุประเภท ช่วงเวลา วันที่ และเหตุผลการลาให้ถูกต้อง' }, { status: 400 });
  }
  if (period !== 'FULL_DAY' && body.startDate !== body.endDate) {
    return NextResponse.json({ error: 'การลาครึ่งวันต้องเลือกวันที่เริ่มต้นและสิ้นสุดเป็นวันเดียวกัน' }, { status: 400 });
  }

  const newLeave = await prisma.leave.create({
    data: {
      employeeId: session.employeeId,
      type,
      period,
      startDate,
      endDate,
      reason,
    },
  });

  return NextResponse.json(serializeLeave(newLeave), { status: 201 });
}

export async function PATCH(req: Request) {
  const session = await getSession(req);

  if (!session) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนอนุมัติใบลา' }, { status: 401 });
  }

  if (session.role.toUpperCase() !== 'ADMIN') {
    return NextResponse.json({ error: 'เฉพาะผู้ดูแลระบบเท่านั้นที่อนุมัติใบลาได้' }, { status: 403 });
  }

  const body = await req.json();
  const id = String(body.id || '');
  const status = body.status === 'Approved'
    ? 'APPROVED'
    : body.status === 'Rejected'
      ? 'REJECTED'
      : body.status === 'Pending'
        ? 'PENDING'
        : null;

  if (!id || !status) {
    return NextResponse.json({ error: 'Invalid leave status update' }, { status: 400 });
  }

  try {
    const updated = await prisma.leave.update({
      where: { id },
      data: { status },
    });
    return NextResponse.json(serializeLeave(updated));
  } catch (error) {
    console.error('Failed to update leave status:', error);
    return NextResponse.json({ error: 'ไม่พบคำขอลาที่ต้องการอัปเดต' }, { status: 404 });
  }
}
