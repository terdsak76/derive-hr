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
import { parseFinanceMonth, type FinanceReport } from '../src/lib/finance';
import { applyIncentiveMigration } from '../scripts/apply-incentive-migration.mjs';
import { applyTaxMigration } from '../scripts/apply-tax-migration.mjs';
import { socialSecurityCents, vatAmounts, type TaxReport } from '../src/lib/taxes';
import { applyOwnerMigration } from '../scripts/apply-owner-migration.mjs';
import { applyFullIncentiveMigration } from '../scripts/apply-full-incentive-migration.mjs';
import { calculateIncentiveCents } from '../src/lib/incentives';

let directory: string;
let prisma: PrismaClient;
let incentives: typeof import('../src/app/api/incentives/route');
let finance: typeof import('../src/app/api/company-finance/route');
let employees: typeof import('../src/app/api/employees/route');
let taxes: typeof import('../src/app/api/taxes/route');
let purchases: typeof import('../src/app/api/taxes/purchases/route');
let sales: typeof import('../src/app/api/taxes/sales/route');
let overtime: typeof import('../src/app/api/overtime/route');
let overtimeQuote: typeof import('../src/app/api/overtime/quote/route');
let approvals: typeof import('../src/app/api/request-approvals/route');

function request(path: string, method = 'GET', userId: string | undefined = 'admin', body?: unknown) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (userId) headers.cookie = `${getSessionCookieName()}=${createSessionToken(userId, 'ADMIN')}`;
  return new Request(`http://localhost${path}`, { method, headers,
    ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
  });
}
const incentiveBody = { employee_id: 'employee', month: '2026-10', score: 85.5 };
const save = (body: unknown = incentiveBody, user = 'admin') => incentives.PUT(request('/api/incentives', 'PUT', user, body));
async function report(month = '2026-10', basis = 'scheduled') {
  const response = await finance.GET(request(`/api/company-finance?month=${month}&basis=${basis}`));
  assert.equal(response.status, 200);
  return await response.json() as FinanceReport;
}

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'derive-finance-tests-'));
  process.env.TURSO_DATABASE_URL = `file:${join(directory, 'test.db')}`;
  process.env.TURSO_AUTH_TOKEN = 'local-tests-only';
  const database = createClient({ url: process.env.TURSO_DATABASE_URL });
  try {
    const { stdout } = await promisify(execFile)(process.execPath, [
      'node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-empty', '--to-schema', 'prisma/schema.prisma', '--script',
    ]);
    await database.executeMultiple(stdout);
    // Use the shipped migration, including its database CHECK constraints.
    await database.execute('DROP TABLE "Incentive"');
    assert.equal(await applyIncentiveMigration(database), 'applied');
    assert.equal(await applyIncentiveMigration(database), 'already-applied');
    await database.executeMultiple('DROP TABLE "VatSale"; DROP TABLE "VatPurchase"; DROP TABLE "VatMonth";');
    assert.equal(await applyTaxMigration(database), 'applied');
    assert.equal(await applyTaxMigration(database), 'already-applied');
  } finally { database.close(); }
  // Reproduce a globally cached pre-owner client surviving a development reload.
  const staleClient = { vatPurchase: {}, $disconnect: async () => {} };
  const globalCache = globalThis as unknown as { prisma: unknown; prismaSchemaKey?: string };
  globalCache.prisma = staleClient;
  globalCache.prismaSchemaKey = 'previous-generated-schema';
  ({ prisma } = await import('../src/lib/prisma'));
  assert.notEqual(prisma, staleClient, 'A cached client from an older schema must be replaced');
  assert.notEqual(globalCache.prismaSchemaKey, 'previous-generated-schema');
  incentives = await import('../src/app/api/incentives/route');
  finance = await import('../src/app/api/company-finance/route');
  employees = await import('../src/app/api/employees/route');
  taxes = await import('../src/app/api/taxes/route');
  purchases = await import('../src/app/api/taxes/purchases/route');
  sales = await import('../src/app/api/taxes/sales/route');
  overtime = await import('../src/app/api/overtime/route');
  overtimeQuote = await import('../src/app/api/overtime/quote/route');
  approvals = await import('../src/app/api/request-approvals/route');
});

beforeEach(async () => {
  await prisma.$transaction([
    prisma.vatSale.deleteMany(), prisma.vatPurchase.deleteMany(), prisma.vatMonth.deleteMany(),
    prisma.incentive.deleteMany(), prisma.overtime.deleteMany(), prisma.onsite.deleteMany(),
    prisma.leave.deleteMany(), prisma.workdayChangeRequest.deleteMany(),
    prisma.issuedDocument.deleteMany(), prisma.projectInvoice.deleteMany(), prisma.project.deleteMany(),
    prisma.invoiceSchedule.deleteMany(), prisma.employee.deleteMany(),
  ]);
  for (const [id, role, salary] of [['admin', 'ADMIN', 0], ['legacy', 'ROLE_ADMIN', 0], ['employee', 'USER', 3000000], ['unset', 'USER', null]] as const) {
    await prisma.employee.create({ data: {
      id, role, name: id, email: `${id}@example.test`, department: 'Test', position: 'Test', passwordHash: 'unused',
      monthlySalaryCents: salary, createdAt: new Date('2026-01-01T00:00:00Z'),
      fullIncentiveCents: id === 'employee' ? 200000 : 0,
    } });
  }
});

after(async () => {
  if (prisma) await prisma.$disconnect();
  if (directory) await rm(directory, { recursive: true });
});

