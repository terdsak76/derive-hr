import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createClient } from '@libsql/client';
import type { PrismaClient } from '@prisma/client';
import { parseKbizCsv } from '../src/lib/kbiz';
import { applyKbizMigration } from '../scripts/apply-kbiz-migration.mjs';
import { createSessionToken, getSessionCookieName } from '../src/lib/auth';
import { kbizMatch } from '../src/lib/kbiz-matching';
import type { KbizInvoice } from '../src/lib/kbiz';
import { applyDocumentStatusMigration } from '../scripts/apply-document-status-migration.mjs';
import { generateRecurringDocuments } from '../src/lib/recurring-documents';
import { applyVendorPaymentMigration } from '../scripts/apply-vendor-payment-migration.mjs';
import { renderVendorPaymentHtml, vendorPaymentMatch, vendorPaymentAmounts } from '../src/lib/vendor-payments';
import { applyEmployeeReconciliationMigration } from '../scripts/apply-employee-reconciliation-migration.mjs';
import { applyRevenueTaxPaymentMigration } from '../scripts/apply-revenue-tax-payment-migration.mjs';
import { revenueTaxMatch } from '../src/lib/revenue-tax-payments';
import { applyVendorWithholdingMigration } from '../scripts/apply-vendor-withholding-migration.mjs';
import { applyEmployeeKbizNameMigration } from '../scripts/apply-employee-kbiz-name-migration.mjs';
import { matchKbizEmployee } from '../src/lib/kbiz-employees';

