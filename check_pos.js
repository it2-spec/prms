const { PrismaClient } = require('./src/generated/prisma');
const p = new PrismaClient();
p.purchaseOrder.findMany({ select: { poNumber: true, id: true }, orderBy: { poNumber: 'asc' } })
  .then(pos => {
    console.log('POs in DB:', pos.length);
    pos.forEach(x => console.log(' -', x.poNumber));
    return p.$disconnect();
  }).catch(e => { console.error(e); p.$disconnect(); });
