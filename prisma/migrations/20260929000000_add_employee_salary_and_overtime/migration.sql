ALTER TABLE "Employee" ADD COLUMN "monthlySalaryCents" INTEGER;

CREATE TABLE "OT" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "workedMinutes" INTEGER NOT NULL,
    "hourlyRateCents" INTEGER NOT NULL,
    "otAmountCents" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OT_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OT_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "OT_employeeId_startAt_idx" ON "OT"("employeeId", "startAt");
CREATE INDEX "OT_startAt_createdAt_idx" ON "OT"("startAt", "createdAt");
