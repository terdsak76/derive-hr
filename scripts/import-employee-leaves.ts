import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { leavePeriodLabels, parseLeaveDate } from '../src/lib/leaves';

// Preview by default. Explicit mappings handle names that changed since export:
// node --import tsx scripts/import-employee-leaves.ts --employee=0005:EMP005 --apply
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const mappings = new Map<string, string>();
const skipped = new Set<string>();
let source = 'employees_vercel.json';
for (const arg of args) {
  if (arg === '--apply') continue;
  if (arg.startsWith('--employee=')) {
    const match = /^--employee=([^:]+):([^:]+)$/.exec(arg);
    if (!match) throw new Error(`Invalid employee mapping: ${arg}`);
    mappings.set(match[1], match[2]);
  } else if (arg.startsWith('--skip=')) {
    skipped.add(arg.slice('--skip='.length));
  } else if (!arg.startsWith('--')) source = arg;
  else throw new Error(`Unknown argument: ${arg}`);
}

function normalizeName(value: string): string {
  return value.normalize('NFC').replace(/\([^)]*\)/g, '')
    .replace(/^(นางสาว|นาง|นาย)\s*/, '').replace(/\s+/g, '').trim();
}

function parseDate(value: unknown): Date {
  if (typeof value !== 'string') throw new Error('Leave date must be a string');
  const match = /^(\d{2})\/?(\d{2})\/?(\d{4})$/.exec(value);
  const date = match && parseLeaveDate(`${match[3]}-${match[2]}-${match[1]}`);
  if (!date) throw new Error(`Invalid ddmmyyyy date: ${value}`);
  return date;
}

const categories = {
  'Annual Leave': 'VACATION',
  'Personal Leave': 'PERSONAL',
  'Sick Leave': 'SICK',
};
const periods = new Map(Object.entries(leavePeriodLabels).map(([key, label]) => [label, key]));
const keyOf = (row: { employeeId: string; type: string; period: string; startDate: Date; endDate: Date }) =>
  JSON.stringify([row.employeeId, row.type, row.period, row.startDate.toISOString(), row.endDate.toISOString()]);

async function main() {
  const input = JSON.parse(readFileSync(resolve(source), 'utf8'));
  if (!Array.isArray(input)) throw new Error('Expected an employee array');
  const employees = await prisma.employee.findMany({ select: { id: true, name: true } });
  const records: (Prisma.LeaveCreateManyInput & { period: string; startDate: Date; endDate: Date })[] = [];
  const keys = new Set<string>();
  const unresolved: string[] = [];
  const summary: object[] = [];
  for (const item of input) {
    if (typeof item.employee_code !== 'string' || typeof item.employee_name !== 'string') {
      throw new Error('Each employee needs employee_code and employee_name');
    }
    for (const category of Object.keys(categories)) {
      if (!Array.isArray(item[category])) throw new Error(`Missing ${category}: ${item.employee_code}`);
    }
    if (skipped.has(item.employee_code)) continue;
    const matches = employees.filter(employee => mappings.has(item.employee_code)
      ? employee.id === mappings.get(item.employee_code)
      : normalizeName(employee.name) === normalizeName(item.employee_name));
    if (matches.length !== 1) {
      unresolved.push(`${item.employee_code}: ${item.employee_name}`);
      continue;
    }
    const employee = matches[0];
    let count = 0;
    for (const [category, type] of Object.entries(categories)) {
      for (const entry of item[category]) {
        const date = parseDate(entry.date);
        const period = periods.get(entry.leave_period);
        if (!period) throw new Error(`Unknown leave period: ${entry.leave_period}`);
        const data = { employeeId: employee.id, type, period, startDate: date, endDate: date };
        const key = keyOf(data);
        if (keys.has(key)) throw new Error(`Duplicate source leave: ${key}`);
        keys.add(key);
        records.push({
          ...data,
          id: `leave-import-${createHash('sha256').update(key).digest('hex').slice(0, 32)}`,
          reason: `Imported from ${basename(source)}`,
          // Preserve the schema's PENDING status: the source has no approval information.
        });
        count++;
      }
    }
    summary.push({ code: item.employee_code, employeeId: employee.id, name: employee.name, entries: count });
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'preview', employees: summary, entries: records.length, unresolved }, null, 2));
  if (unresolved.length) throw new Error('Unresolved employees; supply an explicit --employee=CODE:ID mapping or --skip=CODE. No records inserted.');
  if (!records.length) return;
  const run = async (db: Prisma.TransactionClient, write: boolean) => {
    const existing = await db.leave.findMany({ where: { employeeId: { in: [...new Set(records.map(row => row.employeeId))] } } });
    const existingKeys = new Set(existing.map(keyOf));
    const pending = records.filter(row => !existingKeys.has(keyOf(row)));
    if (!write) return { toInsert: pending.length, alreadyPresent: records.length - pending.length };
    const inserted = pending.length ? (await db.leave.createMany({ data: pending })).count : 0;
    const saved = await db.leave.findMany({ where: { id: { in: pending.map(row => row.id!) } } });
    const savedKeys = new Set(saved.map(keyOf));
    if (inserted !== pending.length || pending.some(row => !savedKeys.has(keyOf(row)))) {
      throw new Error('Import verification failed; rolling back');
    }
    return { inserted, alreadyPresent: records.length - pending.length, verified: saved.length };
  };
  console.log(JSON.stringify(apply
    ? await prisma.$transaction(tx => run(tx, true), { timeout: 30000 })
    : await run(prisma, false)));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Leave import failed');
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
