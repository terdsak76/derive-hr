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
"[externals]/node:crypto [external] (node:crypto, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("node:crypto", () => require("node:crypto"));

module.exports = mod;
}),
"[externals]/node:stream [external] (node:stream, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("node:stream", () => require("node:stream"));

module.exports = mod;
}),
"[project]/src/app/api/overtime/quote/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {
__turbopack_context__.s([
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/prisma.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/auth.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$overtime$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/overtime.ts [app-route] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
;
;
function getSession(request) {
    const token = request.headers.get('cookie')?.split(';').map((value)=>value.trim()).find((value)=>value.startsWith(`${(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getSessionCookieName"])()}=`))?.split('=')[1];
    return token ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["verifySessionToken"])(token) : null;
}
async function requireUser(request) {
    const session = getSession(request);
    if (!session) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        error: 'Unauthorized'
    }, {
        status: 401
    });
    const user = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].employee.findUnique({
        where: {
            id: session.employeeId
        },
        select: {
            id: true,
            role: true
        }
    });
    if (!user) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        error: 'Unauthorized'
    }, {
        status: 401
    });
    return {
        user
    };
}
async function POST(request) {
    const auth = await requireUser(request);
    if (auth instanceof __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"]) return auth;
    let body;
    try {
        body = await request.json();
    } catch  {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: 'Request body must be valid JSON.'
        }, {
            status: 400
        });
    }
    const requestedEmployeeId = typeof body.employee_id === 'string' ? body.employee_id.trim() : '';
    const employeeId = auth.user.role.toUpperCase() === 'ADMIN' ? requestedEmployeeId : auth.user.id;
    const startAt = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$overtime$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["parseBangkokDateTime"])(body.start_at);
    const endAt = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$overtime$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["parseBangkokDateTime"])(body.end_at);
    if (!employeeId) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        error: 'Employee is required.'
    }, {
        status: 400
    });
    if (!startAt) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        error: 'Invalid OT start date/time. Use YYYY-MM-DDTHH:mm.'
    }, {
        status: 400
    });
    if (!endAt) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        error: 'Invalid OT end date/time. Use YYYY-MM-DDTHH:mm.'
    }, {
        status: 400
    });
    if (endAt.getTime() <= startAt.getTime()) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: 'End date/time must be after start date/time.'
        }, {
            status: 400
        });
    }
    const employee = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].employee.findUnique({
        where: {
            id: employeeId
        },
        select: {
            id: true,
            name: true,
            monthlySalaryCents: true
        }
    });
    if (!employee) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        error: 'Employee does not exist.'
    }, {
        status: 400
    });
    if (!Number.isSafeInteger(employee.monthlySalaryCents) || employee.monthlySalaryCents <= 0) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: 'Employee must have a valid monthly salary before recording overtime.'
        }, {
            status: 400
        });
    }
    const calculation = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$overtime$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["calculateOvertime"])(employee.monthlySalaryCents, startAt, endAt);
    if (!calculation) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        error: 'The overtime interval is invalid.'
    }, {
        status: 400
    });
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        employee_id: employee.id,
        employee_name: employee.name,
        monthly_salary: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$overtime$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["centsToAmount"])(employee.monthlySalaryCents),
        hourly_rate: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$overtime$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["centsToAmount"])(calculation.hourlyRateCents),
        worked_minutes: calculation.workedMinutes,
        ot_hours: calculation.workedMinutes / 60,
        ot_amount: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$overtime$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["centsToAmount"])(calculation.otAmountCents)
    });
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/src/lib/auth.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createSessionToken",
    ()=>createSessionToken,
    "getSessionCookieName",
    ()=>getSessionCookieName,
    "hashPassword",
    ()=>hashPassword,
    "verifyPassword",
    ()=>verifyPassword,
    "verifySessionToken",
    ()=>verifySessionToken
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:crypto [external] (node:crypto, cjs)");
;
const SESSION_COOKIE = 'hr_session';
const SESSION_DURATION_SECONDS = 60 * 60 * 8;
const AUTH_SECRET = process.env.AUTH_SECRET || 'development-only-change-this-secret';
function getSessionCookieName() {
    return SESSION_COOKIE;
}
function createSessionToken(employeeId, role) {
    const payload = {
        employeeId,
        role,
        expiresAt: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["createHmac"])('sha256', AUTH_SECRET).update(encodedPayload).digest('base64url');
    return `${encodedPayload}.${signature}`;
}
function verifySessionToken(token) {
    const [encodedPayload, signature] = token.split('.');
    if (!encodedPayload || !signature) return null;
    const expectedSignature = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["createHmac"])('sha256', AUTH_SECRET).update(encodedPayload).digest('base64url');
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (actualBuffer.length !== expectedBuffer.length || !(0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["timingSafeEqual"])(actualBuffer, expectedBuffer)) {
        return null;
    }
    try {
        const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
        return payload.expiresAt > Math.floor(Date.now() / 1000) ? payload : null;
    } catch  {
        return null;
    }
}
function hashPassword(password) {
    const salt = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["randomBytes"])(16).toString('hex');
    return `${salt}:${(0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["scryptSync"])(password, salt, 64).toString('hex')}`;
}
function verifyPassword(password, storedHash) {
    const [salt, expectedHash] = storedHash.split(':');
    if (!salt || !expectedHash) return false;
    const actualHash = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["scryptSync"])(password, salt, 64).toString('hex');
    const actualBuffer = Buffer.from(actualHash, 'hex');
    const expectedBuffer = Buffer.from(expectedHash, 'hex');
    return actualBuffer.length === expectedBuffer.length && (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["timingSafeEqual"])(actualBuffer, expectedBuffer);
}
}),
"[project]/src/lib/overtime.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BANGKOK_TIME_ZONE",
    ()=>BANGKOK_TIME_ZONE,
    "OT_MULTIPLIER_DENOMINATOR",
    ()=>OT_MULTIPLIER_DENOMINATOR,
    "OT_MULTIPLIER_NUMERATOR",
    ()=>OT_MULTIPLIER_NUMERATOR,
    "OT_WORKING_HOURS",
    ()=>OT_WORKING_HOURS,
    "calculateOvertime",
    ()=>calculateOvertime,
    "centsToAmount",
    ()=>centsToAmount,
    "formatBangkokDateTime",
    ()=>formatBangkokDateTime,
    "parseBangkokDateTime",
    ()=>parseBangkokDateTime
]);
const BANGKOK_TIME_ZONE = 'Asia/Bangkok';
const OT_WORKING_HOURS = 176;
const OT_MULTIPLIER_NUMERATOR = 3;
const OT_MULTIPLIER_DENOMINATOR = 2;
function parseBangkokDateTime(value) {
    if (typeof value !== 'string') return null;
    // datetime-local normally emits YYYY-MM-DDTHH:mm, but browsers may retain
    // a seconds component when a value is typed or restored from form state.
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
    if (!match) return null;
    const [, yearText, monthText, dayText, hourText, minuteText, secondText = '00'] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const hour = Number(hourText);
    const minute = Number(minuteText);
    const second = Number(secondText);
    if (month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
        return null;
    }
    // Bangkok is UTC+07:00. Construct UTC explicitly instead of relying on the
    // operating system timezone of the Next.js server.
    const date = new Date(Date.UTC(year, month - 1, day, hour - 7, minute, second));
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: BANGKOK_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).formatToParts(date);
    const actual = Object.fromEntries(parts.map((part)=>[
            part.type,
            part.value
        ]));
    if (actual.year !== yearText || actual.month !== monthText || actual.day !== dayText || actual.hour !== hourText || actual.minute !== minuteText || actual.second !== secondText) return null;
    return date;
}
function roundHalfUp(numerator, denominator) {
    return Math.floor((numerator * 2 + denominator) / (2 * denominator));
}
function calculateOvertime(salaryCents, startAt, endAt) {
    if (!Number.isSafeInteger(salaryCents) || salaryCents <= 0) return null;
    const durationMs = endAt.getTime() - startAt.getTime();
    if (durationMs <= 0 || durationMs % 60_000 !== 0) return null;
    const workedMinutes = durationMs / 60_000;
    // salary / 176 * 1.5 = salary * 3 / 352. Keep the rate rational until the
    // final monetary rounding so duration and salary are never binary floats.
    const rateDenominator = OT_WORKING_HOURS * OT_MULTIPLIER_DENOMINATOR;
    const rateNumerator = salaryCents * OT_MULTIPLIER_NUMERATOR;
    const hourlyRateCents = roundHalfUp(rateNumerator, rateDenominator);
    const otAmountCents = roundHalfUp(rateNumerator * workedMinutes, rateDenominator * 60);
    return {
        workedMinutes,
        hourlyRateCents,
        otAmountCents
    };
}
function formatBangkokDateTime(date) {
    return new Intl.DateTimeFormat('en-GB', {
        timeZone: BANGKOK_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(date).replace(',', '');
}
function centsToAmount(cents) {
    return cents / 100;
}
}),
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
const prisma = globalForPrisma.prisma ?? new __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__["PrismaClient"]({
    adapter
});
if ("TURBOPACK compile-time truthy", 1) {
    globalForPrisma.prisma = prisma;
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__17n4qxs._.js.map