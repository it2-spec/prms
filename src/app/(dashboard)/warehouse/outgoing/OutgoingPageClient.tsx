"use client";

import { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
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
} from "lucide-react";
import { Card } from "@/components/ui";
import { submitOutgoing, cancelOutgoing } from "./outgoingAction";

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
  warehouseId,
  warehouseName,
}: {
  warehouseId: string;
  warehouseName: string;
}) {
  const [inputCode, setInputCode] = useState("");
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
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  async function startScanner() {
    setErrorMsg(null);
    setScanning(true);

    try {
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
        scannerRef.current = null;
      }

      // Wait for React to render the scanner container into the DOM
      await new Promise((r) => setTimeout(r, 100));

      const el = document.getElementById(SCANNER_ID);
      if (!el) {
        throw new Error("Container scanner belum siap.");
      }

      const scanner = new Html5Qrcode(SCANNER_ID);
      scannerRef.current = scanner;

      let targetCam: any = { facingMode: "environment" };
      try {
        const cams = await Html5Qrcode.getCameras();
        if (cams && cams.length > 0) {
          const rear = cams.find((c) => /back|rear|belakang|environment/i.test(c.label));
          targetCam = rear ? rear.id : cams[0].id;
        }
      } catch {}

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
          stopScanner();
          handleLookup(decoded.trim());
        },
        () => {},
      );
    } catch (err: any) {
      console.error("Outgoing scanner error:", err);
      setScanning(false);
      setErrorMsg("Tidak dapat mengakses kamera. Silakan ketik kode part langsung di bawah.");
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
    }
  }

  // Lookup Part by Code
  async function handleLookup(code: string) {
    if (!code.trim()) return;
    setLookupLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setItemData(null);

    try {
      const res = await fetch(
        `/api/stock/balance?itemCode=${encodeURIComponent(code.trim())}&warehouseId=${warehouseId}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Kode part tidak ditemukan di sistem");
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
      handleLookup(inputCode.trim());
    }
  }

  // Tambahkan item ke Keranjang Sementara (Belum Simpan ke Database)
  function handleAddToCart() {
    if (!itemData) return;
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

    setErrorMsg(null);

    if (inCart) {
      setCart((prev) =>
        prev.map((c) =>
          c.itemId === itemData.item.id ? { ...c, packageQty: totalDesired } : c,
        ),
      );
    } else {
      setCart((prev) => [
        ...prev,
        {
          itemId: itemData.item.id,
          itemCode: itemData.item.code,
          itemName: itemData.item.name,
          packageUnit: itemData.item.packageUnit || "Pail",
          packageSize: itemData.item.packageSize || 1,
          packageQty: qty,
          unit: itemData.item.unit || "kg",
          availableStock: itemData.balancePkgQty,
        },
      ]);
    }

    // Reset scan form siap untuk scan item berikutnya
    setItemData(null);
    setInputCode("");
    setQty(1);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }

  // Hapus item dari Keranjang Sementara
  function handleRemoveFromCart(itemId: string) {
    setCart((prev) => prev.filter((c) => c.itemId !== itemId));
  }

  // Ubah qty item di Keranjang Sementara
  function handleUpdateCartQty(itemId: string, delta: number) {
    setCart((prev) =>
      prev.map((c) => {
        if (c.itemId !== itemId) return c;
        const newQty = Math.max(1, Math.min(c.availableStock, c.packageQty + delta));
        return { ...c, packageQty: newQty };
      }),
    );
  }

  // Submit Semua Item di Keranjang ke Database & Potong Stok
  async function handleSubmitAll() {
    if (cart.length === 0) {
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
          text: `Berhasil mengeluarkan ${created.length} item material!`,
          details: `Nomor Transaksi: ${numbersText} (Tercatat sebagai baris tersendiri)`,
        });

        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      }
    } catch {
      setErrorMsg("Terjadi kesalahan saat memproses pengeluaran stok");
    } finally {
      setSubmitting(false);
    }
  }

  // Batalkan transaksi yang sudah tersimpan
  async function handleCancelRecent(tx: RecentTx) {
    if (!tx.outgoingId) return;
    const ok = window.confirm(
      `Batalkan transaksi ${tx.outgoingNumber} (${tx.qty} ${tx.unit} ${tx.itemName})?\n\nStok material akan langsung dikembalikan ke saldo gudang.`,
    );
    if (!ok) return;

    setCancellingId(tx.outgoingId);
    setErrorMsg(null);

    try {
      const res = await cancelOutgoing(tx.outgoingId, "Dibatalkan langsung di sesi scan");
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setRecentList((prev) =>
          prev.map((item) =>
            item.outgoingId === tx.outgoingId ? { ...item, isCancelled: true } : item,
          ),
        );
        setSuccessMsg({
          text: `Transaksi ${tx.outgoingNumber} berhasil dibatalkan.`,
          details: `Stok ${tx.qty} ${tx.unit} ${tx.itemName} telah kembali ke gudang.`,
        });

        if (itemData && itemData.item.code === tx.itemCode) {
          handleLookup(tx.itemCode);
        }
      }
    } catch {
      setErrorMsg("Gagal membatalkan transaksi pengeluaran");
    } finally {
      setCancellingId(null);
    }
  }

  const totalCartPackages = cart.reduce((acc, c) => acc + c.packageQty, 0);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Alert Sukses */}
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

      {/* STEP 1: SCAN / INPUT PART */}
      <Card bodyClassName="!p-5 bg-white border border-slate-200 shadow-sm">
        <form onSubmit={handleFormLookup} className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <ScanLine className="w-4 h-4 text-blue-600" />
              <span>Scan Part / Ketik Kode Barang</span>
            </label>
            <span className="text-xs text-slate-500">
              Gudang: <strong className="text-slate-700">{warehouseName}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                placeholder="Scan barcode / ketik kode part lalu tekan Enter..."
                className="w-full pl-10 pr-3 py-3 rounded-xl border-2 border-slate-300 focus:border-blue-600 focus:outline-hidden text-base font-semibold placeholder:font-normal placeholder:text-slate-400 shadow-2xs"
                disabled={lookupLoading}
              />
              <ScanLine className="w-5 h-5 text-slate-400 absolute left-3 top-3.5" />
            </div>

            <button
              type="submit"
              disabled={lookupLoading || !inputCode.trim()}
              className="px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition shrink-0 cursor-pointer"
            >
              {lookupLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Cari Part"}
            </button>

            <button
              type="button"
              onClick={scanning ? stopScanner : startScanner}
              className={`p-3 rounded-xl border transition shrink-0 cursor-pointer ${
                scanning
                  ? "bg-red-50 text-red-600 border-red-300"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
              }`}
              title={scanning ? "Tutup Kamera" : "Gunakan Kamera Scan QR"}
            >
              <QrCode className="w-5 h-5" />
            </button>
          </div>
        </form>

        {scanning && (
          <div className="mt-4 pt-4 border-t border-slate-200 flex flex-col items-center">
            <div
              id={SCANNER_ID}
              className="w-full max-w-sm rounded-xl overflow-hidden border border-slate-300 shadow-inner bg-slate-950 min-h-[260px]"
            />
            <p className="text-xs text-slate-500 mt-2">Arahkan kamera ke QR / Barcode part</p>

            <style jsx global>{`
              #${SCANNER_ID} video {
                width: 100% !important;
                height: 100% !important;
                max-height: 320px !important;
                object-fit: cover !important;
                border-radius: 0.75rem !important;
              }
              #${SCANNER_ID} {
                border: none !important;
              }
              #${SCANNER_ID} img[alt="Info icon"] {
                display: none !important;
              }
            `}</style>
          </div>
        )}
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

              <div className="text-right shrink-0 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">
                <div className="text-[11px] text-emerald-700 font-medium">Stok Tersedia</div>
                <div className="text-xl font-black text-emerald-800 font-mono">
                  {itemData.balancePkgQty}
                  <span className="text-xs font-normal text-emerald-700 ml-1">
                    {itemData.item.packageUnit || "Pail"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Jumlah ({itemData.item.packageUnit || "Kemasan"})
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="w-10 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-base flex items-center justify-center transition cursor-pointer border border-slate-300"
                  >
                    <Minus className="w-4 h-4" />
                  </button>

                  <input
                    type="number"
                    min="1"
                    max={itemData.balancePkgQty}
                    value={qty}
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
                    autoFocus
                    className="w-24 h-10 text-center text-xl font-black font-mono rounded-lg border-2 border-blue-500 bg-white focus:outline-hidden"
                  />

                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.min(itemData.balancePkgQty, q + 1))}
                    className="w-10 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-base flex items-center justify-center transition cursor-pointer border border-slate-300"
                  >
                    <Plus className="w-4 h-4" />
                  </button>

                  <span className="text-xs font-semibold text-slate-600 ml-1">
                    {itemData.item.packageUnit || "Kemasan"} (= {qty * itemData.item.packageSize} {itemData.item.unit || "kg"})
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
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Tambah ke Keranjang</span>
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
                      onClick={() => handleCancelRecent(tx)}
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
