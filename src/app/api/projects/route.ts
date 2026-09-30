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

function serializeProject(project: { id: string; name: string; budget: number; clientName: string; address: string; taxId: string }) {
  return {
    id: project.id,
    name: project.name,
    budget: project.budget,
    client_name: project.clientName,
    address: project.address,
    tax_id: project.taxId,
  };
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const projects = await prisma.project.findMany({
      orderBy: [{ name: 'asc' }, { clientName: 'asc' }],
      select: { id: true, name: true, budget: true, clientName: true, address: true, taxId: true },
    });
    return NextResponse.json(projects.map(serializeProject));
  } catch (error) {
    console.error('Failed to load projects:', error);
    return NextResponse.json({ error: 'Unable to load projects' }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const name = String(body.name || '').trim();
    const budgetText = String(body.budget ?? '').trim();
    const budget = Number(budgetText);
    const clientName = String(body.client_name || '').trim();
    const address = String(body.address || '').trim();
    const taxId = String(body.tax_id || '').trim();
    if (!name || !budgetText || !clientName || !address || !taxId || !Number.isFinite(budget) || budget < 0) {
      return NextResponse.json({ error: 'กรุณากรอกชื่อโครงการ งบประมาณ ชื่อลูกค้า ที่อยู่ และเลขประจำตัวผู้เสียภาษีให้ถูกต้อง' }, { status: 400 });
    }

    const project = await prisma.project.create({
      data: { name, budget, clientName, address, taxId },
      select: { id: true, name: true, budget: true, clientName: true, address: true, taxId: true },
    });
    return NextResponse.json(serializeProject(project), { status: 201 });
  } catch (error) {
    console.error('Failed to create project:', error);
    return NextResponse.json({ error: 'Unable to create project' }, { status: 500 });
  }
}
