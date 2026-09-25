import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getSessionCookieName,
  verifySessionToken,
} from '@/lib/auth';

export async function GET(request: Request): Promise<NextResponse> {
  const token = request.headers.get('cookie')
    ?.split(';')
    .map(value => value.trim())
    .find(value => value.startsWith(`${getSessionCookieName()}=`))
    ?.split('=')[1];
  const session = token ? verifySessionToken(token) : null;

  if (!session) return NextResponse.json({ user: null }, { status: 401 });

  const employee = await prisma.employee.findUnique({
    where: { id: session.employeeId },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!employee) return NextResponse.json({ user: null }, { status: 401 });

  return NextResponse.json({ user: employee });
}
