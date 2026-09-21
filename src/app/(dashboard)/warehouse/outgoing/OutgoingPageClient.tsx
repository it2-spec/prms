"use client";

import { useState, useEffect, useRef } from "react";
import { Html5Qrcode, CameraDevice } from "html5-qrcode";
import {
  ScanLine,
  QrCode,
  PackageMinus,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  ArrowRight,
  RotateCcw,
  ShoppingCart,
  Trash2,
  Camera,
  StopCircle,
  Keyboard,
} from "lucide-react";
import { Card } from "@/components/ui";
import { submitOutgoing, cancelOutgoing } from "./outgoingAction";

type OtherWarehouseStock = {
  warehouseId: string;
  warehouseName: string;
  balancePkgQty: number;
};

type BalanceData = {
  item: {
    id: string;
    code: string;
    name: string;
    unit: string | null;
    packageUnit: string | null;
    packageSize: number;
  };
  balancePkgQty: number;
  balanceBaseQty: number;
  incomingPkgQty: number;
  outgoingPkgQty: number;
  otherWarehouses?: OtherWarehouseStock[];
};

type CartItem = {
  itemId: string;
  itemCode: string;
  itemName: string;
  packageUnit: string;
  packageSize: number;
  packageQty: number;
  unit: string;
  availableStock: number;
};

type RecentTx = {
  outgoingId: string;
  outgoingNumber: string;
  itemCode: string;
  itemName: string;
  qty: number;
  unit: string;
  time: string;
  isCancelled?: boolean;
};

const SCANNER_ID = "fast-outgoing-qr-scanner";

