CREATE TABLE "Incentive" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Incentive_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Incentive_score_check" CHECK ("score" >= 0 AND "score" <= 100),
    CONSTRAINT "Incentive_amount_check" CHECK ("amountCents" >= 0)
);

CREATE UNIQUE INDEX "Incentive_employeeId_month_key" ON "Incentive"("employeeId", "month");
CREATE INDEX "Incentive_month_idx" ON "Incentive"("month");
