import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireFinanceAdmin } from '@/lib/finance-access';
import { amountToCents, parseFinanceMonth } from '@/lib/finance';

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
        id: true, name: true, department: true,
        incentives: { where: { month: month.key }, select: { score: true, amountCents: true } },
      },
    });
    return NextResponse.json(employees.map(({ incentives, ...employee }) => ({
      ...employee, month: month.key,
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
    const { employee_id, month: monthValue, score, amount } = body as Record<string, unknown>;
    const month = parseFinanceMonth(monthValue);
    if (!month || typeof employee_id !== 'string' || !employee_id.trim()
      || typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 100
      || typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0
      || amountToCents(amount) > 2147483647
      || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001) {
      return NextResponse.json({ error: 'กรุณาระบุเดือน คะแนน 0–100 และจำนวนเงินตั้งแต่ 0 บาท (ทศนิยมไม่เกิน 2 ตำแหน่ง)' }, { status: 400 });
    }
    const employee = await prisma.employee.findUnique({ where: { id: employee_id.trim() }, select: { id: true, createdAt: true } });
    if (!employee) return NextResponse.json({ error: 'ไม่พบพนักงาน' }, { status: 404 });
    if (employee.createdAt >= month.end) return NextResponse.json({ error: 'พนักงานยังไม่เริ่มงานในเดือนที่เลือก' }, { status: 400 });
    const data = { score, amountCents: amountToCents(amount) };
    const saved = await prisma.incentive.upsert({
      where: { employeeId_month: { employeeId: employee.id, month: month.key } },
      create: { employeeId: employee.id, month: month.key, ...data },
      update: data,
    });
    return NextResponse.json({ employee_id: saved.employeeId, month: saved.month, score: saved.score, amount: saved.amountCents / 100 });
  } catch (error) {
    console.error('Failed to save incentive:', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึก Incentive ได้ กรุณาลองอีกครั้ง' }, { status: 500 });
  }
}
