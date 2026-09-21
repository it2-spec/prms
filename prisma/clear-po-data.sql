-- ==============================================================================
-- SCRIPT PEMBERSIHAN DATA TRANSAKSI: PO, DELIVERIES, & RECEIVINGS (SUPABASE)
-- ==============================================================================
-- Perintah ini akan menghapus semua data transaksi PO, Surat Jalan Pengiriman, 
-- dan Penerimaan Gudang, TANPA MENGHAPUS master data (Supplier, Item, Warehouse, User).
-- Jalankan query berikut di Supabase SQL Editor:

BEGIN;

-- 1. Truncate tabel transaksi berelasi dengan CASCADE
TRUNCATE TABLE 
  "ReceivingDetail",
  "Receiving",
  "DeliveryDetail",
  "Delivery",
  "PurchaseOrderDetail",
  "PurchaseOrder"
CASCADE;

-- 2. (Opsional) Bersihkan notifikasi terkait PO, Delivery, dan Receiving
DELETE FROM "Notification" 
WHERE "type" IN (
  'NEW_PO', 
  'PO_APPROVED_L1', 
  'PO_APPROVED_L2', 
  'PO_REVISED', 
  'NEW_DELIVERY', 
  'DELIVERY_ARRIVED', 
  'GOODS_RECEIVED'
);

-- 3. (Opsional) Bersihkan log audit transaksi PO/Delivery/Receiving
DELETE FROM "AuditLog"
WHERE "entityType" IN ('PurchaseOrder', 'Delivery', 'Receiving');

COMMIT;

-- ==============================================================================
-- Verifikasi: Pastikan jumlah baris sudah 0
-- ==============================================================================
SELECT 'PurchaseOrder' AS tabel, COUNT(*) AS sisa_data FROM "PurchaseOrder"
UNION ALL
SELECT 'PurchaseOrderDetail', COUNT(*) FROM "PurchaseOrderDetail"
UNION ALL
SELECT 'Delivery', COUNT(*) FROM "Delivery"
UNION ALL
SELECT 'DeliveryDetail', COUNT(*) FROM "DeliveryDetail"
UNION ALL
SELECT 'Receiving', COUNT(*) FROM "Receiving"
UNION ALL
SELECT 'ReceivingDetail', COUNT(*) FROM "ReceivingDetail";
