import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const onsites = await prisma.onsite.findMany({
    include: { employee: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(onsites);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { employeeId, location, purpose, startDate, endDate, allowance } = body;

  const newOnsite = await prisma.onsite.create({
    data: {
      employeeId,
      location,
      purpose,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      allowance: parseFloat(allowance || '0'),
    },
  });

  return NextResponse.json(newOnsite, { status: 201 });
}