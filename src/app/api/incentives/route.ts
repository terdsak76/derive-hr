import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireFinanceAdmin } from '@/lib/finance-access';
import { parseFinanceMonth } from '@/lib/finance';
import { calculateIncentiveCents } from '@/lib/incentives';
import { syncIncentivePaymentStatuses } from '@/lib/incentive-payment-status';

export async function GET(request: Request) {
  try {
    const user = await requireFinanceAdmin(request);
    if (user instanceof NextResponse) return user;
    const month = parseFinanceMonth(new URL(request.url).searchParams.get('month'));
    if (!month) return NextResponse.json({ error: 'Invalid month. Use YYYY-MM.' }, { status: 400 });
    const employees = await prisma.employee.findMany({
      where: { createdAt: { lt: month.end } },
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, department: true, fullIncentiveCents: true,
        incentives: { where: { month: month.key }, select: { score: true, amountCents: true, status: true, paymentDate: true, approvedAt: true } },
      },
    });
    return NextResponse.json(employees.map(({ incentives, fullIncentiveCents, ...employee }) => ({
      ...employee, month: month.key, fullIncentive: fullIncentiveCents / 100,
      score: incentives[0]?.score ?? null,
      amount: incentives[0] ? incentives[0].amountCents / 100 : null,
      status: incentives[0]?.status ?? null,
      paymentDate: incentives[0]?.paymentDate ?? null,
      approvedAt: incentives[0]?.approvedAt ?? null,
    })));
  } catch (error) {
    console.error('Failed to load incentives:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลด Incentive ได้' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireFinanceAdmin(request);
    if (user instanceof NextResponse) return user;
    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid incentive.' }, { status: 400 });
    }
    const { employee_id, month: monthValue, score } = body as Record<string, unknown>;
    const month = parseFinanceMonth(monthValue);
    if (!month || typeof employee_id !== 'string' || !employee_id.trim()
      || typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 100) {
      return NextResponse.json({ error: 'กรุณาระบุเดือนและคะแนน 0–100' }, { status: 400 });
    }
    return await prisma.$transaction(async tx => {
      const employee = await tx.employee.findUnique({ where: { id: employee_id.trim() }, select: { id: true, createdAt: true, fullIncentiveCents: true } });
      if (!employee) return NextResponse.json({ error: 'ไม่พบพนักงาน' }, { status: 404 });
      if (employee.createdAt >= month.end) return NextResponse.json({ error: 'พนักงานยังไม่เริ่มงานในเดือนที่เลือก' }, { status: 400 });
      const data = { score, amountCents: calculateIncentiveCents(employee.fullIncentiveCents, score) };
      const previous = await tx.incentive.findUnique({ where: { employeeId_month: { employeeId: employee.id, month: month.key } } });
      const changed = previous && (previous.score !== data.score || previous.amountCents !== data.amountCents);
      if (changed) {
        const matched = await tx.kbizEmployeeAllocation.count({ where: { employeeId: employee.id, paymentMonth: month.key, paymentType: 'INCENTIVE' } });
        if (matched || previous.status === 'COMPLETED') return NextResponse.json({ error: 'กรุณายกเลิกการจับคู่ Kbiz ก่อนแก้ไข Incentive ที่มีการจ่ายเงินแล้ว' }, { status: 409 });
      }
      const saved = await tx.incentive.upsert({
        where: { employeeId_month: { employeeId: employee.id, month: month.key } },
        create: { employeeId: employee.id, month: month.key, ...data },
        update: { ...data, ...(changed ? { status: 'INITIAL', paymentDate: null, approvedById: null, approvedAt: null } : {}) },
      });
      return NextResponse.json({ employee_id: saved.employeeId, month: saved.month, score: saved.score, amount: saved.amountCents / 100, fullIncentive: employee.fullIncentiveCents / 100,
        status: saved.status, paymentDate: saved.paymentDate, approvedAt: saved.approvedAt });
    });
  } catch (error) {
    console.error('Failed to save incentive:', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึก Incentive ได้ กรุณาลองอีกครั้ง' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireFinanceAdmin(request);
    if (user instanceof NextResponse) return user;
    const body = await request.json().catch(() => null);
    const month = parseFinanceMonth(body?.month);
    if (!month || typeof body?.employee_id !== 'string' || !body.employee_id.trim() || body.action !== 'APPROVE' ||
        typeof body.score !== 'number' || !Number.isFinite(body.score) || body.score < 0 || body.score > 100 ||
        !Number.isSafeInteger(body.amountCents) || body.amountCents < 0) {
      return NextResponse.json({ error: 'กรุณาเลือก Incentive ที่บันทึกแล้วเพื่ออนุมัติ' }, { status: 400 });
    }
    return await prisma.$transaction(async tx => {
      const key = { employeeId: body.employee_id.trim(), month: month.key };
      // Approve only the saved score and amount the admin actually reviewed.
      const result = await tx.incentive.updateMany({ where: { ...key, status: 'INITIAL', score: body.score, amountCents: body.amountCents }, data: {
        status: 'PAYMENT_PENDING', approvedById: user.id, approvedAt: new Date(),
      } });
      if (!result.count) return NextResponse.json({ error: 'Incentive เปลี่ยนแปลง อนุมัติแล้ว หรือไม่พบรายการ กรุณารีเฟรชก่อนอนุมัติ' }, { status: 409 });
      await syncIncentivePaymentStatuses(tx, [key]);
      const saved = await tx.incentive.findUniqueOrThrow({ where: { employeeId_month: key } });
      return NextResponse.json({ employee_id: saved.employeeId, month: saved.month, status: saved.status,
        paymentDate: saved.paymentDate, approvedAt: saved.approvedAt });
    });
  } catch (error) {
    console.error('Failed to approve incentive:', error);
    return NextResponse.json({ error: 'ไม่สามารถอนุมัติ Incentive ได้ กรุณาลองอีกครั้ง' }, { status: 500 });
  }
}
