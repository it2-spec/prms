"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import SearchableSelect from "@/components/SearchableSelect";

type POOption = {
  id: string;
  poNumber: string;
  details: {
    id: string;
    itemId: string;
    itemCode: string;
    itemName: string;
    unit: string | null;
    packageUnit: string | null;
    packageSize: number;
    qty: number;
    deliveredQty: number;
    outstanding: number; // in kg
    pkgOutstanding: number; // in Pail/Can (whole number)
  }[];
};

type InitialPO = POOption | null;

function getTodayString(): string {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function DeliveryForm({
  selectablePOs,
  initialPO,
  createDelivery,
}: {
  selectablePOs: POOption[];
  initialPO: InitialPO;
  createDelivery: (formData: FormData) => Promise<{ error?: string; redirect?: string }>;
}) {
  const [selectedPOId, setSelectedPOId] = useState(initialPO?.id ?? selectablePOs[0]?.id ?? "");
  const [suratJalan, setSuratJalan] = useState("");
  const [shipDate, setShipDate] = useState(getTodayString);
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const selectedPO = selectablePOs.find((p) => p.id === selectedPOId) ?? null;
  const details = selectedPO?.details ?? [];

  function setPkgQty(detailId: string, value: number, maxPkg: number) {
    // Only integer packaging quantities allowed (no 0.5 pail, etc)
    const valInt = Math.floor(Math.max(0, value));
    setQtys((q) => ({ ...q, [detailId]: Math.min(valInt, maxPkg) }));
  }

  const totalPkgQty = details.reduce((s, d) => s + (qtys[d.id] || 0), 0);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = details
      .filter((d) => (qtys[d.id] || 0) > 0)
      .map((d) => ({
        purchaseOrderDetailId: d.id,
        itemId: d.itemId,
        qty: qtys[d.id] || 0,
      }));

    if (!payload.length) {
      setError("Isi minimal satu item dengan qty lebih dari 0.");
      setSubmitting(false);
      return;
    }

    const fd = new FormData();
    fd.set("poId", selectedPOId);
    fd.set("suratJalan", suratJalan);
    fd.set("shipDate", shipDate);
    fd.set("details", JSON.stringify(payload));

    const res = await createDelivery(fd);
    if (res?.error) {
      setError(res.error);
      setSubmitting(false);
    } else if (res?.redirect) {
      router.push(res.redirect);
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="form-group">
          <span className="form-label">Purchase Order</span>
          <SearchableSelect
            options={selectablePOs.map((p) => ({ value: p.id, label: p.poNumber }))}
            value={selectedPOId}
            onChange={(val) => {
              setSelectedPOId(val);
              setQtys({});
            }}
            placeholder="Pilih Purchase Order..."
            searchPlaceholder="Cari nomor PO..."
          />
        </div>
        <label className="form-group">
          <span className="form-label">No. Surat Jalan</span>
          <input
            value={suratJalan}
            onChange={(e) => setSuratJalan(e.target.value)}
            required
            placeholder="SJ-2026-001"
            className="form-control"
          />
        </label>
        <label className="form-group">
          <span className="form-label">Tanggal Kirim</span>
          <input
            type="date"
            value={shipDate}
            onChange={(e) => setShipDate(e.target.value)}
            required
            className="form-control"
          />
        </label>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-800">
          Item Pengiriman {selectedPO ? `- ${selectedPO.poNumber}` : ""}
        </h3>
        {!selectedPO && (
          <div className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
            Tidak ada PO yang menunggu pengiriman.
          </div>
        )}
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Item & Konversi</th>
                <th className="px-4 py-3 font-medium">Outstanding PO</th>
                <th className="px-4 py-3 font-medium text-amber-600">Sisa Kemasan</th>
                <th className="px-4 py-3 font-medium">Jumlah Kemasan Kirim</th>
                <th className="px-4 py-3 font-medium text-right">Total Berat (Kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {details.map((d) => {
                const pkgUnit = d.packageUnit || "Pail";
                const currentPkg = qtys[d.id] ?? 0;
                const totalKgKirim = currentPkg * d.packageSize;
                return (
                  <tr key={d.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{d.itemName}</div>
                      <div className="text-xs text-slate-400">
                        {d.itemCode} · 1 {pkgUnit} = {d.packageSize} {d.unit || "kg"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {d.outstanding} {d.unit || "kg"}
                    </td>
                    <td className="px-4 py-3 font-semibold text-amber-600">
                      {d.pkgOutstanding} {pkgUnit}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="1"
                          min={0}
                          max={d.pkgOutstanding}
                          value={qtys[d.id] ?? 0}
                          onChange={(e) => setPkgQty(d.id, Number(e.target.value), d.pkgOutstanding)}
                          className="w-24 form-control font-semibold"
                        />
                        <span className="text-xs text-slate-600 font-medium">{pkgUnit}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800">
                      {totalKgKirim} {d.unit || "kg"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
          <AlertCircle className="h-3.5 w-3.5" />
          Total kemasan dikirim: {totalPkgQty} kemasan (Pengiriman harus dalam hitungan bulat kemasan utuh).
        </div>
      </div>

      {error && (
        <div className="alert alert-danger py-2 text-sm" role="alert">{error}</div>
      )}

      <div className="flex justify-end border-t border-slate-200 pt-4">
        <button
          type="submit"
          disabled={submitting || !selectedPO}
          className="btn btn-primary"
        >
          {submitting ? "Menyimpan..." : "Buat Delivery & Generate QR"}
        </button>
      </div>
    </form>
  );
}
