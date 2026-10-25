ALTER TABLE "Employee" ADD COLUMN "kbizName" TEXT NOT NULL DEFAULT '';
CREATE TABLE "new_KbizEmployeeAllocation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "transactionId" TEXT NOT NULL REFERENCES "KbizTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "employeeId" TEXT NOT NULL REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "employeeName" TEXT NOT NULL,
  "paymentType" TEXT NOT NULL CHECK ("paymentType" IN ('PENDING', 'PAYROLL', 'INCENTIVE', 'ONSITE', 'OTHERS')),
  "paymentMonth" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL CHECK ("amountCents" > 0)
);
INSERT INTO "new_KbizEmployeeAllocation" ("id", "transactionId", "employeeId", "employeeName", "paymentType", "paymentMonth", "amountCents")
SELECT "id", "transactionId", "employeeId", "employeeName", "paymentType", "paymentMonth", "amountCents" FROM "KbizEmployeeAllocation";
DROP TABLE "KbizEmployeeAllocation";
ALTER TABLE "new_KbizEmployeeAllocation" RENAME TO "KbizEmployeeAllocation";
CREATE UNIQUE INDEX "KbizEmployeeAllocation_transactionId_employeeId_paymentType_paymentMonth_key" ON "KbizEmployeeAllocation"("transactionId", "employeeId", "paymentType", "paymentMonth");
CREATE INDEX "KbizEmployeeAllocation_employeeId_paymentMonth_idx" ON "KbizEmployeeAllocation"("employeeId", "paymentMonth");
