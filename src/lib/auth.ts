import { createHmac, timingSafeEqual, scryptSync } from 'node:crypto';

const SESSION_COOKIE = 'hr_session';
const SESSION_DURATION_SECONDS = 60 * 60 * 8;
const AUTH_SECRET = process.env.AUTH_SECRET || 'development-only-change-this-secret';

type SessionPayload = {
  employeeId: string;
  role: string;
  expiresAt: number;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export function getSessionCookieName(): string {
  return SESSION_COOKIE;
}

export function createSessionToken(employeeId: string, role: string): string {
  const payload: SessionPayload = {
    employeeId,
    role,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', AUTH_SECRET)
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;

  const expectedSignature = createHmac('sha256', AUTH_SECRET)
    .update(encodedPayload)
    .digest('base64url');
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as SessionPayload;
    return payload.expiresAt > Math.floor(Date.now() / 1000) ? payload : null;
  } catch {
    return null;
  }
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, expectedHash] = storedHash.split(':');
  if (!salt || !expectedHash) return false;

  const actualHash = scryptSync(password, salt, 64).toString('hex');
  const actualBuffer = Buffer.from(actualHash, 'hex');
  const expectedBuffer = Buffer.from(expectedHash, 'hex');

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}
