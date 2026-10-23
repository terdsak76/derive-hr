CREATE TABLE "VatSale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "referenceKey" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "invoiceMonth" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "customer" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "taxDate" DATETIME NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "vatCents" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "VatPurchase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "month" TEXT NOT NULL,
    "purchaseDate" DATETIME NOT NULL,
    "supplier" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "vatCents" INTEGER NOT NULL,
    "creditable" BOOLEAN NOT NULL DEFAULT false,
    "expense" BOOLEAN NOT NULL DEFAULT true,
    "vatMode" TEXT NOT NULL DEFAULT 'exclusive',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "VatMonth" (
    "month" TEXT NOT NULL PRIMARY KEY,
    "openingCreditCents" INTEGER NOT NULL DEFAULT 0,
    "creditAction" TEXT NOT NULL DEFAULT 'CARRY',
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "VatSale_referenceKey_key" ON "VatSale"("referenceKey");

CREATE INDEX "VatSale_taxDate_idx" ON "VatSale"("taxDate");

CREATE INDEX "VatPurchase_month_idx" ON "VatPurchase"("month");

CREATE UNIQUE INDEX "VatPurchase_supplier_invoiceNumber_key" ON "VatPurchase"("supplier", "invoiceNumber");
