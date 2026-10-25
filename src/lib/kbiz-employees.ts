import type { Prisma } from '@prisma/client';
import type { KbizRow } from './kbiz';

type MatchEmployee = { id: string; name: string; kbizName: string };

// Keep Thai combining marks; ignoring spacing handles bank statement formatting.
const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/\s+/gu, '');

export function matchKbizEmployee(row: KbizRow, employees: MatchEmployee[]) {
  if (row.withdrawalCents <= 0 || row.depositCents > 0) return null;
  const descriptions = [normalize(row.bankDescription), normalize(row.details)];
  const matches = employees.filter(employee => {
    const name = normalize(employee.kbizName);
    return name.length > 0 && descriptions.some(description => description.includes(name));
  });
  // Multiple recipients or overlapping names require an admin to decide.
  return matches.length === 1 ? matches[0] : null;
}

export function pendingEmployeeAllocation(row: KbizRow, employee: MatchEmployee) {
  return { employeeId: employee.id, employeeName: employee.name, paymentType: 'PENDING',
    paymentMonth: row.transactionDate.slice(0, 7), amountCents: row.withdrawalCents };
}

/** Apply newly configured bank names to existing, unclassified withdrawals. */
export async function matchExistingKbizEmployees(tx: Prisma.TransactionClient, updatedById?: string, transactionIds?: string[]) {
  if (transactionIds?.length === 0) return { matched: 0, unmatched: 0 };
  const employees = await tx.employee.findMany({ select: { id: true, name: true, kbizName: true } });
  const rows = await tx.kbizTransaction.findMany({ where: {
    ...(transactionIds ? { id: { in: transactionIds } } : {}),
    withdrawalCents: { gt: 0 }, depositCents: 0, expenseKind: 'OTHER', expenseDescription: '',
    allocations: { none: {} }, employeeAllocations: { none: {} }, vendorAllocations: { none: {} }, taxAllocations: { none: {} },
  } });
  let matched = 0;
  for (const row of rows) {
    const employee = matchKbizEmployee(row, employees);
    if (!employee) continue;
    await tx.kbizTransaction.update({ where: { id: row.id }, data: {
      expenseKind: 'EMPLOYEE', updatedById, employeeAllocations: { create: pendingEmployeeAllocation(row, employee) },
    } });
    matched++;
  }
  return { matched, unmatched: rows.length - matched };
}