test('approval inbox is admin-only regardless of token role claims', async () => {
  for (const id of ['', 'missing', 'employee']) {
    const status = id === 'employee' ? 403 : 401;
    assert.equal((await approvals.GET(request('/api/request-approvals', 'GET', id))).status, status);
    assert.equal((await approvals.PATCH(request('/api/request-approvals', 'PATCH', id,
      { id: 'request', type: 'LEAVE', status: 'APPROVED' }))).status, status);
  }
  assert.equal((await approvals.GET(request('/api/request-approvals', 'GET', 'legacy'))).status, 200);
});

async function seedApprovalRequests() {
  const start = new Date('2026-10-23T00:00:00Z');
  const leave = await prisma.leave.create({ data: { employeeId: 'employee', type: 'SICK', startDate: start, endDate: start,
    reason: 'Rest', createdAt: new Date('2026-10-01T00:00:00Z') } });
  const workday = await prisma.workdayChangeRequest.create({ data: { employeeId: 'employee', fromDate: start,
    toDate: new Date('2026-10-24T00:00:00Z'), project: 'Project', jobDetail: 'Customer meeting',
    createdAt: new Date('2026-10-02T00:00:00Z') } });
  const ot = await prisma.overtime.create({ data: { employeeId: 'employee', startAt: start,
    endAt: new Date('2026-10-23T02:00:00Z'), workedMinutes: 120, hourlyRateCents: 17045,
    otAmountCents: 51136, createdById: 'employee', createdAt: new Date('2026-10-03T00:00:00Z') } });
  return [{ id: leave.id, type: 'LEAVE' }, { id: workday.id, type: 'WORKDAY_CHANGE' }, { id: ot.id, type: 'OVERTIME' }];
}

test('approval inbox combines pending request types oldest-first without sensitive employee data', async () => {
  await seedApprovalRequests();
  await prisma.leave.create({ data: { employeeId: 'employee', type: 'PERSONAL', startDate: new Date(), endDate: new Date(), reason: 'Done', status: 'APPROVED' } });
  const response = await approvals.GET(request('/api/request-approvals'));
  assert.equal(response.status, 200);
  const rows = await response.json();
  assert.deepEqual(rows.map((row: { type: string }) => row.type), ['LEAVE', 'WORKDAY_CHANGE', 'OVERTIME']);
  assert.equal(rows[0].employeeName, 'employee');
  assert.equal(rows[2].hours, 2);
  assert.equal(rows[2].amount, 511.36);
  assert.ok(!JSON.stringify(rows).includes('passwordHash'));
  assert.ok(!JSON.stringify(rows).includes('monthlySalaryCents'));
});

test('admin can approve or reject every request type with approval audit and no repeated decisions', async () => {
  const requests = await seedApprovalRequests();
  for (const [index, item] of requests.entries()) {
    const status = index === 1 ? 'REJECTED' : 'APPROVED';
    const response = await approvals.PATCH(request('/api/request-approvals', 'PATCH', 'legacy', { ...item, status }));
    assert.equal(response.status, 200);
    assert.equal((await approvals.PATCH(request('/api/request-approvals', 'PATCH', 'admin', { ...item, status: 'REJECTED' }))).status, 409);
  }
  const leave = await prisma.leave.findUniqueOrThrow({ where: { id: requests[0].id } });
  const workday = await prisma.workdayChangeRequest.findUniqueOrThrow({ where: { id: requests[1].id } });
  const ot = await prisma.overtime.findUniqueOrThrow({ where: { id: requests[2].id } });
  assert.equal(leave.status, 'APPROVED');
  assert.equal(workday.status, 'REJECTED');
  assert.equal(ot.status, 'APPROVED');
  assert.equal(workday.approvedById, 'legacy');
  assert.equal(ot.approvedById, 'legacy');
  assert.ok(workday.approvedAt && ot.approvedAt);
  assert.deepEqual(await (await approvals.GET(request('/api/request-approvals'))).json(), []);
});

test('approval decisions reject malformed input and unknown requests', async () => {
  for (const body of [null, [], {}, { id: 'x', type: 'ONSITE', status: 'APPROVED' },
    { id: 'x', type: 'LEAVE', status: 'PENDING' }, { id: '', type: 'LEAVE', status: 'APPROVED' }]) {
    assert.equal((await approvals.PATCH(request('/api/request-approvals', 'PATCH', 'admin', body))).status, 400);
  }
  assert.equal((await approvals.PATCH(request('/api/request-approvals', 'PATCH', 'admin',
    { id: 'missing', type: 'LEAVE', status: 'APPROVED' }))).status, 409);
  const valid = request('/api/request-approvals');
  assert.equal((await approvals.PATCH(new Request(valid.url, { method: 'PATCH', headers: valid.headers, body: '{' }))).status, 400);
});

test('admin access is required even if an employee token claims ADMIN', async () => {
  for (const id of ['', 'missing', 'employee']) {
    const status = id === 'employee' ? 403 : 401;
    assert.equal((await incentives.GET(request('/api/incentives?month=2026-10', 'GET', id))).status, status);
    assert.equal((await incentives.PUT(request('/api/incentives', 'PUT', id, incentiveBody))).status, status);
    assert.equal((await finance.GET(request('/api/company-finance?month=2026-10', 'GET', id))).status, status);
  }
  assert.equal((await save(incentiveBody, 'legacy')).status, 200);
});

