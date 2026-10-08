"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Printer, ArrowLeft } from "lucide-react";

export function PrintButton({ autoPrint = false }: { autoPrint?: boolean }) {
  useEffect(() => {
    if (autoPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [autoPrint]);

  return (
    <div className="flex items-center gap-2 print:hidden">
      <Link
        href="/supplier/deliveries"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-xs transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Kembali ke Daftar</span>
      </Link>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-black rounded-lg shadow-xs transition-all cursor-pointer"
      >
        <Printer className="w-4 h-4" />
        <span>Cetak Surat Jalan</span>
      </button>
    </div>
  );
}
