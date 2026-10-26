import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireFinanceAdmin } from '@/lib/finance-access';
import { parseFinanceMonth } from '@/lib/finance';
import { calculateBonusCents, parseBonusYear } from '@/lib/bonuses';
import { bonusEmployees } from '@/lib/bonus-data';
import { syncBonusPaymentStatuses } from '@/lib/bonus-payment-status';

class BonusError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
function errorResponse(error: unknown) {
  if (error instanceof BonusError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error('Bonus calculation failed:', error);
  return NextResponse.json({ error: 'ไม่สามารถโหลดหรือบันทึก Bonus ได้ กรุณาตรวจสอบฐานข้อมูล' }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const user = await requireFinanceAdmin(request);
    if (user instanceof NextResponse) return user;
    const year = parseBonusYear(new URL(request.url).searchParams.get('year'));
    if (year === null) throw new BonusError('กรุณาระบุปี ค.ศ. 2000–9998');
    const [settings, employees] = await Promise.all([
      prisma.bonusYear.findUnique({ where: { year } }), bonusEmployees(prisma, year),
    ]);
    return NextResponse.json({ year, maxLeaveDays: settings?.maxLeaveDays ?? 0, expenseMonth: settings?.expenseMonth ?? `${year}-12`, employees },
      { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}

export async function PUT(request: Request) {
  try {
    const user = await requireFinanceAdmin(request);
    if (user instanceof NextResponse) return user;
    const body = await request.json().catch(() => null);
    const year = parseBonusYear(body?.year);
    if (year === null || typeof body.maxLeaveDays !== 'number' || !Number.isFinite(body.maxLeaveDays) ||
        body.maxLeaveDays < 0 || body.maxLeaveDays > 366 || !parseFinanceMonth(body.expenseMonth) ||
        !Array.isArray(body.scores) || body.scores.length > 2000) throw new BonusError('กรุณาระบุปี วันลาที่ไม่หักโบนัส (0–366) เดือนรายจ่าย และคะแนนให้ถูกต้อง');
    const scores = new Map<string, number>();
    for (const item of body.scores) {
      if (!item || typeof item.employeeId !== 'string' || !item.employeeId.trim() || scores.has(item.employeeId) ||
          typeof item.score !== 'number' || !Number.isFinite(item.score) || item.score < 0 || item.score > 200 ||
          Math.abs(item.score * 100 - Math.round(item.score * 100)) > 0.000001) throw new BonusError('คะแนนต้องเป็น 0–200% ทศนิยมไม่เกิน 2 ตำแหน่ง และพนักงานต้องไม่ซ้ำกัน');
      scores.set(item.employeeId, item.score);
    }
    const count = await prisma.$transaction(async tx => {
      const settings = await tx.bonusYear.findUnique({ where: { year } });
      if (settings && settings.expenseMonth !== body.expenseMonth && await tx.bonus.count({ where: { year, status: { not: 'INITIAL' } } })) {
        throw new BonusError('ไม่สามารถเปลี่ยนเดือนรายจ่ายของปีที่มี Bonus อนุมัติแล้ว', 409);
      }
      const employees = await bonusEmployees(tx, year);
      const eligible = new Set(employees.map(employee => employee.id));
      if (Array.from(scores.keys()).some(id => !eligible.has(id))) throw new BonusError('ไม่พบพนักงาน หรือเป็นเจ้าของกิจการซึ่งไม่รวมในการคำนวณ Bonus');
      const calculations = employees.flatMap(employee => {
        if (employee.saved && employee.saved.status !== 'INITIAL') {
          if (scores.has(employee.id) && scores.get(employee.id) !== employee.saved.score) throw new BonusError(`Bonus ของ ${employee.name} อนุมัติแล้ว ไม่สามารถแก้ไขคะแนนได้`, 409);
          return [];
        }
        const score = scores.get(employee.id) ?? employee.saved?.score;
        if (score === undefined) return [];
        if (employee.salaryCents === null) throw new BonusError(`กรุณาตั้งค่าเงินเดือนของ ${employee.name} ก่อนคำนวณ Bonus`);
        const calculation = calculateBonusCents(employee.salaryCents, score, employee.leaveDays, body.maxLeaveDays);
        if ([calculation.baseCents, calculation.deductionCents, calculation.amountCents].some(value => !Number.isSafeInteger(value) || value > 2147483647)) {
          throw new BonusError(`ยอด Bonus ของ ${employee.name} เกินขอบเขตจำนวนเงินที่รองรับ`);
        }
        return [{ employeeId: employee.id, year, score, salaryCents: employee.salaryCents, leaveDays: employee.leaveDays,
          maxLeaveDays: body.maxLeaveDays, baseCents: calculation.baseCents, deductionCents: calculation.deductionCents, amountCents: calculation.amountCents }];
      });
      await tx.bonusYear.upsert({ where: { year }, create: { year, maxLeaveDays: body.maxLeaveDays, expenseMonth: body.expenseMonth, updatedById: user.id },
        update: { maxLeaveDays: body.maxLeaveDays, expenseMonth: body.expenseMonth, updatedById: user.id } });
      for (const data of calculations) await tx.bonus.upsert({ where: { employeeId_year: { employeeId: data.employeeId, year } }, create: data, update: data });
      return calculations.length;
    }, { timeout: 60000 });
    return NextResponse.json({ saved: count });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireFinanceAdmin(request);
    if (user instanceof NextResponse) return user;
    const body = await request.json().catch(() => null);
    if (typeof body?.id !== 'string' || !body.id.trim() || body.action !== 'APPROVE' ||
        typeof body.updatedAt !== 'string' || !Number.isFinite(new Date(body.updatedAt).getTime())) throw new BonusError('กรุณาเลือก Bonus ที่บันทึกแล้วเพื่ออนุมัติ');
    const saved = await prisma.$transaction(async tx => {
      const result = await tx.bonus.updateMany({ where: { id: body.id, status: 'INITIAL', updatedAt: new Date(body.updatedAt), employee: { isOwner: false } },
        data: { status: 'PAYMENT_PENDING', approvedById: user.id, approvedAt: new Date() } });
      if (!result.count) throw new BonusError('Bonus เปลี่ยนแปลง อนุมัติแล้ว หรือไม่พบรายการ กรุณารีเฟรชก่อนอนุมัติ', 409);
      await syncBonusPaymentStatuses(tx, [body.id]);
      return tx.bonus.findUniqueOrThrow({ where: { id: body.id }, select: { id: true, status: true, paymentDate: true, approvedAt: true, updatedAt: true } });
    });
    return NextResponse.json(saved);
  } catch (error) { return errorResponse(error); }
}
