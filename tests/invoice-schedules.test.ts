import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createClient } from '@libsql/client';
import type { PrismaClient } from '@prisma/client';
import { createSessionToken, getSessionCookieName } from '../src/lib/auth';
import { renderInvoiceHtml } from '../src/lib/invoice-template';

let directory: string;
let prisma: PrismaClient;
let route: typeof import('../src/app/api/invoice-schedules/route');
const original = {
  id: 'invoice', client: 'TWSS', product: 'VaRP', service: 'MA', description: 'Original description',
  period: 'month', issueDay: 23, amount: 15000, address: 'Customer address', name: 'Customer', taxId: '0125559009490',
};

function request(userId?: string, body: unknown = { id: 'invoice', description: 'Updated description' }, method = 'PATCH') {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  // Authorization must check the database role, even if the token claims ADMIN.
  if (userId) headers.cookie = `${getSessionCookieName()}=${createSessionToken(userId, 'ADMIN')}`;
  return new Request('http://localhost/api/invoice-schedules?month=2026-10', {
    method, headers, ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
  });
}

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'derive-invoice-tests-'));
  process.env.TURSO_DATABASE_URL = `file:${join(directory, 'test.db')}`;
  process.env.TURSO_AUTH_TOKEN = 'local-test-only';
  const database = createClient({ url: process.env.TURSO_DATABASE_URL });
  try {
    const { stdout } = await promisify(execFile)(process.execPath, [
      'node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-empty', '--to-schema', 'prisma/schema.prisma', '--script',
    ]);
    await database.executeMultiple(stdout);
  } finally { database.close(); }
  ({ prisma } = await import('../src/lib/prisma'));
  route = await import('../src/app/api/invoice-schedules/route');
  for (const [id, role] of [['admin', 'ADMIN'], ['legacy-admin', 'ROLE_ADMIN'], ['user', 'USER']]) {
    await prisma.employee.create({ data: {
      id, role, name: id, email: `${id}@example.test`, department: 'Test', position: 'Test', passwordHash: 'unused',
    } });
  }
});

beforeEach(async () => {
  await prisma.invoiceSchedule.deleteMany();
  await prisma.invoiceSchedule.create({ data: original });
});

after(async () => {
  if (prisma) await prisma.$disconnect();
  if (directory) await rm(directory, { recursive: true });
});

test('description changes require a current admin account', async () => {
  for (const userId of [undefined, 'missing', 'user']) {
    assert.equal((await route.PATCH(request(userId))).status, 403);
  }
  assert.equal((await prisma.invoiceSchedule.findUniqueOrThrow({ where: { id: original.id } })).description, original.description);
  assert.equal((await route.PATCH(request('legacy-admin'))).status, 200);
});

test('saved multiline description survives reload and is used on both printed copies', async () => {
  const description = 'บริการประจำเดือนตุลาคม\nรายละเอียดเพิ่มเติม <ลูกค้า> & บริการ';
  const response = await route.PATCH(request('admin', { id: original.id, description: `  ${description}  `, amount: 1, taxId: 'changed' }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { id: original.id, description });
  const stored = await prisma.invoiceSchedule.findUniqueOrThrow({ where: { id: original.id } });
  assert.equal(stored.description, description);
  assert.equal(stored.amount, original.amount);
  assert.equal(stored.taxId, original.taxId);
  const schedules = await (await route.GET(request('admin', undefined, 'GET'))).json();
  assert.equal(schedules[0].description, description);
  const html = renderInvoiceHtml({
    invoice: schedules[0], invoiceNumber: 'INV-2026-001', issueDate: '23 ตุลาคม 2569',
    amountWords: 'หนึ่งหมื่นหกพันห้าสิบบาทถ้วน', assetBaseUrl: 'https://example.test/invoice',
  });
  assert.equal(html.split('บริการประจำเดือนตุลาคม\nรายละเอียดเพิ่มเติม &lt;ลูกค้า&gt; &amp; บริการ').length - 1, 2);
});

test('rejects malformed and invalid description requests without changing stored data', async () => {
  for (const body of [null, [], {}, { id: original.id, description: '   ' },
    { id: original.id, description: 123 }, { id: '', description: 'text' },
    { id: original.id, description: 'a'.repeat(5001) }]) {
    assert.equal((await route.PATCH(request('admin', body))).status, 400);
  }
  const valid = request('admin');
  const malformed = new Request(valid.url, { method: 'PATCH', headers: valid.headers, body: '{' });
  assert.equal((await route.PATCH(malformed)).status, 400);
  assert.equal((await prisma.invoiceSchedule.findUniqueOrThrow({ where: { id: original.id } })).description, original.description);
});

test('missing invoice returns 404 and failed saves can be retried', async () => {
  assert.equal((await route.PATCH(request('admin', { id: 'missing', description: 'text' }))).status, 404);
  assert.equal((await route.PATCH(request('admin', { id: original.id, description: 'a'.repeat(5000) }))).status, 200);
});
