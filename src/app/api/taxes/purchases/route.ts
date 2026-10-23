import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireFinanceAdmin } from '@/lib/finance-access';
import { parseFinanceMonth } from '@/lib/finance';
import { parseTaxDate, validTaxAmount, vatAmounts } from '@/lib/taxes';

export async function POST(request: Request) {
  try {
    const user = await requireFinanceAdmin(request);
    if (user instanceof NextResponse) return user;
    const body = await request.json().catch(() => null);
    const month = parseFinanceMonth(body?.month);
    const date = parseTaxDate(body?.purchase_date);
    if (!month || !date || date >= month.end || !validTaxAmount(body?.amount)
      || typeof body?.supplier !== 'string' || !body.supplier.trim() || body.supplier.length > 254
      || typeof body?.invoice_number !== 'string' || !body.invoice_number.trim() || body.invoice_number.length > 100
      || typeof body?.description !== 'string' || !body.description.trim() || body.description.length > 5000
      || typeof body?.creditable !== 'boolean' || typeof body?.expense !== 'boolean'
      || !['exclusive', 'inclusive', 'none'].includes(body?.vat_mode) || (body?.vat_mode === 'none' && body?.creditable)
      || (body.id !== undefined && (typeof body.id !== 'string' || !body.id))) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลใบกำกับภาษี เดือน วันที่ และจำนวนเงินให้ถูกต้อง' }, { status: 400 });
    }
    const data = { month: month.key, purchaseDate: date, supplier: body.supplier.trim(), invoiceNumber: body.invoice_number.trim(),
      description: body.description.trim(), creditable: body.creditable, expense: body.expense, vatMode: body.vat_mode as string,
      ...vatAmounts(body.amount, body.vat_mode === 'inclusive'),
      ...(body.vat_mode === 'none' ? { vatCents: 0 } : {}) };
    const saved = body.id
      ? await prisma.vatPurchase.update({ where: { id: body.id }, data })
      : await prisma.vatPurchase.create({ data });
    return NextResponse.json({ id: saved.id });
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
    if (code === 'P2002') return NextResponse.json({ error: 'บันทึกใบกำกับภาษีของผู้ขายเลขที่นี้แล้ว กรุณาแก้ไขรายการเดิม' }, { status: 409 });
    if (code === 'P2025') return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 });
    console.error('Failed to save VAT purchase:', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึกรายการซื้อได้' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireFinanceAdmin(request);
    if (user instanceof NextResponse) return user;
    const body = await request.json().catch(() => null);
    if (typeof body?.id !== 'string' || !body.id) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    await prisma.vatPurchase.delete({ where: { id: body.id } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 });
    return NextResponse.json({ error: 'ไม่สามารถลบรายการได้' }, { status: 500 });
  }
}
