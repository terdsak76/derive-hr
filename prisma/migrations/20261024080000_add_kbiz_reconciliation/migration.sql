CREATE TABLE "KbizTransaction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "fingerprint" TEXT NOT NULL,
  "accountNumber" TEXT NOT NULL,
  "transactionDate" TEXT NOT NULL,
  "transactionTime" TEXT NOT NULL,
  "bankDescription" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "details" TEXT NOT NULL,
  "withdrawalCents" INTEGER NOT NULL CHECK ("withdrawalCents" >= 0),
  "depositCents" INTEGER NOT NULL CHECK ("depositCents" >= 0),
  "balanceCents" INTEGER NOT NULL,
  "sourceFile" TEXT NOT NULL,
  "expenseDescription" TEXT NOT NULL DEFAULT '',
  "updatedById" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CHECK (("withdrawalCents" > 0 AND "depositCents" = 0) OR ("depositCents" > 0 AND "withdrawalCents" = 0))
);
CREATE UNIQUE INDEX "KbizTransaction_fingerprint_key" ON "KbizTransaction"("fingerprint");
CREATE INDEX "KbizTransaction_transactionDate_idx" ON "KbizTransaction"("transactionDate");
CREATE TABLE "KbizAllocation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "transactionId" TEXT NOT NULL REFERENCES "KbizTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "referenceKey" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "customer" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL CHECK ("amountCents" > 0),
  "expectedCents" INTEGER NOT NULL CHECK ("expectedCents" > 0),
  "basis" TEXT NOT NULL CHECK ("basis" IN ('NET', 'GROSS'))
);
CREATE UNIQUE INDEX "KbizAllocation_transactionId_referenceKey_key" ON "KbizAllocation"("transactionId", "referenceKey");
CREATE INDEX "KbizAllocation_referenceKey_idx" ON "KbizAllocation"("referenceKey");
