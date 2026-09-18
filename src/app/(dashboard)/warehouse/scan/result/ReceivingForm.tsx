"use client";

import { useState } from "react";
import { createReceiving } from "./receivingAction";
import { Card } from "@/components/ui";

type DeliveryDetailItem = {
  id: string;
  item: { id: string; name: string; code: string; unit: string | null; packageUnit: string | null; packageSize: any };
  purchaseOrderDetail: {
    qty: number;
    receivedQty: number;
    unitPrice: { toString(): string } | string | number;
  };
  qty: number;
};

type Delivery = {
  id: string;
  deliveryNumber: string;
  details: DeliveryDetailItem[];
};

export default function ReceivingForm({
  delivery,
  warehouseId,
}: {
  delivery: Delivery;
  warehouseId: string;
}) {
  const [qtys, setQtys] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    delivery.details.forEach((d) => {
      const pkgSize = Number(d.item.packageSize ?? 1);
      init[d.id] = pkgSize > 0 ? Math.floor(d.qty / pkgSize) : d.qty;
    });
    return init;
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function setPkgQty(detailId: string, value: number, maxPkg: number) {
    const valInt = Math.floor(Math.max(0, value));
    setQtys((q) => ({ ...q, [detailId]: Math.min(valInt, maxPkg) }));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = delivery.details.map((d) => {
      const poDetail = d.purchaseOrderDetail;
      const pkgSize = Number(d.item.packageSize ?? 1);
      const pkgQty = qtys[d.id] ?? 0;
      const kgReceived = pkgQty * pkgSize;

      const outstandingKg = poDetail.qty - poDetail.receivedQty;
      const maxKgAllowed = Math.min(outstandingKg, d.qty);

      return {
        deliveryDetailId: d.id,
        itemId: d.item.id,
        qtyOrdered: poDetail.qty,
        qtyDelivered: d.qty,
        qtyReceived: Math.min(kgReceived, maxKgAllowed),
        receivedPackageQty: pkgQty,
      };
    });

    if (!payload.some((p) => p.qtyReceived > 0)) {
      setError("Isi minimal satu item dengan qty receiving lebih dari 0.");
      setSubmitting(false);
      return;
    }

    const fd = new FormData();
    fd.set("details", JSON.stringify(payload));
    const res = await createReceiving(delivery.id, fd);
    if (res?.error) {
      setError(res.error);
      setSubmitting(false);
    } else if (res?.redirect) {
      window.location.href = res.redirect;
    }
  }

  return (
    <Card>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-800">Verifikasi Fisik & Konfirmasi Receiving</h3>
        <p className="text-xs text-slate-500">
          Bandingkan dengan barang fisik. Edit qty jika berbeda (BR-006).
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <input type="hidden" name="warehouseId" value={warehouseId} />
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Item & Konversi</th>
                <th className="px-4 py-3 font-medium">Dikirim (Surat Jalan)</th>
                <th className="px-4 py-3 font-medium text-amber-600">Outstanding PO</th>
                <th className="px-4 py-3 font-medium">Jumlah Kemasan Diterima</th>
                <th className="px-4 py-3 font-medium text-right">Total Berat (Kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {delivery.details.map((d) => {
                const poDetail = d.purchaseOrderDetail;
                const pkgSize = Number(d.item.packageSize ?? 1);
                const pkgUnit = d.item.packageUnit || "Pail";

                const outstanding = poDetail.qty - poDetail.receivedQty;
                const maxKg = Math.min(outstanding, d.qty);
                const maxPkg = pkgSize > 0 ? Math.floor(maxKg / pkgSize) : maxKg;

                const currentPkg = qtys[d.id] ?? 0;
                const currentKg = currentPkg * pkgSize;

                return (
                  <tr key={d.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{d.item.name}</div>
                      <div className="text-xs text-slate-400">
                        {d.item.code} · 1 {pkgUnit} = {pkgSize} {d.item.unit || "kg"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {d.qty} {d.item.unit || "kg"} ({pkgSize > 0 ? Math.floor(d.qty / pkgSize) : d.qty} {pkgUnit})
                    </td>
                    <td className="px-4 py-3 font-semibold text-amber-600">
                      {Math.max(0, outstanding)} {d.item.unit || "kg"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="1"
                          min={0}
                          max={maxPkg}
                          value={qtys[d.id] ?? 0}
                          onChange={(e) => setPkgQty(d.id, Number(e.target.value), maxPkg)}
                          className="w-24 form-control font-semibold"
                        />
                        <span className="text-xs text-slate-600 font-medium">{pkgUnit}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800">
                      {currentKg} {d.item.unit || "kg"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {error && (
          <div className="alert alert-danger py-2 text-sm" role="alert">{error}</div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="btn btn-success"
          >
            {submitting ? "Memproses..." : "Confirm Receiving"}
          </button>
        </div>
      </form>
    </Card>
  );
}
