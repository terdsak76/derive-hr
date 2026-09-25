CREATE TABLE "WorkdayChangeRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "fromDate" DATETIME NOT NULL,
    "toDate" DATETIME NOT NULL,
    "project" TEXT NOT NULL,
    "jobDetail" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING_FOR_APPROVAL',
    "approvedById" TEXT,
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkdayChangeRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkdayChangeRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "WorkdayChangeRequest_employeeId_idx" ON "WorkdayChangeRequest" ("employeeId");
CREATE INDEX "WorkdayChangeRequest_status_idx" ON "WorkdayChangeRequest" ("status");
