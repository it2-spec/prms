<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# PRMS Project Context & Architecture Memory

> File referensi lengkap: [project-context.md](file:///.agents/rules/project-context.md)

## Tech Stack & Core Conventions
- **Framework**: Next.js (App Router), TypeScript, Tailwind CSS
- **Database**: PostgreSQL with Prisma ORM (`prisma/schema.prisma`), client in `@/generated/prisma`
- **Auth**: JWT cookie (`prms_session`) with `jose` via `@/lib/auth` and middleware gatekeeper `@/proxy.ts`

## Roles & Workflow (PR -> PO -> Delivery -> Receiving -> Closed)
- **Roles**:
  - `PURCHASING`: Manajemen PO, review PR, penentuan supplier, convert PR -> PO
  - `WAREHOUSE`: Penerimaan barang, receiving inspection, stock outgoing
  - `SUPPLIER`: Akses portal supplier, tanda tangan PO, konfirmasi delivery
  - `ADMIN_PRODUKSI`: Admin departemen produksi (Molding, Plating, Painting 1, Painting 2). Buat PR, filter item produksi, request item baru.
  - `ADMIN_INDIRECT`: Admin departemen indirect (PP, QC, QA, Assembly, PPIC). Buat PR, filter item indirect, request item baru.
  - `DEPT_APPROVER`: SPV / Manager departemen pemohon untuk approval internal PR sebelum diproses Purchasing.

## Aturan Khusus Purchase Request (PR)
1. **Multi-Department Admin**: 1 user admin bisa membawahi beberapa sub-departemen dan memilih departemen pemohon saat membuat PR.
2. **Item Scoping**: Master item difilter berdasarkan departemen, plus mendukung custom/ad-hoc item request jika belum terdaftar di master item.
3. **Supplier Selection**: Supplier ditentukan oleh Purchasing saat konversi PR ke PO, bukan oleh Admin Dept.
4. **Approval Flow**: Admin submit -> Status `PENDING_APPROVAL` (SPV/Manager Dept Approve) -> Status `APPROVED` -> Purchasing convert to PO. Purchasing memiliki visibilitas read-only ke PR berstatus pending sebagai early tracking.
5. **Multi-Vendor PO Splitting & Lifecycle Completion Rule**:
   - **Saat PO Terbit**: 1 PR dapat dipecah ke beberapa PO per vendor (`PARTIAL_PO` jika sebagian item dipesan, `ORDERED` jika seluruh item sudah diterbitkan PO). Status PR saat terbit PO adalah `ORDERED`, **BUKAN** `COMPLETED`.
   - **Definisi Selesai (`COMPLETED`)**: Proses PR baru dikatakan SELESAI (`COMPLETED`) ketika barang dari PO terkait sudah **diterima lengkap oleh tim Warehouse** (Receiving tuntas).
   - **Siklus Status PR**: `DRAFT` -> `PENDING_APPROVAL` -> `APPROVED` -> `PARTIAL_PO` / `ORDERED` -> `PARTIAL_RECEIVED` -> `COMPLETED`. Status item PR: `PENDING` -> `ORDERED` -> `PARTIAL_RECEIVED` -> `RECEIVED`.

