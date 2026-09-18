/*
  Warnings:

  - You are about to drop the column `location` on the `PurchaseOrder` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "lastUnitPrice" DECIMAL(15,2),
ADD COLUMN     "packageSize" DECIMAL(10,2) DEFAULT 1,
ADD COLUMN     "packageUnit" TEXT;

-- AlterTable
ALTER TABLE "PurchaseOrder" DROP COLUMN "location";

-- AlterTable
ALTER TABLE "PurchaseOrderDetail" ADD COLUMN     "packageQty" INTEGER,
ADD COLUMN     "packageUnit" TEXT,
ADD COLUMN     "receivedPackageQty" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ItemPriceHistory" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "oldUnitPrice" DECIMAL(15,2),
    "newUnitPrice" DECIMAL(15,2) NOT NULL,
    "source" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ItemPriceHistory_itemId_changedAt_idx" ON "ItemPriceHistory"("itemId", "changedAt");

-- AddForeignKey
ALTER TABLE "ItemPriceHistory" ADD CONSTRAINT "ItemPriceHistory_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
