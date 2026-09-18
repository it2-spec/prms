"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { QrCode, ScanLine } from "lucide-react";

const SCANNER_ID = "qr-scanner";

export default function QrScanner({
  onResult,
}: {
  onResult: (deliveryNumber: string) => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState("");
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  async function startScanner() {
    setError(null);
    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(SCANNER_ID);
      }
      await scannerRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          stopScanner();
          handleDecoded(decodedText);
        },
        () => {},
      );
      setScanning(true);
    } catch {
      setError("Tidak dapat mengakses kamera. Gunakan input manual di bawah.");
    }
  }

  async function stopScanner() {
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop().catch(() => {});
      setScanning(false);
    }
  }

  function handleDecoded(text: string) {
    // QR berisi JSON { "delivery_id": "DLV000245" } atau plain delivery id
    try {
      const parsed = JSON.parse(text);
      if (parsed.delivery_id) {
        onResult(String(parsed.delivery_id));
        return;
      }
    } catch {}
    // fallback: plain text
    onResult(text.trim());
  }

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    if (manual.trim()) onResult(manual.trim());
  }

  return (
    <div className="space-y-4">
      <div>
        <div id={SCANNER_ID} className={`overflow-hidden rounded-xl bg-slate-900 ${scanning ? "" : "hidden"}`} />
        {!scanning && (
          <button
            type="button"
            onClick={startScanner}
            className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 py-16 text-slate-500 hover:border-blue-400 hover:text-blue-600"
          >
            <ScanLine className="h-10 w-10" />
            <span className="text-sm font-medium">Mulai Scan Kamera</span>
            <span className="text-xs">Mobile friendly — arahkan kamera ke QR Code</span>
          </button>
        )}
        {scanning && (
          <button
            type="button"
            onClick={stopScanner}
            className="btn btn-danger mt-3 w-full"
          >
            Stop Kamera
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        atau input manual
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <form onSubmit={submitManual} className="flex gap-2">
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Contoh: DLV000245"
          className="form-control"
        />
        <button
          type="submit"
          className="btn btn-dark inline-flex items-center gap-1"
        >
          <QrCode className="h-4 w-4" /> Cari
        </button>
      </form>

      {error && (
        <div className="alert alert-warning py-2 text-sm" role="alert">{error}</div>
      )}
    </div>
  );
}
