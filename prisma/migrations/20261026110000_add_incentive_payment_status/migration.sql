ALTER TABLE "Incentive" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'INITIAL'
CHECK ("status" IN ('INITIAL', 'PAYMENT_PENDING', 'COMPLETED'));
ALTER TABLE "Incentive" ADD COLUMN "paymentDate" TEXT;
ALTER TABLE "Incentive" ADD COLUMN "approvedById" TEXT;
ALTER TABLE "Incentive" ADD COLUMN "approvedAt" DATETIME;

UPDATE "Incentive"
SET "status" = CASE
  WHEN "amountCents" > 0 AND (
    SELECT COALESCE(SUM(a."amountCents"), 0)
    FROM "KbizEmployeeAllocation" a JOIN "KbizTransaction" t ON t."id" = a."transactionId"
    WHERE a."employeeId" = "Incentive"."employeeId" AND a."paymentMonth" = "Incentive"."month"
      AND a."paymentType" = 'INCENTIVE' AND t."withdrawalCents" > 0 AND t."depositCents" = 0
  ) >= "amountCents" THEN 'COMPLETED' ELSE 'PAYMENT_PENDING' END,
  "paymentDate" = (
    SELECT MAX(t."transactionDate")
    FROM "KbizEmployeeAllocation" a JOIN "KbizTransaction" t ON t."id" = a."transactionId"
    WHERE a."employeeId" = "Incentive"."employeeId" AND a."paymentMonth" = "Incentive"."month"
      AND a."paymentType" = 'INCENTIVE' AND t."withdrawalCents" > 0 AND t."depositCents" = 0
  )
WHERE EXISTS (
  SELECT 1 FROM "KbizEmployeeAllocation" a JOIN "KbizTransaction" t ON t."id" = a."transactionId"
  WHERE a."employeeId" = "Incentive"."employeeId" AND a."paymentMonth" = "Incentive"."month"
    AND a."paymentType" = 'INCENTIVE' AND t."withdrawalCents" > 0 AND t."depositCents" = 0
);
