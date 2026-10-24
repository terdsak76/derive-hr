import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireFinanceAdmin } from '@/lib/finance-access';
import { parseVendorPayment, vendorPaymentAmounts } from '@/lib/vendor-payments';
import { syncVendorPaymentStatuses } from '@/lib/vendor-payment-status';

export async function GET(request: Request) {
  try {
    const user = await requireFinanceAdmin(request);
    if (user instanceof NextResponse) return user;
    const payments = await prisma.vendorPayment.findMany({ orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }], include: {
      allocations: { select: { transactionId: true, amountCents: true, transaction: { select: { transactionDate: true, accountNumber: true, details: true } } } },
    } });
    return NextResponse.json(payments.map(payment => ({ ...payment, ...vendorPaymentAmounts(payment), allocatedCents: payment.allocations.reduce((sum, item) => sum + item.amountCents, 0) })), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Unable to load vendor payments:', error);
    return NextResponse.json({ error: 'Unable to load vendor payments' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireFinanceAdmin(request);
    if (user instanceof NextResponse) return user;
    const data = parseVendorPayment(await request.json().catch(() => null));
    if (!data) return NextResponse.json({ error: 'Enter vendor name, Tax ID, date and a positive payment amount with at most two decimal places' }, { status: 400 });
    const payment = await prisma.vendorPayment.create({ data: { ...data, updatedById: user.id,
      paymentNumber: `VP-${data.paymentDate.slice(0, 4)}-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`,
    } });
    return NextResponse.json({ ...payment, ...vendorPaymentAmounts(payment), allocatedCents: 0 }, { status: 201 });
  } catch (error) {
    console.error('Unable to create vendor payment:', error);
    return NextResponse.json({ error: 'Unable to create vendor payment' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireFinanceAdmin(request);
    if (user instanceof NextResponse) return user;
    const body = await request.json().catch(() => null);
    if (typeof body?.id !== 'string' || !['PRINT', 'UPDATE'].includes(body.action)) return NextResponse.json({ error: 'Invalid payment action' }, { status: 400 });
    const data = body.action === 'UPDATE' ? parseVendorPayment(body) : null;
    if (body.action === 'UPDATE' && !data) return NextResponse.json({ error: 'Invalid vendor payment details' }, { status: 400 });
    return await prisma.$transaction(async tx => {
      const current = await tx.vendorPayment.findUnique({ where: { id: body.id } });
      if (!current) return NextResponse.json({ error: 'Vendor payment not found' }, { status: 404 });
      if (body.action === 'UPDATE' && current.status !== 'INITIAL') return NextResponse.json({ error: 'Printed vendor payments cannot be edited' }, { status: 409 });
      if (body.action === 'PRINT') {
        if (current.status === 'INITIAL') await tx.vendorPayment.update({ where: { id: current.id }, data: { status: 'PRINTED', printedAt: new Date(), updatedById: user.id } });
        await syncVendorPaymentStatuses(tx, [current.id]);
      } else await tx.vendorPayment.update({ where: { id: current.id }, data: { ...data, updatedById: user.id } });
      const payment = await tx.vendorPayment.findUniqueOrThrow({ where: { id: current.id }, include: { allocations: { select: { amountCents: true } } } });
      return NextResponse.json({ ...payment, ...vendorPaymentAmounts(payment), allocatedCents: payment.allocations.reduce((sum, item) => sum + item.amountCents, 0) });
    });
  } catch (error) {
    console.error('Unable to update vendor payment:', error);
    return NextResponse.json({ error: 'Unable to update vendor payment' }, { status: 500 });
  }
}
