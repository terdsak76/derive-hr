-- Align older Employee tables with the current Prisma model.
ALTER TABLE "Employee" ADD COLUMN "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Add authentication and authorization fields to employees.
ALTER TABLE "Employee" ADD COLUMN "passwordHash" TEXT NOT NULL DEFAULT 'static-salt-change-me:892dbe355305da8b6ce6a562a2ab3694d030117523c7402499db4c43f4d25215bf4d131236aba1d1320ea92951227f736847334d68893bbc8291f515671904a0';
ALTER TABLE "Employee" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'USER';

-- Promote the two administrators when they already exist in the database.
UPDATE "Employee"
SET "role" = 'ADMIN'
WHERE lower("name") LIKE '%terdsak%'
   OR lower("name") LIKE '%songsak%';
