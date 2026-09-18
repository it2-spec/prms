"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";

interface DeletePoButtonProps {
  poId: string;
  poNumber: string;
  supplierName: string;
  poStatus?: string;
}

export default function DeletePoButton({ poId, poNumber, supplierName, poStatus }: DeletePoButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/purchase-orders/${poId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal menghapus Purchase Order");
        setDeleting(false);
        return;
      }

      setIsOpen(false);
      router.push("/purchasing/purchase-orders");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Terjadi kesalahan saat menghubungi server");
      setDeleting(false);
    }
  }

  const isCancelled = poStatus === "CANCELLED";

  return (
    <>
      <Button
        type="button"
        variant="danger"
        onClick={() => {
          setError(null);
          setIsOpen(true);
        }}
        className="gap-1.5"
      >
        <Trash2 className="w-4 h-4" />
        {isCancelled ? "Hapus PO yang Dibatalkan" : "Hapus PO"}
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">Hapus Purchase Order?</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Anda akan menghapus PO <strong className="text-slate-900">{poNumber}</strong> untuk supplier{" "}
                  <strong className="text-slate-900">{supplierName}</strong>.
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-amber-50 p-3.5 text-xs text-amber-900 border border-amber-200/80 leading-relaxed">
              <p className="font-semibold mb-1 flex items-center gap-1.5 text-amber-800">
                <span>{isCancelled ? "Informasi PO Dibatalkan" : "Informasi Status Draft"}</span>
              </p>
              {isCancelled
                ? "PO ini telah dibatalkan (Cancelled). Tindakan ini akan menghapus data PO dan seluruh item rinciannya secara permanen dari sistem."
                : "PO ini belum dikirim ke supplier (status Draft). Tindakan ini akan menghapus data PO dan seluruh item rinciannya secara permanen."}
            </div>

            {error && (
              <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200 font-medium">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="secondary"
                disabled={deleting}
                onClick={() => setIsOpen(false)}
              >
                Batal
              </Button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 transition-colors disabled:opacity-50 shadow-xs"
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                {deleting ? "Menghapus..." : "Ya, Hapus PO"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
