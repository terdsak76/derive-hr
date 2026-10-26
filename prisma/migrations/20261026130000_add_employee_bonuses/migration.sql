CREATE TABLE "BonusYear" (
  "year" INTEGER NOT NULL PRIMARY KEY CHECK ("year" BETWEEN 2000 AND 9998),
  "maxLeaveDays" REAL NOT NULL DEFAULT 0 CHECK ("maxLeaveDays" >= 0 AND "maxLeaveDays" <= 366),
  "expenseMonth" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE TABLE "Bonus" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "employeeId" TEXT NOT NULL REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "year" INTEGER NOT NULL REFERENCES "BonusYear"("year") ON DELETE RESTRICT ON UPDATE CASCADE,
  "score" REAL NOT NULL CHECK ("score" BETWEEN 0 AND 200),
  "salaryCents" INTEGER NOT NULL CHECK ("salaryCents" >= 0),
  "leaveDays" REAL NOT NULL CHECK ("leaveDays" >= 0),
  "maxLeaveDays" REAL NOT NULL CHECK ("maxLeaveDays" >= 0 AND "maxLeaveDays" <= 366),
  "baseCents" INTEGER NOT NULL CHECK ("baseCents" >= 0),
  "deductionCents" INTEGER NOT NULL CHECK ("deductionCents" >= 0),
  "amountCents" INTEGER NOT NULL CHECK ("amountCents" >= 0),
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "Bonus_employeeId_year_key" ON "Bonus"("employeeId", "year");
CREATE INDEX "Bonus_year_idx" ON "Bonus"("year");
