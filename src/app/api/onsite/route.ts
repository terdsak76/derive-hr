import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type VehicleType = 'CAR' | 'TAXI' | 'MOTORCYCLE';

type TravelConfigSnapshot = {
  month: string;
  fuel_price: number;
  car_km_per_liter: number;
  motorcycle_km_per_liter: number;
  depreciation_per_km: number;
};

type TravelMeta = {
  client_name?: string;
  purpose?: string;
  vehicle?: VehicleType;
  outbound_distance?: number;
  return_distance?: number;
  toll_fee?: number;
  taxi_fare?: number;
  expense?: number;
  config_snapshot?: TravelConfigSnapshot | null;
};

function decodePurpose(raw: string | null): TravelMeta {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as TravelMeta;
  } catch {
    // Legacy rows may contain plain-text purpose values.
  }
  return { purpose: raw };
}

function serializeOnsite(item: any) {
  const meta = decodePurpose(item.purpose);
  return {
    id: item.id,
    employee_id: item.employeeId,
    client_name: meta.client_name || '',
    destination: item.location || '',
    date: item.startDate ? new Date(item.startDate).toISOString().split('T')[0] : '',
    purpose: meta.purpose || '',
    vehicle: meta.vehicle || 'CAR',
    outbound_distance: Number(meta.outbound_distance || 0),
    return_distance: Number(meta.return_distance || 0),
    toll_fee: Number(meta.toll_fee || 0),
    taxi_fare: Number(meta.taxi_fare || 0),
    expense: Number(meta.expense ?? item.allowance ?? 0),
    config_snapshot: meta.config_snapshot ?? null,
    status: 'In Progress',
    employee: item.employee,
  };
}

function getMonthFromDate(dateText: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    throw new Error('Invalid onsite date');
  }
  return dateText.slice(0, 7);
}

function calculateExpense(body: any, config: TravelConfigSnapshot | null): number {
  const vehicle: VehicleType = body.vehicle === 'TAXI'
    ? 'TAXI'
    : body.vehicle === 'MOTORCYCLE'
      ? 'MOTORCYCLE'
      : 'CAR';

  const tollFee = Number(body.toll_fee) || 0;
  if (tollFee < 0) throw new Error('Toll fee cannot be negative');

  if (vehicle === 'TAXI') {
    const taxiFare = Number(body.taxi_fare) || 0;
    if (taxiFare < 0) throw new Error('Taxi fare cannot be negative');
    return Math.round((taxiFare + tollFee) * 100) / 100;
  }

  if (!config) {
    throw new Error('Travel config not found for the selected month');
  }

  const outbound = Number(body.outbound_distance) || 0;
  const returnDistance = Number(body.return_distance) || 0;
  if (outbound < 0 || returnDistance < 0) throw new Error('Distance cannot be negative');

  const totalDistance = outbound + returnDistance;
  const kmPerLiter = vehicle === 'MOTORCYCLE'
    ? config.motorcycle_km_per_liter
    : config.car_km_per_liter;

  if (kmPerLiter <= 0 || config.fuel_price <= 0 || config.depreciation_per_km < 0) {
    throw new Error('Invalid travel configuration');
  }

  const fuelCost = (totalDistance / kmPerLiter) * config.fuel_price;
  return Math.round((fuelCost + totalDistance * config.depreciation_per_km + tollFee) * 100) / 100;
}

export async function GET() {
  const onsites = await prisma.onsite.findMany({
    include: { employee: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(onsites.map(serializeOnsite));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      employee_id,
      client_name,
      destination,
      date,
      purpose,
      vehicle,
      outbound_distance,
      return_distance,
      toll_fee,
      taxi_fare,
    } = body;

    if (!employee_id || !destination || !date || !purpose) {
      return NextResponse.json({ error: 'Missing required onsite fields' }, { status: 400 });
    }

    if (!['CAR', 'TAXI', 'MOTORCYCLE'].includes(vehicle)) {
      return NextResponse.json({ error: 'Invalid vehicle type' }, { status: 400 });
    }

    const month = getMonthFromDate(String(date));
    let configSnapshot: TravelConfigSnapshot | null = null;

    if (vehicle !== 'TAXI') {
      const config = await prisma.travelConfig.findUnique({
        where: { month },
      });

      if (!config) {
        return NextResponse.json(
          { error: `ยังไม่มี Travel Config สำหรับเดือน ${month}` },
          { status: 400 },
        );
      }

      configSnapshot = {
        month: config.month,
        fuel_price: config.fuelPrice,
        car_km_per_liter: config.carKmPerLiter,
        motorcycle_km_per_liter: config.motorcycleKmPerLiter,
        depreciation_per_km: config.depreciationPerKm,
      };
    }

    const expense = calculateExpense(body, configSnapshot);
    const meta: TravelMeta = {
      client_name: String(client_name || '').trim(),
      purpose: String(purpose || '').trim(),
      vehicle,
      outbound_distance: Number(outbound_distance) || 0,
      return_distance: Number(return_distance) || 0,
      toll_fee: Number(toll_fee) || 0,
      taxi_fare: Number(taxi_fare) || 0,
      expense,
      config_snapshot: configSnapshot,
    };

    const newOnsite = await prisma.onsite.create({
      data: {
        employeeId: employee_id,
        location: String(destination).trim(),
        purpose: JSON.stringify(meta),
        startDate: new Date(`${date}T00:00:00+07:00`),
        endDate: new Date(`${date}T23:59:59+07:00`),
        allowance: expense,
      },
      include: { employee: true },
    });

    return NextResponse.json(serializeOnsite(newOnsite), { status: 201 });
  } catch (error) {
    console.error('Failed to save onsite travel:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to save onsite record' },
      { status: 500 },
    );
  }
}
