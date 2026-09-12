-- Promotes the ad-hoc "RestaurantWaiter"/"RestaurantRider" tables -- which were created
-- at runtime by CREATE TABLE IF NOT EXISTS on every API request -- into first-class
-- Prisma models, and replaces the regex-in-orderNotes encoding of the serving staff
-- with real foreign keys plus name snapshots.
--
-- Existing waiter/rider rows and their links to historical orders are preserved.

-- CreateTable
CREATE TABLE "Waiter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Waiter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "vehicleNo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rider_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Waiter_isActive_idx" ON "Waiter"("isActive");
CREATE INDEX "Waiter_createdAt_idx" ON "Waiter"("createdAt");
CREATE INDEX "Rider_isActive_idx" ON "Rider"("isActive");
CREATE INDEX "Rider_createdAt_idx" ON "Rider"("createdAt");

-- DataMigration: carry across rows from the legacy runtime-created tables, if present.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'RestaurantWaiter') THEN
        INSERT INTO "Waiter" ("id", "name", "phone", "isActive", "createdAt", "updatedAt")
        SELECT "id", "name", "phone", "isActive",
               COALESCE("createdAt", CURRENT_TIMESTAMP), CURRENT_TIMESTAMP
        FROM "RestaurantWaiter"
        ON CONFLICT ("id") DO NOTHING;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'RestaurantRider') THEN
        INSERT INTO "Rider" ("id", "name", "phone", "vehicleNo", "isActive", "createdAt", "updatedAt")
        SELECT "id", "name", "phone", "vehicleNo", "isActive",
               COALESCE("createdAt", CURRENT_TIMESTAMP), CURRENT_TIMESTAMP
        FROM "RestaurantRider"
        ON CONFLICT ("id") DO NOTHING;
    END IF;
END $$;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "riderId" TEXT,
ADD COLUMN     "riderName" TEXT,
ADD COLUMN     "waiterId" TEXT,
ADD COLUMN     "waiterName" TEXT;

-- DataMigration: lift the "[Waiter: x] [Rider: y]" prefix out of orderNotes into
-- real columns, then remove it from the free-text note.
UPDATE "Order"
SET "waiterName" = NULLIF(TRIM(SUBSTRING("orderNotes" FROM '\[Waiter:\s*([^\]]+)\]')), ''),
    "riderName"  = NULLIF(TRIM(SUBSTRING("orderNotes" FROM '\[Rider:\s*([^\]]+)\]')), '')
WHERE "orderNotes" IS NOT NULL
  AND ("orderNotes" LIKE '%[Waiter:%' OR "orderNotes" LIKE '%[Rider:%');

UPDATE "Order" o
SET "waiterId" = w."id"
FROM "Waiter" w
WHERE o."waiterName" IS NOT NULL AND o."waiterId" IS NULL AND w."name" = o."waiterName";

UPDATE "Order" o
SET "riderId" = r."id"
FROM "Rider" r
WHERE o."riderName" IS NOT NULL AND o."riderId" IS NULL AND r."name" = o."riderName";

UPDATE "Order"
SET "orderNotes" = NULLIF(
        TRIM(REGEXP_REPLACE("orderNotes", '\[(Waiter|Rider):[^\]]*\]\s*', '', 'g')),
        '')
WHERE "orderNotes" IS NOT NULL
  AND ("orderNotes" LIKE '%[Waiter:%' OR "orderNotes" LIKE '%[Rider:%');

-- DataMigration: one-off repair of legacy unpaid delivery orders whose grandTotal
-- included a delivery charge. This was previously done by a raw UPDATE that ran on
-- every GET /api/orders; it belongs here, applied exactly once.
UPDATE "Order"
SET "deliveryCharge" = 0,
    "grandTotal" = "subtotal" - "discountAmount" + "taxAmount"
WHERE "deliveryCharge" > 0 AND "paymentStatus" = 'UNPAID';

-- DropTable
DROP TABLE IF EXISTS "RestaurantRider";
DROP TABLE IF EXISTS "RestaurantWaiter";

-- CreateIndex
CREATE INDEX "Order_waiterId_idx" ON "Order"("waiterId");
CREATE INDEX "Order_riderId_idx" ON "Order"("riderId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_waiterId_fkey" FOREIGN KEY ("waiterId") REFERENCES "Waiter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