test('incentives persist, update instead of duplicate, and stay separate by month', async () => {
  assert.equal((await save()).status, 200);
  assert.equal((await save({ ...incentiveBody, score: 92 })).status, 200);
  assert.equal((await save({ ...incentiveBody, month: '2026-11', score: 25 })).status, 200);
  assert.equal(await prisma.incentive.count(), 2);
  const rows = await (await incentives.GET(request('/api/incentives?month=2026-10'))).json();
  const employee = rows.find((row: { id: string }) => row.id === 'employee');
  assert.equal(employee.score, 92);
  assert.equal(employee.amount, 1840);
  assert.equal(employee.fullIncentive, 2000);
  assert.ok(!('monthlySalaryCents' in employee));
  assert.equal((await report()).expenses.incentive, 1840);
  assert.equal((await report('2026-11')).expenses.incentive, 500);
  assert.equal((await save({ ...incentiveBody, amount: 0, score: 0 })).status, 200);
  assert.equal((await report()).expenses.incentive, 0);
});

test('rejects invalid scores, malformed JSON and invalid months', async () => {
  for (const body of [null, [], {}, { ...incentiveBody, score: -1 }, { ...incentiveBody, score: 101 },
    { ...incentiveBody, score: '85' }, { ...incentiveBody, score: null },
    { ...incentiveBody, month: '2026-13' }, { ...incentiveBody, employee_id: '' }]) {
    assert.equal((await save(body)).status, 400);
  }
  assert.equal((await save({ ...incentiveBody, employee_id: 'missing' })).status, 404);
  const valid = request('/api/incentives', 'PUT', 'admin', incentiveBody);
  assert.equal((await incentives.PUT(new Request(valid.url, { method: 'PUT', headers: valid.headers, body: '{' }))).status, 400);
  assert.equal((await finance.GET(request('/api/company-finance?month=2026-00'))).status, 400);
  assert.equal((await finance.GET(request('/api/company-finance?month=2026-10&basis=cash'))).status, 400);
  assert.equal(await prisma.incentive.count(), 0);
});

test('employees with incentive history cannot be deleted', async () => {
  await save();
  const response = await employees.DELETE(request('/api/employees', 'DELETE', 'admin', { id: 'employee' }));
  assert.equal(response.status, 409);
  assert.equal(await prisma.incentive.count(), 1);
  assert.ok(await prisma.employee.findUnique({ where: { id: 'employee' } }));
});

test('incentive amount is calculated server-side and rounds satang rather than trusting the submitted amount', async () => {
  await prisma.employee.update({ where: { id: 'employee' }, data: { fullIncentiveCents: 10001 } });
  const saved = await (await save({ ...incentiveBody, score: 50, amount: 999999, fullIncentive: 999999 })).json();
  assert.equal(saved.fullIncentive, 100.01);
  assert.equal(saved.amount, 50.01);
  assert.equal((await report()).expenses.incentive, 50.01);
  for (const [score, amount] of [[0, 0], [100, 100.01], [85.5, 85.51]]) {
    assert.equal((await (await save({ ...incentiveBody, score })).json()).amount, amount);
  }
  assert.equal(calculateIncentiveCents(2147483647, 100), 2147483647);
  const zero = await (await save({ ...incentiveBody, employee_id: 'unset', score: 100 })).json();
  assert.equal(zero.amount, 0);
});

test('changing full incentive preserves previously saved months until explicitly recalculated', async () => {
  await save();
  assert.equal((await employees.PATCH(request('/api/employees', 'PATCH', 'admin', { id: 'employee', fullIncentive: 3000 }))).status, 200);
  assert.equal((await report()).expenses.incentive, 1710);
  const previous = await (await incentives.GET(request('/api/incentives?month=2026-10'))).json();
  assert.equal(previous.find((row: { id: string }) => row.id === 'employee').amount, 1710);
  assert.equal(previous.find((row: { id: string }) => row.id === 'employee').fullIncentive, 3000);
  const november = await (await save({ ...incentiveBody, month: '2026-11' })).json();
  assert.equal(november.amount, 2565);
  assert.equal((await report()).expenses.incentive, 1710);
  await save();
  assert.equal((await report()).expenses.incentive, 2565);
  assert.equal((await report('2026-11')).expenses.incentive, 2565);
});

test('full incentive is admin-managed, validated and returned in baht', async () => {
  for (const id of ['admin', 'legacy']) {
    const response = await employees.PATCH(request('/api/employees', 'PATCH', id, { id: 'employee', fullIncentive: 1234.56 }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).fullIncentive, 1234.56);
    assert.equal((await prisma.employee.findUniqueOrThrow({ where: { id: 'employee' } })).fullIncentiveCents, 123456);
  }
  for (const field of ['fullIncentive', 'fullIncentiveCents']) {
    assert.equal((await employees.PATCH(request('/api/employees', 'PATCH', 'employee', { id: 'employee', [field]: 999999 }))).status, 403);
  }
  for (const value of [-1, 0.001, '1000', null, 21474836.48]) {
    assert.equal((await employees.PATCH(request('/api/employees', 'PATCH', 'admin', { id: 'employee', fullIncentive: value }))).status, 400);
  }
  assert.equal((await employees.PATCH(request('/api/employees', 'PATCH', 'admin', { id: 'employee', fullIncentive: 0 }))).status, 200);
  assert.equal((await employees.PATCH(request('/api/employees', 'PATCH', 'admin', { id: 'employee', name: 'Renamed' }))).status, 200);
  assert.equal((await prisma.employee.findUniqueOrThrow({ where: { id: 'employee' } })).fullIncentiveCents, 0);
  const created = await employees.POST(request('/api/employees', 'POST', 'admin', {
    name: 'New', email: 'new@test.example', department: 'Test', position: 'Test', password: 'password123', fullIncentive: 5000.01,
  }));
  assert.equal(created.status, 201);
  assert.equal((await created.json()).fullIncentive, 5000.01);
});

