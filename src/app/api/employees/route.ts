import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { isEmployeeAdmin, requireEmployeeUser } from '@/lib/employee-access';

const employeeSelect = {
  id: true, name: true, department: true, position: true, email: true, role: true,
} as const;

class EmployeeConflict extends Error {}

function employeeError(error: unknown): NextResponse {
  if (error instanceof EmployeeConflict) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Email is already in use.' }, { status: 409 });
    }
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });
    }
    if (error.code === 'P2003') {
      return NextResponse.json({ error: 'Employee is linked to existing records and cannot be deleted.' }, { status: 409 });
    }
  }
  console.error('Employee management failed:', error);
  return NextResponse.json({ error: 'Unable to complete employee request.' }, { status: 500 });
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

function parseEmployee(body: Record<string, unknown>, creating: boolean) {
  const data: { name?: string; department?: string; position?: string; email?: string; passwordHash?: string } = {};
  for (const field of ['name', 'department', 'position', 'email'] as const) {
    if (!creating && body[field] === undefined) continue;
    if (typeof body[field] !== 'string' || !body[field].trim() || body[field].trim().length > 254) {
      return { error: `${field} is required and must be at most 254 characters.` } as const;
    }
    data[field] = body[field].trim();
  }
  if (data.email !== undefined) {
    data.email = data.email.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      return { error: 'Enter a valid email address.' } as const;
    }
  }
  if (creating || (body.password !== undefined && body.password !== '')) {
    if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128) {
      return { error: 'Password must contain 8 to 128 characters.' } as const;
    }
    data.passwordHash = hashPassword(body.password);
  }
  if (!Object.keys(data).length) return { error: 'No employee changes supplied.' } as const;
  return { data } as const;
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const user = await requireEmployeeUser(request);
    if (user instanceof NextResponse) return user;
    const employees = await prisma.employee.findMany({
      where: isEmployeeAdmin(user.role) ? undefined : { id: user.id },
      orderBy: { name: 'asc' },
      select: employeeSelect,
    });
    return NextResponse.json(employees);
  } catch (error) {
    return employeeError(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await requireEmployeeUser(request);
    if (user instanceof NextResponse) return user;
    if (!isEmployeeAdmin(user.role)) return NextResponse.json({ error: 'Only admins can create employees.' }, { status: 403 });
    const body = await readBody(request);
    if (!body) return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
    const parsed = parseEmployee(body, true);
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const employee = await prisma.employee.create({
      data: {
        name: parsed.data.name!, department: parsed.data.department!, position: parsed.data.position!,
        email: parsed.data.email!, passwordHash: parsed.data.passwordHash!, role: 'USER',
      },
      select: employeeSelect,
    });
    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    return employeeError(error);
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    const user = await requireEmployeeUser(request);
    if (user instanceof NextResponse) return user;
    const body = await readBody(request);
    if (!body) return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
    const id = typeof body.id === 'string' ? body.id.trim() : '';
    if (!id) return NextResponse.json({ error: 'Employee ID is required.' }, { status: 400 });
    if (!isEmployeeAdmin(user.role) && id !== user.id) {
      return NextResponse.json({ error: 'You can only edit your own employee profile.' }, { status: 403 });
    }
    // Roles, salaries, and relation IDs are never accepted from this form.
    const parsed = parseEmployee(body, false);
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const employee = await prisma.employee.update({ where: { id }, data: parsed.data, select: employeeSelect });
    return NextResponse.json(employee);
  } catch (error) {
    return employeeError(error);
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  try {
    const user = await requireEmployeeUser(request);
    if (user instanceof NextResponse) return user;
    if (!isEmployeeAdmin(user.role)) return NextResponse.json({ error: 'Only admins can delete employees.' }, { status: 403 });
    const body = await readBody(request);
    if (!body) return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
    const id = typeof body.id === 'string' ? body.id.trim() : '';
    if (!id) return NextResponse.json({ error: 'Employee ID is required.' }, { status: 400 });
    if (id === user.id) return NextResponse.json({ error: 'You cannot delete your own admin account.' }, { status: 409 });

    await prisma.$transaction(async tx => {
      await tx.employee.findUniqueOrThrow({ where: { id }, select: { id: true } });
      // The creator is required by the OT schema. Preserve other employees' pay history.
      const sharedOvertime = await tx.overtime.findFirst({
        where: { createdById: id, employeeId: { not: id } }, select: { id: true },
      });
      if (sharedOvertime) throw new EmployeeConflict('This employee created overtime records for other employees. Preserve those records before deleting the account.');
      await tx.attendance.deleteMany({ where: { employeeId: id } });
      await tx.leave.deleteMany({ where: { employeeId: id } });
      await tx.onsite.deleteMany({ where: { employeeId: id } });
      await tx.workdayChangeRequest.deleteMany({ where: { employeeId: id } });
      await tx.workdayChangeRequest.updateMany({ where: { approvedById: id }, data: { approvedById: null } });
      await tx.overtime.deleteMany({ where: { employeeId: id } });
      await tx.overtime.updateMany({ where: { approvedById: id }, data: { approvedById: null } });
      await tx.employee.delete({ where: { id } });
    });
    return NextResponse.json({ id });
  } catch (error) {
    return employeeError(error);
  }
}
