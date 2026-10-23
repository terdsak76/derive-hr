import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireFinanceAdmin } from '@/lib/finance-access';
import { parseCompensationCents, parseSalaryDate, previousSalaryDay } from '@/lib/salary-history';

export async function GET(request: Request) {
  try {
    const user = await requireFinanceAdmin(request);
    if (user instanceof NextResponse) return user;
    const employees = await prisma.employee.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, department: true, monthlySalaryCents: true, fullIncentiveCents: true,
        salaryIncentiveHistory: { orderBy: { startDate: 'desc' }, select: {
          id: true, salaryCents: true, fullIncentiveCents: true, startDate: true, endDate: true, isOpening: true,
        } },
      },
    });
    return NextResponse.json(employees.map(employee => ({
      id: employee.id, name: employee.name, department: employee.department,
      salary: employee.monthlySalaryCents === null ? null : employee.monthlySalaryCents / 100,
      fullIncentive: employee.fullIncentiveCents / 100,
      history: employee.salaryIncentiveHistory.map(row => ({
        id: row.id, salary: row.salaryCents === null ? null : row.salaryCents / 100,
        fullIncentive: row.fullIncentiveCents / 100, startDate: row.startDate.toISOString().slice(0, 10),
        endDate: row.endDate?.toISOString().slice(0, 10) ?? null, isOpening: row.isOpening,
      })),
    })), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Failed to load salary history:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลดประวัติเงินเดือนได้' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireFinanceAdmin(request);
    if (user instanceof NextResponse) return user;
    const body = await request.json().catch(() => null);
    const employeeId = typeof body?.employeeId === 'string' ? body.employeeId.trim() : '';
    const startDate = parseSalaryDate(body?.startDate);
    const salaryCents = parseCompensationCents(body?.salary);
    const fullIncentiveCents = parseCompensationCents(body?.fullIncentive);
    if (!employeeId || !startDate || salaryCents === null || fullIncentiveCents === null) {
      return NextResponse.json({ error: 'กรุณาระบุพนักงาน วันเริ่มต้น และจำนวนเงินตั้งแต่ 0 บาท (ทศนิยมไม่เกิน 2 ตำแหน่ง)' }, { status: 400 });
    }
    return await prisma.$transaction(async tx => {
      const employee = await tx.employee.findUnique({ where: { id: employeeId }, select: { id: true } });
      if (!employee) return NextResponse.json({ error: 'ไม่พบพนักงาน' }, { status: 404 });
      const duplicate = await tx.salaryIncentiveHistory.findUnique({ where: { employeeId_startDate: { employeeId, startDate } }, select: { id: true } });
      if (duplicate) return NextResponse.json({ error: 'มีรายการเงินเดือนสำหรับวันเริ่มต้นนี้แล้ว กรุณาเลือกวันอื่น' }, { status: 409 });
      const previous = await tx.salaryIncentiveHistory.findFirst({ where: { employeeId, startDate: { lt: startDate } }, orderBy: { startDate: 'desc' } });
      const next = await tx.salaryIncentiveHistory.findFirst({ where: { employeeId, startDate: { gt: startDate } }, orderBy: { startDate: 'asc' } });
      const saved = await tx.salaryIncentiveHistory.create({ data: {
        employeeId, salaryCents, fullIncentiveCents, startDate, endDate: next ? previousSalaryDay(next.startDate) : null,
      } });
      if (previous) await tx.salaryIncentiveHistory.update({ where: { id: previous.id }, data: { endDate: previousSalaryDay(startDate) } });
      const latest = await tx.salaryIncentiveHistory.findFirstOrThrow({ where: { employeeId }, orderBy: { startDate: 'desc' } });
      await tx.employee.update({ where: { id: employeeId }, data: { monthlySalaryCents: latest.salaryCents, fullIncentiveCents: latest.fullIncentiveCents } });
      return NextResponse.json({ id: saved.id, employeeId, salary: saved.salaryCents! / 100, fullIncentive: saved.fullIncentiveCents / 100,
        startDate: saved.startDate.toISOString().slice(0, 10), endDate: saved.endDate?.toISOString().slice(0, 10) ?? null,
      }, { status: 201 });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) {
      return NextResponse.json({ error: 'รายการถูกเปลี่ยนแปลงแล้ว กรุณาโหลดใหม่และลองอีกครั้ง' }, { status: 409 });
    }
    console.error('Failed to save salary history:', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึกประวัติเงินเดือนได้' }, { status: 500 });
  }
}