test('full incentive migration is additive, repeatable and preserves historical payments', async () => {
  const database = createClient({ url: 'file::memory:' });
  try {
    await database.executeMultiple(`CREATE TABLE Employee (id TEXT PRIMARY KEY, salary INTEGER);
      INSERT INTO Employee VALUES ('existing', 3000000);
      CREATE TABLE Incentive (employeeId TEXT, amountCents INTEGER);
      INSERT INTO Incentive VALUES ('existing', 123456);`);
    assert.equal(await applyFullIncentiveMigration(database), 'applied');
    assert.equal(await applyFullIncentiveMigration(database), 'already-applied');
    const employee = (await database.execute('SELECT * FROM Employee')).rows[0];
    assert.equal(employee.fullIncentiveCents, 0);
    assert.equal(employee.salary, 3000000);
    assert.equal((await database.execute('SELECT amountCents FROM Incentive')).rows[0].amountCents, 123456);
    await assert.rejects(() => database.execute('UPDATE Employee SET fullIncentiveCents = -1'));
    await assert.rejects(() => database.execute('UPDATE Employee SET fullIncentiveCents = 2147483648'));
    await database.execute('UPDATE Employee SET fullIncentiveCents = 500000');
    await applyFullIncentiveMigration(database);
    assert.equal((await database.execute('SELECT fullIncentiveCents FROM Employee')).rows[0].fullIncentiveCents, 500000);
  } finally { database.close(); }
});

async function createIncome() {
  const common = { client: 'Customer', product: 'App', service: 'MA', description: 'Service', issueDay: 1, name: 'Customer', address: 'Address', taxId: '123' };
  for (const [id, period, issueMonth, amount] of [
    ['monthly', 'month', null, 10000], ['quarterly', 'quarter', 1, 30000],
    ['yearly', 'year', 10, 120000], ['off-month', 'year', 11, 999],
  ] as const) await prisma.invoiceSchedule.create({ data: { ...common, id, period, issueMonth, amount } });
  const project = await prisma.project.create({ data: { name: 'Project', budget: 50000, clientName: 'Project client', address: 'Address', taxId: '123' } });
  await prisma.projectInvoice.create({ data: { id: 'project-invoice', projectId: project.id, installment: '1', invoiceDate: new Date('2026-10-01T00:00:00+07:00'), billingDescription: 'Installment', amount: 20000, invoiceNumber: 'P-INV-2026-001' } });
  await prisma.projectInvoice.create({ data: { projectId: project.id, installment: '2', invoiceDate: new Date('2026-11-01T00:00:00+07:00'), billingDescription: 'Next month', amount: 9000, invoiceNumber: 'P-INV-2026-002' } });
}

test('monthly finance includes all expense sources and both invoice sources without VAT', async () => {
  await createIncome(); await save();
  for (const [id, date, amount, status] of [
    ['included', '2026-10-01T00:00:00+07:00', 100.25, 'APPROVED'],
    ['last', '2026-10-31T23:59:59+07:00', 99.75, 'APPROVED'],
    ['next', '2026-11-01T00:00:00+07:00', 1000, 'APPROVED'],
    ['rejected', '2026-10-02T00:00:00+07:00', 5000, 'REJECTED'],
  ] as const) {
    await prisma.onsite.create({ data: { id, employeeId: 'employee', location: 'Site', purpose: 'Work', startDate: new Date(date), endDate: new Date('2026-11-02T00:00:00+07:00'), allowance: amount, status } });
    await prisma.overtime.create({ data: { id, employeeId: 'employee', createdById: 'admin', startAt: new Date(date), endAt: new Date(new Date(date).getTime() + 3600000), workedMinutes: 60, hourlyRateCents: 10000, otAmountCents: 10000, status } });
  }
  const result = await report();
  assert.deepEqual(result.expenses, { salary: 30000, onsite: 200, overtime: 200, incentive: 1710, socialSecurity: 875, purchases: 0, total: 32985 });
  assert.deepEqual(result.income, { recurring: 160000, project: 20000, total: 180000 });
  assert.equal(result.profit, 147015);
  assert.equal(result.incomeItems.length, 4);
  assert.equal(result.employees.find(employee => employee.id === 'unset')?.salary, null);
  assert.equal((await report('2026-11')).expenses.onsite, 1000);
});

test('issued mode counts an invoice once and excludes receipts, other months, and unissued invoices', async () => {
  await createIncome();
  assert.equal((await report('2026-10', 'issued')).income.total, 0);
  for (const [type, source, reference, number] of [
    ['INVOICE', 'RECURRING', 'recurring:monthly:2026-10', 'INV-1'],
    ['RECEIPT', 'RECURRING', 'recurring:monthly:2026-10', 'REC-1'],
    ['INVOICE', 'RECURRING', 'recurring:yearly:2026-11', 'INV-2'],
    ['INVOICE', 'PROJECT', 'project:project-invoice', 'P-INV-1'],
  ]) await prisma.issuedDocument.create({ data: { documentType: type, sourceType: source, referenceKey: reference, documentNumber: number } });
  assert.deepEqual((await report('2026-10', 'issued')).income, { recurring: 10000, project: 20000, total: 30000 });
});

test('month boundaries follow Bangkok time and handle December rollover', async () => {
  assert.equal(parseFinanceMonth('2026-10')?.start.toISOString(), '2026-09-30T17:00:00.000Z');
  assert.equal(parseFinanceMonth('2026-12')?.end.toISOString(), '2026-12-31T17:00:00.000Z');
  assert.equal(parseFinanceMonth('0000-01'), null);
  await prisma.employee.create({ data: { id: 'future', name: 'Future', email: 'future@example.test', department: 'Test', position: 'Test', passwordHash: 'unused', monthlySalaryCents: 9000000, createdAt: new Date('2026-11-01T00:00:00+07:00') } });
  assert.equal((await report('2026-10')).expenses.salary, 30000);
  assert.equal((await save({ ...incentiveBody, employee_id: 'future' })).status, 400);
});

