"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, AlertTriangle, Loader2, X } from "lucide-react";
import { cancelOutgoing } from "../../outgoingAction";

export default function CancelOutgoingButton({
  outgoingId,
  outgoingNumber,
  totalQty,
}: {
  outgoingId: string;
  outgoingNumber: string;
  totalQty: number;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    setLoading(true);
    setError(null);
    try {
      const res = await cancelOutgoing(outgoingId, reason);
      if (res.error) {
        setError(res.error);
      } else {
        setIsOpen(false);
        router.refresh();
      }
    } catch {
      setError("Gagal membatalkan transaksi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
          setError(null);
          setReason("");
        }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-300 bg-red-50 hover:bg-red-100 text-red-700 font-semibold text-xs transition cursor-pointer shadow-2xs"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span>Batalkan Transaksi Ini</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5 text-red-600">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="font-bold text-slate-900 text-base">Batalkan Transaksi Outgoing</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1.5">
              <div className="font-semibold flex items-center gap-1">
                <span>Konfirmasi Sistem:</span>
              </div>
              <p>
                Transaksi <strong>{outgoingNumber}</strong> ({totalQty} kemasan) akan ditandai <strong>DIBATALKAN</strong>.
              </p>
              <p className="text-emerald-800 font-bold bg-emerald-50/80 p-2 rounded-lg border border-emerald-200 mt-1">
                ✓ Seluruh stok barang pada transaksi ini akan otomatis dikembalikan ke saldo gudang seketika.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-medium">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Alasan Pembatalan
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Contoh: Salah scan part, salah jumlah, atau pembatalan pemakaian"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={loading}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Membatalkan...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Ya, Batalkan Transaksi</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
