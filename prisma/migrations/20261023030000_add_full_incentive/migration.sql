ALTER TABLE "Employee" ADD COLUMN "fullIncentiveCents" INTEGER NOT NULL DEFAULT 0 CHECK ("fullIncentiveCents" >= 0 AND "fullIncentiveCents" <= 2147483647);
