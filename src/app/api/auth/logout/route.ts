import { NextResponse } from 'next/server';
import { getSessionCookieName } from '@/lib/auth';

export async function POST(): Promise<NextResponse> {
  const response = NextResponse.json({ success: true });
  response.cookies.set(getSessionCookieName(), '', {
    httpOnly: true,
    expires: new Date(0),
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
  return response;
}