test('additive migration preserves existing rows and enforces amount and score constraints', async () => {
  const client = createClient({ url: process.env.TURSO_DATABASE_URL! });
  try {
    assert.equal(await applyIncentiveMigration(client), 'already-applied');
    assert.equal((await client.execute('SELECT COUNT(*) AS total FROM Employee')).rows[0].total, 4);
    for (const [score, amount] of [[101, 100], [50, -1]]) {
      await assert.rejects(() => client.execute({ sql: 'INSERT INTO Incentive (id, employeeId, month, score, amountCents, updatedAt) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)', args: ['invalid', 'employee', '2026-10', score, amount] }));
    }
  } finally { client.close(); }
});

async function selectedReport(year: string, month: string, basis = 'scheduled') {
  const response = await finance.GET(request(`/api/company-finance?year=${year}&month=${month}&basis=${basis}`));
  assert.equal(response.status, 200);
  return await response.json() as FinanceReport;
}

test('year and month selections match the existing single-month report', async () => {
  await createIncome(); await save();
  assert.deepEqual(await selectedReport('2026', '10'), await report('2026-10'));
  assert.deepEqual(await selectedReport('2026', '01'), await report('2026-01'));
});

test('all months totals reconcile to twelve monthly rows and include each cost in its month', async () => {
  await createIncome(); await save();
  await save({ ...incentiveBody, month: '2026-11', score: 25 });
  await prisma.employee.create({ data: { id: 'midyear', name: 'Midyear', email: 'midyear@example.test', department: 'Test', position: 'Test', passwordHash: 'unused', monthlySalaryCents: 100000, createdAt: new Date('2026-07-01T00:00:00+07:00') } });
  for (const [id, date, amount] of [
    ['year-start', '2026-01-01T00:00:00+07:00', 10.25],
    ['year-end', '2026-12-31T23:59:59+07:00', 20.75],
    ['next-year', '2027-01-01T00:00:00+07:00', 9999],
  ] as const) await prisma.onsite.create({ data: { id, employeeId: 'employee', location: 'Site', purpose: 'Work', startDate: new Date(date), endDate: new Date(date), allowance: amount, status: 'APPROVED' } });
  await prisma.overtime.create({ data: { employeeId: 'employee', createdById: 'admin', startAt: new Date('2026-12-31T23:00:00+07:00'), endAt: new Date('2027-01-01T00:00:00+07:00'), workedMinutes: 60, hourlyRateCents: 1000, otAmountCents: 1000, status: 'APPROVED' } });
  const annual = await selectedReport('2026', 'all');
  assert.equal(annual.month, '2026');
  assert.equal(annual.monthly.length, 12);
  assert.deepEqual(annual.income, { recurring: 360999, project: 29000, total: 389999 });
  assert.deepEqual(annual.expenses, { salary: 366000, onsite: 31, overtime: 10, incentive: 2210, socialSecurity: 10800, purchases: 0, total: 379051 });
  assert.equal(annual.profit, 10948);
  assert.equal(annual.monthly[0].expenses.salary, 30000);
  assert.equal(annual.monthly[6].expenses.salary, 31000);
  assert.equal(annual.employees.find(employee => employee.id === 'midyear')?.salary, 6000);
  assert.equal(annual.employees.find(employee => employee.id === 'unset')?.salary, null);
  assert.equal(new Set(annual.incomeItems.map(item => `${item.month}:${item.source}:${item.id}`)).size, annual.incomeItems.length);
  for (const row of annual.monthly) {
    const single = await report(row.month);
    assert.deepEqual(row.expenses, single.expenses);
    assert.deepEqual(row.income, single.income);
    assert.equal(row.profit, single.profit);
  }
  assert.equal(annual.monthly.reduce((sum, row) => sum + Math.round(row.expenses.total * 100), 0), Math.round(annual.expenses.total * 100));
});

test('issued all-month view counts recurring invoices in their own months and projects once', async () => {
  await createIncome();
  for (const [referenceKey, sourceType] of [
    ['recurring:monthly:2026-10', 'RECURRING'], ['recurring:monthly:2026-11', 'RECURRING'],
    ['recurring:quarterly:2026-01', 'RECURRING'], ['recurring:quarterly:2026-10', 'RECURRING'],
    ['project:project-invoice', 'PROJECT'], ['recurring:monthly:2027-01', 'RECURRING'],
  ]) await prisma.issuedDocument.create({ data: { documentType: 'INVOICE', sourceType, referenceKey, documentNumber: `INV-${referenceKey}` } });
  await prisma.issuedDocument.create({ data: { documentType: 'RECEIPT', sourceType: 'RECURRING', referenceKey: 'recurring:yearly:2026-10', documentNumber: 'REC-only' } });
  const annual = await selectedReport('2026', 'all', 'issued');
  assert.deepEqual(annual.income, { recurring: 80000, project: 20000, total: 100000 });
  assert.equal(annual.monthly[0].income.total, 30000);
  assert.equal(annual.monthly[9].income.total, 60000);
  assert.equal(annual.monthly[10].income.total, 10000);
});

test('year and all-month parameters validate strictly and retain admin restrictions', async () => {
  for (const query of ['year=0000&month=all', 'year=2026x&month=all', 'year=2026&month=13',
    'year=2026&month=0', 'year=2026&month=', 'year=2026&month=2026-10', 'month=all']) {
    assert.equal((await finance.GET(request(`/api/company-finance?${query}`))).status, 400);
  }
  assert.equal((await finance.GET(request('/api/company-finance?year=2026&month=all', 'GET', 'employee'))).status, 403);
  assert.equal((await finance.GET(request('/api/company-finance?year=2026'))).status, 200);
});

