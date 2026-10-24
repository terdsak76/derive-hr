ALTER TABLE "VendorPayment" ADD COLUMN "withholdingRate" INTEGER NOT NULL DEFAULT 0 CHECK ("withholdingRate" IN (0, 3));
ALTER TABLE "VendorPayment" ADD COLUMN "withholdingBaseCents" INTEGER NOT NULL DEFAULT 0 CHECK ("withholdingBaseCents" >= 0);
ALTER TABLE "RevenueTaxPayment" ADD COLUMN "vendorPaymentId" TEXT REFERENCES "VendorPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "RevenueTaxPayment_vendorPaymentId_paymentMonth_key" ON "RevenueTaxPayment"("vendorPaymentId", "paymentMonth");
