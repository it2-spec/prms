"use client";

import React, { useRef, useState, useEffect } from "react";
import { PenTool, CheckCircle2, RotateCcw, X, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";

interface SupplierSignPoModalProps {
  poId: string;
  poNumber: string;
  defaultSignerName: string;
  onSuccess?: () => void;
}

export default function SupplierSignPoModal({
  poId,
  poNumber,
  defaultSignerName,
  onSuccess,
}: SupplierSignPoModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [signerName, setSignerName] = useState(defaultSignerName);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  // Initialize canvas
  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set high-DPI scaling
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.strokeStyle = "#0f172a"; // slate-900 ink
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setHasDrawn(false);
  }, [isOpen]);

  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    isDrawingRef.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCanvasPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCanvasPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSaveSignature = async () => {
    if (!signerName.trim()) {
      setError("Nama penanda tangan wajib diisi.");
      return;
    }
    if (!hasDrawn) {
      setError("Harap membubuhkan tanda tangan pada kolom yang disediakan.");
      return;
    }
    if (!agreed) {
      setError("Harap centang persetujuan penerimaan PO.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Canvas tidak ditemukan");
      const signatureBase64 = canvas.toDataURL("image/png");

      const res = await fetch(`/api/supplier/purchase-orders/${poId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signerName: signerName.trim(),
          signatureImage: signatureBase64,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan tanda tangan");
      }

      setIsOpen(false);
      if (onSuccess) onSuccess();
      else window.location.reload();
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat menyimpan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="primary"
        onClick={() => setIsOpen(true)}
        className="gap-2 font-bold shadow-md shadow-blue-500/20 cursor-pointer bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
      >
        <PenTool className="w-4 h-4" />
        <span>Terima &amp; Tanda Tangani PO</span>
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                  <PenTool className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                    Penerimaan &amp; TTD Purchase Order
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">{poNumber}</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium">
                  {error}
                </div>
              )}

              {/* Signer Name Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Penanda Tangan (Pihak Supplier) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="Contoh: Budi Santoso (Direktur / Sales Manager)"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
              </div>

              {/* Signature Canvas Area */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <span>Bubuhkan Tanda Tangan Digital</span>
                    <span className="text-red-500">*</span>
                  </label>
                  {hasDrawn && (
                    <button
                      type="button"
                      onClick={clearCanvas}
                      className="text-xs text-slate-500 hover:text-red-600 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Hapus / Ulang</span>
                    </button>
                  )}
                </div>

                <div className="relative border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50/50 hover:bg-white transition-colors overflow-hidden touch-none">
                  <canvas
                    ref={canvasRef}
                    className="w-full h-44 cursor-crosshair block"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                  {!hasDrawn && (
                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-400 gap-1">
                      <PenTool className="w-5 h-5 opacity-40" />
                      <span className="text-xs">Goreskan tanda tangan di area ini (mouse atau touch)</span>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Tanda tangan ini akan otomatis tertera pada cetakan dokumen PDF resmi Purchase Order.
                </p>
              </div>

              {/* Agreement Checkbox */}
              <div className="pt-2">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 mt-0.5 cursor-pointer"
                  />
                  <span>
                    Saya menyatakan bahwa pihak Supplier telah <strong>menerima dan menyetujui</strong> Purchase Order ini, dan berkomitmen memenuhi pesanan barang sesuai spesifikasi serta jadwal yang disepakati.
                  </span>
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end gap-2.5">
              <Button
                variant="secondary"
                onClick={() => setIsOpen(false)}
                disabled={loading}
                className="text-xs"
              >
                Batal
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveSignature}
                disabled={loading}
                className="text-xs font-bold gap-1.5 shadow-md shadow-blue-500/20"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Konfirmasi &amp; Tanda Tangani</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
