ALTER TABLE "Bonus" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'INITIAL'
CHECK ("status" IN ('INITIAL', 'PAYMENT_PENDING', 'COMPLETED'));
ALTER TABLE "Bonus" ADD COLUMN "paymentDate" TEXT;
ALTER TABLE "Bonus" ADD COLUMN "approvedById" TEXT;
ALTER TABLE "Bonus" ADD COLUMN "approvedAt" DATETIME;
ALTER TABLE "KbizEmployeeAllocation" ADD COLUMN "bonusId" TEXT;

CREATE TABLE "new_KbizEmployeeAllocation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "transactionId" TEXT NOT NULL REFERENCES "KbizTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "employeeId" TEXT NOT NULL REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "employeeName" TEXT NOT NULL,
  "paymentType" TEXT NOT NULL CHECK ("paymentType" IN ('PENDING', 'PAYROLL', 'INCENTIVE', 'ONSITE', 'OTHERS', 'BONUS')),
  "paymentMonth" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL CHECK ("amountCents" > 0),
  "bonusId" TEXT REFERENCES "Bonus"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CHECK (("paymentType" = 'BONUS' AND "bonusId" IS NOT NULL) OR ("paymentType" <> 'BONUS' AND "bonusId" IS NULL))
);
INSERT INTO "new_KbizEmployeeAllocation" ("id", "transactionId", "employeeId", "employeeName", "paymentType", "paymentMonth", "amountCents", "bonusId")
SELECT "id", "transactionId", "employeeId", "employeeName", "paymentType", "paymentMonth", "amountCents", "bonusId" FROM "KbizEmployeeAllocation";
DROP TABLE "KbizEmployeeAllocation";
ALTER TABLE "new_KbizEmployeeAllocation" RENAME TO "KbizEmployeeAllocation";
CREATE UNIQUE INDEX "KbizEmployeeAllocation_transactionId_employeeId_paymentType_paymentMonth_key" ON "KbizEmployeeAllocation"("transactionId", "employeeId", "paymentType", "paymentMonth");
CREATE INDEX "KbizEmployeeAllocation_employeeId_paymentMonth_idx" ON "KbizEmployeeAllocation"("employeeId", "paymentMonth");
CREATE INDEX "KbizEmployeeAllocation_bonusId_idx" ON "KbizEmployeeAllocation"("bonusId");
