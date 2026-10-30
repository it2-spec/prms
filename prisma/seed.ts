import "dotenv/config";
import { PrismaClient, RoleName } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
const isSupabase =
  connectionString?.includes("supabase.co") ||
  connectionString?.includes("pooler.supabase.com");

const sanitizedConnectionString = connectionString?.replace(/[?&]sslmode=[^&]+/g, "");

const pool = new Pool({
  connectionString: sanitizedConnectionString,
  ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Roles
  const purchasingRole = await prisma.role.upsert({
    where: { name: RoleName.PURCHASING },
    update: {},
    create: { name: RoleName.PURCHASING },
  });
  const warehouseRole = await prisma.role.upsert({
    where: { name: RoleName.WAREHOUSE },
    update: {},
    create: { name: RoleName.WAREHOUSE },
  });
  const supplierRole = await prisma.role.upsert({
    where: { name: RoleName.SUPPLIER },
    update: {},
    create: { name: RoleName.SUPPLIER },
  });
  const adminProduksiRole = await prisma.role.upsert({
    where: { name: RoleName.ADMIN_PRODUKSI },
    update: {},
    create: { name: RoleName.ADMIN_PRODUKSI, description: "Admin Departemen Produksi (Molding, Plating, Painting)" },
  });
  const adminIndirectRole = await prisma.role.upsert({
    where: { name: RoleName.ADMIN_INDIRECT },
    update: {},
    create: { name: RoleName.ADMIN_INDIRECT, description: "Admin Departemen Indirect (PP, QC, QA, Assembly, PPIC)" },
  });
  const deptApproverRole = await prisma.role.upsert({
    where: { name: RoleName.DEPT_APPROVER },
    update: {},
    create: { name: RoleName.DEPT_APPROVER, description: "Approver Departemen (SPV / Manager Dept)" },
  });

  // Supplier
  const supl = await prisma.supplier.upsert({
    where: { code: "SUP001" },
    update: {},
    create: {
      code: "SUP001",
      name: "PT Baja Utama",
      address: "Jl. Industri Raya No. 12, Bekasi",
      phone: "021-5551234",
      email: "sales@bajautama.co.id",
      contactPerson: "Budi Santoso",
    },
  });
  const supl2 = await prisma.supplier.upsert({
    where: { code: "SUP002" },
    update: {},
    create: {
      code: "SUP002",
      name: "CV Elektronik Mandiri",
      address: "Jl. Mawar No. 45, Bandung",
      phone: "022-5556789",
      email: "cs@elektronikmandiri.com",
      contactPerson: "Siti Aminah",
    },
  });

  // Warehouse
  const wh = await prisma.warehouse.upsert({
    where: { code: "WH001" },
    update: {},
    create: { code: "WH001", name: "Gudang Pusat", address: "Kawasan Industri Cikarang" },
  });
  const wh2 = await prisma.warehouse.upsert({
    where: { code: "WH002" },
    update: {},
    create: { code: "WH002", name: "Gudang Cabang", address: "Kawasan Industri Karawang" },
  });

  // Items
  const items: { code: string; name: string; unit: string }[] = [
    { code: "BLT-12", name: "Bolt M12 x 50", unit: "pcs" },
    { code: "NUT-12", name: "Nut M12", unit: "pcs" },
    { code: "CBL-10", name: "Cable 10mm", unit: "meter" },
    { code: "BRG-6204", name: "Bearing 6204", unit: "pcs" },
    { code: "PMP-05", name: "Pump 5 HP", unit: "unit" },
  ];
  for (const i of items) {
    await prisma.item.upsert({ where: { code: i.code }, update: {}, create: i });
  }

  // Supplier-Item price mapping
  const itemIds = await prisma.item.findMany();
  for (const it of itemIds) {
    await prisma.supplierItemQuality.upsert({
      where: { supplierId_itemId: { supplierId: supl.id, itemId: it.id } },
      update: {},
      create: { supplierId: supl.id, itemId: it.id, unitPrice: 10000 + Math.random() * 50000 },
    });
    await prisma.supplierItemQuality.upsert({
      where: { supplierId_itemId: { supplierId: supl2.id, itemId: it.id } },
      update: {},
      create: { supplierId: supl2.id, itemId: it.id, unitPrice: 11000 + Math.random() * 50000 },
    });
  }

  // Users
  const password = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { username: "purchasing" },
    update: {},
    create: {
      username: "purchasing",
      password,
      name: "Purchasing Staff",
      email: "purchasing@prms.local",
      roleId: purchasingRole.id,
    },
  });
  await prisma.user.upsert({
    where: { username: "warehouse" },
    update: {},
    create: {
      username: "warehouse",
      password,
      name: "Warehouse Staff",
      email: "warehouse@prms.local",
      roleId: warehouseRole.id,
      warehouseId: wh.id,
    },
  });
  await prisma.user.upsert({
    where: { username: "warehouse2" },
    update: {},
    create: {
      username: "warehouse2",
      password,
      name: "Warehouse Cabang",
      email: "warehouse2@prms.local",
      roleId: warehouseRole.id,
      warehouseId: wh2.id,
    },
  });
  await prisma.user.upsert({
    where: { username: "supplier" },
    update: {},
    create: {
      username: "supplier",
      password,
      name: "Sales Baja Utama",
      email: "sales@bajautama.co.id",
      roleId: supplierRole.id,
      supplierId: supl.id,
    },
  });
  await prisma.user.upsert({
    where: { username: "supplier2" },
    update: {},
    create: {
      username: "supplier2",
      password,
      name: "CV Elektronik Mandiri",
      email: "cs@elektronikmandiri.com",
      roleId: supplierRole.id,
      supplierId: supl2.id,
    },
  });

  // Manager / Approver L1 (approvalLevel = 1)
  await prisma.user.upsert({
    where: { username: "manager" },
    update: { approvalLevel: 1 },
    create: {
      username: "manager",
      password,
      name: "Y. Kato",
      email: "y.kato@sri.co.id",
      roleId: purchasingRole.id, // Masuk sebagai role purchasing tapi memiliki hak approve L1
      approvalLevel: 1,
    },
  });
  await prisma.user.upsert({
    where: { username: "manager2" },
    update: { approvalLevel: 1 },
    create: {
      username: "manager2",
      password,
      name: "S. Aoki",
      email: "s.aoki@sri.co.id",
      roleId: purchasingRole.id,
      approvalLevel: 1,
    },
  });

  // President Director / Approver L2 (approvalLevel = 2)
  await prisma.user.upsert({
    where: { username: "presdir" },
    update: { approvalLevel: 2 },
    create: {
      username: "presdir",
      password,
      name: "H. Suzuki",
      email: "h.suzuki@sri.co.id",
      roleId: purchasingRole.id,
      approvalLevel: 2,
    },
  });

  const adminProduksiUser = await prisma.user.upsert({
    where: { username: "admin_produksi" },
    update: {
      departments: ["Molding", "Plating", "Painting 1", "Painting 2"],
    },
    create: {
      username: "admin_produksi",
      password,
      name: "Admin Produksi",
      email: "produksi@prms.local",
      roleId: adminProduksiRole.id,
      departments: ["Molding", "Plating", "Painting 1", "Painting 2"],
    },
  });

  const adminIndirectUser = await prisma.user.upsert({
    where: { username: "admin_indirect" },
    update: {
      departments: ["PP", "QC", "QA", "Assembly", "PPIC"],
    },
    create: {
      username: "admin_indirect",
      password,
      name: "Admin Indirect",
      email: "indirect@prms.local",
      roleId: adminIndirectRole.id,
      departments: ["PP", "QC", "QA", "Assembly", "PPIC"],
    },
  });

  await prisma.user.upsert({
    where: { username: "dept_approver" },
    update: {
      departments: ["Molding", "Plating", "Painting 1", "Painting 2", "PP", "QC", "QA", "Assembly", "PPIC"],
      approvalLevel: 1,
    },
    create: {
      username: "dept_approver",
      password,
      name: "Supervisor Dept Pemohon",
      email: "spv.dept@prms.local",
      roleId: deptApproverRole.id,
      approvalLevel: 1,
      departments: ["Molding", "Plating", "Painting 1", "Painting 2", "PP", "QC", "QA", "Assembly", "PPIC"],
    },
  });

  // Supervisor Spesifik per Departemen
  const deptSupervisors = [
    { username: "spv_molding", name: "Supervisor Molding", depts: ["Molding"], email: "spv.molding@prms.local" },
    { username: "spv_plating", name: "Supervisor Plating", depts: ["Plating"], email: "spv.plating@prms.local" },
    { username: "spv_painting1", name: "Supervisor Painting 1", depts: ["Painting 1"], email: "spv.painting1@prms.local" },
    { username: "spv_painting2", name: "Supervisor Painting 2", depts: ["Painting 2"], email: "spv.painting2@prms.local" },
    { username: "spv_pp", name: "Supervisor Production Prep (PP)", depts: ["PP"], email: "spv.pp@prms.local" },
    { username: "spv_qc", name: "Supervisor QC & QA", depts: ["QC", "QA"], email: "spv.qc@prms.local" },
    { username: "spv_assy", name: "Supervisor Assembly", depts: ["Assembly"], email: "spv.assy@prms.local" },
    { username: "spv_ppic", name: "Supervisor PPIC", depts: ["PPIC"], email: "spv.ppic@prms.local" },
  ];

  for (const spv of deptSupervisors) {
    await prisma.user.upsert({
      where: { username: spv.username },
      update: {
        name: spv.name,
        departments: spv.depts,
        approvalLevel: 1,
      },
      create: {
        username: spv.username,
        password,
        name: spv.name,
        email: spv.email,
        roleId: deptApproverRole.id,
        approvalLevel: 1,
        departments: spv.depts,
      },
    });
  }

  // Sample Purchase Request
  const purchasingUser = await prisma.user.findUniqueOrThrow({ where: { username: "purchasing" } });
  const prExists = await prisma.purchaseRequest.findUnique({ where: { prNumber: "PR0001" } });
  if (!prExists) {
    const pr = await prisma.purchaseRequest.create({
      data: {
        prNumber: "PR0001",
        department: "Painting 1",
        requestedById: adminProduksiUser.id,
        supplierId: supl.id,
        requestDate: new Date(),
        status: "APPROVED",
        purposeNotes: "Sample purchase request lini Painting",
        details: {
          create: [
            { itemId: (await prisma.item.findFirstOrThrow({ where: { code: "BLT-12" } })).id, qty: 100, estimatedPrice: 15000 },
            { itemId: (await prisma.item.findFirstOrThrow({ where: { code: "NUT-12" } })).id, qty: 200, estimatedPrice: 5000 },
            { itemId: (await prisma.item.findFirstOrThrow({ where: { code: "BRG-6204" } })).id, qty: 50, estimatedPrice: 45000 },
          ],
        },
      },
    });

    // Sample Purchase Order
    await prisma.purchaseOrder.create({
      data: {
        poNumber: "PO0001",
        purchaseRequestId: pr.id,
        supplierId: supl.id,
        warehouseId: wh.id,
        createdById: purchasingUser.id,
        poDate: new Date(),
        expectedDelivery: new Date(Date.now() + 7 * 86400000),
        status: "WAITING_DELIVERY",
        notes: "Sample PO untuk demo",
        details: {
          create: [
            { itemId: (await prisma.item.findFirstOrThrow({ where: { code: "BLT-12" } })).id, qty: 100, unitPrice: 15000 },
            { itemId: (await prisma.item.findFirstOrThrow({ where: { code: "NUT-12" } })).id, qty: 200, unitPrice: 5000 },
            { itemId: (await prisma.item.findFirstOrThrow({ where: { code: "BRG-6204" } })).id, qty: 50, unitPrice: 45000 },
          ],
        },
      },
    });
  }

  // 11 Departments
  const departments = [
    { code: "PNT-1", name: "Painting Plant 1" },
    { code: "PNT-2", name: "Painting Plant 2" },
    { code: "INJ", name: "Injection Moulding" },
    { code: "ASSY", name: "Assembly" },
    { code: "PP", name: "Production Preparation" },
    { code: "QC", name: "Quality Control / QA" },
    { code: "ENG", name: "Maintenance / Engineering" },
    { code: "WHS", name: "Warehouse & Logistic" },
    { code: "PPIC", name: "Production Planning & Inventory Control" },
    { code: "PUR", name: "Purchasing" },
    { code: "GA", name: "General Affair & HR" },
  ];

  for (const dept of departments) {
    await prisma.dept.upsert({
      where: { code: dept.code },
      update: { name: dept.name, isActive: true },
      create: { code: dept.code, name: dept.name, isActive: true },
    });
  }
  console.log(`Seeded ${departments.length} departments.`);

  console.log("Seed completed. Login credentials:");
  console.log("  purchasing / admin123");
  console.log("  warehouse / admin123");
  console.log("  supplier / admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
