ALTER TABLE "KbizTransaction" ADD COLUMN "expenseKind" TEXT NOT NULL DEFAULT 'OTHER' CHECK ("expenseKind" IN ('OTHER', 'VENDOR', 'EMPLOYEE'));
UPDATE "KbizTransaction" SET "expenseKind" = 'VENDOR' WHERE EXISTS (SELECT 1 FROM "KbizVendorAllocation" WHERE "transactionId" = "KbizTransaction"."id");
CREATE TABLE "KbizEmployeeAllocation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "transactionId" TEXT NOT NULL REFERENCES "KbizTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "employeeId" TEXT NOT NULL REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "employeeName" TEXT NOT NULL,
  "paymentType" TEXT NOT NULL CHECK ("paymentType" IN ('PAYROLL', 'INCENTIVE')),
  "paymentMonth" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL CHECK ("amountCents" > 0)
);
CREATE UNIQUE INDEX "KbizEmployeeAllocation_transactionId_employeeId_paymentType_paymentMonth_key" ON "KbizEmployeeAllocation"("transactionId", "employeeId", "paymentType", "paymentMonth");
CREATE INDEX "KbizEmployeeAllocation_employeeId_paymentMonth_idx" ON "KbizEmployeeAllocation"("employeeId", "paymentMonth");
