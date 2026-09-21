import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL tidak ditemukan di environment (.env)");
  process.exit(1);
}

const isSupabase =
  connectionString.includes("supabase.co") ||
  connectionString.includes("pooler.supabase.com");

const sanitizedConnectionString = connectionString.replace(/[?&]sslmode=[^&]+/g, "");

const pool = new Pool({
  connectionString: sanitizedConnectionString,
  ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Mengosongkan data Purchase Order, Delivery, dan Receiving...");

  // Menjalankan raw query TRUNCATE CASCADE
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE 
      "ReceivingDetail",
      "Receiving",
      "DeliveryDetail",
      "Delivery",
      "PurchaseOrderDetail",
      "PurchaseOrder"
    CASCADE;
  `);

  console.log("Membersihkan notifikasi dan audit log terkait...");
  await prisma.$executeRawUnsafe(`
    DELETE FROM "Notification" 
    WHERE "type" IN (
      'NEW_PO', 'PO_APPROVED_L1', 'PO_APPROVED_L2', 'PO_REVISED', 
      'NEW_DELIVERY', 'DELIVERY_ARRIVED', 'GOODS_RECEIVED'
    );
  `);

  await prisma.$executeRawUnsafe(`
    DELETE FROM "AuditLog"
    WHERE "entityType" IN ('PurchaseOrder', 'Delivery', 'Receiving');
  `);

  console.log("SELESAI! Seluruh data PO, Delivery, dan Receiving telah dibersihkan.");
}

main()
  .catch((e) => {
    console.error("Gagal membersihkan data:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
