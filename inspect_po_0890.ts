import dotenv from 'dotenv';
dotenv.config();
import { prisma } from './src/lib/prisma';

async function main() {
  const po = await prisma.purchaseOrder.findFirst({
    where: { poNumber: { contains: '0890' } },
    include: { details: { include: { item: true } } }
  });
  if (!po) {
    console.log('PO 0890 not found');
    return;
  }
  console.log('PO Number:', po.poNumber);
  console.log('Details count:', po.details.length);
  po.details.forEach((d, i) => {
    console.log(`Line ${i + 1}: Item="${d.item.name}", Qty=${d.qty}, ReceivedQty=${d.receivedQty}, Unit="${d.unit}"`);
  });
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
