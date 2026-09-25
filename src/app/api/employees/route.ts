import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(): Promise<NextResponse> {
  try {
    const employees = await prisma.employee.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        department: true,
        position: true,
      },
    });

    return NextResponse.json(employees);
  } catch (error) {
    console.error('Failed to load employees:', error);
    return NextResponse.json(
      { error: 'Unable to load employees from the database.' },
      { status: 500 },
    );
  }
}
