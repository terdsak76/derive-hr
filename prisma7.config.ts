import 'dotenv/config';
import { defineConfig } from '@prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'npx tsx prisma/seed.ts',
  },
  datasource: {
    // Prisma's schema provider remains SQLite because Turso is libSQL.
    // Runtime queries use @prisma/adapter-libsql; Prisma CLI commands that
    // need a datasource must be pointed at Turso explicitly.
    url: process.env.TURSO_DATABASE_URL ?? '',
  },
});
