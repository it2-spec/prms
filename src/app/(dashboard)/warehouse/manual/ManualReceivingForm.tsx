"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import SearchableSelect from "@/components/SearchableSelect";

type POOption = {
  id: string;
  poNumber: string;
  supplierName: string;
  details: {
    itemId: string;
    itemCode: string;
    itemName: string;
    unit: string | null;
    packageUnit: string | null;
    packageSize: number;
    qty: number;
    receivedQty: number;
    outstanding: number;
    pkgOutstanding: number;
  }[];
};

export default function ManualReceivingForm({
  pos,
  createManualReceiving,
}: {
  pos: POOption[];
  createManualReceiving: (formData: FormData) => Promise<{ error?: string; redirect?: string }>;
}) {
  const [poId, setPoId] = useState(pos[0]?.id ?? "");
  const [suratJalan, setSuratJalan] = useState("");
  const [shipDate, setShipDate] = useState("");
  const [rows, setRows] = useState<{ itemId: string; qty: number }[]>(
    pos[0]?.details?.length ? [{ itemId: pos[0].details[0].itemId, qty: 0 }] : [],
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const selectedPO = pos.find((p) => p.id === poId);

  function selectPO(id: string) {
    setPoId(id);
    const p = pos.find((x) => x.id === id);
    setRows(p?.details?.length ? [{ itemId: p.details[0].itemId, qty: 0 }] : []);
  }

  function addRow() {
    const p = pos.find((x) => x.id === poId);
    if (p?.details?.length) setRows((r) => [...r, { itemId: p.details[0].itemId, qty: 0 }]);
  }

  function updateRow(i: number, key: "itemId" | "qty", value: string | number) {
    let finalVal = value;
    if (key === "qty") {
      finalVal = Math.floor(Math.max(0, Number(value)));
    }
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [key]: finalVal } : row)));
  }

  function removeRow(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }

  function detailOf(itemId: string) {
    return selectedPO?.details.find((d) => d.itemId === itemId);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = rows
      .filter((r) => (r.qty || 0) > 0)
      .map((r) => ({ itemId: r.itemId, qtyOrdered: detailOf(r.itemId)?.qty ?? 0, qtyReceived: Number(r.qty) }));

    if (!payload.length) {
      setError("Isi minimal satu item dengan qty lebih dari 0.");
      setSubmitting(false);
      return;
    }

    const fd = new FormData();
    fd.set("poId", poId);
    fd.set("suratJalan", suratJalan);
    fd.set("shipDate", shipDate);
    fd.set("details", JSON.stringify(payload));

    const res = await createManualReceiving(fd);
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
            options={pos.map((p) => ({ value: p.id, label: `${p.poNumber} — ${p.supplierName}` }))}
            value={poId}
            onChange={selectPO}
            placeholder="Pilih Purchase Order..."
            searchPlaceholder="Cari nomor PO atau supplier..."
          />
        </div>
        <label className="form-group">
          <span className="form-label">No. Surat Jalan</span>
          <input
            value={suratJalan}
            onChange={(e) => setSuratJalan(e.target.value)}
            required
            placeholder="SJ-2026-xxx"
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
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Item Diterima</h3>
          <button
            type="button"
            onClick={addRow}
            className="btn btn-light btn-sm"
          >
            <Plus className="h-3.5 w-3.5" /> Tambah Item
          </button>
        </div>
        <div className="space-y-2">
          {rows.map((row, i) => {
            const detail = detailOf(row.itemId);
            return (
              <div key={i} className="grid grid-cols-12 items-center gap-2 rounded-lg border border-slate-200 p-3">
                <div className="col-span-5">
                  <SearchableSelect
                    options={(selectedPO?.details ?? []).map((d) => ({
                      value: d.itemId,
                      label: `${d.itemCode} — ${d.itemName} (sisa: ${d.pkgOutstanding} ${d.packageUnit || "kemasan"})`,
                    }))}
                    value={row.itemId}
                    onChange={(val) => updateRow(i, "itemId", val)}
                    placeholder="Pilih item..."
                    searchPlaceholder="Cari kode/nama item..."
                  />
                </div>
                <div className="col-span-3 flex items-center gap-1">
                  <input
                    type="number"
                    step="1"
                    min={0}
                    max={detail?.pkgOutstanding ?? 0}
                    className="form-control font-semibold"
                    placeholder={`Max ${detail?.pkgOutstanding ?? 0}`}
                    value={row.qty}
                    onChange={(e) => updateRow(i, "qty", Number(e.target.value))}
                    required
                  />
                  <span className="text-xs text-slate-500 font-medium">{detail?.packageUnit || "Pail"}</span>
                </div>
                <div className="col-span-3 text-xs text-slate-600 font-mono">
                  {detail ? `= ${row.qty * detail.packageSize} ${detail.unit || "kg"}` : ""}
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="col-span-1 flex justify-end text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="alert alert-danger py-2 text-sm" role="alert">{error}</div>
      )}

      <div className="flex justify-end border-t border-slate-200 pt-4">
        <button
          type="submit"
          disabled={submitting || !selectedPO}
          className="btn btn-success"
        >
          {submitting ? "Menyimpan..." : "Konfirmasi Receiving Manual"}
        </button>
      </div>
    </form>
  );
}
