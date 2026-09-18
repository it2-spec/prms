-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('PURCHASING', 'WAREHOUSE', 'SUPPLIER');

-- CreateEnum
CREATE TYPE "POStatus" AS ENUM ('DRAFT', 'SENT', 'WAITING_DELIVERY', 'PARTIALLY_DELIVERED', 'WAITING_RECEIVING', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'REVISED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('CREATED', 'SENT', 'ARRIVED');

-- CreateEnum
CREATE TYPE "ReceivingStatus" AS ENUM ('PENDING', 'VERIFIED', 'RECEIVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PRStatus" AS ENUM ('DRAFT', 'APPROVED', 'CONVERTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" "RoleName" NOT NULL,
    "description" TEXT,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "roleId" TEXT NOT NULL,
    "supplierId" TEXT,
    "warehouseId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "contactPerson" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierItemQuality" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "unitPrice" DECIMAL(15,2) NOT NULL DEFAULT 0,

    CONSTRAINT "SupplierItemQuality_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequest" (
    "id" TEXT NOT NULL,
    "prNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "requestDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "PRStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequestDetail" (
    "id" TEXT NOT NULL,
    "purchaseRequestId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPrice" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "PurchaseRequestDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "purchaseRequestId" TEXT,
    "supplierId" TEXT NOT NULL,
    "warehouseId" TEXT,
    "createdById" TEXT NOT NULL,
    "poDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDelivery" TIMESTAMP(3),
    "status" "POStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "revisionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderDetail" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPrice" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "receivedQty" INTEGER NOT NULL DEFAULT 0,
    "deliveredQty" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "PurchaseOrderDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "deliveryNumber" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "suratJalan" TEXT NOT NULL,
    "shipDate" TIMESTAMP(3) NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'CREATED',
    "createdById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryDetail" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "purchaseOrderDetailId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPrice" DECIMAL(15,2) NOT NULL DEFAULT 0,

    CONSTRAINT "DeliveryDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receiving" (
    "id" TEXT NOT NULL,
    "receivingNumber" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "receivedById" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ReceivingStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receiving_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceivingDetail" (
    "id" TEXT NOT NULL,
    "receivingId" TEXT NOT NULL,
    "deliveryDetailId" TEXT,
    "itemId" TEXT NOT NULL,
    "qtyOrdered" INTEGER NOT NULL,
    "qtyDelivered" INTEGER NOT NULL,
    "qtyReceived" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "ReceivingDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Item_code_key" ON "Item"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierItemQuality_supplierId_itemId_key" ON "SupplierItemQuality"("supplierId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequest_prNumber_key" ON "PurchaseRequest"("prNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_deliveryNumber_key" ON "Delivery"("deliveryNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Receiving_receivingNumber_key" ON "Receiving"("receivingNumber");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierItemQuality" ADD CONSTRAINT "SupplierItemQuality_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierItemQuality" ADD CONSTRAINT "SupplierItemQuality_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestDetail" ADD CONSTRAINT "PurchaseRequestDetail_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "PurchaseRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestDetail" ADD CONSTRAINT "PurchaseRequestDetail_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "PurchaseRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderDetail" ADD CONSTRAINT "PurchaseOrderDetail_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderDetail" ADD CONSTRAINT "PurchaseOrderDetail_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryDetail" ADD CONSTRAINT "DeliveryDetail_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryDetail" ADD CONSTRAINT "DeliveryDetail_purchaseOrderDetailId_fkey" FOREIGN KEY ("purchaseOrderDetailId") REFERENCES "PurchaseOrderDetail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryDetail" ADD CONSTRAINT "DeliveryDetail_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receiving" ADD CONSTRAINT "Receiving_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receiving" ADD CONSTRAINT "Receiving_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receiving" ADD CONSTRAINT "Receiving_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receiving" ADD CONSTRAINT "Receiving_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivingDetail" ADD CONSTRAINT "ReceivingDetail_receivingId_fkey" FOREIGN KEY ("receivingId") REFERENCES "Receiving"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivingDetail" ADD CONSTRAINT "ReceivingDetail_deliveryDetailId_fkey" FOREIGN KEY ("deliveryDetailId") REFERENCES "DeliveryDetail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivingDetail" ADD CONSTRAINT "ReceivingDetail_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
