import { PrismaClient } from './src/generated/prisma/client.js';
const p = new PrismaClient();
const pos = await p.purchaseOrder.findMany({ select: { poNumber: true }, orderBy: { poNumber: 'asc' } });
console.log('POs in DB:', pos.length);
pos.forEach(x => console.log(' -', x.poNumber));
await p.$disconnect();
