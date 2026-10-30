# PRMS Architecture & Business Memory

## 1. Project Overview & Tech Stack
- **System**: PRMS (Procurement Receiving Management System)
- **Framework**: Next.js (App Router), TypeScript, Tailwind CSS
- **Database & ORM**: PostgreSQL via Prisma ORM (`prisma/schema.prisma`), client generated in `src/generated/prisma`
- **Auth**: Custom JWT cookie (`prms_session`) with `jose` library in `src/lib/auth.ts` and route guard in `src/proxy.ts`

## 2. Directory Structure & Key Files
- `prisma/schema.prisma` : Skema database Prisma
- `src/lib/auth.ts` : Helper session, auth, requireRole, JWT
- `src/lib/prisma.ts` : Singleton instance Prisma Client
- `src/proxy.ts` : Route protection & role redirection
- `src/app/(dashboard)/` :
  - `purchasing/` : Modul Purchasing (PO, PR, RFQ, Master Data, Vendor, User, Approval)
  - `warehouse/` : Modul Gudang (Receiving, Stock, Dispatch)
  - `supplier/` : Modul Supplier Portal (Delivery Order, Signature, PO View)
- `src/components/` : Shared UI components

## 3. End-to-End Business Flow
```
[Admin Dept Buat PR] 
      ↓
[Approval SPV/Manager Dept] 
      ↓
[Purchasing Review PR] 
      ↓ (Convert to PO / Split Multi-Vendor PO)
[Purchase Order (PO)] 
      ↓
[Approval L1 (Mgr Purchasing) & L2 (Presdir)] 
      ↓
[Supplier Accept & Delivery] 
      ↓
[Warehouse Receiving & Inspection] 
      ↓
[Closed PO]
```

## 4. Modul Purchase Request (PR) & Role Baru
### A. Roles & Permissions:
1. **ADMIN_PRODUKSI**:
   - Membawahi departemen produksi: Molding, Plating, Painting 1, Painting 2
   - Dapat membuat PR untuk salah satu departemen tersebut
   - Pilihan master item difilter khusus kategori produksi (cat, thinner, resin, mold part, dsb.)
   - Dapat menginput item request baru jika belum terdaftar di master item
2. **ADMIN_INDIRECT**:
   - Membawahi departemen indirect: PP, QC, QA, Assembly, PPIC
   - Dapat membuat PR untuk departemen yang dibawahi
   - Master item difilter khusus kebutuhan indirect/office/assembly
   - Dapat menginput item request baru jika belum ada di master
3. **DEPT_APPROVER (SPV / Manager Dept)**:
   - Approval internal departemen sebelum PR dapat diproses oleh Purchasing
4. **PURCHASING**:
   - Dapat memonitor PR (termasuk yang statusnya Draft / Pending Approval sebagai ancang-ancang)
   - Memproses PR yang sudah `APPROVED` menjadi PO
   - Menentukan Supplier untuk tiap item PR
   - Dapat memecah 1 PR menjadi beberapa PO (Multi-Vendor PO)

### B. Lifecycle Status PR:
- `DRAFT`: Sedang diisi oleh Admin Dept
- `PENDING_APPROVAL`: Menunggu persetujuan SPV/Manager Dept pemohon
- `APPROVED`: Disetujui internal dept, siap diproses Purchasing
- `REJECTED`: Ditolak oleh SPV/Manager Dept
- `PARTIAL_PO`: Sebagian item PR sudah diterbitkan PO-nya
- `ORDERED`: Semua item PR sudah diterbitkan PO-nya (menunggu pengiriman & penerimaan barang)
- `PARTIAL_RECEIVED`: Sebagian barang sudah diterima di gudang oleh Warehouse
- `COMPLETED`: Seluruh barang dari PR telah diterima lengkap di gudang (Receiving Tuntas)
- `CANCELLED`: Dibatalkan

### C. Detail Purchase Request:
- Header: `prNumber`, `department`, `requestedById`, `requiredDate`, `urgency` (NORMAL / URGENT), `purposeNotes`, `attachmentUrl`, `status`
- Detail: `itemId` (nullable jika item baru), `customItemName`, `specifications`, `qty`, `unit`, `notes`, `status` (PENDING / ORDERED / PARTIAL_RECEIVED / RECEIVED / CANCELLED), relasi ke PO Details
