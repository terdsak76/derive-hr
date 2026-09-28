import { GET as getAccount, PATCH as updateAccount } from '@/app/api/account/route';

export const GET = getAccount;

export async function POST(request: Request): Promise<Response> {
  return updateAccount(request);
}

export const PATCH = updateAccount;
