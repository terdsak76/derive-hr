import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionCookieName, verifySessionToken } from '@/lib/auth';

export function isEmployeeAdmin(role: string): boolean {
  return ['ADMIN', 'ROLE_ADMIN'].includes(role.trim().toUpperCase());
}

export async function requireEmployeeUser(request: Request) {
  const token = request.headers.get('cookie')
    ?.split(';')
    .map(value => value.trim())
    .find(value => value.startsWith(`${getSessionCookieName()}=`))
    ?.split('=')[1];
  const session = token ? verifySessionToken(token) : null;
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Deleted accounts and changed roles must take effect for existing sessions.
  const user = await prisma.employee.findUnique({
    where: { id: session.employeeId },
    select: { id: true, role: true },
  });
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return user;
}

export async function getEmployeeSession(request: Request) {
  const user = await requireEmployeeUser(request);
  if (user instanceof NextResponse) return null;
  return { employeeId: user.id, role: isEmployeeAdmin(user.role) ? 'ADMIN' : 'USER' };
}
