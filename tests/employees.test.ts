import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createClient } from '@libsql/client';
import type { PrismaClient } from '@prisma/client';
import { createSessionToken, getSessionCookieName, hashPassword, verifyPassword } from '../src/lib/auth';

let temporaryDirectory: string;
let prisma: PrismaClient;
let employees: typeof import('../src/app/api/employees/route');
let account: typeof import('../src/app/api/account/route');
let legacyAccount: typeof import('../src/app/api/auth/update-account/route');
let onsite: typeof import('../src/app/api/onsite/route');
let attendance: typeof import('../src/app/api/attendance/route');
let leaves: typeof import('../src/app/api/leaves/route');
let workdays: typeof import('../src/app/api/workday-changes/route');
let summary: typeof import('../src/app/api/employee-summary/route');
let travel: typeof import('../src/app/api/travel-config/route');

function request(method = 'GET', userId?: string, body?: unknown, sessionRole = 'USER') {
  const headers: Record<string, string> = {};
  if (userId) headers.cookie = `${getSessionCookieName()}=${createSessionToken(userId, sessionRole)}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  return new Request('http://localhost/api/employees?month=10&year=2026', {
    method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const newEmployee = { name: 'New employee', department: 'Engineering', position: 'Developer', email: 'new@example.com', password: 'password123' };

const workdayRequest = {
  from_date: '2026-10-26', to_date: '2026-10-28',
  from_date_start: '08:30', from_date_end: '12:00',
  to_date_start: '13:15', to_date_end: '16:45',
  project: 'Time picker project', job_detail: 'Move the working hours',
};

test('workday change time ranges persist unchanged through listing and approval', async () => {
  const response = await workdays.POST(request('POST', 'user', { ...workdayRequest, employeeId: 'other', status: 'APPROVED' }));
  assert.equal(response.status, 201);
  const saved = await response.json();
  assert.equal(saved.employee_id, 'user');
  assert.equal(saved.status, 'WAITING_FOR_APPROVAL');
  for (const key of ['from_date', 'to_date', 'from_date_start', 'from_date_end', 'to_date_start', 'to_date_end']) assert.equal(saved[key], workdayRequest[key]);
  const stored = await prisma.workdayChangeRequest.findUniqueOrThrow({ where: { id: saved.id } });
  assert.equal(stored.fromDateStart, '08:30'); assert.equal(stored.fromDateEnd, '12:00');
  assert.equal(stored.toDateStart, '13:15'); assert.equal(stored.toDateEnd, '16:45');
  const listing = await (await workdays.GET(request('GET', 'user'))).json();
  assert.equal(listing[0].to_date_start, '13:15');
  assert.equal((await (await workdays.GET(request('GET', 'other'))).json()).length, 0);
  const approvals = await import('../src/app/api/request-approvals/route');
  const pending = await (await approvals.GET(request('GET', 'admin'))).json();
  const inbox = pending.find((row: { id: string }) => row.id === saved.id);
  assert.equal(inbox.fromDateStart, '08:30'); assert.equal(inbox.fromDateEnd, '12:00');
  assert.equal(inbox.toDateStart, '13:15'); assert.equal(inbox.toDateEnd, '16:45');
  assert.equal((await workdays.PATCH(request('PATCH', 'other', { id: saved.id, status: 'APPROVED' }))).status, 403);
  const approved = await workdays.PATCH(request('PATCH', 'admin', { id: saved.id, status: 'APPROVED' }));
  assert.equal(approved.status, 200);
  assert.equal((await approved.json()).from_date_start, '08:30');
});

test('new workday requests require valid dates and four ordered HH:mm times', async () => {
  for (const changes of [
    { from_date_start: undefined }, { from_date_end: '' }, { to_date_start: null }, { to_date_end: '' },
    { from_date_start: '24:00' }, { to_date_start: '9:00' }, { to_date_end: '17:60' },
    { from_date_start: '08:30:00' }, { from_date_start: 830 },
    { from_date_end: '08:30' }, { from_date_end: '07:00' }, { to_date_end: '13:15' }, { to_date_end: '12:00' },
    { from_date: '2026-02-30' }, { to_date: 'not-a-date' }, { to_date: '2026-10-28T00:00:00Z' },
    { project: '  ' }, { job_detail: '  ' },
  ]) {
    assert.equal((await workdays.POST(request('POST', 'user', { ...workdayRequest, ...changes }))).status, 400);
  }
  assert.equal(await prisma.workdayChangeRequest.count(), 0);
  const valid = request('POST', 'user', {});
  assert.equal((await workdays.POST(new Request(valid.url, { method: 'POST', headers: valid.headers, body: '{' }))).status, 400);
  assert.equal((await workdays.POST(request('POST', undefined, workdayRequest))).status, 401);
});

test('historical workday requests keep unspecified times instead of inventing a schedule', async () => {
  await prisma.workdayChangeRequest.create({ data: {
    employeeId: 'user', fromDate: new Date('2026-10-01'), toDate: new Date('2026-10-03'), project: 'Historical', jobDetail: 'Legacy request',
  } });
  const listing = await (await workdays.GET(request('GET', 'user'))).json();
  assert.equal(listing[0].from_date_start, null); assert.equal(listing[0].from_date_end, null);
  assert.equal(listing[0].to_date_start, null); assert.equal(listing[0].to_date_end, null);
});

test('workday time migration preserves existing dates and time values and supports partial installation', async () => {
  const { applyWorkdayChangeTimesMigration } = await import('../scripts/apply-workday-change-times-migration.mjs');
  const database = createClient({ url: 'file::memory:' });
  try {
    await database.executeMultiple(`CREATE TABLE WorkdayChangeRequest (id TEXT PRIMARY KEY, fromDate TEXT, toDate TEXT, fromDateStart TEXT);
      INSERT INTO WorkdayChangeRequest VALUES ('old', '2026-10-01', '2026-10-03', NULL), ('partial', '2026-10-02', '2026-10-04', '08:00');`);
    assert.equal(await applyWorkdayChangeTimesMigration(database), 'applied');
    assert.equal(await applyWorkdayChangeTimesMigration(database), 'already-applied');
    const result = await database.execute('SELECT * FROM WorkdayChangeRequest ORDER BY id');
    assert.equal(result.rows[0].fromDate, '2026-10-01'); assert.equal(result.rows[0].toDate, '2026-10-03');
    assert.equal(result.rows[0].fromDateStart, null); assert.equal(result.rows[0].fromDateEnd, null);
    assert.equal(result.rows[0].toDateStart, null); assert.equal(result.rows[0].toDateEnd, null);
    assert.equal(result.rows[1].fromDateStart, '08:00');
  } finally { database.close(); }
});

test('leave periods persist and half days add up correctly across month boundaries', async () => {
  for (const [period, startDate, endDate, days] of [
    ['MORNING', '2026-10-01', '2026-10-01', 0.5],
    ['AFTERNOON', '2026-10-31', '2026-10-31', 0.5],
    ['FULL_DAY', '2026-09-30', '2026-10-02', 3],
    ['FULL_DAY', '2026-10-31', '2026-11-02', 3],
  ] as const) {
    const response = await leaves.POST(request('POST', 'user', { type: 'SICK', period, startDate, endDate, reason: 'Test leave' }));
    assert.equal(response.status, 201);
    const saved = await response.json();
    assert.equal(saved.period, period);
    assert.equal(saved.days, days);
    await leaves.PATCH(request('PATCH', 'admin', { id: saved.id, status: 'Approved' }));
  }
  const rows = await (await summary.GET(request('GET', 'user'))).json();
  assert.equal(rows[0].leaveDays, 4);
  const savedLeaves = await (await leaves.GET(request('GET', 'user'))).json();
  assert.equal(savedLeaves.filter((row: { days: number }) => row.days === 0.5).length, 2);
});

test('legacy leave requests default to full days; invalid periods and dates are rejected', async () => {
  const valid = { type: 'SICK', startDate: '2026-10-01', endDate: '2026-10-01', reason: 'Test leave' };
  const legacy = await leaves.POST(request('POST', 'user', valid));
  assert.equal(legacy.status, 201);
  const saved = await legacy.json();
  assert.equal(saved.period, 'FULL_DAY');
  assert.equal(saved.days, 1);
  for (const changes of [
    { period: 'INVALID' }, { period: 'toString' },
    { period: 'MORNING', endDate: '2026-10-02' },
    { period: 'AFTERNOON', endDate: '2026-10-02' },
    { startDate: '2026-10-02' }, { startDate: '2026-02-30' },
    { startDate: 'invalid' },
  ]) {
    assert.equal((await leaves.POST(request('POST', 'user', { ...valid, ...changes }))).status, 400);
  }
  assert.equal(await prisma.leave.count(), 1);
});

test('leave migration preserves old requests and can run twice', async () => {
  const { applyLeavePeriodMigration } = await import('../scripts/apply-leave-period-migration.mjs');
  const database = createClient({ url: `file:${join(temporaryDirectory, 'leave-migration.db')}` });
  try {
    await database.execute('CREATE TABLE "Leave" ("id" TEXT PRIMARY KEY)');
    await database.execute("INSERT INTO \"Leave\" (\"id\") VALUES ('old')");
    assert.equal(await applyLeavePeriodMigration(database), 'applied');
    assert.equal(await applyLeavePeriodMigration(database), 'already-applied');
    const result = await database.execute('SELECT "period" FROM "Leave" WHERE "id" = \'old\'');
    assert.equal(result.rows[0].period, 'FULL_DAY');
  } finally { database.close(); }
});

before(async () => {
  // Build an isolated local SQLite fixture from the actual Prisma schema.
  // No project environment or remote database is loaded by this test command.
  temporaryDirectory = await mkdtemp(join(tmpdir(), 'derive-hr-employees-'));
  process.env.TURSO_DATABASE_URL = `file:${join(temporaryDirectory, 'test.db')}`;
  process.env.TURSO_AUTH_TOKEN = 'local-test-only';
  const database = createClient({ url: process.env.TURSO_DATABASE_URL });
  const { stdout: schemaSql } = await promisify(execFile)(process.execPath, [
    'node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-empty', '--to-schema', 'prisma/schema.prisma', '--script',
  ]);
  await database.executeMultiple(schemaSql);
  database.close();
  ({ prisma } = await import('../src/lib/prisma'));
  employees = await import('../src/app/api/employees/route');
  account = await import('../src/app/api/account/route');
  legacyAccount = await import('../src/app/api/auth/update-account/route');
  onsite = await import('../src/app/api/onsite/route');
  attendance = await import('../src/app/api/attendance/route');
  leaves = await import('../src/app/api/leaves/route');
  workdays = await import('../src/app/api/workday-changes/route');
  summary = await import('../src/app/api/employee-summary/route');
  travel = await import('../src/app/api/travel-config/route');
});

beforeEach(async () => {
  await prisma.$transaction([
    prisma.overtime.deleteMany(), prisma.workdayChangeRequest.deleteMany(),
    prisma.attendance.deleteMany(), prisma.leave.deleteMany(), prisma.onsite.deleteMany(), prisma.employee.deleteMany(),
  ]);
  for (const [id, role] of [['admin', 'ADMIN'], ['user', 'USER'], ['other', 'USER'], ['supervisor', 'ADMIN']]) {
    await prisma.employee.create({ data: { id, name: id, role, department: 'Engineering', position: 'Developer', email: `${id}@example.com`, passwordHash: hashPassword('original123') } });
  }
});

after(async () => {
  if (prisma) await prisma.$disconnect();
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true });
});

test('all employee methods reject unauthenticated and deleted accounts', async () => {
  for (const method of ['GET', 'POST', 'PATCH', 'DELETE'] as const) {
    assert.equal((await employees[method](request(method, undefined, method === 'GET' ? undefined : newEmployee))).status, 401);
    assert.equal((await employees[method](request(method, 'missing', method === 'GET' ? undefined : newEmployee, 'ADMIN'))).status, 401);
  }
});

test('users see only themselves; admins see everyone; no credential hashes are returned', async () => {
  const own = await (await employees.GET(request('GET', 'user', undefined, 'ADMIN'))).json();
  assert.deepEqual(own.map((item: { id: string }) => item.id), ['user']);
  const all = await (await employees.GET(request('GET', 'admin'))).json();
  assert.equal(all.length, 4);
  assert.ok(all.every((item: object) => !('passwordHash' in item) && !('password' in item)));
});

test('users cannot create, delete, or edit another employee, including legacy URLs', async () => {
  assert.equal((await employees.POST(request('POST', 'user', newEmployee))).status, 403);
  assert.equal((await employees.DELETE(request('DELETE', 'user', { id: 'other' }))).status, 403);
  for (const update of [employees.PATCH, account.PATCH, legacyAccount.POST]) {
    assert.equal((await update(request('PATCH', 'user', { id: 'other', email: 'hijack@example.com' }))).status, 403);
  }
  assert.equal((await prisma.employee.findUniqueOrThrow({ where: { id: 'other' } })).email, 'other@example.com');
});

test('admins create login-ready accounts with hashed passwords and no mass-assigned role', async () => {
  const response = await employees.POST(request('POST', 'admin', { ...newEmployee, email: 'NEW@EXAMPLE.COM', role: 'ADMIN', monthlySalaryCents: 999999 }));
  assert.equal(response.status, 201);
  const saved = await response.json();
  const stored = await prisma.employee.findUniqueOrThrow({ where: { id: saved.id } });
  assert.equal(stored.email, 'new@example.com');
  assert.equal(stored.role, 'USER');
  assert.equal(stored.monthlySalaryCents, null);
  assert.ok(verifyPassword(newEmployee.password, stored.passwordHash));
  assert.ok(!('passwordHash' in saved));
});

test('users edit their own profile, preserving a blank password and their role', async () => {
  const before = await prisma.employee.findUniqueOrThrow({ where: { id: 'user' } });
  const response = await employees.PATCH(request('PATCH', 'user', { id: 'user', name: 'Updated name', email: 'UPDATED@EXAMPLE.COM', password: '', role: 'ADMIN', monthlySalaryCents: 999999 }));
  assert.equal(response.status, 200);
  const saved = await prisma.employee.findUniqueOrThrow({ where: { id: 'user' } });
  assert.equal(saved.name, 'Updated name');
  assert.equal(saved.email, 'updated@example.com');
  assert.equal(saved.passwordHash, before.passwordHash);
  assert.equal(saved.role, 'USER');
  assert.equal(saved.monthlySalaryCents, null);
});

test('admins can edit another employee and reset their password', async () => {
  assert.equal((await employees.PATCH(request('PATCH', 'admin', { id: 'other', department: 'Support', position: 'Manager', password: 'replacement123' }))).status, 200);
  const saved = await prisma.employee.findUniqueOrThrow({ where: { id: 'other' } });
  assert.equal(saved.department, 'Support');
  assert.equal(saved.position, 'Manager');
  assert.ok(verifyPassword('replacement123', saved.passwordHash));
  assert.ok(!verifyPassword('original123', saved.passwordHash));
});

test('bank matching names are admin-only, optional, trimmed and validated', async () => {
  assert.equal((await employees.PATCH(request('PATCH', 'user', { id: 'user', kbizName: 'Bank name' }))).status, 403);
  for (const kbizName of [null, 123, 'x'.repeat(255)]) {
    assert.equal((await employees.PATCH(request('PATCH', 'admin', { id: 'other', kbizName }))).status, 400);
  }
  const created = await employees.POST(request('POST', 'admin', { ...newEmployee, kbizName: '  Thai Bank Name  ' }));
  assert.equal(created.status, 201);
  assert.equal((await created.json()).kbizName, 'Thai Bank Name');
  const updated = await employees.PATCH(request('PATCH', 'admin', { id: 'other', kbizName: '   ' }));
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).kbizName, '');
});

test('validation, duplicates, malformed JSON, and missing records return actionable errors', async () => {
  assert.equal((await employees.POST(request('POST', 'admin', { ...newEmployee, password: 'short' }))).status, 400);
  assert.equal((await employees.PATCH(request('PATCH', 'user', { id: 'user', email: 'invalid' }))).status, 400);
  assert.equal((await employees.PATCH(request('PATCH', 'user', { id: 'user', password: 12345678 }))).status, 400);
  assert.equal((await employees.PATCH(request('PATCH', 'user', { id: 'user', email: 'other@example.com' }))).status, 409);
  assert.equal((await employees.POST(request('POST', 'admin', { ...newEmployee, email: 'other@example.com' }))).status, 409);
  assert.equal((await employees.PATCH(request('PATCH', 'admin', { id: 'missing', name: 'Missing' }))).status, 404);
  assert.equal((await employees.DELETE(request('DELETE', 'admin', { id: 'missing' }))).status, 404);
  const malformed = request('PATCH', 'admin');
  assert.equal((await employees.PATCH(malformed)).status, 400);
});

async function createOvertime(employeeId: string, createdById: string, approvedById?: string) {
  return prisma.overtime.create({ data: { employeeId, createdById, approvedById, startAt: new Date('2026-10-07T11:00:00Z'), endAt: new Date('2026-10-07T12:00:00Z'), workedMinutes: 60, hourlyRateCents: 10000, otAmountCents: 10000 } });
}

test('deletion removes owned records atomically and preserves other employees records', async () => {
  const date = new Date('2026-10-07T00:00:00Z');
  await prisma.attendance.create({ data: { employeeId: 'other', date, status: 'PRESENT' } });
  await prisma.leave.create({ data: { employeeId: 'other', type: 'SICK', startDate: date, endDate: date, reason: 'Sick' } });
  await prisma.onsite.create({ data: { employeeId: 'other', location: 'Office', purpose: 'Visit', startDate: date, endDate: date } });
  await prisma.workdayChangeRequest.create({ data: { employeeId: 'other', fromDate: date, toDate: date, project: 'Project', jobDetail: 'Work' } });
  const otherWorkday = await prisma.workdayChangeRequest.create({ data: { employeeId: 'user', approvedById: 'other', fromDate: date, toDate: date, project: 'Project', jobDetail: 'Work' } });
  await createOvertime('other', 'admin');
  const otherOvertime = await createOvertime('user', 'admin', 'other');
  assert.equal((await employees.DELETE(request('DELETE', 'admin', { id: 'other' }))).status, 200);
  assert.equal(await prisma.employee.findUnique({ where: { id: 'other' } }), null);
  for (const count of [await prisma.attendance.count(), await prisma.leave.count(), await prisma.onsite.count(), await prisma.overtime.count({ where: { employeeId: 'other' } })]) assert.equal(count, 0);
  assert.equal((await prisma.workdayChangeRequest.findUniqueOrThrow({ where: { id: otherWorkday.id } })).approvedById, null);
  assert.equal((await prisma.overtime.findUniqueOrThrow({ where: { id: otherOvertime.id } })).approvedById, null);
  assert.equal((await employees.GET(request('GET', 'other'))).status, 401);
});

test('self-deletion and deleting a creator of another employees OT are safely blocked', async () => {
  assert.equal((await employees.DELETE(request('DELETE', 'admin', { id: 'admin' }))).status, 409);
  await createOvertime('user', 'supervisor');
  await prisma.attendance.create({ data: { employeeId: 'supervisor', status: 'PRESENT' } });
  assert.equal((await employees.DELETE(request('DELETE', 'admin', { id: 'supervisor' }))).status, 409);
  assert.equal(await prisma.employee.count({ where: { id: 'supervisor' } }), 1);
  assert.equal(await prisma.attendance.count({ where: { employeeId: 'supervisor' } }), 1);
  assert.equal(await prisma.overtime.count(), 1);
});

test('Onsite requires login, restricts ownership, and never returns employee credentials', async () => {
  const date = new Date('2026-10-07T00:00:00Z');
  for (const employeeId of ['user', 'other']) await prisma.onsite.create({ data: { employeeId, location: 'Office', purpose: 'Visit', startDate: date, endDate: date } });
  assert.equal((await onsite.GET(request())).status, 401);
  const own = await (await onsite.GET(request('GET', 'user'))).json();
  assert.equal(own.length, 1);
  assert.equal(own[0].employee_id, 'user');
  const all = await (await onsite.GET(request('GET', 'admin'))).json();
  assert.equal(all.length, 2);
  assert.ok(all.every((item: { employee: object }) => !('passwordHash' in item.employee) && !('email' in item.employee)));
  const travelBody = { employee_id: 'other', destination: 'Office', date: '2026-10-07', purpose: 'Visit', vehicle: 'TAXI', taxi_fare: 100 };
  assert.equal((await onsite.POST(request('POST', 'user', travelBody))).status, 403);
  const saved = await onsite.POST(request('POST', 'user', { ...travelBody, employee_id: 'user' }));
  assert.equal(saved.status, 201);
  assert.ok(!('passwordHash' in (await saved.json()).employee));
});

test('onsite dates keep the selected Bangkok day when saved and reloaded', async () => {
  // Include month/year boundaries, where UTC slicing also changes the month.
  for (const date of ['2026-10-26', '2026-11-01', '2027-01-01']) {
    const response = await onsite.POST(request('POST', 'user', {
      employee_id: 'user', destination: 'Client office', date,
      purpose: 'Client visit', vehicle: 'TAXI', taxi_fare: 100,
    }));
    assert.equal(response.status, 201);
    const saved = await response.json();
    assert.equal(saved.date, date);
    const listing = await (await onsite.GET(request('GET', 'user'))).json();
    assert.equal(listing.find((item: { id: string }) => item.id === saved.id).date, date);
  }
});

test('HR submission dates and attendance times use Bangkok after UTC date rollover', async () => {
  const createdAt = new Date('2026-10-25T17:30:00Z'); // 26 October, 00:30 in Bangkok.
  const date = new Date('2026-10-26T00:00:00Z'); // Date-only calendar field.
  await prisma.leave.create({ data: {
    employeeId: 'user', type: 'SICK', startDate: date, endDate: date, reason: 'Rest', createdAt,
  } });
  await prisma.workdayChangeRequest.create({ data: {
    employeeId: 'user', fromDate: date, toDate: date, project: 'Client', jobDetail: 'Visit', createdAt,
  } });
  await prisma.attendance.create({ data: {
    employeeId: 'user', date: createdAt, checkIn: createdAt, status: 'PRESENT',
  } });
  const [leave] = await (await leaves.GET(request('GET', 'user'))).json();
  assert.equal(leave.created_at, '2026-10-26');
  assert.equal(leave.start_date, '2026-10-26');
  assert.equal(leave.end_date, '2026-10-26');
  const [workday] = await (await workdays.GET(request('GET', 'user'))).json();
  assert.equal(workday.created_at, '2026-10-26');
  assert.equal(workday.from_date, '2026-10-26');
  assert.equal(workday.to_date, '2026-10-26');
  const [clock] = await (await attendance.GET(request('GET', 'user'))).json();
  assert.equal(clock.date, '2026-10-26');
  assert.equal(clock.clock_in, '00:30');
});

test('onsite expenses stay in the selected Bangkok month in employee summaries', async () => {
  for (const date of ['2026-09-30', '2026-10-01', '2026-10-31', '2026-11-01']) {
    const response = await onsite.POST(request('POST', 'user', {
      employee_id: 'user', destination: 'Client', date, purpose: 'Visit', vehicle: 'TAXI', taxi_fare: 100,
    }));
    assert.equal(response.status, 201);
  }
  const [row] = await (await summary.GET(request('GET', 'user'))).json();
  assert.equal(row.travelExpenses, 200);
});

test('deleted admin sessions cannot access HR data', async () => {
  await prisma.employee.delete({ where: { id: 'supervisor' } });
  for (const get of [attendance.GET, leaves.GET, workdays.GET, summary.GET, travel.GET]) {
    assert.equal((await get(request('GET', 'supervisor', undefined, 'ADMIN'))).status, 401);
  }
});
