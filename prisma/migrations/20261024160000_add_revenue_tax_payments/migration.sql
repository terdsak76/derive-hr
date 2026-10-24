CREATE TABLE "RevenueTaxPayment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "paymentNumber" TEXT NOT NULL,
  "paymentMonth" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL CHECK ("amountCents" > 0),
  "status" TEXT NOT NULL DEFAULT 'INITIAL' CHECK ("status" IN ('INITIAL', 'PARTIAL', 'COMPLETED')),
  "updatedById" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "RevenueTaxPayment_paymentNumber_key" ON "RevenueTaxPayment"("paymentNumber");
CREATE INDEX "RevenueTaxPayment_paymentMonth_idx" ON "RevenueTaxPayment"("paymentMonth");
CREATE TABLE "KbizTaxAllocation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "transactionId" TEXT NOT NULL REFERENCES "KbizTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "taxPaymentId" TEXT NOT NULL REFERENCES "RevenueTaxPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "amountCents" INTEGER NOT NULL CHECK ("amountCents" > 0)
);
CREATE UNIQUE INDEX "KbizTaxAllocation_transactionId_taxPaymentId_key" ON "KbizTaxAllocation"("transactionId", "taxPaymentId");
CREATE INDEX "KbizTaxAllocation_taxPaymentId_idx" ON "KbizTaxAllocation"("taxPaymentId");
