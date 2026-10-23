import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireFinanceAdmin } from '@/lib/finance-access';
import { isInvoiceScheduled, parseFinanceMonth } from '@/lib/finance';
import { parseTaxDate, validTaxAmount, vatAmounts } from '@/lib/taxes';

export async function POST(request: Request) {
  try {
    const user = await requireFinanceAdmin(request);
    if (user instanceof NextResponse) return user;
    const body = await request.json().catch(() => null);
    const taxDate = parseTaxDate(body?.tax_date);
    if (!taxDate || !parseFinanceMonth(body?.tax_date?.slice(0, 7))) return NextResponse.json({ error: 'วันที่เกิดภาษีไม่ถูกต้อง' }, { status: 400 });
    // Date corrections retain the original invoice amount and VAT snapshot.
    if (body?.id !== undefined) {
      if (typeof body.id !== 'string' || !body.id) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
      const saved = await prisma.vatSale.update({ where: { id: body.id }, data: { taxDate } });
      return NextResponse.json({ id: saved.id });
    }
    const month = parseFinanceMonth(body?.invoice_month);
    if (!month || !['RECURRING', 'PROJECT'].includes(body?.source_type) || typeof body?.source_id !== 'string') {
      return NextResponse.json({ error: 'กรุณาเลือก Invoice' }, { status: 400 });
    }
    const sourceType = body.source_type as string;
    const sourceId = body.source_id as string;
    let customer: string, description: string, amount: number, number = '';
    const referenceKey = sourceType === 'RECURRING' ? `recurring:${sourceId}:${month.key}` : `project:${sourceId}`;
    if (sourceType === 'RECURRING') {
      const invoice = await prisma.invoiceSchedule.findUnique({ where: { id: sourceId } });
      if (!invoice || !isInvoiceScheduled(invoice.period, invoice.issueMonth, month.month)) return NextResponse.json({ error: 'ไม่พบ Invoice ในรอบบิลนี้' }, { status: 404 });
      customer = invoice.name; description = invoice.description; amount = invoice.amount;
    } else {
      const invoice = await prisma.projectInvoice.findUnique({ where: { id: sourceId }, include: { project: true } });
      if (!invoice || invoice.invoiceDate < month.start || invoice.invoiceDate >= month.end) return NextResponse.json({ error: 'ไม่พบ Invoice ในเดือนนี้' }, { status: 404 });
      customer = invoice.project.clientName; description = invoice.billingDescription; amount = invoice.amount; number = invoice.invoiceNumber;
    }
    if (!validTaxAmount(amount)) return NextResponse.json({ error: 'ยอด Invoice ไม่ถูกต้อง' }, { status: 400 });
    const issued = await prisma.issuedDocument.findUnique({ where: { documentType_sourceType_referenceKey: { documentType: 'INVOICE', sourceType, referenceKey } } });
    const saved = await prisma.vatSale.create({ data: {
      referenceKey, sourceType, sourceId, invoiceMonth: month.key, invoiceNumber: issued?.documentNumber || number || `${month.key} / ${sourceId}`,
      customer, description, taxDate, ...vatAmounts(amount),
    } });
    return NextResponse.json({ id: saved.id });
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
    if (code === 'P2002') return NextResponse.json({ error: 'Invoice นี้บันทึกภาษีขายแล้ว กรุณาแก้ไขรายการเดิม' }, { status: 409 });
    if (code === 'P2025') return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 });
    console.error('Failed to save sales VAT:', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึกภาษีขายได้' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireFinanceAdmin(request);
    if (user instanceof NextResponse) return user;
    const body = await request.json().catch(() => null);
    if (typeof body?.id !== 'string' || !body.id) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    await prisma.vatSale.delete({ where: { id: body.id } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 });
    return NextResponse.json({ error: 'ไม่สามารถลบรายการได้' }, { status: 500 });
  }
}
