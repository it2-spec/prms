-- ==============================================================================
-- PRMS SEED DATA SCRIPT (SUPABASE SQL EDITOR)
-- Password untuk semua akun default di bawah ini adalah: admin123
-- ==============================================================================

-- 1. ROLE (Peran Pengguna)
INSERT INTO "Role" ("id", "name", "description")
VALUES 
  ('role_purchasing', 'PURCHASING', 'Divisi Purchasing & Approval'),
  ('role_warehouse', 'WAREHOUSE', 'Divisi Gudang / Warehouse'),
  ('role_supplier', 'SUPPLIER', 'Portal Eksternal Supplier')
ON CONFLICT ("name") DO UPDATE 
SET "description" = EXCLUDED."description";

-- 2. WAREHOUSE (Gudang)
INSERT INTO "Warehouse" ("id", "code", "name", "address", "isActive", "createdAt")
VALUES
  ('wh_001', 'WH001', 'Gudang Pusat', 'Kawasan Industri Cikarang', true, NOW()),
  ('wh_002', 'WH002', 'Gudang Cabang', 'Kawasan Industri Karawang', true, NOW())
ON CONFLICT ("code") DO UPDATE 
SET "name" = EXCLUDED."name", "address" = EXCLUDED."address";

-- 3. SUPPLIER (Pemasok)
INSERT INTO "Supplier" ("id", "code", "name", "address", "phone", "email", "contactPerson", "isActive", "createdAt")
VALUES
  ('sup_001', 'SUP001', 'PT Baja Utama', 'Jl. Industri Raya No. 12, Bekasi', '021-5551234', 'sales@bajautama.co.id', 'Budi Santoso', true, NOW()),
  ('sup_002', 'SUP002', 'CV Elektronik Mandiri', 'Jl. Mawar No. 45, Bandung', '022-5556789', 'cs@elektronikmandiri.com', 'Siti Aminah', true, NOW())
ON CONFLICT ("code") DO UPDATE 
SET "name" = EXCLUDED."name", "email" = EXCLUDED."email";

-- 4. DEPARTEMEN (11 Departemen Pemohon / Pemakai Barang)
INSERT INTO "Dept" ("id", "code", "name", "isActive", "createdAt")
VALUES
  ('dept_01', 'PNT-1', 'Painting Plant 1', true, NOW()),
  ('dept_02', 'PNT-2', 'Painting Plant 2', true, NOW()),
  ('dept_03', 'INJ', 'Injection Moulding', true, NOW()),
  ('dept_04', 'ASSY', 'Assembly', true, NOW()),
  ('dept_05', 'PP', 'Production Preparation', true, NOW()),
  ('dept_06', 'QC', 'Quality Control / QA', true, NOW()),
  ('dept_07', 'ENG', 'Maintenance / Engineering', true, NOW()),
  ('dept_08', 'WHS', 'Warehouse & Logistic', true, NOW()),
  ('dept_09', 'PPIC', 'Production Planning & Inventory Control', true, NOW()),
  ('dept_10', 'PUR', 'Purchasing', true, NOW()),
  ('dept_11', 'GA', 'General Affair & HR', true, NOW())
ON CONFLICT ("code") DO UPDATE 
SET "name" = EXCLUDED."name", "isActive" = true;

-- 5. ITEM MASTER (Contoh Data Barang)
INSERT INTO "Item" ("id", "code", "name", "unit", "packageUnit", "packageSize", "isActive", "createdAt")
VALUES
  ('itm_001', 'BLT-12', 'Bolt M12 x 50', 'pcs', 'Box', 100, true, NOW()),
  ('itm_002', 'NUT-12', 'Nut M12', 'pcs', 'Box', 200, true, NOW()),
  ('itm_003', 'CBL-10', 'Cable 10mm', 'meter', 'Roll', 50, true, NOW()),
  ('itm_004', 'BRG-6204', 'Bearing 6204', 'pcs', 'Box', 10, true, NOW()),
  ('itm_005', 'PMP-05', 'Pump 5 HP', 'unit', 'Unit', 1, true, NOW())
ON CONFLICT ("code") DO UPDATE 
SET "name" = EXCLUDED."name", "unit" = EXCLUDED."unit";

