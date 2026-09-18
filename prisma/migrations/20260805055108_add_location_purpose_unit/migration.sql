-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "department" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "purposeProject" TEXT;

-- AlterTable
ALTER TABLE "PurchaseOrderDetail" ADD COLUMN     "unit" TEXT;
