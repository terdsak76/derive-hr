import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionCookieName, verifySessionToken } from '@/lib/auth';

function getSession(request: Request) {
  const token = request.headers.get('cookie')
    ?.split(';')
    .map(value => value.trim())
    .find(value => value.startsWith(`${getSessionCookieName()}=`))
    ?.split('=')[1];
  return token ? verifySessionToken(token) : null;
}

function isAdminRole(role: string): boolean {
  return ['ADMIN', 'ROLE_ADMIN'].includes(role.trim().toUpperCase());
}

async function requireAdmin(request: Request) {
  const session = getSession(request);
  if (!session) return null;

  const user = await prisma.employee.findUnique({
    where: { id: session.employeeId },
    select: { role: true },
  });
  return user && isAdminRole(user.role) ? user : null;
}

function parseSelectedMonth(value: string | null) {
  const match = /^(\d{4})-(\d{2})$/.exec(value || '');
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

function parseDate(value: unknown): Date | null {
  const text = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00.000+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatBangkokDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {} as Record<string, string>);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function serializeInvoice(invoice: {
  id: string;
  installment: string;
  invoiceDate: Date;
  billingDescription: string;
  amount: number;
  invoiceNumber: string;
  project: { name: string; budget: number; clientName: string; address: string; taxId: string };
}) {
  return {
    id: invoice.id,
    installment: invoice.installment,
    invoice_date: formatBangkokDate(invoice.invoiceDate),
    billing_description: invoice.billingDescription,
    amount: invoice.amount,
    invoice_number: invoice.invoiceNumber,
    project_name: invoice.project.name,
    project_budget: invoice.project.budget,
    client_name: invoice.project.clientName,
    address: invoice.project.address,
    tax_id: invoice.project.taxId,
  };
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const selectedMonth = parseSelectedMonth(new URL(request.url).searchParams.get('month'));
    if (!selectedMonth) return NextResponse.json({ error: 'Invalid month. Use YYYY-MM.' }, { status: 400 });

    const monthStart = new Date(`${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}-01T00:00:00.000+07:00`);
    const nextMonth = selectedMonth.month === 12
      ? `${selectedMonth.year + 1}-01`
      : `${selectedMonth.year}-${String(selectedMonth.month + 1).padStart(2, '0')}`;
    const monthEnd = new Date(`${nextMonth}-01T00:00:00.000+07:00`);
    const invoices = await prisma.projectInvoice.findMany({
      where: { invoiceDate: { gte: monthStart, lt: monthEnd } },
      orderBy: [{ invoiceDate: 'asc' }, { createdAt: 'asc' }],
      include: { project: { select: { name: true, budget: true, clientName: true, address: true, taxId: true } } },
    });
    return NextResponse.json(invoices.map(serializeInvoice));
  } catch (error) {
    console.error('Failed to load project invoices:', error);
    return NextResponse.json({ error: 'Unable to load project invoices' }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const projectId = String(body.project_id || '').trim();
    const installment = String(body.installment || '').trim();
    const billingDescription = String(body.billing_description || '').trim();
    const invoiceDate = parseDate(body.invoice_date);
    const amount = Number(body.amount);
    if (!projectId || !installment || !billingDescription || !invoiceDate || !Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: 'กรุณากรอกโครงการ งวดงาน วันที่ รายละเอียด และจำนวนเงินให้ครบถ้วน' }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true, budget: true, clientName: true, address: true, taxId: true },
    });
    if (!project) return NextResponse.json({ error: 'ไม่พบโครงการที่เลือก' }, { status: 404 });

    const year = Number(String(body.invoice_date).slice(0, 4));
    const invoiceNumber = `P-INV-${year}-${Date.now().toString(36).toUpperCase()}`;
    const invoice = await prisma.projectInvoice.create({
      data: { projectId, installment, invoiceDate, billingDescription, amount, invoiceNumber },
      include: { project: { select: { name: true, budget: true, clientName: true, address: true, taxId: true } } },
    });
    return NextResponse.json(serializeInvoice(invoice), { status: 201 });
  } catch (error) {
    console.error('Failed to create project invoice:', error);
    return NextResponse.json({ error: 'Unable to create project invoice' }, { status: 500 });
  }
}
