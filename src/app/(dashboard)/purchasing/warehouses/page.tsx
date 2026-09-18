"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageTitle, Card, Badge, Button } from "@/components/ui";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertCircle,
  Loader2,
  ExternalLink,
  FileText,
  Inbox,
  User as UserIcon,
} from "lucide-react";

type WarehouseData = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  isActive: boolean;
};

type LinkedWarehouseTransactions = {
  purchaseOrders: Array<{
    id: string;
    poNumber: string;
    status: string;
    createdAt: string;
    supplier?: { name: string } | null;
  }>;
  receivings: Array<{
    id: string;
    receivingNumber: string;
    receivedAt: string;
    status: string;
    delivery?: {
      id: string;
      deliveryNumber: string;
      suratJalan: string;
      supplier?: { name: string } | null;
    } | null;
    purchaseOrder?: {
      id: string;
      poNumber: string;
      status: string;
    } | null;
  }>;
  users: Array<{
    id: string;
    username: string;
    name: string;
    role: string;
  }>;
};

function statusColor(status: string): "gray" | "blue" | "green" | "red" | "amber" {
  switch (status) {
    case "APPROVED":
    case "RECEIVED":
    case "CLOSED":
      return "green";
    case "PENDING":
    case "WAITING_APPROVAL":
      return "amber";
    case "REJECTED":
    case "CANCELLED":
      return "red";
    default:
      return "blue";
  }
}

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<WarehouseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingWh, setEditingWh] = useState<WarehouseData | null>(null);
  const [formData, setFormData] = useState({ code: "", name: "", address: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<WarehouseData | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLinkedTx, setDeleteLinkedTx] = useState<LinkedWarehouseTransactions | null>(null);
  const [toastSuccess, setToastSuccess] = useState<string | null>(null);

  async function loadWarehouses() {
    setLoading(true);
    try {
      const res = await fetch("/api/master/warehouses");
      const data = await res.json();
      if (Array.isArray(data)) setWarehouses(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWarehouses();
  }, []);

  function handleOpenCreate() {
    setEditingWh(null);
    setFormData({ code: "", name: "", address: "" });
    setError(null);
    setShowModal(true);
  }

  function handleOpenEdit(wh: WarehouseData) {
    setEditingWh(wh);
    setFormData({
      code: wh.code,
      name: wh.name,
      address: wh.address || "",
    });
    setError(null);
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const url = "/api/master/warehouses";
      const method = editingWh ? "PUT" : "POST";
      const body = editingWh ? { id: editingWh.id, ...formData, isActive: editingWh.isActive } : formData;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan warehouse");

      setShowModal(false);
      loadWarehouses();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(wh: WarehouseData) {
    try {
      await fetch("/api/master/warehouses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...wh, isActive: !wh.isActive }),
      });
      loadWarehouses();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    setDeleteLinkedTx(null);

    try {
      const res = await fetch(`/api/master/warehouses?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error || "Gagal menghapus warehouse");
        if (data.transactions) {
          setDeleteLinkedTx(data.transactions);
        }
        return;
      }

      setToastSuccess(`Warehouse ${deleteTarget.name} (${deleteTarget.code}) berhasil dihapus.`);
      setTimeout(() => setToastSuccess(null), 5000);
      setDeleteTarget(null);
      setDeleteLinkedTx(null);
      loadWarehouses();
    } catch (e: any) {
      setDeleteError(e?.message || "Terjadi kesalahan saat menghapus warehouse");
    } finally {
      setDeleting(false);
    }
  }

  async function handleDeactivateFromModal() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch("/api/master/warehouses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...deleteTarget, isActive: false }),
      });
      setToastSuccess(`Status warehouse ${deleteTarget.name} berhasil diubah menjadi Non-Aktif.`);
      setTimeout(() => setToastSuccess(null), 5000);
      setDeleteTarget(null);
      setDeleteLinkedTx(null);
      loadWarehouses();
    } catch (e: any) {
      setDeleteError(e?.message || "Gagal menonaktifkan warehouse");
    } finally {
      setDeleting(false);
    }
  }

  const filteredWarehouses = warehouses.filter(
    (w) =>
      w.code.toLowerCase().includes(search.toLowerCase()) ||
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      (w.address && w.address.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="space-y-4">
      <PageTitle
        title="Master Warehouse"
        subtitle="Kelola master lokasi gudang & plant penerimaan"
        breadcrumb={["Master Data", "Warehouse"]}
        action={
          <Button onClick={handleOpenCreate} variant="primary" className="gap-2">
            <Plus className="w-4 h-4" /> Tambah Warehouse
          </Button>
        }
      />

      {/* Toast Notifikasi Sukses */}
      {toastSuccess && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 flex items-center justify-between gap-3 text-emerald-800 text-xs shadow-xs animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastSuccess}</span>
          </div>
          <button
            onClick={() => setToastSuccess(null)}
            className="text-emerald-600 hover:text-emerald-800 font-bold p-1"
          >
            ×
          </button>
        </div>
      )}

      <Card className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari kode, nama, atau alamat warehouse..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Total: {filteredWarehouses.length} Warehouse
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-3">Kode</th>
                <th className="px-4 py-3">Nama Warehouse</th>
                <th className="px-4 py-3">Alamat / Lokasi</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    Memuat data warehouse...
                  </td>
                </tr>
              ) : filteredWarehouses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    Tidak ada warehouse ditemukan.
                  </td>
                </tr>
              ) : (
                filteredWarehouses.map((wh) => (
                  <tr key={wh.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900">{wh.code}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{wh.name}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate">
                      {wh.address ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={wh.isActive ? "green" : "red"}>
                        {wh.isActive ? "Aktif" : "Non-Aktif"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleToggleStatus(wh)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                          title={wh.isActive ? "Nonaktifkan Warehouse" : "Aktifkan Warehouse"}
                        >
                          {wh.isActive ? (
                            <XCircle className="w-4 h-4 text-amber-500" />
                          ) : (
                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                          )}
                        </button>
                        <button
                          onClick={() => handleOpenEdit(wh)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                          title="Edit Warehouse"
                        >
                          <Edit2 className="w-4 h-4 text-blue-600" />
                        </button>
                        <button
                          onClick={() => {
                            setDeleteTarget(wh);
                            setDeleteError(null);
                            setDeleteLinkedTx(null);
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                          title="Hapus Warehouse"
                        >
                          <Trash2 className="w-4 h-4 text-rose-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Form Add/Edit */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              {editingWh ? "Edit Warehouse" : "Tambah Warehouse Baru"}
            </h3>

            {error && (
              <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kode Warehouse *
                </label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="Contoh: WH-PLANT1"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Warehouse / Plant *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: Painting Plant 1 Area"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alamat / Lokasi
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Lokasi spesifik gudang..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                >
                  Batal
                </Button>
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? "Menyimpan..." : "Simpan Warehouse"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dedicated Delete Confirmation Modal UI */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">Hapus Warehouse?</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Anda akan menghapus warehouse{" "}
                  <strong className="text-slate-900">{deleteTarget.name}</strong> (
                  <span className="font-mono text-xs font-semibold text-slate-700">{deleteTarget.code}</span>).
                </p>
              </div>
            </div>

            {/* Proteksi Integritas Data Notice */}
            {!deleteError && !deleteLinkedTx && (
              <div className="rounded-xl bg-amber-50 p-3.5 text-xs text-amber-900/90 border border-amber-200 leading-relaxed space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-950">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Proteksi Integritas Data</span>
                </div>
                <p className="text-[11px] text-amber-900/90">
                  Warehouse yang sudah memiliki riwayat Penerimaan Barang (Receiving), Purchase Order (PO), atau Pengguna terdaftar tidak dapat dihapus permanen demi menjaga audit trail inventaris. Disarankan untuk <strong>menonaktifkannya</strong> saja.
                </p>
              </div>
            )}

            {/* Error Alert jika delete gagal */}
            {deleteError && (
              <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-800 border border-rose-200 leading-relaxed flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{deleteError}</div>
              </div>
            )}

            {/* Daftar Transaksi Penerimaan (Receiving) yang Terikat (DENGAN HREF KLIK LANGSUNG) */}
            {deleteLinkedTx?.receivings && deleteLinkedTx.receivings.length > 0 && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-blue-950 flex items-center gap-1.5">
                    <Inbox className="w-4 h-4 text-blue-600" />
                    Terhubung ke {deleteLinkedTx.receivings.length} Penerimaan (Receiving):
                  </span>
                  <span className="text-[10px] text-blue-700 font-semibold bg-white px-2 py-0.5 rounded border border-blue-200">
                    Klik No PO untuk buka
                  </span>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {deleteLinkedTx.receivings.map((rcv) => (
                    <div
                      key={rcv.id}
                      className="p-2.5 rounded-lg bg-white border border-blue-200/80 space-y-1.5 text-xs shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-mono font-bold text-slate-800">
                          <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[11px]">
                            {rcv.receivingNumber}
                          </span>
                          <span className="text-[11px] font-normal text-slate-500">
                            {new Date(rcv.receivedAt).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                        <Badge color={statusColor(rcv.status)}>{rcv.status}</Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 pt-0.5 border-t border-slate-100">
                        {rcv.purchaseOrder && (
                          <Link
                            href={`/purchasing/purchase-orders/${rcv.purchaseOrder.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-mono font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                            title={`Buka PO ${rcv.purchaseOrder.poNumber} di tab baru`}
                          >
                            <span>PO: {rcv.purchaseOrder.poNumber}</span>
                            <ExternalLink className="w-3 h-3 text-blue-500" />
                          </Link>
                        )}
                        {rcv.delivery && (
                          <span>
                            SJ: <span className="font-mono font-medium text-slate-700">{rcv.delivery.suratJalan}</span>
                          </span>
                        )}
                        {rcv.delivery?.supplier?.name && (
                          <span className="text-slate-500 truncate max-w-[180px]">
                            ({rcv.delivery.supplier.name})
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg bg-white/80 p-2.5 border border-blue-200/60 text-[11px] text-slate-600 space-y-1">
                  <p className="font-semibold text-blue-950 flex items-center gap-1">
                    💡 <span>Mengapa tidak bisa dihapus?</span>
                  </p>
                  <p className="leading-snug">
                    Penerimaan barang mencatat masuknya stok fisik ke gudang ini. Menghapus gudang akan merusak riwayat arsip penerimaan barang. Silakan klik <strong>Nonaktifkan Warehouse Saja</strong> di bawah agar warehouse ini tidak dapat dipilih lagi.
                  </p>
                </div>
              </div>
            )}

            {/* Daftar Transaksi PO yang Terikat Langsung (jika ada) */}
            {deleteLinkedTx?.purchaseOrders && deleteLinkedTx.purchaseOrders.length > 0 && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3.5 space-y-2">
                <span className="font-bold text-xs text-indigo-950 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  Terhubung ke {deleteLinkedTx.purchaseOrders.length} Purchase Order:
                </span>
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {deleteLinkedTx.purchaseOrders.map((po) => (
                    <Link
                      key={po.id}
                      href={`/purchasing/purchase-orders/${po.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between p-2 rounded-lg bg-white border border-indigo-200/80 hover:border-indigo-400 hover:bg-indigo-50/80 transition-all text-xs group shadow-2xs"
                    >
                      <div className="flex items-center gap-1.5 font-mono font-bold text-indigo-600 group-hover:underline">
                        <span>{po.poNumber}</span>
                        <ExternalLink className="w-3.5 h-3.5 text-indigo-500 opacity-70 group-hover:opacity-100" />
                      </div>
                      <Badge color={statusColor(po.status)}>{po.status}</Badge>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Pengguna Terkait (jika ada) */}
            {deleteLinkedTx?.users && deleteLinkedTx.users.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1 text-slate-700">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                  <span>Akun Pengguna Terkait:</span>
                </div>
                <p className="text-[11px]">
                  Warehouse ini di-assign ke pengguna: <strong>{deleteLinkedTx.users.map((u) => `${u.name} (${u.username})`).join(", ")}</strong>.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
              {deleteLinkedTx ? (
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDeactivateFromModal}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-semibold text-white hover:bg-amber-600 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                  title="Ubah status warehouse menjadi Non-Aktif tanpa menghapus histori transaksi"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Nonaktifkan Warehouse Saja</span>
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={deleting}
                  onClick={() => {
                    setDeleteTarget(null);
                    setDeleteError(null);
                    setDeleteLinkedTx(null);
                  }}
                >
                  {deleteLinkedTx ? "Tutup" : "Batal"}
                </Button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleConfirmDelete}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      <span>{deleteLinkedTx ? "Coba Hapus Lagi" : "Ya, Hapus Warehouse"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
