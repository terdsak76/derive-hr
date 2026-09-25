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

function serializeRequest(item) {
  return {
    id: item.id,
    employee_id: item.employeeId,
    employee_name: item.employee?.name || '',
    from_date: item.fromDate.toISOString().split('T')[0],
    to_date: item.toDate.toISOString().split('T')[0],
    project: item.project,
    job_detail: item.jobDetail,
    status: item.status,
    created_at: item.createdAt.toISOString().split('T')[0],
  };
}

export async function GET(request: Request): Promise<NextResponse> {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const requests = await prisma.workdayChangeRequest.findMany({
    where: session.role === 'ADMIN' ? undefined : { employeeId: session.employeeId },
    include: { employee: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(requests.map(serializeRequest));
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  if (!body.from_date || !body.to_date || !body.project || !body.job_detail) {
    return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 });
  }

  try {
    const created = await prisma.workdayChangeRequest.create({
      data: {
        employeeId: session.employeeId,
        fromDate: new Date(body.from_date),
        toDate: new Date(body.to_date),
        project: String(body.project).trim(),
        jobDetail: String(body.job_detail).trim(),
      },
      include: { employee: { select: { name: true } } },
    });

  return NextResponse.json(serializeRequest(created), { status: 201 });
  } catch (error) {
    console.error('Failed to create workday change request:', error);
    return NextResponse.json(
      { error: 'ไม่สามารถบันทึกคำขอได้ กรุณาตรวจสอบว่าได้อัปเดตฐานข้อมูลแล้ว' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const session = getSession(request);
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'เฉพาะ Admin เท่านั้นที่อนุมัติคำขอได้' }, { status: 403 });
  }

  const body = await request.json();
  if (!body.id || !['APPROVED', 'REJECTED'].includes(body.status)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const updated = await prisma.workdayChangeRequest.update({
    where: { id: body.id },
    data: {
      status: body.status,
      approvedById: session.employeeId,
      approvedAt: new Date(),
    },
    include: { employee: { select: { name: true } } },
  });

  return NextResponse.json(serializeRequest(updated));
}
