import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function svgToDataUrl(svg: string): string {
  const base64 = Buffer.from(svg.trim()).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}

const sigPurchasing = svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 90" width="260" height="90">
  <path d="M 30 75 C 25 45, 35 25, 55 20 C 75 15, 80 40, 65 55 C 50 70, 70 75, 95 65 M 100 55 C 105 45, 115 45, 120 60 M 125 40 L 125 65 M 125 30 A 1 1 0 0 1 125 32 M 135 60 C 145 40, 155 70, 165 55 C 170 50, 175 60, 185 58 M 190 65 L 190 45 C 190 35, 205 35, 205 65 M 215 40 C 215 20, 240 20, 235 50 C 230 75, 210 85, 245 75 M 210 45 L 245 42" fill="none" stroke="#0f172a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`);

const sigManager = svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 90" width="260" height="90">
  <path d="M 35 25 L 50 50 L 65 25 M 50 50 L 45 80 M 68 75 A 2 2 0 0 1 68 77 M 90 20 L 90 75 M 90 50 L 125 25 M 105 40 L 130 75 M 140 60 C 145 45, 160 45, 160 70 M 155 45 L 155 75 M 168 35 L 168 75 M 160 50 L 180 48 M 185 55 C 185 45, 205 45, 205 65 C 205 80, 185 80, 185 55 M 210 65 C 215 50, 245 40, 255 70" fill="none" stroke="#0f172a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`);

const sigPresdir = svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 90" width="260" height="90">
  <path d="M 30 20 L 30 75 M 65 20 L 65 75 M 30 45 L 65 45 M 72 72 A 2 2 0 0 1 72 74 M 95 35 C 115 25, 115 50, 95 55 C 80 60, 100 80, 125 70 M 135 48 C 135 70, 150 70, 150 48 L 150 72 M 160 50 L 180 50 L 165 72 L 185 72 M 195 48 C 195 70, 210 70, 210 48 L 210 72 M 220 30 L 220 72 M 220 52 L 245 35 M 230 46 L 250 72 M 255 35 L 255 72" fill="none" stroke="#0f172a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`);

async function main() {
  await prisma.user.updateMany({
    where: { username: "purchasing" },
    data: { signatureImage: sigPurchasing },
  });

  await prisma.user.updateMany({
    where: { username: "manager" },
    data: { signatureImage: sigManager },
  });

  await prisma.user.updateMany({
    where: { username: "manager2" },
    data: { signatureImage: sigManager },
  });

  await prisma.user.updateMany({
    where: { username: "presdir" },
    data: { signatureImage: sigPresdir },
  });

  console.log("✅ Seed signatures updated successfully for purchasing, manager, and presdir!");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
