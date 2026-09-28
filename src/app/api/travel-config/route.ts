import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionCookieName, verifySessionToken } from '@/lib/auth';

function getSession(request: Request) {
  const token = request.headers.get('cookie')
    ?.split(';')
    .map(value => value.trim())
    .find(value => value.startsWith(`${getSessionCookieName()}=`))
    ?.split('=')[1];

  return token ? verifySessionToken(token) : null;
}

function isValidMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function serializeConfig(config: any) {
  return {
    id: config.id,
    month: config.month,
    fuel_price: config.fuelPrice,
    car_km_per_liter: config.carKmPerLiter,
    motorcycle_km_per_liter: config.motorcycleKmPerLiter,
    depreciation_per_km: config.depreciationPerKm,
    created_at: config.createdAt,
    updated_at: config.updatedAt,
  };
}

export async function GET(request: Request): Promise<NextResponse> {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month') || '';

  if (!isValidMonth(month)) {
    return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 });
  }

  const config = await prisma.travelConfig.findUnique({
    where: { month },
  });

  if (!config) {
    return NextResponse.json({ error: `Travel config not found for ${month}` }, { status: 404 });
  }

  return NextResponse.json(serializeConfig(config));
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role.toUpperCase() !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin permission required' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const month = String(body.month || '').trim();
    const fuelPrice = Number(body.fuel_price);
    const carKmPerLiter = Number(body.car_km_per_liter);
    const motorcycleKmPerLiter = Number(body.motorcycle_km_per_liter);
    const depreciationPerKm = Number(body.depreciation_per_km);

    if (!isValidMonth(month)) {
      return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 });
    }

    if (
      !Number.isFinite(fuelPrice) || fuelPrice <= 0 ||
      !Number.isFinite(carKmPerLiter) || carKmPerLiter <= 0 ||
      !Number.isFinite(motorcycleKmPerLiter) || motorcycleKmPerLiter <= 0 ||
      !Number.isFinite(depreciationPerKm) || depreciationPerKm < 0
    ) {
      return NextResponse.json({ error: 'Invalid travel configuration values' }, { status: 400 });
    }

    const saved = await prisma.travelConfig.upsert({
      where: { month },
      update: {
        fuelPrice,
        carKmPerLiter,
        motorcycleKmPerLiter,
        depreciationPerKm,
      },
      create: {
        month,
        fuelPrice,
        carKmPerLiter,
        motorcycleKmPerLiter,
        depreciationPerKm,
      },
    });

    return NextResponse.json(serializeConfig(saved));
  } catch (error) {
    console.error('Failed to save travel config:', error);
    return NextResponse.json({ error: 'Unable to save travel configuration' }, { status: 500 });
  }
}
