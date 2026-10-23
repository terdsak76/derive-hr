import { NextResponse } from 'next/server';
import { requireEmployeeUser, isEmployeeAdmin } from '@/lib/employee-access';

export async function requireFinanceAdmin(request: Request) {
  const user = await requireEmployeeUser(request);
  if (user instanceof NextResponse) return user;
  if (!isEmployeeAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return user;
}