-- 6. USER (Akun Pengguna)
-- Hash bcrypt di bawah adalah untuk password: admin123
INSERT INTO "User" (
  "id", "username", "password", "name", "email", 
  "roleId", "warehouseId", "supplierId", "approvalLevel", "isActive", "createdAt", "updatedAt"
)
VALUES
  -- Purchasing Staff
  ('usr_purchasing', 'purchasing', '$2b$10$iNHrx6kWnTeWs/DcJXt42O0ykJCXjg4MBh71MCKRPuYBkDHI4tO5u', 'Purchasing Staff', 'purchasing@prms.local', 
   (SELECT "id" FROM "Role" WHERE "name" = 'PURCHASING' LIMIT 1), NULL, NULL, 0, true, NOW(), NOW()),

  -- Warehouse Staff Pusat
  ('usr_warehouse', 'warehouse', '$2b$10$iNHrx6kWnTeWs/DcJXt42O0ykJCXjg4MBh71MCKRPuYBkDHI4tO5u', 'Warehouse Staff', 'warehouse@prms.local', 
   (SELECT "id" FROM "Role" WHERE "name" = 'WAREHOUSE' LIMIT 1), (SELECT "id" FROM "Warehouse" WHERE "code" = 'WH001' LIMIT 1), NULL, 0, true, NOW(), NOW()),

  -- Warehouse Staff Cabang
  ('usr_warehouse2', 'warehouse2', '$2b$10$iNHrx6kWnTeWs/DcJXt42O0ykJCXjg4MBh71MCKRPuYBkDHI4tO5u', 'Warehouse Cabang', 'warehouse2@prms.local', 
   (SELECT "id" FROM "Role" WHERE "name" = 'WAREHOUSE' LIMIT 1), (SELECT "id" FROM "Warehouse" WHERE "code" = 'WH002' LIMIT 1), NULL, 0, true, NOW(), NOW()),

  -- Supplier PT Baja Utama
  ('usr_supplier', 'supplier', '$2b$10$iNHrx6kWnTeWs/DcJXt42O0ykJCXjg4MBh71MCKRPuYBkDHI4tO5u', 'Sales Baja Utama', 'sales@bajautama.co.id', 
   (SELECT "id" FROM "Role" WHERE "name" = 'SUPPLIER' LIMIT 1), NULL, (SELECT "id" FROM "Supplier" WHERE "code" = 'SUP001' LIMIT 1), 0, true, NOW(), NOW()),

  -- Supplier CV Elektronik Mandiri
  ('usr_supplier2', 'supplier2', '$2b$10$iNHrx6kWnTeWs/DcJXt42O0ykJCXjg4MBh71MCKRPuYBkDHI4tO5u', 'CV Elektronik Mandiri', 'cs@elektronikmandiri.com', 
   (SELECT "id" FROM "Role" WHERE "name" = 'SUPPLIER' LIMIT 1), NULL, (SELECT "id" FROM "Supplier" WHERE "code" = 'SUP002' LIMIT 1), 0, true, NOW(), NOW()),

  -- Manager Purchasing (Approver L1)
  ('usr_manager', 'manager', '$2b$10$iNHrx6kWnTeWs/DcJXt42O0ykJCXjg4MBh71MCKRPuYBkDHI4tO5u', 'Y. Kato', 'y.kato@sri.co.id', 
   (SELECT "id" FROM "Role" WHERE "name" = 'PURCHASING' LIMIT 1), NULL, NULL, 1, true, NOW(), NOW()),

  -- Manager Purchasing 2 (Approver L1)
  ('usr_manager2', 'manager2', '$2b$10$iNHrx6kWnTeWs/DcJXt42O0ykJCXjg4MBh71MCKRPuYBkDHI4tO5u', 'S. Aoki', 's.aoki@sri.co.id', 
   (SELECT "id" FROM "Role" WHERE "name" = 'PURCHASING' LIMIT 1), NULL, NULL, 1, true, NOW(), NOW()),

  -- Presdir (Approver L2)
  ('usr_presdir', 'presdir', '$2b$10$iNHrx6kWnTeWs/DcJXt42O0ykJCXjg4MBh71MCKRPuYBkDHI4tO5u', 'H. Suzuki', 'h.suzuki@sri.co.id', 
   (SELECT "id" FROM "Role" WHERE "name" = 'PURCHASING' LIMIT 1), NULL, NULL, 2, true, NOW(), NOW())
ON CONFLICT ("username") DO UPDATE 
SET 
  "password" = EXCLUDED."password",
  "name" = EXCLUDED."name",
  "roleId" = EXCLUDED."roleId",
  "warehouseId" = EXCLUDED."warehouseId",
  "supplierId" = EXCLUDED."supplierId",
  "approvalLevel" = EXCLUDED."approvalLevel",
  "updatedAt" = NOW();