const purchaseBody = {
  month: '2026-10', purchase_date: '2026-10-10', supplier: 'Supplier', invoice_number: 'SUP-001',
  description: 'Cloud service', amount: 1070, vat_mode: 'inclusive', creditable: true, expense: true,
};
async function taxReport(month = '2026-10') {
  const response = await taxes.GET(request(`/api/taxes?month=${month}`));
  assert.equal(response.status, 200);
  return await response.json() as TaxReport;
}
const buy = (body: unknown = purchaseBody) => purchases.POST(request('/api/taxes/purchases', 'POST', 'admin', body));
const recordSale = (body: unknown = { source_type: 'RECURRING', source_id: 'monthly', invoice_month: '2026-10', tax_date: '2026-10-15' }) => sales.POST(request('/api/taxes/sales', 'POST', 'admin', body));

test('social security is capped per employee and only employer share is added to expenses', async () => {
  assert.equal(socialSecurityCents(3000000), 87500);
  assert.equal(socialSecurityCents(1750000), 87500);
  assert.equal(socialSecurityCents(1000000), 50000);
  assert.equal(socialSecurityCents(null), 0);
  assert.equal(socialSecurityCents(0), 0);
  const tax = await taxReport();
  assert.equal(tax.summary.employerSocialSecurity, 875);
  assert.equal(tax.summary.employeeSocialSecurity, 875);
  assert.equal(tax.summary.totalSocialSecurity, 1750);
  const result = await report();
  assert.equal(result.expenses.socialSecurity, 875);
  assert.equal(result.expenses.total, 30875);
});

test('sales VAT comes from explicit invoice records and preserves the invoice snapshot', async () => {
  await createIncome();
  assert.equal((await taxReport()).summary.outputVat, 0);
  const response = await recordSale({ source_type: 'RECURRING', source_id: 'monthly', invoice_month: '2026-10', tax_date: '2026-11-01', amount: 1, vat: 1 });
  assert.equal(response.status, 200);
  const { id } = await response.json();
  assert.equal((await taxReport()).summary.outputVat, 0);
  assert.equal((await taxReport('2026-11')).summary.outputVat, 700);
  assert.equal((await recordSale()).status, 409);
  await prisma.invoiceSchedule.update({ where: { id: 'monthly' }, data: { amount: 999 } });
  assert.equal((await taxReport('2026-11')).summary.outputVat, 700);
  assert.equal((await recordSale({ id, tax_date: '2026-10-15' })).status, 200);
  const october = await taxReport();
  assert.equal(october.summary.sales, 10000);
  assert.equal(october.summary.outputVat, 700);
  assert.equal(october.summary.payable, 700);
  assert.ok(october.invoices.find(invoice => invoice.referenceKey === 'recurring:monthly:2026-10')?.recorded);
});

test('inclusive and exclusive purchases calculate VAT, require eligibility, and flow into finance', async () => {
  assert.deepEqual(vatAmounts(1070, true), { amountCents: 100000, vatCents: 7000 });
  assert.deepEqual(vatAmounts(1000), { amountCents: 100000, vatCents: 7000 });
  assert.equal((await buy()).status, 200);
  assert.equal((await buy()).status, 409);
  assert.equal((await buy({ ...purchaseBody, invoice_number: 'SUP-002', amount: 1000, vat_mode: 'exclusive', creditable: false })).status, 200);
  assert.equal((await buy({ ...purchaseBody, invoice_number: 'SUP-003', expense: false })).status, 200);
  const tax = await taxReport();
  assert.equal(tax.summary.inputVat, 140);
  assert.equal(tax.summary.carryForward, 140);
  assert.equal((await report()).expenses.purchases, 2070);
  const purchase = tax.purchases.find(item => item.invoiceNumber === 'SUP-001')!;
  assert.equal(purchase.amount, 1000);
  assert.equal(purchase.vat, 70);
  assert.equal((await buy({ ...purchaseBody, id: purchase.id, amount: 2140 })).status, 200);
  assert.equal((await taxReport()).summary.inputVat, 210);
  assert.equal((await purchases.DELETE(request('/api/taxes/purchases', 'DELETE', 'admin', { id: purchase.id }))).status, 200);
  assert.equal((await taxReport()).summary.inputVat, 70);
});

test('VAT credits carry across months and years, refund requests do not also carry forward', async () => {
  await createIncome();
  await buy({ ...purchaseBody, month: '2025-12', purchase_date: '2025-12-10', amount: 10700 });
  await recordSale();
  assert.equal((await taxReport('2026-01')).summary.broughtForward, 700);
  assert.equal((await taxReport()).summary.broughtForward, 700);
  assert.equal((await taxReport()).summary.payable, 0);
  const setting = { month: '2025-12', opening_credit: 0, credit_action: 'REFUND' };
  assert.equal((await taxes.PUT(request('/api/taxes', 'PUT', 'admin', setting))).status, 200);
  assert.equal((await taxReport('2025-12')).summary.refundRequested, 700);
  assert.equal((await taxReport('2026-01')).summary.broughtForward, 0);
  assert.equal((await taxReport()).summary.payable, 700);
  assert.equal((await taxes.PUT(request('/api/taxes', 'PUT', 'admin', { month: '2026-10', opening_credit: 100, credit_action: 'CARRY' }))).status, 200);
  assert.equal((await taxReport()).summary.payable, 600);
});

