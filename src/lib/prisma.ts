import { createHash } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

if (!tursoUrl || !tursoAuthToken) {
  throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be configured');
}

const adapter = new PrismaLibSql({
  url: tursoUrl,
  authToken: tursoAuthToken,
});

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaSchemaKey: string | undefined;
};

// Hot reload keeps global state across regenerations. Check scalar fields as
// well as models so a client from before additions such as isOwner is replaced.
const schemaKey = createHash('sha256')
  .update(Prisma.prismaVersion.client)
  .update(JSON.stringify(Prisma.dmmf.datamodel))
  .digest('hex');
const cachedPrisma = globalForPrisma.prisma;
export const prisma = cachedPrisma && globalForPrisma.prismaSchemaKey === schemaKey
  ? cachedPrisma
  : new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSchemaKey = schemaKey;
  if (cachedPrisma && cachedPrisma !== prisma) {
    void cachedPrisma.$disconnect().catch(() => {});
  }
}
