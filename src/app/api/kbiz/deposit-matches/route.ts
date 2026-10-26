import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireFinanceAdmin } from '@/lib/finance-access';
import { DepositMatchError, reviewDepositMatch, suggestDepositMatches } from '@/lib/kbiz-deposit-matches';

function errorResponse(error: unknown) {
  if (error instanceof DepositMatchError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error('Kbiz deposit matching failed:', error);
  return NextResponse.json({ error: 'Unable to match deposits. Check the database migration and try again.' }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const user = await requireFinanceAdmin(request);
    if (user instanceof NextResponse) return user;
    const body = await request.json().catch(() => null);
    if (!Array.isArray(body?.transactionIds) || body.transactionIds.length > 25 ||
        body.transactionIds.some((id: unknown) => typeof id !== 'string' || !id.trim() || id.length > 254)) {
      throw new DepositMatchError('Provide up to 25 visible deposit transaction IDs', 400);
    }
    const ids = [...new Set<string>(body.transactionIds)];
    const result = await prisma.$transaction(tx => suggestDepositMatches(tx, ids, user.id), { timeout: 60000 });
    return NextResponse.json(result);
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireFinanceAdmin(request);
    if (user instanceof NextResponse) return user;
    const body = await request.json().catch(() => null);
    if (typeof body?.id !== 'string' || !body.id.trim() || body.id.length > 254 || !['CONFIRMED', 'REJECTED'].includes(body.status)) {
      throw new DepositMatchError('Select a pending match and confirm or reject it', 400);
    }
    await prisma.$transaction(tx => reviewDepositMatch(tx, body.id, body.status, user.id), { timeout: 30000 });
    return NextResponse.json({ id: body.id, status: body.status });
  } catch (error) { return errorResponse(error); }
}