let directory: string, prisma: PrismaClient, api: typeof import('../src/app/api/kbiz/route');
let csv: string;
let documents: typeof import('../src/app/api/issued-documents/route');
let vendorApi: typeof import('../src/app/api/vendor-payments/route');
let taxApi: typeof import('../src/app/api/revenue-tax-payments/route');
function request(method = 'GET', body?: unknown, id = 'admin') {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (id) headers.cookie = `${getSessionCookieName()}=${createSessionToken(id, 'ADMIN')}`;
  return new Request('http://localhost/api/kbiz?invoice_month=2026-10', { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
const sample = (deposit = '104.00') => `K-DEPOSIT\n,,,,,,,,,,,016-8-53748-4,\n,วันที่,เวลา/ วันที่มีผล,รายการ,ถอนเงิน,,ฝากเงิน,,ยอดคงเหลือ,,ช่องทาง,,รายละเอียด\n,20-10-26,12:00,รับโอนเงิน,,,${deposit},,${deposit},,K BIZ,,Test`;

before(async () => {
  csv = await readFile('resultFile_20261024_143348.csv', 'utf8').catch(error => {
    if (error.code === 'ENOENT') return '';
    throw error;
  });
  directory = await mkdtemp(join(tmpdir(), 'derive-kbiz-tests-'));
  process.env.TURSO_DATABASE_URL = `file:${join(directory, 'test.db')}`;
  process.env.TURSO_AUTH_TOKEN = 'local-tests-only';
  const database = createClient({ url: process.env.TURSO_DATABASE_URL });
  try {
    const { stdout } = await promisify(execFile)(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-empty', '--to-schema', 'prisma/schema.prisma', '--script']);
    await database.executeMultiple(stdout);
    await database.execute('ALTER TABLE "Employee" DROP COLUMN "kbizName"');
    await database.executeMultiple('DROP TABLE "KbizTaxAllocation"; DROP TABLE "RevenueTaxPayment"; DROP TABLE "KbizEmployeeAllocation"; DROP TABLE "KbizVendorAllocation"; DROP TABLE "VendorPayment"; DROP TABLE "KbizAllocation"; DROP TABLE "KbizTransaction";');
    assert.equal(await applyKbizMigration(database), 'applied');
    assert.equal(await applyKbizMigration(database), 'already-applied');
    assert.equal(await applyVendorPaymentMigration(database), 'applied');
    assert.equal(await applyVendorPaymentMigration(database), 'already-applied');
    assert.equal(await applyEmployeeReconciliationMigration(database), 'applied');
    assert.equal(await applyEmployeeReconciliationMigration(database), 'already-applied');
    assert.equal(await applyEmployeeKbizNameMigration(database), 'applied');
    assert.equal(await applyEmployeeKbizNameMigration(database), 'already-applied');
    assert.equal(await applyRevenueTaxPaymentMigration(database), 'applied');
    assert.equal(await applyRevenueTaxPaymentMigration(database), 'already-applied');
    assert.equal(await applyVendorWithholdingMigration(database), 'applied');
    assert.equal(await applyVendorWithholdingMigration(database), 'already-applied');
  } finally { database.close(); }
  ({ prisma } = await import('../src/lib/prisma'));
  api = await import('../src/app/api/kbiz/route');
  documents = await import('../src/app/api/issued-documents/route');
  vendorApi = await import('../src/app/api/vendor-payments/route');
  taxApi = await import('../src/app/api/revenue-tax-payments/route');
  for (const [id, role] of [['admin', 'ADMIN'], ['employee', 'USER'], ['legacy', 'ROLE_ADMIN']]) {
    await prisma.employee.create({ data: { id, role, email: `${id}@test.local`, name: id, department: 'Test', position: 'Test', passwordHash: 'unused' } });
  }
});
after(async () => { if (prisma) await prisma.$disconnect(); if (directory) await rm(directory, { recursive: true }); });

test('supplied multiline Thai statement parses exactly 5 deposits and 51 withdrawals', context => {
  if (!csv) { context.skip('User-supplied bank statement is not in this checkout'); return; }
  const rows = parseKbizCsv(csv);
  assert.equal(rows.length, 56);
  assert.equal(rows.filter(row => row.depositCents > 0).length, 5);
  assert.equal(rows.reduce((sum, row) => sum + row.depositCents, 0), 492832881);
  assert.equal(rows.reduce((sum, row) => sum + row.withdrawalCents, 0), 137782583);
  assert.equal(rows.at(-1)?.balanceCents, 746878803);
  assert.equal(rows[0].transactionDate, '2026-07-07');
  assert.ok(rows[0].details.includes('SMART SCB'));
  assert.deepEqual(parseKbizCsv(csv.replaceAll('\n', '\r\n')), rows);
});
test('malformed files, dates, amounts, balances and summaries are rejected', () => {
  for (const invalid of ['', 'date,amount\n2026-01-01,100', sample().replace('20-10-26', '31-02-26'), sample('oops'), csv.replace('7,468,788.03', '7,468,788.04'), csv.replace('249,717.01', '249,717.02'), `${sample()}\n"unfinished`]) {
    assert.throws(() => parseKbizCsv(invalid));
  }
});
test('quoted commas, escaped quotes, BOM and multiline fields survive import parsing', () => {
  const fixture = sample().replace('K-DEPOSIT\n', '\uFEFF"K-DEPOSIT\naccount ""name"""\n')
    .replace(',,Test', ',,"Payroll ""July"", cost\ncontinued"');
  const rows = parseKbizCsv(fixture);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].details, 'Payroll "July", cost\ncontinued');
  assert.equal(rows[0].depositCents, 10400);
});

test('employee matching keeps Thai marks, ignores case and spacing, and rejects ambiguity and deposits', () => {
  const employee = { id: 'match', name: 'Display name', kbizName: 'สมชาย ใจดี' };
  const row = { ...parseKbizCsv(sample())[0], depositCents: 0, withdrawalCents: 10400, details: 'โอนไป นายสมชาย  ใจดี ธนาคาร' };
  assert.equal(matchKbizEmployee(row, [employee])?.id, 'match');
  assert.equal(matchKbizEmployee({ ...row, bankDescription: 'Transfer to SOMCHAI', details: '' }, [{ ...employee, kbizName: 'Somchai' }])?.id, 'match');
  assert.equal(matchKbizEmployee({ ...row, details: 'สมชาย ใจด' }, [employee]), null);
  assert.equal(matchKbizEmployee(row, [{ ...employee, kbizName: '   ' }]), null);
  assert.equal(matchKbizEmployee(row, [employee, { ...employee, id: 'duplicate' }]), null);
  assert.equal(matchKbizEmployee(row, [employee, { ...employee, id: 'overlap', kbizName: 'สมชาย' }]), null);
  assert.equal(matchKbizEmployee({ ...row, depositCents: 10400, withdrawalCents: 0 }, [employee]), null);
});

test('bank name migration preserves payment history and extends database payment-type constraints', async () => {
  const database = createClient({ url: `file:${join(directory, 'migration-history.db')}` });
  try {
    await database.executeMultiple('CREATE TABLE "Employee" ("id" TEXT PRIMARY KEY); CREATE TABLE "KbizTransaction" ("id" TEXT PRIMARY KEY);');
    const original = await readFile('prisma/migrations/20261024140000_add_employee_reconciliation/migration.sql', 'utf8');
    for (const statement of original.split(';').map(part => part.trim()).filter(part => part.startsWith('CREATE'))) await database.execute(statement);
    await database.execute("INSERT INTO Employee (id) VALUES ('employee')");
    await database.execute("INSERT INTO KbizTransaction (id) VALUES ('transaction')");
    await database.execute("INSERT INTO KbizEmployeeAllocation VALUES ('historical', 'transaction', 'employee', 'Historical name', 'PAYROLL', '2026-09', 12345)");
    const before = await database.execute('SELECT * FROM KbizEmployeeAllocation');
    assert.equal(await applyEmployeeKbizNameMigration(database), 'applied');
    assert.deepEqual((await database.execute('SELECT * FROM KbizEmployeeAllocation')).rows, before.rows);
    assert.equal((await database.execute('SELECT kbizName FROM Employee')).rows[0].kbizName, '');
    assert.equal(await applyEmployeeKbizNameMigration(database), 'already-applied');
    for (const type of ['PENDING', 'ONSITE', 'OTHERS']) {
      await database.execute({ sql: 'INSERT INTO KbizEmployeeAllocation VALUES (?, ?, ?, ?, ?, ?, ?)', args: [type, 'transaction', 'employee', 'Name', type, '2026-10', 100] });
    }
    await assert.rejects(database.execute("UPDATE KbizEmployeeAllocation SET paymentType = 'INVALID' WHERE id = 'historical'"));
    await assert.rejects(database.execute("UPDATE KbizEmployeeAllocation SET amountCents = 0 WHERE id = 'historical'"));
    await assert.rejects(database.execute("INSERT INTO KbizEmployeeAllocation VALUES ('duplicate', 'transaction', 'employee', 'Name', 'PAYROLL', '2026-09', 100)"));
  } finally { database.close(); }
});

test('imports allocate employee names as pending until admin chooses Salary, Incentive, Onsite or Others', async () => {
  const employee = await prisma.employee.create({ data: { email: 'auto-match@test.local', name: 'Matched employee', kbizName: 'สมชาย ใจดี', department: 'Test', position: 'Test', passwordHash: 'unused' } });
  const fixture = sample('105.00').replace('20-10-26', '25-10-26').replace(',,,105.00,,105.00', ',105.00,,,,105.00').replace(',,Test', ',,โอนไป สมชาย ใจดี');
  const imported = await api.POST(request('POST', { csv: fixture, filename: 'employee.csv' }));
  assert.equal(imported.status, 200);
  assert.deepEqual(await imported.json(), { imported: 1, skipped: 0 });
  const row = await prisma.kbizTransaction.findFirstOrThrow({ where: { sourceFile: 'employee.csv' }, include: { employeeAllocations: true } });
  assert.equal(row.expenseKind, 'EMPLOYEE');
  assert.equal(row.employeeAllocations.length, 1);
  const allocation = row.employeeAllocations[0];
  assert.equal(allocation.employeeId, employee.id);
  assert.equal(allocation.employeeName, employee.name);
  assert.equal(allocation.amountCents, 10500);
  assert.equal(allocation.paymentMonth, '2026-10');
  assert.equal(allocation.paymentType, 'PENDING');
  const status = async () => (await (await api.GET(request())).json()).transactions.find(item => item.id === row.id).reconciliationStatus;
  assert.equal(await status(), 'PENDING');
  assert.equal((await api.PUT(request('PUT', { id: row.id, expenseDescription: 'Review pending' }))).status, 200);
  assert.equal(await status(), 'PENDING', 'notes cannot complete an unclassified allocation');
  const save = (paymentType: string, user = 'admin') => api.PUT(request('PUT', { id: row.id, expenseDescription: '', employeeAllocations: [{ employeeId: employee.id, paymentType, paymentMonth: '2026-10', amountCents: 10500 }] }, user));
  assert.equal((await save('PENDING')).status, 400);
  assert.equal((await save('ONSITE', 'employee')).status, 403);
  for (const type of ['PAYROLL', 'INCENTIVE', 'ONSITE', 'OTHERS']) {
    assert.equal((await save(type)).status, 200);
    assert.equal(await status(), 'COMPLETED');
  }
  const saved = await prisma.kbizEmployeeAllocation.findFirstOrThrow({ where: { transactionId: row.id } });
  assert.deepEqual(await (await api.POST(request('POST', { csv: fixture, filename: 'renamed-employee.csv' }))).json(), { imported: 0, skipped: 1 });
  assert.deepEqual(await prisma.kbizEmployeeAllocation.findMany({ where: { transactionId: row.id } }), [saved]);
});

test('setting a bank matching name allocates existing unclassified withdrawals and preserves reviewed transactions', async () => {
  const employee = await prisma.employee.create({ data: { email: 'backfill@test.local', name: 'Backfill employee', department: 'Test', position: 'Test', passwordHash: 'unused' } });
  const common = { ...parseKbizCsv(sample())[0], details: 'Transfer to BANK MATCH NAME', sourceFile: 'backfill.csv', depositCents: 0, withdrawalCents: 10400 };
  const untouched = await prisma.kbizTransaction.create({ data: { ...common, fingerprint: 'backfill-untouched' } });
  const reviewed = await prisma.kbizTransaction.create({ data: { ...common, fingerprint: 'backfill-reviewed', expenseDescription: 'Office expense' } });
  const deposit = await prisma.kbizTransaction.create({ data: { ...common, fingerprint: 'backfill-deposit', depositCents: 10400, withdrawalCents: 0 } });
  const employeeApi = await import('../src/app/api/employees/route');
  const response = await employeeApi.PATCH(request('PATCH', { id: employee.id, kbizName: '  Bank Match Name  ' }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).kbizName, 'Bank Match Name');
  const allocation = await prisma.kbizEmployeeAllocation.findFirstOrThrow({ where: { transactionId: untouched.id } });
  assert.equal(allocation.employeeId, employee.id);
  assert.equal(allocation.paymentType, 'PENDING');
  for (const row of [reviewed, deposit]) assert.equal(await prisma.kbizEmployeeAllocation.count({ where: { transactionId: row.id } }), 0);
  // Subsequent profile edits do not recreate allocations an admin has removed.
  await prisma.kbizEmployeeAllocation.delete({ where: { id: allocation.id } });
  await prisma.kbizTransaction.update({ where: { id: untouched.id }, data: { expenseKind: 'OTHER' } });
  assert.equal((await employeeApi.PATCH(request('PATCH', { id: employee.id, kbizName: 'Bank Match Name', name: 'Updated display' }))).status, 200);
  assert.equal(await prisma.kbizEmployeeAllocation.count({ where: { transactionId: untouched.id } }), 0);
});
test('all endpoints enforce current database admin role, not cookie claims', async () => {
  for (const id of ['', 'missing', 'employee']) for (const [method, body] of [['GET', undefined], ['POST', {}], ['POST', { action: 'MATCH_EMPLOYEES' }], ['PUT', {}]] as const) {
    const result = await api[method](request(method, body, id));
    assert.equal(result.status, id === 'employee' ? 403 : 401);
  }
  assert.equal((await api.GET(request('GET', undefined, 'legacy'))).status, 200);
});
test('manual matching handles pending withdrawals, preserves existing allocations and is safe to rerun', async () => {
  const employee = await prisma.employee.create({ data: { email: 'manual-match@test.local', name: 'Manual employee', kbizName: 'MANUAL RECIPIENT', department: 'Test', position: 'Test', passwordHash: 'unused' } });
  const common = { ...parseKbizCsv(sample())[0], details: 'Transfer to Manual Recipient', depositCents: 0, withdrawalCents: 10400, sourceFile: 'manual-match.csv' };
  const unclassified = await prisma.kbizTransaction.create({ data: { ...common, transactionDate: '2026-09-20', fingerprint: 'manual-unclassified' } });
  const hidden = await prisma.kbizTransaction.create({ data: { ...common, transactionDate: '2026-08-20', fingerprint: 'manual-hidden' } });
  const note = await prisma.kbizTransaction.create({ data: { ...common, fingerprint: 'manual-note', expenseDescription: 'Reviewed expense' } });
  const deposit = await prisma.kbizTransaction.create({ data: { ...common, fingerprint: 'manual-deposit', depositCents: 10400, withdrawalCents: 0 } });
  const existing = await prisma.kbizTransaction.create({ data: { ...common, fingerprint: 'manual-existing', expenseKind: 'EMPLOYEE', employeeAllocations: { create: { employeeId: employee.id, employeeName: employee.name, paymentType: 'INCENTIVE', paymentMonth: '2026-10', amountCents: 5000 } } } });
  const pending = await prisma.kbizTransaction.create({ data: { ...common, fingerprint: 'manual-pending', expenseKind: 'EMPLOYEE', employeeAllocations: { create: { employeeId: employee.id, employeeName: employee.name, paymentType: 'PENDING', paymentMonth: '2026-10', amountCents: 10400 } } } });
  const previous = await prisma.kbizEmployeeAllocation.findMany({ where: { transactionId: { in: [existing.id, pending.id] } }, orderBy: { id: 'asc' } });
  const transactionIds = [unclassified.id, unclassified.id, note.id, deposit.id, existing.id, pending.id];
  const response = await api.POST(request('POST', { action: 'MATCH_EMPLOYEES', transactionIds }));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(result, { matched: 1, unmatched: 0 });
  const matched = await prisma.kbizEmployeeAllocation.findFirstOrThrow({ where: { transactionId: unclassified.id } });
  assert.equal(matched.employeeId, employee.id);
  assert.equal(matched.paymentType, 'PENDING');
  assert.equal(matched.paymentMonth, '2026-09');
  assert.equal((await prisma.kbizTransaction.findUniqueOrThrow({ where: { id: unclassified.id } })).updatedById, 'admin');
  for (const row of [note, deposit, hidden]) assert.equal(await prisma.kbizEmployeeAllocation.count({ where: { transactionId: row.id } }), 0);
  assert.equal((await prisma.kbizTransaction.findUniqueOrThrow({ where: { id: hidden.id } })).expenseKind, 'OTHER');
  assert.deepEqual(await prisma.kbizEmployeeAllocation.findMany({ where: { transactionId: { in: [existing.id, pending.id] } }, orderBy: { id: 'asc' } }), previous);
  const repeated = await api.POST(request('POST', { action: 'MATCH_EMPLOYEES', transactionIds }));
  assert.equal(repeated.status, 200);
  assert.equal((await repeated.json()).matched, 0);
  assert.deepEqual(await prisma.kbizEmployeeAllocation.findMany({ where: { transactionId: unclassified.id } }), [matched]);
  for (const transactionIds of [undefined, null, 'all', [null], [''], Array(26).fill(hidden.id)]) {
    assert.equal((await api.POST(request('POST', { action: 'MATCH_EMPLOYEES', transactionIds }))).status, 400);
  }
  const empty = await api.POST(request('POST', { action: 'MATCH_EMPLOYEES', transactionIds: [] }));
  assert.equal(empty.status, 200);
  assert.deepEqual(await empty.json(), { matched: 0, unmatched: 0 });
  assert.equal(await prisma.kbizEmployeeAllocation.count({ where: { transactionId: hidden.id } }), 0);
});
test('reimport skips duplicates and preserves admin expense descriptions', async () => {
  const fixture = sample().replace(',,,104.00,,104.00', ',104.00,,,,104.00');
  const first = await api.POST(request('POST', { csv: fixture, filename: 'statement.csv' }));
  assert.equal(first.status, 200); assert.deepEqual(await first.json(), { imported: 1, skipped: 0 });
  const expense = await prisma.kbizTransaction.findFirstOrThrow({ where: { withdrawalCents: { gt: 0 } } });
  assert.equal((await api.PUT(request('PUT', { id: expense.id, expenseDescription: 'Payroll / เงินเดือน' }))).status, 200);
  assert.deepEqual(await (await api.POST(request('POST', { csv: fixture, filename: 'renamed.csv' }))).json(), { imported: 0, skipped: 1 });
  assert.equal((await prisma.kbizTransaction.findUniqueOrThrow({ where: { id: expense.id } })).expenseDescription, 'Payroll / เงินเดือน');
  assert.equal((await api.PUT(request('PUT', { id: expense.id, expenseDescription: 'a'.repeat(501) }))).status, 400);
});
test('partial and split invoice matching, withholding basis, limits and atomic rollback', async () => {
  const project = await prisma.project.create({ data: { name: 'Test', clientName: 'Customer', address: 'Test', taxId: '123' } });
  const invoice = await prisma.projectInvoice.create({ data: { projectId: project.id, installment: '1', invoiceDate: new Date('2026-10-01T00:00:00Z'), billingDescription: 'Test', amount: 100, invoiceNumber: 'INV-TEST' } });
  const recurring = await prisma.invoiceSchedule.create({ data: { client: 'Client', name: 'Recurring customer', product: '', service: '', description: 'Service', period: 'month', issueDay: 1, amount: 100, address: '', taxId: '' } });
  const referenceKey = `project:${invoice.id}`, recurringKey = `recurring:${recurring.id}:2026-10`;
  for (const [key, type, id, number] of [[referenceKey, 'PROJECT', invoice.id, invoice.invoiceNumber], [recurringKey, 'RECURRING', recurring.id, 'INV-RECURRING']]) {
    const response = await documents.POST(request('POST', { document_type: 'INVOICE', source_type: type, reference_key: key, source_id: id, document_number: number }));
    assert.equal(response.status, 201);
  }
  await api.POST(request('POST', { csv: sample('150.00'), filename: 'split.csv' }));
  await api.POST(request('POST', { csv: sample('104.00'), filename: 'partial.csv' }));
  const first = await prisma.kbizTransaction.findFirstOrThrow({ where: { sourceFile: 'split.csv' } });
  const second = await prisma.kbizTransaction.findFirstOrThrow({ where: { sourceFile: 'partial.csv' } });
  const save = (id: string, allocations: unknown[]) => api.PUT(request('PUT', { id, allocations }));
  const allocation = (key: string, amountCents: number, basis = 'NET') => ({ referenceKey: key, amountCents, basis });
  assert.equal((await save(first.id, [allocation(referenceKey, 5000), allocation(recurringKey, 10000)])).status, 200);
  assert.equal((await prisma.issuedDocument.findFirstOrThrow({ where: { referenceKey } })).status, 'ISSUED');
  assert.equal((await save(second.id, [allocation(referenceKey, 5400)])).status, 200);
  assert.equal((await prisma.issuedDocument.findFirstOrThrow({ where: { referenceKey } })).status, 'COMPLETED');
  const reprint = await documents.POST(request('POST', { document_type: 'INVOICE', source_type: 'PROJECT', reference_key: referenceKey, source_id: invoice.id, document_number: invoice.invoiceNumber }));
  assert.equal((await reprint.json()).status, 'COMPLETED');
  for (const invalid of [[allocation(referenceKey, 5401)], [allocation(referenceKey, 5300, 'GROSS')], [allocation(referenceKey, 5000), allocation(referenceKey, 1)], [allocation('project:missing', 1)], [allocation(referenceKey, -1)]]) {
    assert.equal((await save(second.id, invalid)).status, 400);
    assert.equal((await prisma.kbizAllocation.findFirstOrThrow({ where: { transactionId: second.id } })).amountCents, 5400);
  }
  // Two otherwise valid invoices cannot exceed the bank deposit.
  assert.equal((await save(second.id, [allocation(referenceKey, 5400), allocation(recurringKey, 400)])).status, 200);
  // This would exceed invoice capacity; original matches remain intact.
  assert.equal((await save(second.id, [allocation(referenceKey, 5400), allocation(recurringKey, 500)])).status, 400);
  assert.equal((await save(second.id, [])).status, 200);
  assert.equal((await prisma.issuedDocument.findFirstOrThrow({ where: { referenceKey } })).status, 'ISSUED');
  assert.equal(await prisma.kbizAllocation.count({ where: { transactionId: second.id } }), 0);
  const result = await (await api.GET(request())).json();
  assert.equal(result.invoices.find(item => item.referenceKey === referenceKey).allocatedCents, 5000);
  assert.equal(result.invoices.find(item => item.referenceKey === recurringKey).netCents, 10400);
  const fresh = await prisma.projectInvoice.create({ data: { projectId: project.id, installment: '2', invoiceDate: new Date('2026-10-01T00:00:00Z'), billingDescription: 'Test', amount: 1000, invoiceNumber: 'INV-LARGE' } });
  assert.equal((await save(second.id, [allocation(`project:${fresh.id}`, 10400)])).status, 400, 'unprinted invoice cannot be reconciled');
  await documents.POST(request('POST', { document_type: 'INVOICE', source_type: 'PROJECT', reference_key: `project:${fresh.id}`, source_id: fresh.id, document_number: fresh.invoiceNumber }));
  assert.equal((await save(second.id, [allocation(`project:${fresh.id}`, 10401)])).status, 400);
  assert.equal((await save(second.id, [allocation(`project:${fresh.id}`, 10400, 'GROSS')])).status, 200);
});

test('document lifecycle persists INITIAL drafts, prints snapshots and finds earlier-month bills', async () => {
  const schedule = await prisma.invoiceSchedule.create({ data: { client: 'TWS', name: 'TWS Solutions Company Limited', product: '', service: '', description: 'July maintenance', period: 'month', issueDay: 1, amount: 100, address: '', taxId: '' } });
  const referenceKey = `recurring:${schedule.id}:2026-07`;
  const body = { document_type: 'INVOICE', source_type: 'RECURRING', source_id: schedule.id, reference_key: referenceKey, document_number: 'INV-2026-099' };
  const draft = await documents.POST(request('POST', { ...body, action: 'INITIAL' }));
  assert.equal(draft.status, 201); assert.equal((await draft.json()).status, 'INITIAL');
  assert.equal((await prisma.issuedDocument.findFirstOrThrow({ where: { referenceKey } })).status, 'INITIAL');
  const printed = await documents.POST(request('POST', body));
  assert.equal((await printed.json()).status, 'ISSUED');
  await prisma.invoiceSchedule.update({ where: { id: schedule.id }, data: { amount: 200, description: 'Edited later' } });
  const result = await (await api.GET(request())).json();
  const candidate = result.invoices.find(item => item.referenceKey === referenceKey);
  assert.equal(candidate.month, '2026-07'); assert.equal(candidate.netCents, 10400); assert.equal(candidate.description, 'July maintenance');
  assert.equal((await documents.POST(request('POST', { ...body, action: 'INITIAL' }))).status, 200);
  assert.equal((await prisma.issuedDocument.findFirstOrThrow({ where: { referenceKey } })).status, 'ISSUED', 'opening print dialog cannot downgrade a printed document');
});

test('description matching ranks document numbers, abbreviated payer names and amounts', () => {
  const row = parseKbizCsv(sample())[0];
  const invoice: KbizInvoice = { referenceKey: 'test', invoiceNumber: 'INV-2026-099', customer: 'TWS Solutions Company Limited', description: 'July maintenance', month: '2026-07', netCents: 10400, grossCents: 10700, allocatedCents: 0, status: 'ISSUED' };
  const nameMatch = kbizMatch({ ...row, details: 'จาก SMART SCB X7293 TWS SOLUTIONS COMP++' }, invoice);
  assert.equal(nameMatch.score, 60);
  assert.ok(kbizMatch({ ...row, details: 'Payment INV-2026-099' }, invoice).score > nameMatch.score);
  assert.equal(kbizMatch(row, { ...invoice, status: 'INITIAL' }).score, 0);
  assert.equal(kbizMatch({ ...row, depositCents: 10, details: 'SCB cheque 123' }, invoice).score, 0);
  assert.equal(kbizMatch({ ...row, details: 'จาก SMART SCB X7293 TWS SOLUTIONS COMP++' }, { ...invoice, customer: 'บริษัท ทีดับบลิวเอส โซลูชั่นส์ จำกัด', customerCode: 'TWSS' }).score, 45);
});

test('document status migration preserves existing numbers and marks historical rows issued', async () => {
  const db = createClient({ url: 'file::memory:' });
  try {
    await db.execute('CREATE TABLE IssuedDocument (id TEXT PRIMARY KEY, documentNumber TEXT)');
    await db.execute("INSERT INTO IssuedDocument VALUES ('old', 'INV-OLD')");
    assert.equal(await applyDocumentStatusMigration(db), 'applied');
    assert.equal(await applyDocumentStatusMigration(db), 'already-applied');
    const old = (await db.execute('SELECT * FROM IssuedDocument')).rows[0];
    assert.equal(old.documentNumber, 'INV-OLD'); assert.equal(old.status, 'ISSUED');
    await db.execute("INSERT INTO IssuedDocument (id, documentNumber) VALUES ('new', 'INV-NEW')");
    assert.equal((await db.execute("SELECT status FROM IssuedDocument WHERE id='new'")).rows[0].status, 'INITIAL');
    await db.execute("UPDATE IssuedDocument SET status='COMPLETED' WHERE id='old'");
    await db.execute('ALTER TABLE IssuedDocument DROP COLUMN grossCents');
    assert.equal(await applyDocumentStatusMigration(db), 'applied');
    assert.equal((await db.execute("SELECT status FROM IssuedDocument WHERE id='old'")).rows[0].status, 'COMPLETED', 'resuming a compatible partial schema preserves existing statuses');
  } finally { db.close(); }
});

test('scheduled draft generation respects monthly, quarterly and annual dates and preserves existing documents', async () => {
  const common = { client: 'Generation test', name: 'Scheduled customer', product: '', service: '', description: 'Scheduled service', amount: 100, address: '', taxId: '' };
  const monthly = await prisma.invoiceSchedule.create({ data: { ...common, period: 'month', issueDay: 31 } });
  const quarterly = await prisma.invoiceSchedule.create({ data: { ...common, period: 'quarter', issueDay: 5, issueMonth: 1 } });
  const annually = await prisma.invoiceSchedule.create({ data: { ...common, period: 'year', issueDay: 28, issueMonth: 1 } });
  const late = await prisma.invoiceSchedule.create({ data: { ...common, period: 'year', issueDay: 28, issueMonth: 10 } });
  const preview = await generateRecurringDocuments(prisma, '2026-01', '2026-10-24');
  assert.equal(preview.created, 0);
  assert.equal(preview.documents.filter(item => item.referenceKey.startsWith(`recurring:${monthly.id}:`)).length, 9);
  assert.equal(preview.documents.filter(item => item.referenceKey.startsWith(`recurring:${quarterly.id}:`)).length, 4);
  assert.equal(preview.documents.filter(item => item.referenceKey.startsWith(`recurring:${annually.id}:`)).length, 1);
  assert.equal(preview.documents.filter(item => item.referenceKey.startsWith(`recurring:${late.id}:`)).length, 0);
  assert.equal(preview.documents.find(item => item.referenceKey === `recurring:${monthly.id}:2026-02`)?.scheduledDate, '2026-02-28');
  const existing = await prisma.issuedDocument.findMany({ where: { status: { in: ['ISSUED', 'COMPLETED'] } } });
  const result = await prisma.$transaction(tx => generateRecurringDocuments(tx, '2026-01', '2026-10-24', true));
  assert.equal(result.created, preview.pending);
  assert.equal((await generateRecurringDocuments(prisma, '2026-01', '2026-10-24')).pending, 0);
  const created = await prisma.issuedDocument.findFirstOrThrow({ where: { referenceKey: `recurring:${monthly.id}:2026-02` } });
  assert.equal(created.status, 'INITIAL'); assert.equal(created.netCents, 10400);
  assert.equal(created.issuedAt.toISOString(), '2026-02-27T17:00:00.000Z');
  for (const document of existing) {
    const current = await prisma.issuedDocument.findUniqueOrThrow({ where: { id: document.id } });
    assert.equal(current.status, document.status); assert.equal(current.documentNumber, document.documentNumber);
  }
});

const vendorBody = { vendorName: 'Test Vendor', taxId: '0105556107148', amount: '100.00', paymentDate: '2026-10-24', description: 'Consulting services' };
async function createVendor(overrides = {}) {
  const response = await vendorApi.POST(request('POST', { ...vendorBody, ...overrides }));
  assert.equal(response.status, 201);
  return response.json();
}
const printVendor = (id: string) => vendorApi.PATCH(request('PATCH', { id, action: 'PRINT' }));
const matchVendors = (id: string, vendorAllocations: unknown[], expenseDescription = '') => api.PUT(request('PUT', { id, vendorAllocations, expenseDescription }));

test('vendor payments enforce admin access, validate money and lock details after printing', async () => {
  for (const id of ['', 'missing', 'employee']) {
    const expected = id === 'employee' ? 403 : 401;
    assert.equal((await vendorApi.GET(request('GET', undefined, id))).status, expected);
    assert.equal((await vendorApi.POST(request('POST', vendorBody, id))).status, expected);
    assert.equal((await vendorApi.PATCH(request('PATCH', { id: 'x', action: 'PRINT' }, id))).status, expected);
  }
  assert.equal((await vendorApi.GET(request('GET', undefined, 'legacy'))).status, 200);
  for (const overrides of [{ vendorName: '' }, { taxId: '' }, { amount: '0' }, { amount: '-1' }, { amount: '0.001' }, { amount: '21474836.48' }, { amount: 'NaN' }, { paymentDate: '2026-02-31' }, { description: 'a'.repeat(501) }]) {
    assert.equal((await vendorApi.POST(request('POST', { ...vendorBody, ...overrides }))).status, 400);
  }
  const payment = await createVendor({ amount: '100.01' });
  assert.equal(payment.amountCents, 10001); assert.equal(payment.status, 'INITIAL'); assert.equal(payment.printedAt, null);
  const editBody = { ...vendorBody, id: payment.id, action: 'UPDATE', vendorName: 'Edited Vendor' };
  assert.equal((await vendorApi.PATCH(request('PATCH', editBody))).status, 200);
  const printed = await (await printVendor(payment.id)).json();
  assert.equal(printed.status, 'PRINTED'); assert.equal(printed.vendorName, 'Edited Vendor'); assert.ok(printed.printedAt);
  assert.equal((await vendorApi.PATCH(request('PATCH', editBody))).status, 409);
  assert.equal((await vendorApi.PATCH(request('PATCH', { id: payment.id, action: 'COMPLETED' }))).status, 400);
  assert.equal((await printVendor('missing')).status, 404);
});

test('vendor reconciliation supports partial and split withdrawals, prevents overpayment and reopens removed matches', async () => {
  const a = await createVendor(), b = await createVendor({ amount: '50' }), c = await createVendor();
  const initial = await createVendor();
  await printVendor(a.id); await printVendor(b.id); await printVendor(c.id);
  const common = { accountNumber: '016-8-53748-4', transactionDate: '2026-10-24', transactionTime: '12:00', bankDescription: 'Transfer', channel: 'K BIZ', details: 'Test Vendor', depositCents: 0, balanceCents: 100000, sourceFile: 'vendor-test.csv' };
  const first = await prisma.kbizTransaction.create({ data: { ...common, fingerprint: 'vendor-first', withdrawalCents: 12000 } });
  const second = await prisma.kbizTransaction.create({ data: { ...common, fingerprint: 'vendor-second', withdrawalCents: 4000 } });
  const deposit = await prisma.kbizTransaction.create({ data: { ...common, fingerprint: 'vendor-deposit', withdrawalCents: 0, depositCents: 10000 } });
  const allocation = (vendorPaymentId: string, amountCents: number) => ({ vendorPaymentId, amountCents });
  assert.equal((await matchVendors(first.id, [allocation(a.id, 6000), allocation(b.id, 5000)])).status, 200);
  assert.equal((await prisma.vendorPayment.findUniqueOrThrow({ where: { id: a.id } })).status, 'PRINTED');
  assert.equal((await prisma.vendorPayment.findUniqueOrThrow({ where: { id: b.id } })).status, 'COMPLETED');
  assert.equal((await matchVendors(second.id, [allocation(a.id, 4000)])).status, 200);
  assert.equal((await prisma.vendorPayment.findUniqueOrThrow({ where: { id: a.id } })).status, 'COMPLETED');
  const originalPrintTime = (await prisma.vendorPayment.findUniqueOrThrow({ where: { id: a.id } })).printedAt;
  assert.equal((await (await printVendor(a.id)).json()).status, 'COMPLETED');
  assert.equal((await prisma.vendorPayment.findUniqueOrThrow({ where: { id: a.id } })).printedAt?.toISOString(), originalPrintTime?.toISOString());
  for (const invalid of [[allocation(a.id, 4001)], [allocation(c.id, 5000)], [allocation(initial.id, 1)], [allocation('missing', 1)], [allocation(a.id, -1)], [allocation(a.id, 1), allocation(a.id, 2)], [null]]) {
    assert.equal((await matchVendors(second.id, invalid)).status, 400);
    assert.equal((await prisma.kbizVendorAllocation.findFirstOrThrow({ where: { transactionId: second.id } })).amountCents, 4000);
    assert.equal((await prisma.vendorPayment.findUniqueOrThrow({ where: { id: a.id } })).status, 'COMPLETED');
  }
  assert.equal((await matchVendors(deposit.id, [allocation(c.id, 1000)])).status, 400);
  assert.equal((await api.PUT(request('PUT', { id: second.id, expenseDescription: 'Services' }))).status, 200);
  assert.equal(await prisma.kbizVendorAllocation.count({ where: { transactionId: second.id } }), 1, 'description-only updates preserve existing matches');
  assert.equal((await matchVendors(second.id, [])).status, 200);
  assert.equal((await prisma.vendorPayment.findUniqueOrThrow({ where: { id: a.id } })).status, 'PRINTED');
  assert.equal((await prisma.vendorPayment.findUniqueOrThrow({ where: { id: b.id } })).status, 'COMPLETED');
  const listing = await (await vendorApi.GET(request())).json();
  const saved = listing.find(item => item.id === a.id);
  assert.equal(saved.allocatedCents, 6000); assert.equal(saved.allocations[0].transaction.transactionDate, '2026-10-24');
  const bankListing = await (await api.GET(request())).json();
  assert.equal(bankListing.vendorPayments.find(item => item.id === b.id).status, 'COMPLETED');
  assert.equal(bankListing.transactions.find(item => item.id === first.id).vendorAllocations.length, 2);
});

test('vendor voucher escapes user content and withdrawal suggestions never use deposits', () => {
  const payment = { id: 'test', paymentNumber: 'VP-TEST', vendorName: 'Test <script>alert(1)</script>', taxId: '1234567890', amountCents: 10400, paymentDate: '2026-10-24', description: '<img onerror=alert(1)>', status: 'PRINTED', printedAt: null, allocatedCents: 0 };
  const html = renderVendorPaymentHtml(payment);
  assert.ok(html.includes('104.00')); assert.ok(html.includes('&lt;script&gt;')); assert.ok(!html.includes('<script>')); assert.ok(!html.includes('<img onerror'));
  const row = parseKbizCsv(sample())[0];
  assert.equal(vendorPaymentMatch(row, payment).score, 0);
  assert.equal(vendorPaymentMatch({ ...row, depositCents: 0, withdrawalCents: 10400 }, payment).score, 20);
  assert.equal(vendorPaymentMatch({ ...row, depositCents: 0, withdrawalCents: 10400 }, { ...payment, status: 'INITIAL' }).score, 0);
});

test('payroll and incentive matching completes withdrawals without vendors and reopens when unmatched', async () => {
  const employee = await prisma.employee.create({ data: { id: 'payroll-employee', name: 'Payroll Employee', role: 'USER', email: 'payroll@test.local', department: 'Test', position: 'Test', passwordHash: 'unused' } });
  const common = { accountNumber: '016-8-53748-4', transactionDate: '2026-10-24', transactionTime: '12:00', bankDescription: 'Payroll', channel: 'K BIZ', details: 'Payroll employee', balanceCents: 100000, sourceFile: 'employee-test.csv' };
  const row = await prisma.kbizTransaction.create({ data: { ...common, fingerprint: 'employee-payment', withdrawalCents: 10000, depositCents: 0 } });
  const deposit = await prisma.kbizTransaction.create({ data: { ...common, fingerprint: 'employee-deposit', withdrawalCents: 0, depositCents: 10000 } });
  const allocation = (amountCents: number, paymentType = 'PAYROLL', employeeId = employee.id) => ({ employeeId, paymentType, paymentMonth: '2026-09', amountCents, employeeName: 'Forged name' });
  const save = (employeeAllocations: unknown[], overrides = {}) => api.PUT(request('PUT', { id: row.id, expenseKind: 'EMPLOYEE', expenseDescription: 'Payroll and incentive', vendorAllocations: [], employeeAllocations, ...overrides }));
  const status = async () => (await (await api.GET(request())).json()).transactions.find(item => item.id === row.id);
  assert.equal((await save([allocation(6000)])).status, 200);
  assert.equal((await status()).reconciliationStatus, 'PARTIAL');
  assert.equal((await save([allocation(6000), allocation(4000, 'INCENTIVE')])).status, 200);
  let saved = await status();
  assert.equal(saved.reconciliationStatus, 'COMPLETED'); assert.equal(saved.expenseKind, 'EMPLOYEE');
  assert.equal(saved.vendorAllocations.length, 0); assert.equal(saved.employeeAllocations.length, 2);
  assert.equal(saved.employeeAllocations[0].employeeName, employee.name);
  for (const invalid of [[allocation(10001)], [allocation(0)], [allocation(-1)], [allocation(1.5)], [allocation(10000, 'OTHER')], [allocation(10000, 'PAYROLL', 'missing')], [allocation(4000), allocation(6000)], [{ ...allocation(10000), paymentMonth: '2026-13' }], [null]]) {
    assert.equal((await save(invalid)).status, 400);
    assert.equal((await status()).reconciliationStatus, 'COMPLETED');
    assert.equal(await prisma.kbizEmployeeAllocation.count({ where: { transactionId: row.id } }), 2);
  }
  assert.equal((await save([allocation(10000)], { id: deposit.id })).status, 400);
  assert.equal((await api.PUT(request('PUT', { id: row.id, expenseDescription: 'Updated note' }))).status, 200);
  assert.equal((await status()).employeeAllocations.length, 2);
  const employeeApi = await import('../src/app/api/employees/route');
  assert.equal((await employeeApi.DELETE(request('DELETE', { id: employee.id }))).status, 409);
  assert.ok(await prisma.employee.findUnique({ where: { id: employee.id } }));
  const listing = await (await api.GET(request())).json();
  assert.deepEqual(Object.keys(listing.employees.find(item => item.id === employee.id)).sort(), ['department', 'id', 'name']);
  assert.equal((await save([])).status, 200);
  assert.equal((await status()).reconciliationStatus, 'INITIAL', 'a note alone cannot close an unmatched employee payment');
  assert.equal((await api.PUT(request('PUT', { id: row.id, expenseDescription: 'Still payroll' }))).status, 200);
  assert.equal((await status()).reconciliationStatus, 'INITIAL');
  // One bulk withdrawal can pay several employees, with no vendor needed.
  assert.equal((await save([allocation(7000), allocation(3000, 'PAYROLL', 'employee')])).status, 200);
  saved = await status(); assert.equal(saved.reconciliationStatus, 'COMPLETED');
  assert.equal(new Set(saved.employeeAllocations.map(item => item.employeeId)).size, 2);
});

test('switching a vendor withdrawal to employee payments releases the vendor match atomically', async () => {
  const payment = await createVendor(); await printVendor(payment.id);
  const row = await prisma.kbizTransaction.create({ data: { accountNumber: '016-8-53748-4', transactionDate: '2026-10-24', transactionTime: '12:00', bankDescription: 'Transfer', channel: 'K BIZ', details: 'Employee', depositCents: 0, withdrawalCents: 10000, balanceCents: 100000, fingerprint: 'switch-employee', sourceFile: 'test.csv' } });
  assert.equal((await matchVendors(row.id, [{ vendorPaymentId: payment.id, amountCents: 10000 }])).status, 200);
  assert.equal((await prisma.vendorPayment.findUniqueOrThrow({ where: { id: payment.id } })).status, 'COMPLETED');
  const employeeAllocations = [{ employeeId: 'employee', paymentType: 'INCENTIVE', paymentMonth: '2026-10', amountCents: 10000 }];
  // Without explicitly removing the vendor, mixing both classifications is rejected.
  assert.equal((await api.PUT(request('PUT', { id: row.id, expenseDescription: '', employeeAllocations }))).status, 400);
  assert.equal((await api.PUT(request('PUT', { id: row.id, expenseKind: 'EMPLOYEE', expenseDescription: '', vendorAllocations: [], employeeAllocations }))).status, 200);
  assert.equal((await prisma.vendorPayment.findUniqueOrThrow({ where: { id: payment.id } })).status, 'PRINTED');
  assert.equal(await prisma.kbizVendorAllocation.count({ where: { transactionId: row.id } }), 0);
  assert.equal(await prisma.kbizEmployeeAllocation.count({ where: { transactionId: row.id } }), 1);
});

test('Revenue Department payments require admin access, month and valid money', async () => {
  const body = { paymentMonth: '2026-10', amount: '1250.01' };
  for (const id of ['', 'missing', 'employee']) for (const method of ['GET', 'POST', 'PATCH'] as const) {
    assert.equal((await taxApi[method](request(method, method === 'GET' ? undefined : body, id))).status, id === 'employee' ? 403 : 401);
  }
  assert.equal((await taxApi.GET(request('GET', undefined, 'legacy'))).status, 200);
  for (const overrides of [{ paymentMonth: '2026-13' }, { paymentMonth: '' }, { amount: 0 }, { amount: -1 }, { amount: '0.001' }, { amount: '21474836.48' }, { amount: 'NaN' }]) {
    assert.equal((await taxApi.POST(request('POST', { ...body, ...overrides }))).status, 400);
  }
  const createdResponse = await taxApi.POST(request('POST', { ...body, status: 'COMPLETED' }));
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  assert.equal(created.amountCents, 125001); assert.equal(created.status, 'INITIAL');
  assert.equal((await taxApi.PATCH(request('PATCH', { id: created.id, paymentMonth: '2026-09', amount: '100' }))).status, 200);
  assert.equal((await taxApi.PATCH(request('PATCH', { id: 'missing', ...body }))).status, 404);
});

test('tax reconciliation supports multiple withdrawals, caps amounts and recalculates completed status on unmatch', async () => {
  const create = async (amount: string) => {
    const response = await taxApi.POST(request('POST', { paymentMonth: '2026-10', amount }));
    assert.equal(response.status, 201); return response.json();
  };
  const a = await create('100'), b = await create('50'), c = await create('200');
  const common = { accountNumber: '016-8-53748-4', transactionDate: '2026-10-24', transactionTime: '12:00', bankDescription: 'ชำระเงิน', channel: 'K BIZ', details: 'กรมสรรพากร', depositCents: 0, balanceCents: 100000, sourceFile: 'tax-test.csv' };
  const first = await prisma.kbizTransaction.create({ data: { ...common, fingerprint: 'tax-first', withdrawalCents: 12000 } });
  const second = await prisma.kbizTransaction.create({ data: { ...common, fingerprint: 'tax-second', withdrawalCents: 4000 } });
  const deposit = await prisma.kbizTransaction.create({ data: { ...common, fingerprint: 'tax-deposit', withdrawalCents: 0, depositCents: 10000 } });
  const allocation = (taxPaymentId: string, amountCents: number) => ({ taxPaymentId, amountCents });
  const save = (id: string, taxAllocations: unknown[], overrides = {}) => api.PUT(request('PUT', { id, taxAllocations, expenseDescription: '', expenseKind: 'OTHER', vendorAllocations: [], employeeAllocations: [], ...overrides }));
  assert.equal((await save(first.id, [allocation(a.id, 6000), allocation(b.id, 5000)])).status, 200);
  assert.equal((await prisma.revenueTaxPayment.findUniqueOrThrow({ where: { id: a.id } })).status, 'PARTIAL');
  assert.equal((await prisma.revenueTaxPayment.findUniqueOrThrow({ where: { id: b.id } })).status, 'COMPLETED');
  assert.equal((await save(second.id, [allocation(a.id, 4000)])).status, 200);
  assert.equal((await prisma.revenueTaxPayment.findUniqueOrThrow({ where: { id: a.id } })).status, 'COMPLETED');
  assert.equal((await taxApi.PATCH(request('PATCH', { id: a.id, paymentMonth: '2026-10', amount: '100' }))).status, 409);
  for (const invalid of [[allocation(a.id, 4001)], [allocation(c.id, 5000)], [allocation('missing', 1)], [allocation(a.id, 0)], [allocation(a.id, 1.5)], [allocation(a.id, 1000), allocation(a.id, 1000)], [null]]) {
    assert.equal((await save(second.id, invalid)).status, 400);
    assert.equal((await prisma.kbizTaxAllocation.findFirstOrThrow({ where: { transactionId: second.id } })).amountCents, 4000);
  }
  assert.equal((await save(deposit.id, [allocation(c.id, 1000)])).status, 400);
  const vendor = await createVendor(); await printVendor(vendor.id);
  assert.equal((await save(second.id, [allocation(a.id, 4000)], { vendorAllocations: [{ vendorPaymentId: vendor.id, amountCents: 1 }] })).status, 400);
  const listing = await (await taxApi.GET(request())).json();
  assert.equal(listing.find(item => item.id === a.id).allocatedCents, 10000);
  assert.equal(listing.find(item => item.id === a.id).allocations.length, 2);
  const bank = await (await api.GET(request())).json();
  assert.equal(bank.taxPayments.find(item => item.id === a.id).status, 'COMPLETED');
  assert.equal(bank.transactions.find(item => item.id === second.id).reconciliationStatus, 'COMPLETED');
  assert.equal(bank.transactions.find(item => item.id === first.id).reconciliationStatus, 'PARTIAL');
  assert.equal((await save(second.id, [])).status, 200);
  assert.equal((await prisma.revenueTaxPayment.findUniqueOrThrow({ where: { id: a.id } })).status, 'PARTIAL');
  assert.equal((await save(first.id, [])).status, 200);
  assert.equal((await prisma.revenueTaxPayment.findUniqueOrThrow({ where: { id: a.id } })).status, 'INITIAL');
  assert.equal((await prisma.revenueTaxPayment.findUniqueOrThrow({ where: { id: b.id } })).status, 'INITIAL');
  assert.equal((await taxApi.PATCH(request('PATCH', { id: a.id, paymentMonth: '2026-09', amount: '120' }))).status, 200);
  // Switching to another payment type clears the tax match and reopens its item.
  assert.equal((await save(second.id, [allocation(a.id, 4000)])).status, 200);
  assert.equal((await api.PUT(request('PUT', { id: second.id, expenseKind: 'EMPLOYEE', expenseDescription: '', taxAllocations: [], vendorAllocations: [], employeeAllocations: [{ employeeId: 'employee', paymentType: 'PAYROLL', paymentMonth: '2026-10', amountCents: 4000 }] }))).status, 200);
  assert.equal((await prisma.revenueTaxPayment.findUniqueOrThrow({ where: { id: a.id } })).status, 'INITIAL');
});

test('tax payment suggestions use the Revenue Department recipient, amount and month', () => {
  const row = { ...parseKbizCsv(sample())[0], depositCents: 0, withdrawalCents: 10400, details: 'กรมสรรพากรเพื่อรับชำระภาษีผ่านอินเทอร์เน็ต' };
  const payment = { id: 'test', paymentNumber: 'RD-2026-10-TEST', paymentMonth: '2026-10', amountCents: 10400, allocatedCents: 0, status: 'INITIAL' };
  assert.equal(revenueTaxMatch(row, payment).score, 35);
  assert.equal(revenueTaxMatch({ ...row, depositCents: 10400, withdrawalCents: 0 }, payment).score, 0);
  assert.equal(revenueTaxMatch(row, { ...payment, status: 'COMPLETED' }).score, 0);
});

test('vendor withholding calculates 3% on the entered base and reconciles the net payment', async () => {
  for (const overrides of [{ withholdingEnabled: 'yes' }, { withholdingEnabled: true }, { withholdingEnabled: true, withholdingBase: '100.001' }, { withholdingEnabled: true, withholdingBase: '2000' }, { withholdingEnabled: true, withholdingBase: '0' }]) {
    assert.equal((await vendorApi.POST(request('POST', { ...vendorBody, amount: '1070', ...overrides }))).status, 400);
  }
  const payment = await createVendor({ amount: '1070', withholdingEnabled: true, withholdingBase: '1000' });
  assert.equal(payment.withholdingRate, 3); assert.equal(payment.withholdingBaseCents, 100000);
  assert.equal(payment.withholdingCents, 3000); assert.equal(payment.netCents, 104000);
  await printVendor(payment.id);
  assert.equal(await prisma.revenueTaxPayment.count({ where: { vendorPaymentId: payment.id } }), 0, 'printing does not create payable before actual payment is reconciled');
  const html = renderVendorPaymentHtml(payment);
  assert.ok(html.includes('3%')); assert.ok(html.includes('1,040.00')); assert.ok(html.includes('30.00'));
  const common = { accountNumber: '016-8-53748-4', transactionDate: '2026-10-24', transactionTime: '12:00', bankDescription: 'Transfer', channel: 'K BIZ', details: 'Test Vendor', depositCents: 0, balanceCents: 100000, sourceFile: 'withholding-test.csv' };
  const row = await prisma.kbizTransaction.create({ data: { ...common, fingerprint: 'withholding-vendor', withdrawalCents: 104000 } });
  const allocation = [{ vendorPaymentId: payment.id, amountCents: 104000 }];
  assert.equal((await matchVendors(row.id, [{ vendorPaymentId: payment.id, amountCents: 107000 }])).status, 400);
  assert.equal((await matchVendors(row.id, allocation)).status, 200);
  assert.equal((await prisma.vendorPayment.findUniqueOrThrow({ where: { id: payment.id } })).status, 'COMPLETED');
  const payable = await prisma.revenueTaxPayment.findFirstOrThrow({ where: { vendorPaymentId: payment.id } });
  assert.equal(payable.paymentMonth, '2026-10'); assert.equal(payable.amountCents, 3000); assert.equal(payable.status, 'INITIAL');
  assert.equal((await matchVendors(row.id, allocation)).status, 200);
  assert.equal(await prisma.revenueTaxPayment.count({ where: { vendorPaymentId: payment.id } }), 1, 're-saving does not duplicate the withholding');
  assert.equal((await taxApi.PATCH(request('PATCH', { id: payable.id, paymentMonth: '2026-10', amount: '40' }))).status, 409, 'automatic payable cannot be edited manually');
  const taxRow = await prisma.kbizTransaction.create({ data: { ...common, fingerprint: 'withholding-remittance', transactionDate: '2026-11-05', details: 'กรมสรรพากร', withdrawalCents: 3000 } });
  assert.equal((await api.PUT(request('PUT', { id: taxRow.id, expenseKind: 'OTHER', expenseDescription: '', taxAllocations: [{ taxPaymentId: payable.id, amountCents: 3000 }] }))).status, 200);
  assert.equal((await prisma.revenueTaxPayment.findUniqueOrThrow({ where: { id: payable.id } })).status, 'COMPLETED');
  assert.equal((await matchVendors(row.id, [])).status, 409, 'cannot erase liability already remitted');
  assert.equal(await prisma.kbizVendorAllocation.count({ where: { transactionId: row.id } }), 1);
  assert.equal((await prisma.vendorPayment.findUniqueOrThrow({ where: { id: payment.id } })).status, 'COMPLETED', 'conflicting edit is rolled back atomically');
  assert.equal((await api.PUT(request('PUT', { id: taxRow.id, expenseDescription: '', taxAllocations: [] }))).status, 200);
  assert.equal((await matchVendors(row.id, [])).status, 200);
  assert.equal(await prisma.revenueTaxPayment.count({ where: { vendorPaymentId: payment.id } }), 0, 'unmatching vendor removes unremitted generated payable');
});

test('partial vendor transfers recognize monthly withholding with exact cumulative rounding', async () => {
  const payment = await createVendor({ amount: '100.01', withholdingEnabled: true, withholdingBase: '100.01' });
  await printVendor(payment.id);
  assert.deepEqual(vendorPaymentAmounts(payment), { withholdingCents: 300, netCents: 9701 });
  const common = { accountNumber: '016-8-53748-4', transactionTime: '12:00', bankDescription: 'Transfer', channel: 'K BIZ', details: 'Test Vendor', depositCents: 0, balanceCents: 100000, sourceFile: 'withholding-test.csv' };
  const first = await prisma.kbizTransaction.create({ data: { ...common, transactionDate: '2026-09-30', fingerprint: 'withholding-part-1', withdrawalCents: 3333 } });
  const second = await prisma.kbizTransaction.create({ data: { ...common, transactionDate: '2026-10-02', fingerprint: 'withholding-part-2', withdrawalCents: 6368 } });
  assert.equal((await matchVendors(first.id, [{ vendorPaymentId: payment.id, amountCents: 3333 }])).status, 200);
  assert.equal((await prisma.vendorPayment.findUniqueOrThrow({ where: { id: payment.id } })).status, 'PRINTED');
  assert.equal((await prisma.revenueTaxPayment.findFirstOrThrow({ where: { vendorPaymentId: payment.id } })).amountCents, 103);
  assert.equal((await matchVendors(second.id, [{ vendorPaymentId: payment.id, amountCents: 6368 }])).status, 200);
  const payables = await prisma.revenueTaxPayment.findMany({ where: { vendorPaymentId: payment.id }, orderBy: { paymentMonth: 'asc' } });
  assert.deepEqual(payables.map(item => [item.paymentMonth, item.amountCents]), [['2026-09', 103], ['2026-10', 197]]);
  assert.equal(payables.reduce((sum, item) => sum + item.amountCents, 0), 300);
  assert.equal((await prisma.vendorPayment.findUniqueOrThrow({ where: { id: payment.id } })).status, 'COMPLETED');
  const listing = await (await taxApi.GET(request())).json();
  assert.equal(listing.find(item => item.id === payables[0].id).vendorPayment.vendorName, vendorBody.vendorName);
  const bank = await (await api.GET(request())).json();
  assert.equal(bank.vendorPayments.find(item => item.id === payment.id).netCents, 9701);
});
