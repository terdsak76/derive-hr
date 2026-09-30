-- CreateTable
CREATE TABLE "IssuedDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentType" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "referenceKey" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "IssuedDocument_documentNumber_key" ON "IssuedDocument"("documentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "IssuedDocument_documentType_sourceType_referenceKey_key" ON "IssuedDocument"("documentType", "sourceType", "referenceKey");

-- CreateIndex
CREATE INDEX "IssuedDocument_documentType_sourceType_issuedAt_idx" ON "IssuedDocument"("documentType", "sourceType", "issuedAt");

-- Reserve invoice numbers that were already assigned to existing project invoices.
INSERT INTO "IssuedDocument" ("id", "documentType", "sourceType", "referenceKey", "documentNumber", "issuedAt", "createdAt", "updatedAt")
SELECT 'legacy-project-invoice-' || "id", 'INVOICE', 'PROJECT', 'project:' || "id", "invoiceNumber", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ProjectInvoice";
