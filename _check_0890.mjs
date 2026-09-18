import { prisma } from "./src/lib/prisma";

const po = await prisma.purchaseOrder.findUnique({
  where: { poNumber: "0890/SRI/PUD/VII/2026" },
  include: { details: { include: { item: true } }, warehouse: true },
});
if (!po) { console.log("PO not found"); process.exit(0); }
console.log("PO:", po.poNumber, "status:", po.status, "wh:", po.warehouse?.name);
for (const d of po.details) {
  console.log(
    `  ${d.item.code} | ${d.item.name}\n` +
    `    item.unit=${d.item.unit} item.packageUnit=${d.item.packageUnit} item.packageSize=${d.item.packageSize}\n` +
    `    POD: qty=${d.qty} unit=${d.unit} packageUnit=${d.packageUnit} packageQty=${d.packageQty} unitPrice=${d.unitPrice}\n` +
    `    POD: deliveredQty=${d.deliveredQty} receivedQty=${d.receivedQty} receivedPackageQty=${d.receivedPackageQty}`
  );
}
await prisma.$disconnect();
process.exit(0);
