import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const leaves = await prisma.leave.findMany({
    include: { employee: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(leaves);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { employeeId, type, startDate, endDate, reason } = body;

  const newLeave = await prisma.leave.create({
    data: {
      employeeId,
      type,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reason,
    },
  });

  return NextResponse.json(newLeave, { status: 201 });
}