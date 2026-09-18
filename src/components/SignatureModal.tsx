"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui";
import { X, Upload, Edit3, Trash2, Check, Loader2, Image as ImageIcon } from "lucide-react";

type SignatureModalProps = {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  userId: string;
  currentSignature?: string | null;
  onSaved: (newSignature: string | null) => void;
};

export default function SignatureModal({
  isOpen,
  onClose,
  userName,
  userId,
  currentSignature,
  onSaved,
}: SignatureModalProps) {
  const [tab, setTab] = useState<"upload" | "draw">("upload");
  const [preview, setPreview] = useState<string | null>(currentSignature || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Canvas refs for drawing
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    setPreview(currentSignature || null);
    setError(null);
    setHasDrawn(false);
  }, [currentSignature, isOpen]);

  useEffect(() => {
    if (tab === "draw" && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }
    }
  }, [tab]);

  if (!isOpen) return null;

  // Drawing Handlers
  function startDrawing(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawn(true);
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function draw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function stopDrawing() {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL("image/png");
      setPreview(dataUrl);
    }
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    setPreview(null);
  }

  // File Upload Handler
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Format file harus berupa gambar (PNG, JPG, JPEG)");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Ukuran file maksimal 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
      setError(null);
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/user/signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: userId,
          signatureImage: preview || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan tanda tangan");
      }
      onSaved(preview);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveSignature() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/user/signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: userId,
          signatureImage: null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus tanda tangan");
      setPreview(null);
      onSaved(null);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
          <div>
            <h3 className="text-base font-bold text-slate-800">Tanda Tangan Digital</h3>
            <p className="text-xs text-slate-500 mt-0.5">User: <span className="font-semibold text-slate-700">{userName}</span></p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Tab Switcher */}
          <div className="flex rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setTab("upload")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition ${
                tab === "upload"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Upload className="w-4 h-4" />
              Upload File Scan
            </button>
            <button
              type="button"
              onClick={() => setTab("draw")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition ${
                tab === "draw"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Edit3 className="w-4 h-4" />
              Tulis Langsung (Canvas)
            </button>
          </div>

          {/* Tab 1: Upload */}
          {tab === "upload" && (
            <div className="space-y-3">
              <label className="flex flex-col items-center justify-center w-full h-44 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer bg-slate-50/50 hover:bg-slate-50 hover:border-slate-400 transition">
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                  <ImageIcon className="w-8 h-8 text-slate-400 mb-2" />
                  <p className="text-xs text-slate-700 font-medium">Klik untuk memilih file scan tanda tangan</p>
                  <p className="text-[11px] text-slate-400 mt-1">Format PNG transparan atau JPG (maksimal 2MB)</p>
                </div>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* Tab 2: Draw */}
          {tab === "draw" && (
            <div className="space-y-2">
              <div className="relative border-2 border-slate-300 rounded-xl overflow-hidden bg-white shadow-inner">
                <canvas
                  ref={canvasRef}
                  width={460}
                  height={176}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-44 cursor-crosshair touch-none"
                />
                {!hasDrawn && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-300 text-xs italic">
                    Goreskan tanda tangan Anda di sini menggunakan mouse atau touch
                  </div>
                )}
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-600 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Hapus Coretan
                </button>
              </div>
            </div>
          )}

          {/* Preview Section */}
          {preview && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-600">Preview Tanda Tangan:</span>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="text-xs text-red-500 hover:underline"
                >
                  Reset Preview
                </button>
              </div>
              <div className="h-20 flex items-center justify-center bg-white border border-slate-200 rounded-lg p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt="Preview Tanda Tangan"
                  className="max-h-full max-w-full object-contain filter contrast-125"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4">
          {currentSignature ? (
            <Button
              type="button"
              variant="danger"
              onClick={handleRemoveSignature}
              disabled={saving}
              className="text-xs"
            >
              Hapus TTD
            </Button>
          ) : <div />}

          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Batal
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleSave}
              disabled={saving || !preview}
              className="gap-1.5"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Simpan Tanda Tangan
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
