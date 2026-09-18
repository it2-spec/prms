"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";

interface CancelPoButtonProps {
  poId: string;
  poNumber: string;
  supplierName: string;
  onCancelPo: (poId: string, reason: string) => Promise<{ error?: string; success?: boolean } | void>;
  isEnglish?: boolean;
}

export default function CancelPoButton({
  poId,
  poNumber,
  supplierName,
  onCancelPo,
  isEnglish = false,
}: CancelPoButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirmCancel(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setError(isEnglish ? "Cancellation reason is required." : "Alasan pembatalan wajib diisi.");
      return;
    }

    setCancelling(true);
    setError(null);
    try {
      const res = await onCancelPo(poId, reason.trim());
      if (res && "error" in res && res.error) {
        setError(res.error);
        setCancelling(false);
        return;
      }
      setIsOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || (isEnglish ? "Failed to cancel Purchase Order." : "Terjadi kesalahan saat membatalkan PO."));
      setCancelling(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="danger"
        onClick={() => {
          setError(null);
          setReason("");
          setIsOpen(true);
        }}
        className="gap-1.5 font-bold"
      >
        <XCircle className="w-4 h-4" />
        {isEnglish ? "Cancel PO" : "Batalkan PO"}
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-slate-100">
            {/* Modal Header */}
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {isEnglish ? "Cancel Purchase Order?" : "Batalkan Purchase Order?"}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  PO <strong className="text-slate-800 font-mono">{poNumber}</strong> · Supplier:{" "}
                  <strong className="text-slate-800">{supplierName}</strong>
                </p>
              </div>
            </div>

            {/* Info notice */}
            <div className="rounded-xl bg-amber-50 border border-amber-200/80 p-3.5 text-xs text-amber-900 leading-relaxed space-y-1">
              <p className="font-semibold text-amber-800">
                {isEnglish ? "Cancellation Consequences:" : "Konsekuensi Pembatalan Dokumen:"}
              </p>
              <p className="text-amber-800/90 text-[11px]">
                {isEnglish ? (
                  <>
                    The PO status will be permanently changed to <strong className="text-amber-900">CANCELLED</strong>.
                    All digital signatures will be revoked, and this document will no longer be eligible for receiving goods.
                  </>
                ) : (
                  <>
                    Status PO akan diubah menjadi <strong className="text-amber-900">CANCELLED (Dibatalkan)</strong>.
                    Seluruh persetujuan digital akan dibekukan, dan dokumen tidak dapat diproses lebih lanjut untuk penerimaan barang.
                  </>
                )}
              </p>
            </div>

            {error && (
              <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200 font-medium">
                {error}
              </div>
            )}

            {/* Form input alasan */}
            <form onSubmit={handleConfirmCancel} className="space-y-4">
              <div className="space-y-1.5 text-xs">
                <label className="font-bold text-slate-800 flex items-center justify-between">
                  <span>
                    {isEnglish ? "Cancellation Reason" : "Alasan Pembatalan"}{" "}
                    <span className="text-rose-500">*</span>
                  </span>
                  <span className="text-[11px] font-normal text-slate-400">
                    {isEnglish ? "Required for compliance & audit trail" : "Wajib diisi untuk audit log"}
                  </span>
                </label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={
                    isEnglish
                      ? "Specify the detailed reason for PO cancellation (e.g. Cancelled by user department, incorrect part specifications, rejected supplier quotation)..."
                      : "Tuliskan alasan pembatalan PO secara spesifik (contoh: Permintaan dibatalkan oleh user produksi, spesifikasi part tidak sesuai, revisi supplier ditolak)..."
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 placeholder:text-slate-400"
                  required
                  autoFocus
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={cancelling}
                  onClick={() => setIsOpen(false)}
                >
                  {isEnglish ? "Cancel" : "Batal"}
                </Button>
                <button
                  type="submit"
                  disabled={cancelling || !reason.trim()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
                >
                  {cancelling && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {cancelling
                    ? isEnglish
                      ? "Cancelling PO..."
                      : "Membatalkan PO..."
                    : isEnglish
                    ? "Yes, Cancel PO"
                    : "Ya, Batalkan PO"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
