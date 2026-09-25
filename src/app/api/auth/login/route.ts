import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  createSessionToken,
  getSessionCookieName,
  verifyPassword,
} from '@/lib/auth';

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!email || !password) {
    return NextResponse.json(
      { error: 'กรุณากรอกอีเมลและรหัสผ่าน' },
      { status: 400 },
    );
  }

  const employee = await prisma.employee.findUnique({ where: { email } });
  if (!employee || !verifyPassword(password, employee.passwordHash)) {
    return NextResponse.json(
      { error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' },
      { status: 401 },
    );
  }

  const response = NextResponse.json({
    user: {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      role: employee.role,
    },
  });
  response.cookies.set(getSessionCookieName(), createSessionToken(employee.id, employee.role), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 8,
    path: '/',
  });
  return response;
}
