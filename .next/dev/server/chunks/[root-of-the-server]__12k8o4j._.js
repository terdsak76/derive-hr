module.exports = [
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/action-async-storage.external.js [external] (next/dist/server/app-render/action-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/action-async-storage.external.js", () => require("next/dist/server/app-render/action-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/runtime-reacts.external.js [external] (next/dist/server/runtime-reacts.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/runtime-reacts.external.js", () => require("next/dist/server/runtime-reacts.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/node:stream [external] (node:stream, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("node:stream", () => require("node:stream"));

module.exports = mod;
}),
"[project]/src/app/api/onsite/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {
__turbopack_context__.s([
    "GET",
    ()=>GET,
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/prisma.ts [app-route] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
function decodePurpose(raw) {
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
    } catch  {
    // Legacy rows may contain plain-text purpose values.
    }
    return {
        purpose: raw
    };
}
function serializeOnsite(item) {
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
        employee: item.employee
    };
}
function getMonthFromDate(dateText) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
        throw new Error('Invalid onsite date');
    }
    return dateText.slice(0, 7);
}
function calculateExpense(body, config) {
    const vehicle = body.vehicle === 'TAXI' ? 'TAXI' : body.vehicle === 'MOTORCYCLE' ? 'MOTORCYCLE' : 'CAR';
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
    const kmPerLiter = vehicle === 'MOTORCYCLE' ? config.motorcycle_km_per_liter : config.car_km_per_liter;
    if (kmPerLiter <= 0 || config.fuel_price <= 0 || config.depreciation_per_km < 0) {
        throw new Error('Invalid travel configuration');
    }
    const fuelCost = totalDistance / kmPerLiter * config.fuel_price;
    return Math.round((fuelCost + totalDistance * config.depreciation_per_km + tollFee) * 100) / 100;
}
async function GET() {
    const onsites = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].onsite.findMany({
        include: {
            employee: true
        },
        orderBy: {
            createdAt: 'desc'
        }
    });
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(onsites.map(serializeOnsite));
}
async function POST(req) {
    try {
        const body = await req.json();
        const { employee_id, client_name, destination, date, purpose, vehicle, outbound_distance, return_distance, toll_fee, taxi_fare } = body;
        if (!employee_id || !destination || !date || !purpose) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: 'Missing required onsite fields'
            }, {
                status: 400
            });
        }
        if (![
            'CAR',
            'TAXI',
            'MOTORCYCLE'
        ].includes(vehicle)) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: 'Invalid vehicle type'
            }, {
                status: 400
            });
        }
        const month = getMonthFromDate(String(date));
        let configSnapshot = null;
        if (vehicle !== 'TAXI') {
            const config = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].travelConfig.findUnique({
                where: {
                    month
                }
            });
            if (!config) {
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    error: `ยังไม่มี Travel Config สำหรับเดือน ${month}`
                }, {
                    status: 400
                });
            }
            configSnapshot = {
                month: config.month,
                fuel_price: config.fuelPrice,
                car_km_per_liter: config.carKmPerLiter,
                motorcycle_km_per_liter: config.motorcycleKmPerLiter,
                depreciation_per_km: config.depreciationPerKm
            };
        }
        const expense = calculateExpense(body, configSnapshot);
        const meta = {
            client_name: String(client_name || '').trim(),
            purpose: String(purpose || '').trim(),
            vehicle,
            outbound_distance: Number(outbound_distance) || 0,
            return_distance: Number(return_distance) || 0,
            toll_fee: Number(toll_fee) || 0,
            taxi_fare: Number(taxi_fare) || 0,
            expense,
            config_snapshot: configSnapshot
        };
        const newOnsite = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].onsite.create({
            data: {
                employeeId: employee_id,
                location: String(destination).trim(),
                purpose: JSON.stringify(meta),
                startDate: new Date(`${date}T00:00:00+07:00`),
                endDate: new Date(`${date}T23:59:59+07:00`),
                allowance: expense
            },
            include: {
                employee: true
            }
        });
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(serializeOnsite(newOnsite), {
            status: 201
        });
    } catch (error) {
        console.error('Failed to save onsite travel:', error);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: error instanceof Error ? error.message : 'Unable to save onsite record'
        }, {
            status: 500
        });
    }
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/src/lib/prisma.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {
__turbopack_context__.s([
    "prisma",
    ()=>prisma
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__ = __turbopack_context__.i("[externals]/@prisma/client [external] (@prisma/client, cjs, [project]/node_modules/@prisma/client)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$prisma$2f$adapter$2d$libsql$2f$dist$2f$index$2d$node$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@prisma/adapter-libsql/dist/index-node.mjs [app-route] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$prisma$2f$adapter$2d$libsql$2f$dist$2f$index$2d$node$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$prisma$2f$adapter$2d$libsql$2f$dist$2f$index$2d$node$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;
if (!tursoUrl || !tursoAuthToken) {
    throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be configured');
}
const adapter = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$prisma$2f$adapter$2d$libsql$2f$dist$2f$index$2d$node$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["PrismaLibSql"]({
    url: tursoUrl,
    authToken: tursoAuthToken
});
const globalForPrisma = globalThis;
const cachedPrisma = globalForPrisma.prisma;
const prisma = cachedPrisma && 'issuedDocument' in cachedPrisma ? cachedPrisma : new __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__["PrismaClient"]({
    adapter
});
if ("TURBOPACK compile-time truthy", 1) {
    globalForPrisma.prisma = prisma;
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__12k8o4j._.js.map