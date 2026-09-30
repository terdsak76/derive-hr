CREATE TABLE IF NOT EXISTS "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Project_name_idx" ON "Project"("name");

CREATE TABLE IF NOT EXISTS "ProjectInvoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "installment" TEXT NOT NULL,
    "invoiceDate" DATETIME NOT NULL,
    "billingDescription" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectInvoice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectInvoice_invoiceNumber_key" ON "ProjectInvoice"("invoiceNumber");
CREATE INDEX IF NOT EXISTS "ProjectInvoice_invoiceDate_idx" ON "ProjectInvoice"("invoiceDate");
CREATE INDEX IF NOT EXISTS "ProjectInvoice_projectId_invoiceDate_idx" ON "ProjectInvoice"("projectId", "invoiceDate");
