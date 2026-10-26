import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireFinanceAdmin } from '@/lib/finance-access';
import { employeeTaxReport } from '@/lib/employee-tax-data';
import { parseTaxYear } from '@/lib/employee-tax-summary';

export async function GET(request: Request) {
  try {
    const user = await requireFinanceAdmin(request);
    if (user instanceof NextResponse) return user;
    const year = parseTaxYear(new URL(request.url).searchParams.get('year'));
    if (year === null) return NextResponse.json({ error: 'กรุณาระบุปี ค.ศ. 2000–9998' }, { status: 400 });
    return NextResponse.json(await employeeTaxReport(prisma, year), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Employee tax summary failed:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลดสรุปภาษีพนักงานได้' }, { status: 500 });
  }
}
