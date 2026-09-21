"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode, CameraDevice } from "html5-qrcode";
import { QrCode, ScanLine, Camera, Loader2, StopCircle, RefreshCw, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";

const SCANNER_ID = "warehouse-qr-scanner-box";

export default function QrScanner({
  onResult,
}: {
  onResult: (deliveryNumber: string) => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [manual, setManual] = useState("");
  const [detectedValue, setDetectedValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(() => {});
        }
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    };
  }, []);

  const handleDecoded = useCallback((text: string) => {
    let cleanCode = text.trim();
    try {
      const parsed = JSON.parse(text);
      if (parsed.delivery_id) {
        cleanCode = String(parsed.delivery_id).trim();
      } else if (parsed.deliveryNumber) {
        cleanCode = String(parsed.deliveryNumber).trim();
      }
    } catch {}

    // 1. Langsung isi kotak input manual
    setManual(cleanCode);
    setDetectedValue(cleanCode);
    setError(null);
  }, []);

  async function stopScanner() {
    try {
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    } catch {
      // ignore
    } finally {
      if (mountedRef.current) {
        setScanning(false);
        setStarting(false);
      }
    }
  }

  async function startScanner(preferredCameraId?: string) {
    setError(null);
    setStarting(true);

    try {
      // 1. Ensure any previous instance is stopped and cleared
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
          scannerRef.current.clear();
        } catch {}
        scannerRef.current = null;
      }

      // 2. Query available camera devices
      let availableCameras: CameraDevice[] = [];
      try {
        availableCameras = await Html5Qrcode.getCameras();
        if (mountedRef.current) {
          setCameras(availableCameras);
        }
      } catch (err: any) {
        console.warn("Could not enumerate cameras:", err);
      }

      // 3. Small delay to ensure DOM container is completely painted
      await new Promise((resolve) => setTimeout(resolve, 80));

      const container = document.getElementById(SCANNER_ID);
      if (!container) {
        throw new Error("Wadah kamera tidak ditemukan di layar.");
      }

      const scanner = new Html5Qrcode(SCANNER_ID);
      scannerRef.current = scanner;

      // 4. Select best camera: preferred -> rear/back -> first available
      let targetCamera: any = { facingMode: "environment" };
      if (availableCameras.length > 0) {
        let chosen = availableCameras[0];
        if (preferredCameraId) {
          const matched = availableCameras.find((c) => c.id === preferredCameraId);
          if (matched) chosen = matched;
        } else {
          // Prioritize back/rear camera on mobile
          const rearCam = availableCameras.find((c) =>
            /back|rear|belakang|environment|macro/i.test(c.label)
          );
          if (rearCam) chosen = rearCam;
        }

        targetCamera = chosen.id;
        if (mountedRef.current) {
          setSelectedCameraId(chosen.id);
        }
      }

      const qrConfig = {
        fps: 15,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const edge = Math.max(180, Math.floor(minEdge * 0.72));
          return { width: edge, height: edge };
        },
        aspectRatio: 1.0,
      };

      await scanner.start(
        targetCamera,
        qrConfig,
        (decodedText) => {
          stopScanner();
          handleDecoded(decodedText);
        },
        () => {}
      );

      if (mountedRef.current) {
        setScanning(true);
        setStarting(false);
      }
    } catch (err: any) {
      console.error("Camera start error:", err);
      if (mountedRef.current) {
        setStarting(false);
        setScanning(false);
        setError(
          err?.message?.includes("Permission") || err?.name === "NotAllowedError"
            ? "Izin kamera ditolak oleh browser. Mohon izinkan akses kamera di pengaturan browser Anda."
            : "Gagal menghubungkan ke kamera. Pastikan kamera tidak sedang digunakan aplikasi lain atau gunakan input manual di bawah."
        );
      }
    }
  }

  function handleCameraChange(newCamId: string) {
    setSelectedCameraId(newCamId);
    startScanner(newCamId);
  }

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    if (manual.trim()) onResult(manual.trim());
  }

  return (
    <div className="space-y-4">
      {/* Scanner Box Container */}
      <div className="relative w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-md">
        {/* The actual element used by Html5Qrcode */}
        <div
          id={SCANNER_ID}
          className="w-full min-h-[300px] sm:min-h-[340px] flex items-center justify-center relative overflow-hidden"
        />

        {/* Overlay saat kamera BELUM aktif */}
        {!scanning && !starting && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 bg-slate-900/95 text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-4">
              <ScanLine className="w-8 h-8 stroke-[1.8]" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">
              Pemindai QR Surat Jalan
            </h3>
            <p className="text-xs text-slate-400 max-w-xs mb-5 leading-relaxed">
              Arahkan kamera ke QR Code Surat Jalan pengiriman dari supplier untuk memeriksa dan menerima barang.
            </p>
            <button
              type="button"
              onClick={() => startScanner()}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-6 py-2.5 rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Aktifkan Kamera</span>
            </button>
          </div>
        )}

        {/* Loading Spinner saat inisialisasi kamera */}
        {starting && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/90 text-white p-4">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
            <p className="text-sm font-semibold">Menghubungkan ke kamera...</p>
            <p className="text-xs text-slate-400 mt-1">Mohon berikan izin jika diminta browser</p>
          </div>
        )}

        {/* Controls Bar saat kamera AKTIF */}
        {scanning && (
          <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between gap-2 bg-slate-950/70 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10 text-white">
            <div className="flex items-center gap-2 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="hidden sm:inline">Kamera Aktif</span>
            </div>

            <div className="flex items-center gap-2">
              {cameras.length > 1 && (
                <select
                  value={selectedCameraId}
                  onChange={(e) => handleCameraChange(e.target.value)}
                  className="bg-slate-800 text-white text-xs px-2 py-1 rounded-lg border border-slate-700 focus:outline-none cursor-pointer max-w-[140px] truncate"
                >
                  {cameras.map((c, i) => (
                    <option key={c.id} value={c.id}>
                      {c.label || `Kamera ${i + 1}`}
                    </option>
                  ))}
                </select>
              )}

              <button
                type="button"
                onClick={stopScanner}
                className="bg-red-600/90 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <StopCircle className="w-3.5 h-3.5" />
                <span>Stop</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Scan Success Confirmation Card */}
      {detectedValue && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-emerald-700 font-semibold">QR Surat Jalan Terdeteksi:</div>
              <div className="text-base font-black text-emerald-900 font-mono tracking-wide">
                {detectedValue}
              </div>
              <div className="text-[11px] text-emerald-600">Nilai telah diisi otomatis ke kotak input di bawah.</div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onResult(manual.trim() || detectedValue)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <span>Lanjutkan Terima Barang</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setDetectedValue(null);
                startScanner();
              }}
              className="text-emerald-700 hover:bg-emerald-100 text-xs font-semibold px-3 py-2 rounded-xl transition-colors cursor-pointer"
            >
              Scan Ulang
            </button>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5 text-xs">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">{error}</div>
        </div>
      )}

      {/* Divider */}
      <div className="flex items-center gap-3 text-xs text-slate-400 my-2">
        <span className="h-px flex-1 bg-slate-200" />
        <span>atau periksa / ubah nomor surat jalan di bawah</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      {/* Input Manual Form */}
      <form onSubmit={submitManual} className="flex gap-2">
        <div className="relative flex-1">
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Contoh: DLV000245 atau SJ-2026-001"
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 placeholder:text-slate-400 font-medium"
          />
        </div>
        <button
          type="submit"
          disabled={!manual.trim()}
          className="bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors inline-flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-xs"
        >
          <QrCode className="w-4 h-4" />
          <span>Cari</span>
        </button>
      </form>

      {/* Global CSS Override for Html5Qrcode video elements */}
      <style jsx global>{`
        #${SCANNER_ID} video {
          width: 100% !important;
          height: 100% !important;
          max-height: 380px !important;
          object-fit: cover !important;
          border-radius: 1rem !important;
        }
        #${SCANNER_ID} {
          border: none !important;
        }
        #${SCANNER_ID} img[alt="Info icon"] {
          display: none !important;
        }
      `}</style>
    </div>
  );
}
