CREATE TABLE IF NOT EXISTS "InvoiceSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "client" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "issueDay" INTEGER NOT NULL,
    "issueMonth" INTEGER,
    "amount" REAL NOT NULL,
    "address" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "InvoiceSchedule_period_issueMonth_issueDay_idx"
ON "InvoiceSchedule"("period", "issueMonth", "issueDay");

INSERT OR IGNORE INTO "InvoiceSchedule" (
    "id", "client", "product", "service", "description", "period", "issueDay", "issueMonth", "amount", "address", "name", "taxId"
) VALUES
    ('invoice-schedule-twss-varp-bp', 'TWSS', 'VaRP BP', 'ค่าเช่าให้บริการ', 'ค่าเช่าใช้บริการโปรแกรม VaRP รายเดือน', 'month', 28, NULL, 15000, '71 หมู่ 3 ต.บางตลาด อ.ปากเกร็ด จ.นนทบุรี 11120', 'บริษัท ทีดับบลิวเอส โซลูชั่นส์ จำกัด', '125559009490'),
    ('invoice-schedule-twss-varp-pk', 'TWSS', 'VaRP PK', 'ค่าเช่าให้บริการ', 'ค่าเช่าใช้บริการโปรแกรม VaRP รายเดือน', 'month', 28, NULL, 24000, '71 หมู่ 3 ต.บางตลาด อ.ปากเกร็ด จ.นนทบุรี 11120', 'บริษัท ทีดับบลิวเอส โซลูชั่นส์ จำกัด', '125559009490'),
    ('invoice-schedule-twss-msc', 'TWSS_MSC', 'VaRP_MSC', 'MA', 'ค่า MA รายปี โปรแกรม VaRP', 'year', 30, 3, 144112.5, '71 หมู่ 3 ต.บางตลาด อ.ปากเกร็ด จ.นนทบุรี 11120', 'บริษัท ทีดับบลิวเอส โซลูชั่นส์ จำกัด', '125559009490'),
    ('invoice-schedule-tao-varp', 'TAO', 'VaRP', 'MA', 'ค่า MA รายปี โปรแกรม VaRP', 'year', 5, 1, 72000, 'นิมิตใหม่ กรุงเทพมหานคร', 'บริษัท ที.เอ.โอ.บางกอก คอนสตรัคชั่น จำกัด (สำนักงานใหญ่)', '105537104058');
