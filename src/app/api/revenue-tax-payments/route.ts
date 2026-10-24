import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireFinanceAdmin } from '@/lib/finance-access';
import { parseRevenueTaxPayment } from '@/lib/revenue-tax-payments';

export async function GET(request: Request) {
  try {
    const user = await requireFinanceAdmin(request);
    if (user instanceof NextResponse) return user;
    const payments = await prisma.revenueTaxPayment.findMany({ orderBy: [{ paymentMonth: 'desc' }, { createdAt: 'desc' }], include: {
      vendorPayment: { select: { vendorName: true, taxId: true, paymentNumber: true } },
      allocations: { select: { transactionId: true, amountCents: true, transaction: { select: { transactionDate: true, accountNumber: true, details: true } } } },
    } });
    return NextResponse.json(payments.map(payment => ({ ...payment, allocatedCents: payment.allocations.reduce((sum, item) => sum + item.amountCents, 0) })), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { console.error('Unable to load tax payments:', error); return NextResponse.json({ error: 'Unable to load Revenue Department tax payments' }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const user = await requireFinanceAdmin(request);
    if (user instanceof NextResponse) return user;
    const data = parseRevenueTaxPayment(await request.json().catch(() => null));
    if (!data) return NextResponse.json({ error: 'Enter a valid payment month and positive amount with at most two decimal places' }, { status: 400 });
    const payment = await prisma.revenueTaxPayment.create({ data: { ...data, updatedById: user.id,
      paymentNumber: `RD-${data.paymentMonth}-${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`,
    } });
    return NextResponse.json({ ...payment, allocatedCents: 0 }, { status: 201 });
  } catch (error) { console.error('Unable to create tax payment:', error); return NextResponse.json({ error: 'Unable to save tax payment' }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireFinanceAdmin(request);
    if (user instanceof NextResponse) return user;
    const body = await request.json().catch(() => null);
    const data = parseRevenueTaxPayment(body);
    if (!data || typeof body?.id !== 'string') return NextResponse.json({ error: 'Invalid payment details' }, { status: 400 });
    return await prisma.$transaction(async tx => {
      const current = await tx.revenueTaxPayment.findUnique({ where: { id: body.id }, include: { _count: { select: { allocations: true } } } });
      if (!current) return NextResponse.json({ error: 'Tax payment not found' }, { status: 404 });
      if (current.vendorPaymentId) return NextResponse.json({ error: 'This withholding payable is calculated from vendor reconciliation and cannot be edited manually' }, { status: 409 });
      if (current._count.allocations) return NextResponse.json({ error: 'Remove the Kbiz matches before editing a tax payment' }, { status: 409 });
      const payment = await tx.revenueTaxPayment.update({ where: { id: current.id }, data: { ...data, updatedById: user.id } });
      return NextResponse.json({ ...payment, allocatedCents: 0 });
    });
  } catch (error) { console.error('Unable to update tax payment:', error); return NextResponse.json({ error: 'Unable to update tax payment' }, { status: 500 }); }
}
