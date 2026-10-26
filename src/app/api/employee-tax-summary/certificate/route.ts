import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireFinanceAdmin } from '@/lib/finance-access';
import { parseTaxYear, validCertificateAmounts } from '@/lib/employee-tax-summary';
import { renderWithholdingCertificate } from '@/lib/withholding-certificate';

// POST keeps reviewed personal income amounts out of URLs and browser history.
export async function POST(request: Request) {
  try {
    const user = await requireFinanceAdmin(request);
    if (user instanceof NextResponse) return user;
    const body = await request.json().catch(() => null);
    const year = parseTaxYear(body?.year);
    if (year === null || typeof body?.employeeId !== 'string' || body.confirmed !== true || !validCertificateAmounts(body.amounts)) {
      return NextResponse.json({ error: 'กรุณาตรวจสอบและยืนยันยอดจ่ายจริงและเงิน ปกส. ก่อนพิมพ์' }, { status: 400 });
    }
    const employee = await prisma.employee.findUnique({ where: { id: body.employeeId }, select: { name: true, taxId: true, address: true } });
    if (!employee) return NextResponse.json({ error: 'ไม่พบพนักงาน' }, { status: 404 });
    if (!/^\d{13}$/.test(employee.taxId) || !employee.address.trim()) return NextResponse.json({ error: 'กรุณาเพิ่มเลขผู้เสียภาษี 13 หลักและที่อยู่พนักงานก่อนพิมพ์' }, { status: 400 });
    return new Response(renderWithholdingCertificate({ year, employee, amounts: body.amounts }), { headers: {
      'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
    } });
  } catch (error) {
    console.error('Employee certificate failed:', error);
    return NextResponse.json({ error: 'ไม่สามารถสร้างหนังสือรับรองได้' }, { status: 500 });
  }
}
