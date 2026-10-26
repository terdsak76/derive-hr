CREATE TABLE "KbizDepositSuggestion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "transactionId" TEXT NOT NULL REFERENCES "KbizTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "referenceKey" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "invoiceMonth" TEXT NOT NULL,
  "customer" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL CHECK ("amountCents" > 0),
  "expectedCents" INTEGER NOT NULL CHECK ("expectedCents" >= "amountCents"),
  "basis" TEXT NOT NULL CHECK ("basis" IN ('NET', 'GROSS')),
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING', 'CONFIRMED', 'REJECTED')),
  "createdById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "reviewedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "KbizDepositSuggestion_transactionId_referenceKey_key" ON "KbizDepositSuggestion"("transactionId", "referenceKey");
CREATE INDEX "KbizDepositSuggestion_status_idx" ON "KbizDepositSuggestion"("status");
