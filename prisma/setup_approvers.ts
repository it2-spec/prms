import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const password = await bcrypt.hash("admin123", 10);
  const purchasingRole = await prisma.role.findUniqueOrThrow({ where: { name: "PURCHASING" } });

  // L1: Manager Purchasing
  const m1 = await prisma.user.upsert({
    where: { username: "manager" },
    update: { approvalLevel: 1, name: "Y. Kato" },
    create: { username: "manager", password, name: "Y. Kato", email: "y.kato@sri.co.id", roleId: purchasingRole.id, approvalLevel: 1 },
  });
  const m2 = await prisma.user.upsert({
    where: { username: "manager2" },
    update: { approvalLevel: 1, name: "S. Aoki" },
    create: { username: "manager2", password, name: "S. Aoki", email: "s.aoki@sri.co.id", roleId: purchasingRole.id, approvalLevel: 1 },
  });

  // L2: Presdir
  const p1 = await prisma.user.upsert({
    where: { username: "presdir" },
    update: { approvalLevel: 2, name: "H. Suzuki" },
    create: { username: "presdir", password, name: "H. Suzuki", email: "h.suzuki@sri.co.id", roleId: purchasingRole.id, approvalLevel: 2 },
  });

  console.log("Users set:");
  console.log(` manager  / admin123 -> ${m1.name} (Level ${m1.approvalLevel} - Manager)`);
  console.log(` manager2 / admin123 -> ${m2.name} (Level ${m2.approvalLevel} - Manager)`);
  console.log(` presdir  / admin123 -> ${p1.name} (Level ${p1.approvalLevel} - Presdir)`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
