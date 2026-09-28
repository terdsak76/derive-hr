import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionCookieName, hashPassword, verifySessionToken } from '@/lib/auth';

function getSession(request: Request) {
  const token = request.headers.get('cookie')
    ?.split(';')
    .map(value => value.trim())
    .find(value => value.startsWith(`${getSessionCookieName()}=`))
    ?.split('=')[1];

  return token ? verifySessionToken(token) : null;
}

export async function GET(request: Request): Promise<NextResponse> {
  const session = getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const employees = await prisma.employee.findMany({
    where: session.role.toUpperCase() === 'ADMIN'
      ? undefined
      : { id: session.employeeId },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      department: true,
      position: true,
      email: true,
      role: true,
    },
  });

  return NextResponse.json(employees);
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const session = getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const employeeId = String(body.id || '');
  const isAdmin = session.role.toUpperCase() === 'ADMIN';

  if (!employeeId || (!isAdmin && employeeId !== session.employeeId)) {
    return NextResponse.json(
      { error: 'You are not allowed to edit this account' },
      { status: 403 },
    );
  }

  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!email || !password) {
    return NextResponse.json(
      { error: 'Email and password are required' },
      { status: 400 },
    );
  }

  try {
    const employee = await prisma.employee.update({
      where: { id: employeeId },
      data: {
        email,
        passwordHash: hashPassword(password),
      },
      select: {
        id: true,
        name: true,
        department: true,
        position: true,
        email: true,
        role: true,
      },
    });

    return NextResponse.json(employee);
  } catch (error) {
    console.error('Failed to update employee account:', error);
    return NextResponse.json(
      { error: 'Email may already be in use' },
      { status: 400 },
    );
  }
}