export default function OutgoingPageClient({
  warehouses,
  initialWarehouseId,
}: {
  warehouses: Array<{ id: string; name: string; code: string }>;
  initialWarehouseId: string;
}) {
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(initialWarehouseId);
  const [inputCode, setInputCode] = useState("");
  const [detectedCode, setDetectedCode] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [itemData, setItemData] = useState<BalanceData | null>(null);
  const [qty, setQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<{
    text: string;
    details?: string;
  } | null>(null);

  // Keranjang Sementara (Cart) - Stok BELUM dipotong
  const [cart, setCart] = useState<CartItem[]>([]);

  // Riwayat transaksi sesi ini yang sudah disimpan ke DB
  const [recentList, setRecentList] = useState<RecentTx[]>([]);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // QR Scanner State
  const [scanning, setScanning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastScannedRef = useRef<{ code: string; time: number }>({ code: "", time: 0 });

  const activeWarehouse =
    warehouses.find((w) => w.id === selectedWarehouseId) || warehouses[0];
  const warehouseName = activeWarehouse?.name || "Gudang";

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(() => {});
        }
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    };
  }, []);

  async function startScanner(preferredCameraId?: string) {
    setErrorMsg(null);
    setStarting(true);

    try {
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
          scannerRef.current.clear();
        } catch {}
        scannerRef.current = null;
      }

      let availableCameras: CameraDevice[] = [];
      try {
        availableCameras = await Html5Qrcode.getCameras();
        setCameras(availableCameras);
      } catch (err: any) {
        console.warn("Could not enumerate cameras:", err);
      }

      await new Promise((r) => setTimeout(r, 60));

      const el = document.getElementById(SCANNER_ID);
      if (!el) {
        throw new Error("Wadah kamera scanner belum siap.");
      }

      const scanner = new Html5Qrcode(SCANNER_ID);
      scannerRef.current = scanner;

      let targetCam: any = { facingMode: "environment" };
      if (availableCameras.length > 0) {
        let chosen = availableCameras[0];
        if (preferredCameraId) {
          const matched = availableCameras.find((c) => c.id === preferredCameraId);
          if (matched) chosen = matched;
        } else {
          const rear = availableCameras.find((c) =>
            /back|rear|belakang|environment|macro/i.test(c.label)
          );
          if (rear) chosen = rear;
        }
        targetCam = chosen.id;
        setSelectedCameraId(chosen.id);
      }

      await scanner.start(
        targetCam,
        {
          fps: 15,
          qrbox: (w, h) => {
            const edge = Math.max(180, Math.floor(Math.min(w, h) * 0.72));
            return { width: edge, height: edge };
          },
          aspectRatio: 1.0,
        },
        (decoded) => {
          const cleanCode = decoded.trim();
          if (!cleanCode) return;

          // Anti-spam debounce: cegah trigger berulang dalam 2 detik untuk kode yang sama
          const now = Date.now();
          if (
            cleanCode === lastScannedRef.current.code &&
            now - lastScannedRef.current.time < 2000
          ) {
            return;
          }
          lastScannedRef.current = { code: cleanCode, time: now };

          // Isi input & jalankan pencarian tanpa mematikan kamera
          setInputCode(cleanCode);
          setDetectedCode(cleanCode);
          handleLookup(cleanCode, selectedWarehouseId);
          // CATATAN: Kamera tetap menyala terus sampai user klik Stop Kamera
        },
        () => {},
      );

      setScanning(true);
      setStarting(false);
    } catch (err: any) {
      console.error("Outgoing scanner error:", err);
      setScanning(false);
      setStarting(false);
      setErrorMsg(
        err?.message?.includes("Permission") || err?.name === "NotAllowedError"
          ? "Izin kamera ditolak oleh browser. Mohon izinkan akses kamera di pengaturan browser Anda."
          : "Gagal menghubungkan ke kamera. Silakan gunakan form pencarian manual di bawah."
      );
    }
  }

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
      setScanning(false);
      setStarting(false);
    }
  }

  function handleCameraChange(newCamId: string) {
    setSelectedCameraId(newCamId);
    startScanner(newCamId);
  }

  function handleWarehouseChange(newWhId: string) {
    if (cart.length > 0) {
      if (
        !confirm(
          "Mengganti gudang akan mengosongkan keranjang saat ini. Lanjutkan mengganti gudang?"
        )
      ) {
        return;
      }
      setCart([]);
    }
    setSelectedWarehouseId(newWhId);
    if (inputCode.trim()) {
      handleLookup(inputCode.trim(), newWhId);
    }
  }

  // Lookup Part by Code
  async function handleLookup(code: string, overrideWhId?: string) {
    if (!code.trim()) return;
    const targetWhId = overrideWhId || selectedWarehouseId;
    setLookupLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(
        `/api/stock/balance?itemCode=${encodeURIComponent(code.trim())}&warehouseId=${targetWhId}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Kode part tidak ditemukan di sistem");
        setItemData(null);
      } else {
        setItemData(data as BalanceData);
        setQty(1);
      }
    } catch {
      setErrorMsg("Gagal memuat data stok part");
    } finally {
      setLookupLoading(false);
    }
  }

  function handleFormLookup(e: React.FormEvent) {
    e.preventDefault();
    if (inputCode.trim()) {
      setDetectedCode(inputCode.trim());
      handleLookup(inputCode.trim());
    }
  }

  // Tambahkan item ke Keranjang Sementara (Belum Simpan ke Database)
  function handleAddToCart() {
    if (!itemData) return;
    if (itemData.balancePkgQty <= 0) {
      setErrorMsg(`Stok ${itemData.item.name} di ${warehouseName} kosong (0 ${itemData.item.packageUnit || "kemasan"}).`);
      return;
    }
    if (qty <= 0) {
      setErrorMsg("Jumlah pengeluaran minimal 1");
      return;
    }

    const inCart = cart.find((c) => c.itemId === itemData.item.id);
    const currentCartQty = inCart ? inCart.packageQty : 0;
    const totalDesired = currentCartQty + qty;

    if (totalDesired > itemData.balancePkgQty) {
      setErrorMsg(
        `Stok tidak mencukupi! Tersedia hanya ${itemData.balancePkgQty} ${itemData.item.packageUnit || "kemasan"}. ${
          currentCartQty > 0 ? `(Sudah ada ${currentCartQty} di keranjang)` : ""
        }`,
      );
      return;
    }

    if (inCart) {
      setCart((prev) =>
        prev.map((c) =>
          c.itemId === itemData.item.id
            ? { ...c, packageQty: c.packageQty + qty }
            : c,
        ),
      );
    } else {
      setCart((prev) => [
        ...prev,
        {
          itemId: itemData.item.id,
          itemCode: itemData.item.code,
          itemName: itemData.item.name,
          packageUnit: itemData.item.packageUnit || "Kemasan",
          packageSize: itemData.item.packageSize,
          packageQty: qty,
          unit: itemData.item.unit || "satuan",
          availableStock: itemData.balancePkgQty,
        },
      ]);
    }

    // Reset pilihan form
    setItemData(null);
    setInputCode("");
    setDetectedCode(null);
    setErrorMsg(null);
    setSuccessMsg({
      text: `Item ${itemData.item.name} (+${qty} ${itemData.item.packageUnit || "kemasan"}) ditambahkan ke keranjang.`,
    });
  }

  function handleUpdateCartQty(itemId: string, newQty: number) {
    if (newQty <= 0) {
      handleRemoveFromCart(itemId);
      return;
    }
    const target = cart.find((c) => c.itemId === itemId);
    if (!target) return;

    if (newQty > target.availableStock) {
      setErrorMsg(
        `Maksimal kuantitas untuk ${target.itemName} adalah ${target.availableStock} ${target.packageUnit}`,
      );
      return;
    }

    setErrorMsg(null);
    setCart((prev) =>
      prev.map((c) => (c.itemId === itemId ? { ...c, packageQty: newQty } : c)),
    );
  }

  function handleRemoveFromCart(itemId: string) {
    setCart((prev) => prev.filter((c) => c.itemId !== itemId));
  }

  // Simpan Semua Item di Keranjang ke Database
  async function handleSubmitAll() {
    if (!cart.length) {
      setErrorMsg("Keranjang masih kosong");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await submitOutgoing(
        cart.map((c) => ({
          itemId: c.itemId,
          itemCode: c.itemCode,
          itemName: c.itemName,
          packageUnit: c.packageUnit,
          packageSize: c.packageSize,
          packageQty: c.packageQty,
        })),
        undefined,
        undefined,
        selectedWarehouseId,
      );

      if (res.error) {
        setErrorMsg(res.error);
      } else {
        const created = res.createdOutgoings || [];
        const nowStr = new Date().toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });

        const newRecents: RecentTx[] = created.map((c) => ({
          outgoingId: c.outgoingId,
          outgoingNumber: c.outgoingNumber,
          itemCode: c.itemCode,
          itemName: c.itemName,
          qty: c.packageQty,
          unit: c.packageUnit,
          time: nowStr,
          isCancelled: false,
        }));

        setRecentList((prev) => [...newRecents, ...prev]);
        setCart([]);

        const numbersText = created.map((c) => c.outgoingNumber).join(", ");
        setSuccessMsg({
          text: `Berhasil mengeluarkan ${created.length} item material dari ${warehouseName}!`,
          details: `Nomor Transaksi: ${numbersText} (Tercatat sebagai baris tersendiri)`,
        });

        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      }
    } catch {
      setErrorMsg("Terjadi kesalahan jaringan saat menyimpan pengeluaran");
    } finally {
      setSubmitting(false);
    }
  }

  // Batalkan Transaksi Outgoing
  async function handleCancelOutgoing(outgoingId: string, outgoingNumber: string) {
    if (
      !confirm(
        `Yakin ingin membatalkan transaksi ${outgoingNumber}? Stok barang akan dikembalikan ke saldo gudang ${warehouseName}.`
      )
    ) {
      return;
    }

    setCancellingId(outgoingId);
    setErrorMsg(null);

    try {
      const res = await cancelOutgoing(outgoingId);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setRecentList((prev) =>
          prev.map((r) =>
            r.outgoingId === outgoingId ? { ...r, isCancelled: true } : r
          )
        );
        setSuccessMsg({
          text: `Transaksi ${outgoingNumber} berhasil dibatalkan.`,
          details: `Stok barang telah dikembalikan ke saldo gudang ${warehouseName}.`,
        });

        if (itemData) {
          handleLookup(itemData.item.code);
        }
      }
    } catch {
      setErrorMsg("Gagal membatalkan transaksi");
    } finally {
      setCancellingId(null);
    }
  }

  const totalCartPackages = cart.reduce((acc, cur) => acc + cur.packageQty, 0);

  return (
    <div className="space-y-6">
      {/* Alert Berhasil */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-start gap-3 shadow-xs animate-in fade-in duration-200">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-base text-emerald-800">{successMsg.text}</div>
            {successMsg.details && (
              <div className="text-xs text-emerald-700 font-mono font-medium">
                {successMsg.details}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Alert Error */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-300 text-red-800 flex items-center gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <div className="text-sm font-medium">{errorMsg}</div>
        </div>
      )}

      {/* Selector Gudang Pengeluaran */}
      <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-800">
          <span>Lokasi Gudang:</span>
        </div>
        <select
          value={selectedWarehouseId}
          onChange={(e) => handleWarehouseChange(e.target.value)}
          className="bg-slate-50 border border-slate-300 text-slate-800 text-xs sm:text-sm font-bold px-3 py-1.5 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
        >
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} ({w.code})
            </option>
          ))}
        </select>
      </div>

      {/* CARD SCANNER DECK - 100% IDENTIK DENGAN INCOMING */}
      <Card>
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
                  Pemindai QR / Barcode Part
                </h3>
                <p className="text-xs text-slate-400 max-w-xs mb-5 leading-relaxed">
                  Arahkan kamera ke QR Code atau Barcode pada kemasan part untuk memeriksa stok dan mencatat pengeluaran.
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
          {detectedCode && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-emerald-700 font-semibold">QR / Barcode Part Terdeteksi:</div>
                  <div className="text-base font-black text-emerald-900 font-mono tracking-wide">
                    {detectedCode}
                  </div>
                  {itemData ? (
                    <div className="text-xs text-emerald-700 font-medium mt-0.5">
                      {itemData.item.name} &bull; Sisa di {warehouseName}:{" "}
                      <strong>{itemData.balancePkgQty} {itemData.item.packageUnit || "pail"}</strong>
                    </div>
                  ) : (
                    <div className="text-[11px] text-emerald-600">Sedang memuat data stok part...</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setDetectedCode(null);
                    setInputCode("");
                    setItemData(null);
                  }}
                  className="text-emerald-700 hover:bg-emerald-100 text-xs font-semibold px-3 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  Scan Ulang
                </button>
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3 text-xs text-slate-400 my-2">
            <span className="h-px flex-1 bg-slate-200" />
            <span>atau periksa / masukkan kode part di bawah</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          {/* Input Manual Form */}
          <form onSubmit={handleFormLookup} className="flex gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                placeholder="Contoh: SI115 atau scan barcode manual..."
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 placeholder:text-slate-400 font-medium"
              />
            </div>
            <button
              type="submit"
              disabled={!inputCode.trim() || lookupLoading}
              className="bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors inline-flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-xs shrink-0"
            >
              {lookupLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <QrCode className="w-4 h-4" />
              )}
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
      </Card>

      {/* STEP 2: MASUKKAN QTY & TAMBAH KE KERANJANG */}
      {itemData && (
        <Card bodyClassName="!p-5 bg-linear-to-b from-blue-50/60 to-white border-2 border-blue-300 shadow-md animate-in fade-in duration-150">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-200">
              <div>
                <span className="px-2.5 py-1 rounded bg-blue-100 text-blue-800 font-mono text-xs font-bold">
                  {itemData.item.code}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1.5">{itemData.item.name}</h3>
                <div className="text-xs text-slate-500 mt-0.5">
                  1 {itemData.item.packageUnit || "Kemasan"} = {itemData.item.packageSize} {itemData.item.unit || "kg"}
                </div>
              </div>

              {/* STOK BADGE: HIJAU JIKA TERSEDIA, MERAH JIKA KOSONG */}
              {itemData.balancePkgQty > 0 ? (
                <div className="text-right shrink-0 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">
                  <div className="text-[11px] text-emerald-700 font-medium">Stok Tersedia</div>
                  <div className="text-xl font-black text-emerald-800 font-mono">
                    {itemData.balancePkgQty}
                    <span className="text-xs font-normal text-emerald-700 ml-1">
                      {itemData.item.packageUnit || "Pail"}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-right shrink-0 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                  <div className="text-[11px] text-red-700 font-bold uppercase tracking-wider">Stok Kosong</div>
                  <div className="text-xl font-black text-red-800 font-mono">
                    0
                    <span className="text-xs font-normal text-red-700 ml-1">
                      {itemData.item.packageUnit || "Pail"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* JIKA STOK KOSONG DI GUDANG INI, TAMPILKAN REKOMENDASI GUDANG LAIN */}
            {itemData.balancePkgQty <= 0 && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-900">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Stok barang ini di <u>{warehouseName}</u> kosong (0 {itemData.item.packageUnit || "kemasan"}).
                  </span>
                </div>
                {itemData.otherWarehouses && itemData.otherWarehouses.length > 0 ? (
                  <div className="pt-1 space-y-1.5">
                    <p className="text-slate-700 font-medium">
                      Barang ini tersedia di gudang lain. Klik untuk langsung memindahkan lokasi pengeluaran:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {itemData.otherWarehouses.map((ow) => (
                        <button
                          key={ow.warehouseId}
                          type="button"
                          onClick={() => handleWarehouseChange(ow.warehouseId)}
                          className="px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-400 font-bold rounded-lg shadow-2xs transition inline-flex items-center gap-2 cursor-pointer"
                        >
                          <span>Pindah ke <strong>{ow.warehouseName}</strong>:</span>
                          <span className="font-mono text-emerald-700 font-black">
                            {ow.balancePkgQty} {itemData.item.packageUnit || "pail"}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-amber-700" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-600">
                    Tidak ada catatan stok untuk part ini di gudang manapun.
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Jumlah ({itemData.item.packageUnit || "Kemasan"})
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    disabled={itemData.balancePkgQty <= 0}
                    className="w-10 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-bold text-base flex items-center justify-center transition cursor-pointer border border-slate-300"
                  >
                    <Minus className="w-4 h-4" />
                  </button>

                  <input
                    type="number"
                    min="1"
                    max={Math.max(1, itemData.balancePkgQty)}
                    value={itemData.balancePkgQty <= 0 ? 0 : qty}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setQty(isNaN(val) || val < 1 ? 1 : val);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddToCart();
                      }
                    }}
                    disabled={itemData.balancePkgQty <= 0}
                    autoFocus
                    className="w-24 h-10 text-center text-xl font-black font-mono rounded-lg border-2 border-blue-500 disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400 bg-white focus:outline-hidden"
                  />

                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.min(itemData.balancePkgQty, q + 1))}
                    disabled={itemData.balancePkgQty <= 0}
                    className="w-10 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-bold text-base flex items-center justify-center transition cursor-pointer border border-slate-300"
                  >
                    <Plus className="w-4 h-4" />
                  </button>

                  <span className="text-xs font-semibold text-slate-600 ml-1">
                    {itemData.item.packageUnit || "Kemasan"} (={" "}
                    {(itemData.balancePkgQty <= 0 ? 0 : qty) * itemData.item.packageSize}{" "}
                    {itemData.item.unit || "kg"})
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setItemData(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-600 font-semibold text-xs transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={itemData.balancePkgQty <= 0}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {itemData.balancePkgQty <= 0 ? "Stok Kosong" : "+ Tambah ke Keranjang"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* STEP 3: KERANJANG SEMENTARA (STAGING CART) */}
      {cart.length > 0 && (
        <Card bodyClassName="!p-5 bg-white border-2 border-orange-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-orange-600" />
              <h3 className="font-bold text-slate-900 text-sm">
                Keranjang Pengeluaran ({cart.length} Jenis Material)
              </h3>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-[11px] font-semibold">
              Belum masuk stok (Bisa diubah / dihapus)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                <tr>
                  <th className="px-3 py-2.5">No</th>
                  <th className="px-3 py-2.5">Material</th>
                  <th className="px-3 py-2.5 text-center">Stok Gudang</th>
                  <th className="px-3 py-2.5 text-center">Qty Dikeluarkan</th>
                  <th className="px-3 py-2.5 text-right">Satuan Dasar</th>
                  <th className="px-3 py-2.5 text-center">Hapus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cart.map((item, idx) => (
                  <tr key={item.itemId} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2.5 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-bold text-slate-800">{item.itemName}</div>
                      <div className="text-[11px] font-mono text-slate-500">{item.itemCode}</div>
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono text-slate-600">
                      {item.availableStock} {item.packageUnit}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="inline-flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
                        <button
                          type="button"
                          onClick={() => handleUpdateCartQty(item.itemId, -1)}
                          disabled={item.packageQty <= 1}
                          className="w-5 h-5 rounded hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700 disabled:opacity-30 cursor-pointer"
                        >
                          -
                        </button>
                        <span className="font-mono font-bold text-sm text-slate-900 w-8 text-center">
                          {item.packageQty}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateCartQty(item.itemId, 1)}
                          disabled={item.packageQty >= item.availableStock}
                          className="w-5 h-5 rounded hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700 disabled:opacity-30 cursor-pointer"
                        >
                          +
                        </button>
                        <span className="text-[11px] text-slate-500 ml-1">{item.packageUnit}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-700 font-semibold">
                      {item.packageQty * item.packageSize} {item.unit}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveFromCart(item.itemId)}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 transition cursor-pointer"
                        title="Hapus dari keranjang"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs font-semibold text-slate-700">
            <span>Total Pengeluaran:</span>
            <span className="text-orange-700 font-mono text-sm font-bold">
              {totalCartPackages} Kemasan ({cart.length} item material)
            </span>
          </div>

          {/* Tombol Simpan Akhir */}
          <div>
            <button
              type="button"
              onClick={handleSubmitAll}
              disabled={submitting || cart.length === 0}
              className="w-full py-3.5 px-6 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold text-sm transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Menyimpan & Memotong Stok Gudang...</span>
                </>
              ) : (
                <>
                  <PackageMinus className="w-5 h-5" />
                  <span>Simpan & Keluarkan {cart.length} Material Ini (Tercatat Per Baris)</span>
                  <ArrowRight className="w-5 h-5 ml-1" />
                </>
              )}
            </button>
          </div>
        </Card>
      )}

      {/* Riwayat Sesi Ini */}
      {recentList.length > 0 && (
        <Card bodyClassName="!p-4 bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-2 mb-3 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            <span>Baru Saja Dikeluarkan (Sesi Ini - Tersimpan di Database)</span>
          </div>

          <div className="divide-y divide-slate-200 text-xs">
            {recentList.map((tx, i) => (
              <div
                key={i}
                className={`py-2.5 flex items-center justify-between gap-3 ${
                  tx.isCancelled ? "opacity-60 bg-slate-100/60 -mx-2 px-2 rounded-lg" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-bold text-slate-800 ${
                        tx.isCancelled ? "line-through text-slate-500" : ""
                      }`}
                    >
                      {tx.itemName}
                    </span>
                    {tx.isCancelled && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                        DIBATALKAN (Stok Kembali)
                      </span>
                    )}
                  </div>
                  <div className="text-slate-500 font-mono text-[11px] truncate">
                    {tx.outgoingNumber} • {tx.itemCode}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span
                      className={`font-mono font-bold text-sm ${
                        tx.isCancelled ? "line-through text-slate-400" : "text-orange-700"
                      }`}
                    >
                      -{tx.qty} {tx.unit}
                    </span>
                    <div className="text-[10px] text-slate-400">{tx.time}</div>
                  </div>

                  {!tx.isCancelled && (
                    <button
                      type="button"
                      onClick={() => handleCancelOutgoing(tx.outgoingId, tx.outgoingNumber)}
                      disabled={cancellingId === tx.outgoingId}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-600 font-semibold text-xs transition cursor-pointer disabled:opacity-50 shadow-2xs"
                      title="Batalkan transaksi ini jika salah scan"
                    >
                      {cancellingId === tx.outgoingId ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3.5 h-3.5" />
                      )}
                      <span>Batalkan</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
