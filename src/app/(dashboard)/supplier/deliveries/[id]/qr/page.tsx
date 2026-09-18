import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { formatDateOnly, formatMoney } from "@/lib/utils";
import { Card, PageTitle } from "@/components/ui";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

export default async function DeliveryQRPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, dbUser } = await getSessionUser();
  if (!user) redirect("/login");

  const delivery = await prisma.delivery.findUnique({
    where: { id },
    include: {
      purchaseOrder: { include: { supplier: true } },
      supplier: true,
      details: { include: { item: true } },
      createdBy: true,
    },
  });

  if (!delivery) notFound();

  // BR-001 + RBAC: supplier hanya bisa melihat delivery miliknya
  if (user.role === "SUPPLIER" && delivery.supplierId !== dbUser?.supplierId) notFound();
  if (!["PURCHASING", "WAREHOUSE", "SUPPLIER"].includes(user.role)) redirect("/login");

  // QR berisi delivery_id (FR-04)
  const qrPayload = JSON.stringify({ delivery_id: delivery.deliveryNumber });
  const qrDataUrl = await QRCode.toDataURL(qrPayload, { width: 220, margin: 1 });

  const totalValue = delivery.details.reduce(
    (s, d) => s + d.qty * Number(d.unitPrice),
    0,
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4 print:space-y-4">
      <div className="print:hidden">
        <PageTitle
          title="QR Code Delivery"
          subtitle="Cetak dan tempel pada surat jalan / barang yang dikirim"
          breadcrumb={["Deliveries", "QR Code"]}
          action={<PrintButton />}
        />
      </div>

      {delivery.status === "CANCELLED" && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-center text-sm font-semibold text-red-700">
          PERHATIAN: SURAT JALAN INI TELAH DIBATALKAN OLEH SUPPLIER
        </div>
      )}

      <Card className="!p-8 print:border-0 print:shadow-none">
        <div className="mb-6 text-center">
          <div className="text-xs uppercase tracking-widest text-slate-400">
            Delivery / Surat Jalan Digital
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-800">{delivery.deliveryNumber}</div>
        </div>

        <div className="flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt={`QR ${delivery.deliveryNumber}`}
            className="h-48 w-48"
          />
        </div>
        <div className="mt-3 text-center font-mono text-sm text-slate-600">
          {delivery.deliveryNumber}
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 border-t border-dashed border-slate-200 pt-6 text-sm">
          <div>
            <div className="text-xs text-slate-400">Supplier</div>
            <div className="font-medium text-slate-800">{delivery.supplier.name}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Purchase Order</div>
            <div className="font-medium text-slate-800">{delivery.purchaseOrder.poNumber}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Surat Jalan</div>
            <div className="font-medium text-slate-800">{delivery.suratJalan}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Tanggal Kirim</div>
            <div className="font-medium text-slate-800">{formatDateOnly(delivery.shipDate)}</div>
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-2 text-xs font-medium text-slate-400">Item Pengiriman</div>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 font-medium">Qty</th>
                <th className="px-3 py-2 font-medium text-right">Harga</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {delivery.details.map((d) => (
                <tr key={d.id}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-700">{d.item.name}</div>
                    <div className="text-xs text-slate-400">{d.item.code}</div>
                  </td>
                  <td className="px-3 py-2">{d.qty}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(d.unitPrice)}</td>
                </tr>
              ))}
              <tr>
                <td className="px-3 py-2 font-semibold" colSpan={2}>Total</td>
                <td className="px-3 py-2 text-right font-semibold">{formatMoney(totalValue)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-8 flex justify-between border-t border-slate-200 pt-4 text-xs text-slate-400">
          <span>Dibuat oleh: {delivery.createdBy.name}</span>
          <span>{formatDateOnly(delivery.createdAt)}</span>
        </div>
      </Card>
    </div>
  );
}
