CREATE TABLE "VendorPayment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "paymentNumber" TEXT NOT NULL,
  "vendorName" TEXT NOT NULL,
  "taxId" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL CHECK ("amountCents" > 0),
  "paymentDate" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'INITIAL' CHECK ("status" IN ('INITIAL', 'PRINTED', 'COMPLETED')),
  "printedAt" DATETIME,
  "updatedById" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "VendorPayment_paymentNumber_key" ON "VendorPayment"("paymentNumber");
CREATE INDEX "VendorPayment_paymentDate_idx" ON "VendorPayment"("paymentDate");
CREATE TABLE "KbizVendorAllocation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "transactionId" TEXT NOT NULL REFERENCES "KbizTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "vendorPaymentId" TEXT NOT NULL REFERENCES "VendorPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "amountCents" INTEGER NOT NULL CHECK ("amountCents" > 0)
);
CREATE UNIQUE INDEX "KbizVendorAllocation_transactionId_vendorPaymentId_key" ON "KbizVendorAllocation"("transactionId", "vendorPaymentId");
CREATE INDEX "KbizVendorAllocation_vendorPaymentId_idx" ON "KbizVendorAllocation"("vendorPaymentId");
