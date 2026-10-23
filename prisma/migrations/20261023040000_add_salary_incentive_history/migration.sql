CREATE TABLE IF NOT EXISTS "salary_incentive_history" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "employeeId" TEXT NOT NULL,
  "salaryCents" INTEGER,
  "fullIncentiveCents" INTEGER NOT NULL,
  "startDate" DATETIME NOT NULL,
  "endDate" DATETIME,
  "isOpening" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "salary_incentive_history_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CHECK ("salaryCents" IS NULL OR ("salaryCents" >= 0 AND "salaryCents" <= 2147483647)),
  CHECK ("fullIncentiveCents" >= 0 AND "fullIncentiveCents" <= 2147483647),
  CHECK ("endDate" IS NULL OR "endDate" >= "startDate")
);
CREATE UNIQUE INDEX IF NOT EXISTS "salary_incentive_history_employeeId_startDate_key" ON "salary_incentive_history"("employeeId", "startDate");

-- Preserve existing compensation as an explicitly labelled opening balance.
-- Its assumed start is the employee record's creation date in Bangkok.
-- Support both Prisma epoch-millisecond and legacy text timestamps.
INSERT INTO "salary_incentive_history" ("id", "employeeId", "salaryCents", "fullIncentiveCents", "startDate", "isOpening")
SELECT 'opening-' || e."id", e."id", e."monthlySalaryCents", e."fullIncentiveCents",
  date(CASE WHEN typeof(e."createdAt") IN ('integer', 'real')
    THEN datetime(e."createdAt" / 1000, 'unixepoch') ELSE e."createdAt" END, '+7 hours') || 'T00:00:00.000+00:00',
  true
FROM "Employee" e
WHERE (e."monthlySalaryCents" IS NOT NULL OR e."fullIncentiveCents" > 0)
  AND NOT EXISTS (SELECT 1 FROM "salary_incentive_history" h WHERE h."employeeId" = e."id");

-- Use the same ISO timestamp representation as the libSQL adapter so SQLite
-- comparisons and unique constraints treat opening and newly entered dates alike.
UPDATE "salary_incentive_history"
SET "startDate" = strftime('%Y-%m-%dT00:00:00.000+00:00', "startDate" / 1000, 'unixepoch'),
    "endDate" = CASE WHEN typeof("endDate") IN ('integer', 'real')
      THEN strftime('%Y-%m-%dT00:00:00.000+00:00', "endDate" / 1000, 'unixepoch') ELSE "endDate" END
WHERE "isOpening" = true AND typeof("startDate") IN ('integer', 'real');
