ALTER TABLE "IssuedDocument" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'INITIAL' CHECK ("status" IN ('INITIAL', 'ISSUED', 'COMPLETED'));
ALTER TABLE "IssuedDocument" ADD COLUMN "customer" TEXT NOT NULL DEFAULT '';
ALTER TABLE "IssuedDocument" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';
ALTER TABLE "IssuedDocument" ADD COLUMN "invoiceMonth" TEXT NOT NULL DEFAULT '';
ALTER TABLE "IssuedDocument" ADD COLUMN "netCents" INTEGER;
ALTER TABLE "IssuedDocument" ADD COLUMN "grossCents" INTEGER;
UPDATE "IssuedDocument" SET "status" = 'ISSUED';
