import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionCookieName, verifySessionToken } from '@/lib/auth';

const DOCUMENT_TYPES = new Set(['INVOICE', 'RECEIPT']);
const SOURCE_TYPES = new Set(['RECURRING', 'PROJECT']);

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

function parseRequest(value: string | null) {
  const text = String(value || '').trim().toUpperCase();
  return text && (DOCUMENT_TYPES.has(text) || SOURCE_TYPES.has(text)) ? text : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getSequence(number: string, prefix: string, year: number): number | null {
  const match = new RegExp(`^${escapeRegExp(prefix)}-${year}[-/](\\d+)$`, 'i').exec(number);
  return match ? Number(match[1]) : null;
}

function getDefaultNumber(prefix: string, year: number, sequence: number): string {
  const separator = prefix === 'REC' ? '/' : '-';
  return `${prefix}-${year}${separator}${String(sequence).padStart(3, '0')}`;
}

async function isNumberUsed(documentNumber: string, documentType: string, sourceType: string, sourceId?: string) {
  const issued = await prisma.issuedDocument.findUnique({ where: { documentNumber } });
  if (issued) return true;

  const projectInvoice = await prisma.projectInvoice.findFirst({
    where: {
      invoiceNumber: documentNumber,
      ...(sourceType === 'PROJECT' && sourceId ? { id: { not: sourceId } } : {}),
    },
    select: { id: true },
  });
  if (projectInvoice) return true;

  return false;
}

async function getNextNumber(documentType: string, sourceType: string, prefix: string, year: number): Promise<string> {
  const issuedDocuments = await prisma.issuedDocument.findMany({
    where: { documentType, sourceType },
    select: { documentNumber: true },
  });
  const projectInvoices = documentType === 'INVOICE' && sourceType === 'PROJECT'
    ? await prisma.projectInvoice.findMany({ select: { invoiceNumber: true } })
    : [];
  const usedNumbers = [
    ...issuedDocuments.map(item => item.documentNumber),
    ...projectInvoices.map(item => item.invoiceNumber),
  ];
  const highestSequence = usedNumbers.reduce((highest, number) => {
    const sequence = getSequence(number, prefix, year);
    return sequence === null ? highest : Math.max(highest, sequence);
  }, 0);

  let sequence = highestSequence + 1;
  let candidate = getDefaultNumber(prefix, year, sequence);
  while (await isNumberUsed(candidate, documentType, sourceType)) {
    sequence += 1;
    candidate = getDefaultNumber(prefix, year, sequence);
  }
  return candidate;
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const url = new URL(request.url);
    const documentType = parseRequest(url.searchParams.get('document_type'));
    const sourceType = parseRequest(url.searchParams.get('source_type'));
    const referenceKey = String(url.searchParams.get('reference_key') || '').trim();
    const sourceId = String(url.searchParams.get('source_id') || '').trim();
    const prefix = String(url.searchParams.get('prefix') || '').trim().toUpperCase();
    const year = Number(url.searchParams.get('year'));
    const fallbackNumber = String(url.searchParams.get('fallback_number') || '').trim().toUpperCase();
    if (!documentType || !DOCUMENT_TYPES.has(documentType) || !sourceType || !SOURCE_TYPES.has(sourceType) || !referenceKey || !prefix || !Number.isInteger(year)) {
      return NextResponse.json({ error: 'Invalid document-number request' }, { status: 400 });
    }

    const existing = await prisma.issuedDocument.findUnique({
      where: { documentType_sourceType_referenceKey: { documentType, sourceType, referenceKey } },
      select: { documentNumber: true },
    });
    if (existing) return NextResponse.json({ document_number: existing.documentNumber, issued: true });

    if (fallbackNumber && !(await isNumberUsed(fallbackNumber, documentType, sourceType, sourceId))) {
      return NextResponse.json({ document_number: fallbackNumber, issued: false });
    }

    return NextResponse.json({
      document_number: await getNextNumber(documentType, sourceType, prefix, year),
      issued: false,
    });
  } catch (error) {
    console.error('Failed to load document number:', error);
    return NextResponse.json({ error: 'Unable to load document number' }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const documentType = parseRequest(body.document_type);
    const sourceType = parseRequest(body.source_type);
    const referenceKey = String(body.reference_key || '').trim();
    const documentNumber = String(body.document_number || '').trim().toUpperCase();
    const sourceId = String(body.source_id || '').trim();
    if (!documentType || !DOCUMENT_TYPES.has(documentType) || !sourceType || !SOURCE_TYPES.has(sourceType) || !referenceKey || !documentNumber || documentNumber.length > 100) {
      return NextResponse.json({ error: 'กรุณาระบุเลขที่เอกสารให้ถูกต้อง' }, { status: 400 });
    }

    const existing = await prisma.issuedDocument.findUnique({
      where: { documentType_sourceType_referenceKey: { documentType, sourceType, referenceKey } },
    });
    if (existing) {
      if (existing.documentNumber !== documentNumber) {
        return NextResponse.json({ error: `เอกสารนี้ออกเลขที่ ${existing.documentNumber} ไปแล้ว ไม่สามารถเปลี่ยนเลขที่ได้` }, { status: 409 });
      }
      return NextResponse.json({ document_number: existing.documentNumber, issued: true });
    }

    if (await isNumberUsed(documentNumber, documentType, sourceType, sourceId)) {
      return NextResponse.json({ error: `เลขที่เอกสาร ${documentNumber} ถูกใช้แล้ว กรุณาเลือกเลขใหม่` }, { status: 409 });
    }

    const issued = await prisma.$transaction(async transaction => {
      if (documentType === 'INVOICE' && sourceType === 'PROJECT' && sourceId) {
        await transaction.projectInvoice.update({
          where: { id: sourceId },
          data: { invoiceNumber: documentNumber },
        });
      }
      return transaction.issuedDocument.create({
        data: { documentType, sourceType, referenceKey, documentNumber },
      });
    });
    return NextResponse.json({ document_number: issued.documentNumber, issued: true }, { status: 201 });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'เลขที่เอกสารถูกใช้แล้ว กรุณาเลือกเลขใหม่' }, { status: 409 });
    }
    console.error('Failed to issue document number:', error);
    return NextResponse.json({ error: 'Unable to issue document number' }, { status: 500 });
  }
}
