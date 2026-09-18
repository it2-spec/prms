import { prisma } from './src/lib/prisma.js';
async function main() {
  const pos = await prisma.purchaseOrder.findMany({ 
    select: { poNumber: true, id: true }, 
    orderBy: { poNumber: 'asc' } 
  });
  console.log('Total POs in DB:', pos.length);
  pos.forEach(x => console.log(' -', x.poNumber));
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
