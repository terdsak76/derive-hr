import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isEmployeeAdmin, requireEmployeeUser } from '@/lib/employee-access';
import type { ApprovalRequest } from '@/lib/request-approvals';

async function requireAdmin(request: Request) {
  const user = await requireEmployeeUser(request);
  if (user instanceof NextResponse) return user;
  return isEmployeeAdmin(user.role) ? user : NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

export async function GET(request: Request) {
  try {
    const user = await requireAdmin(request);
    if (user instanceof NextResponse) return user;
    const include = { employee: { select: { name: true, department: true } } };
    const [leaves, changes, overtime] = await Promise.all([
      prisma.leave.findMany({ where: { status: 'PENDING' }, include }),
      prisma.workdayChangeRequest.findMany({ where: { status: 'WAITING_FOR_APPROVAL' }, include }),
      prisma.overtime.findMany({ where: { status: 'PENDING_APPROVAL' }, include }),
    ]);
    const leaveLabels: Record<string, string> = { SICK: 'ลาป่วย', PERSONAL: 'ลากิจ', VACATION: 'ลาพักร้อน' };
    const rows: ApprovalRequest[] = [
      ...leaves.map(row => ({
        id: row.id, type: 'LEAVE' as const, employeeName: row.employee.name, department: row.employee.department,
        submittedAt: row.createdAt.toISOString(), start: row.startDate.toISOString(), end: row.endDate.toISOString(),
        description: `${leaveLabels[row.type] || row.type}: ${row.reason}`,
      })),
      ...changes.map(row => ({
        id: row.id, type: 'WORKDAY_CHANGE' as const, employeeName: row.employee.name, department: row.employee.department,
        submittedAt: row.createdAt.toISOString(), start: row.fromDate.toISOString(), end: row.toDate.toISOString(),
        description: `${row.project}: ${row.jobDetail}`,
      })),
      ...overtime.map(row => ({
        id: row.id, type: 'OVERTIME' as const, employeeName: row.employee.name, department: row.employee.department,
        submittedAt: row.createdAt.toISOString(), start: row.startAt.toISOString(), end: row.endAt.toISOString(),
        description: 'ทำงานล่วงเวลา', hours: row.workedMinutes / 60, amount: row.otAmountCents / 100,
      })),
    ];
    rows.sort((a, b) => a.submittedAt.localeCompare(b.submittedAt) || a.id.localeCompare(b.id));
    return NextResponse.json(rows, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Failed to load approval requests:', error);
    return NextResponse.json({ error: 'Unable to load approval requests' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAdmin(request);
    if (user instanceof NextResponse) return user;
    const body = await request.json().catch(() => null);
    if (!body || typeof body.id !== 'string' || !body.id.trim() ||
      !['LEAVE', 'WORKDAY_CHANGE', 'OVERTIME'].includes(body.type) ||
      !['APPROVED', 'REJECTED'].includes(body.status)) {
      return NextResponse.json({ error: 'Invalid approval request' }, { status: 400 });
    }
    const { id, type, status } = body;
    const audit = { status, approvedById: user.id, approvedAt: new Date() };
    // The pending-status predicate prevents two admins from overwriting each other's decisions.
    const result = type === 'LEAVE'
      ? await prisma.leave.updateMany({ where: { id, status: 'PENDING' }, data: { status } })
      : type === 'WORKDAY_CHANGE'
        ? await prisma.workdayChangeRequest.updateMany({ where: { id, status: 'WAITING_FOR_APPROVAL' }, data: audit })
        : await prisma.overtime.updateMany({ where: { id, status: 'PENDING_APPROVAL' }, data: audit });
    if (!result.count) {
      return NextResponse.json({ error: 'คำขอนี้ถูกดำเนินการแล้วหรือไม่พบคำขอ กรุณารีเฟรชรายการ' }, { status: 409 });
    }
    return NextResponse.json({ id, type, status });
  } catch (error) {
    console.error('Failed to decide approval request:', error);
    return NextResponse.json({ error: 'Unable to save approval decision' }, { status: 500 });
  }
}
