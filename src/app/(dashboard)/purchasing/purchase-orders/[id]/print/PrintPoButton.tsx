"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";

export function PrintPoButton({ poId }: { poId: string }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("auto") === "true") {
      const timer = setTimeout(() => {
        window.print();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  return (
    <div className="no-print print:hidden fixed top-0 inset-x-0 z-50 bg-slate-900/90 text-white backdrop-blur-md px-6 py-3 shadow-lg flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Link
          href={`/purchasing/purchase-orders/${poId}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali ke Detail PO
        </Link>
        <span className="text-xs text-slate-400 hidden sm:inline">
          Tips: Gunakan opsi <strong className="text-white">&ldquo;Save as PDF&rdquo;</strong> pada dialog cetak browser untuk menyimpan file PDF.
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          Cetak / Simpan PDF
        </button>
      </div>
    </div>
  );
}