test('project invoice VAT is counted once; delete reverses VAT without deleting the invoice', async () => {
  await createIncome();
  const body = { source_type: 'PROJECT', source_id: 'project-invoice', invoice_month: '2026-10', tax_date: '2026-10-01' };
  const response = await recordSale(body);
  assert.equal(response.status, 200);
  const saved = await response.json();
  assert.equal((await taxReport()).summary.outputVat, 1400);
  assert.equal((await recordSale(body)).status, 409);
  assert.equal((await sales.DELETE(request('/api/taxes/sales', 'DELETE', 'admin', { id: saved.id }))).status, 200);
  assert.equal((await taxReport()).summary.outputVat, 0);
  assert.ok(await prisma.projectInvoice.findUnique({ where: { id: 'project-invoice' } }));
});

test('tax endpoints reject non-admins, malformed bodies, invalid dates and wrong invoice periods', async () => {
  await createIncome();
  for (const user of ['', 'missing', 'employee']) {
    const status = user === 'employee' ? 403 : 401;
    assert.equal((await taxes.GET(request('/api/taxes?month=2026-10', 'GET', user))).status, status);
    assert.equal((await taxes.PUT(request('/api/taxes', 'PUT', user, {}))).status, status);
    for (const endpoint of [purchases, sales]) {
      assert.equal((await endpoint.POST(request('/api/taxes', 'POST', user, {}))).status, status);
      assert.equal((await endpoint.DELETE(request('/api/taxes', 'DELETE', user, {}))).status, status);
    }
  }
  for (const body of [null, {}, { ...purchaseBody, amount: -1 }, { ...purchaseBody, amount: 1.001 },
    { ...purchaseBody, creditable: 'true' }, { ...purchaseBody, purchase_date: '2026-02-30' },
    { ...purchaseBody, purchase_date: '2026-11-01' }, { ...purchaseBody, vat_mode: 'invalid' }]) {
    assert.equal((await buy(body)).status, 400);
  }
  assert.equal((await recordSale({ source_type: 'RECURRING', source_id: 'yearly', invoice_month: '2026-11', tax_date: '2026-11-01' })).status, 404);
  assert.equal((await recordSale({ source_type: 'PROJECT', source_id: 'project-invoice', invoice_month: '2026-11', tax_date: '2026-11-01' })).status, 404);
  assert.equal((await recordSale({ tax_date: '2026-02-30' })).status, 400);
  assert.equal((await taxes.PUT(request('/api/taxes', 'PUT', 'admin', { month: '2026-10', opening_credit: -1, credit_action: 'CARRY' }))).status, 400);
  const malformed = request('/api/taxes', 'POST');
  assert.equal((await purchases.POST(new Request(malformed.url, { method: 'POST', headers: malformed.headers, body: '{' }))).status, 400);
  assert.equal((await taxes.GET(request('/api/taxes?month=invalid'))).status, 400);
});

test('purchases without VAT do not manufacture a credit or add VAT to expenses', async () => {
  const response = await buy({ ...purchaseBody, vat_mode: 'none', creditable: false, amount: 1000 });
  assert.equal(response.status, 200);
  const tax = await taxReport();
  assert.equal(tax.purchases[0].amount, 1000);
  assert.equal(tax.purchases[0].vat, 0);
  assert.equal(tax.purchases[0].vatMode, 'none');
  assert.equal(tax.summary.inputVat, 0);
  assert.equal((await report()).expenses.purchases, 1000);
  assert.equal((await buy({ ...purchaseBody, invoice_number: 'INVALID', vat_mode: 'none', creditable: true })).status, 400);
});

test('owner flag exempts both social security shares but preserves salary and other expenses', async () => {
  for (const [id, name, salary] of [['owner-a', 'Songsak', 3000000], ['owner-b', 'Terdsak', 1000000]] as const) {
    await prisma.employee.create({ data: { id, name, email: `${id}@example.test`, department: 'Management', position: 'Owner', role: 'USER', passwordHash: 'unused', isOwner: true, monthlySalaryCents: salary, fullIncentiveCents: 100000, createdAt: new Date('2026-01-01T00:00:00Z') } });
  }
  assert.equal(socialSecurityCents(3000000, true), 0);
  await save({ ...incentiveBody, employee_id: 'owner-a', score: 100 });
  const tax = await taxReport();
  assert.equal(tax.summary.employerSocialSecurity, 875);
  assert.equal(tax.summary.employeeSocialSecurity, 875);
  assert.equal(tax.summary.totalSocialSecurity, 1750);
  for (const id of ['owner-a', 'owner-b']) {
    const owner = tax.employees.find(employee => employee.id === id)!;
    assert.equal(owner.isOwner, true);
    assert.equal(owner.employer, 0); assert.equal(owner.employee, 0); assert.equal(owner.total, 0);
  }
  const result = await report();
  assert.equal(result.expenses.salary, 70000);
  assert.equal(result.expenses.incentive, 1000);
  assert.equal(result.expenses.socialSecurity, 875);
  assert.equal(result.expenses.total, 71875);
  assert.equal((await selectedReport('2026', 'all')).expenses.socialSecurity, 10500);
  // Classification follows the flag, not names or access roles.
  await prisma.employee.update({ where: { id: 'owner-a' }, data: { name: 'Renamed Owner' } });
  await prisma.employee.update({ where: { id: 'employee' }, data: { name: 'Songsak' } });
  assert.equal((await taxReport()).summary.employerSocialSecurity, 875);
});

