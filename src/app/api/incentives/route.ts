import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireFinanceAdmin } from '@/lib/finance-access';
import { parseFinanceMonth } from '@/lib/finance';
import { calculateIncentiveCents } from '@/lib/incentives';

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
        incentives: { where: { month: month.key }, select: { score: true, amountCents: true } },
      },
    });
    return NextResponse.json(employees.map(({ incentives, fullIncentiveCents, ...employee }) => ({
      ...employee, month: month.key, fullIncentive: fullIncentiveCents / 100,
      score: incentives[0]?.score ?? null,
      amount: incentives[0] ? incentives[0].amountCents / 100 : null,
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
      const saved = await tx.incentive.upsert({
        where: { employeeId_month: { employeeId: employee.id, month: month.key } },
        create: { employeeId: employee.id, month: month.key, ...data },
        update: data,
      });
      return NextResponse.json({ employee_id: saved.employeeId, month: saved.month, score: saved.score, amount: saved.amountCents / 100, fullIncentive: employee.fullIncentiveCents / 100 });
    });
  } catch (error) {
    console.error('Failed to save incentive:', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึก Incentive ได้ กรุณาลองอีกครั้ง' }, { status: 500 });
  }
}