test('only admins can change ownership and invalid flag types are rejected', async () => {
  const update = (user: string, body: unknown) => employees.PATCH(request('/api/employees', 'PATCH', user, body));
  assert.equal((await update('employee', { id: 'employee', isOwner: true })).status, 403);
  assert.equal((await update('admin', { id: 'employee', isOwner: 'true' })).status, 400);
  assert.equal((await update('admin', { id: 'employee', isOwner: true })).status, 200);
  assert.equal((await taxReport()).summary.employerSocialSecurity, 0);
  assert.equal((await report()).expenses.socialSecurity, 0);
  // A normal self-profile edit must preserve the admin-controlled flag.
  assert.equal((await update('employee', { id: 'employee', name: 'Updated employee' })).status, 200);
  assert.equal((await prisma.employee.findUniqueOrThrow({ where: { id: 'employee' } })).isOwner, true);
  assert.equal((await update('legacy', { id: 'employee', isOwner: false })).status, 200);
  assert.equal((await taxReport()).summary.employerSocialSecurity, 875);
  const created = await employees.POST(request('/api/employees', 'POST', 'admin', { name: 'New Owner', department: 'Management', position: 'Owner', email: 'new-owner@example.test', password: 'password123', isOwner: true }));
  assert.equal(created.status, 201);
  const saved = await created.json();
  assert.equal(saved.isOwner, true);
  assert.equal(saved.role, 'USER');
});

test('owner migration targets exact IDs, preserves other employees, and is repeatable', async () => {
  const database = createClient({ url: `file:${join(directory, 'owner-migration.db')}` });
  try {
    await database.execute('CREATE TABLE Employee (id TEXT PRIMARY KEY, name TEXT NOT NULL, salary INTEGER)');
    await database.batch([
      { sql: 'INSERT INTO Employee VALUES (?, ?, ?)', args: ['ADM001', 'Terdsak', 30000] },
      { sql: 'INSERT INTO Employee VALUES (?, ?, ?)', args: ['ADM002', 'Songsak', 10000] },
      { sql: 'INSERT INTO Employee VALUES (?, ?, ?)', args: ['other', 'Songsak Other', 20000] },
    ], 'write');
    const result = await applyOwnerMigration(database, ['ADM001', 'ADM002']);
    assert.equal(result.applied, true);
    assert.equal(result.owners.length, 2);
    assert.ok(result.owners.every(owner => Number(owner.isOwner) === 1));
    assert.equal((await applyOwnerMigration(database, ['ADM001', 'ADM002'])).applied, false);
    const other = (await database.execute("SELECT * FROM Employee WHERE id = 'other'")).rows[0];
    assert.equal(Number(other.isOwner), 0);
    assert.equal(other.salary, 20000);
    await assert.rejects(() => applyOwnerMigration(database, ['missing']));
    assert.equal((await database.execute("SELECT COUNT(*) AS count FROM Employee WHERE isOwner = 1")).rows[0].count, 2);
  } finally { database.close(); }
});

const otBody = { employee_id: 'admin', start_at: '2026-10-20T18:00', end_at: '2026-10-20T20:00', hourly_rate: 99999, ot_amount: 1 };

test('employees can quote and create their own pending OT even if a different employee ID is submitted', async () => {
  const quote = await overtimeQuote.POST(request('/api/overtime/quote', 'POST', 'employee', otBody));
  assert.equal(quote.status, 200);
  const quoted = await quote.json();
  assert.equal(quoted.employee_id, 'employee');
  assert.equal(quoted.ot_amount, 511.36);
  const response = await overtime.POST(request('/api/overtime', 'POST', 'employee', otBody));
  assert.equal(response.status, 201);
  const saved = await response.json();
  assert.equal(saved.employee_id, 'employee');
  assert.equal(saved.created_by_id, 'employee');
  assert.equal(saved.status, 'PENDING_APPROVAL');
  assert.equal(saved.ot_amount, 511.36);
  assert.equal(saved.worked_minutes, 120);
  assert.equal((await report()).expenses.overtime, 0);
  assert.equal((await overtime.PATCH(request('/api/overtime', 'PATCH', 'employee', { id: saved.id, status: 'APPROVED' }))).status, 403);
  assert.equal((await overtime.PATCH(request('/api/overtime', 'PATCH', 'legacy', { id: saved.id, status: 'APPROVED' }))).status, 200);
  assert.equal((await report()).expenses.overtime, 511.36);
});

test('regular users see only their own OT; legacy admins can record and approve employee OT', async () => {
  await overtime.POST(request('/api/overtime', 'POST', 'employee', otBody));
  await prisma.employee.update({ where: { id: 'unset' }, data: { monthlySalaryCents: 2000000 } });
  const other = await overtime.POST(request('/api/overtime', 'POST', 'legacy', { ...otBody, employee_id: 'unset' }));
  assert.equal(other.status, 201);
  const quoted = await overtimeQuote.POST(request('/api/overtime/quote', 'POST', 'legacy', { ...otBody, employee_id: 'unset' }));
  assert.equal(quoted.status, 200);
  assert.equal((await quoted.json()).employee_id, 'unset');
  const ownRows = await (await overtime.GET(request('/api/overtime', 'GET', 'employee'))).json();
  assert.equal(ownRows.length, 1);
  assert.ok(ownRows.every((row: { employee_id: string }) => row.employee_id === 'employee'));
  const allRows = await (await overtime.GET(request('/api/overtime', 'GET', 'legacy'))).json();
  assert.equal(allRows.length, 2);
});

test('OT requires login and salary data, and still rejects overlapping intervals', async () => {
  assert.equal((await overtime.POST(request('/api/overtime', 'POST', '', otBody))).status, 401);
  assert.equal((await overtime.POST(request('/api/overtime', 'POST', 'unset', otBody))).status, 400);
  assert.equal((await overtimeQuote.POST(request('/api/overtime/quote', 'POST', 'unset', otBody))).status, 400);
  assert.equal((await overtime.POST(request('/api/overtime', 'POST', 'employee', otBody))).status, 201);
  assert.equal((await overtime.POST(request('/api/overtime', 'POST', 'employee', otBody))).status, 409);
});
