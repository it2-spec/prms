"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageTitle, Card, Badge, Button, statusColor } from "@/components/ui";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  ExternalLink,
  FileText,
  CheckCircle2,
  X,
  AlertCircle,
} from "lucide-react";

type SupplierData = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  contactPerson: string | null;
  isActive: boolean;
};

type LinkedSupplierTransactions = {
  purchaseOrders?: Array<{
    id: string;
    poNumber: string;
    status: string;
    poDate?: string;
  }>;
  deliveries?: Array<{
    id: string;
    deliveryNumber: string;
    suratJalan: string;
    shipDate?: string;
  }>;
  users?: Array<{
    id: string;
    username: string;
    name: string;
  }>;
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<SupplierData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingSup, setEditingSup] = useState<SupplierData | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    address: "",
    phone: "",
    email: "",
    contactPerson: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<SupplierData | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLinkedTx, setDeleteLinkedTx] = useState<LinkedSupplierTransactions | null>(null);
  const [toastSuccess, setToastSuccess] = useState<string | null>(null);

  async function loadSuppliers() {
    setLoading(true);
    try {
      const res = await fetch("/api/master/suppliers");
      const data = await res.json();
      if (Array.isArray(data)) setSuppliers(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSuppliers();
  }, []);

  function handleOpenCreate() {
    setEditingSup(null);
    setFormData({ code: "", name: "", address: "", phone: "", email: "", contactPerson: "" });
    setError(null);
    setShowModal(true);
  }

  function handleOpenEdit(sup: SupplierData) {
    setEditingSup(sup);
    setFormData({
      code: sup.code,
      name: sup.name,
      address: sup.address || "",
      phone: sup.phone || "",
      email: sup.email || "",
      contactPerson: sup.contactPerson || "",
    });
    setError(null);
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const url = "/api/master/suppliers";
      const method = editingSup ? "PUT" : "POST";
      const body = editingSup ? { id: editingSup.id, ...formData, isActive: editingSup.isActive } : formData;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan supplier");

      setShowModal(false);
      loadSuppliers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(sup: SupplierData) {
    try {
      await fetch("/api/master/suppliers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...sup, isActive: !sup.isActive }),
      });
      loadSuppliers();
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
      const res = await fetch(`/api/master/suppliers?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error || "Gagal menghapus supplier");
        if (data.transactions) {
          setDeleteLinkedTx(data.transactions);
        }
        setDeleting(false);
        return;
      }

      setToastSuccess(`Supplier ${deleteTarget.name} berhasil dihapus.`);
      setTimeout(() => setToastSuccess(null), 5000);
      setDeleteTarget(null);
      setDeleteLinkedTx(null);
      loadSuppliers();
    } catch (e: any) {
      setDeleteError(e?.message || "Terjadi kesalahan saat menghapus supplier");
    } finally {
      setDeleting(false);
    }
  }

  async function handleDeactivateFromModal() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch("/api/master/suppliers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...deleteTarget, isActive: false }),
      });
      setToastSuccess(`Status supplier ${deleteTarget.name} berhasil diubah menjadi Non-Aktif.`);
      setTimeout(() => setToastSuccess(null), 5000);
      setDeleteTarget(null);
      setDeleteLinkedTx(null);
      loadSuppliers();
    } catch (e: any) {
      setDeleteError(e?.message || "Gagal menonaktifkan supplier");
    } finally {
      setDeleting(false);
    }
  }

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.code.toLowerCase().includes(search.toLowerCase()) ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.contactPerson && s.contactPerson.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="space-y-4">
      <PageTitle
        title="Master Supplier"
        subtitle="Kelola master data pemasok & vendor"
        breadcrumb={["Master Data", "Supplier"]}
        action={
          <Button onClick={handleOpenCreate} variant="primary" className="gap-2">
            <Plus className="w-4 h-4" /> Tambah Supplier
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
            className="p-1 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <Card className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari kode, nama, atau contact person..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Total: {filteredSuppliers.length} Supplier
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-3">Kode</th>
                <th className="px-4 py-3">Nama Supplier</th>
                <th className="px-4 py-3">Kontak & Telepon</th>
                <th className="px-4 py-3">Alamat</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Memuat data supplier...
                  </td>
                </tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Tidak ada supplier ditemukan.
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((sup) => (
                  <tr key={sup.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900">{sup.code}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{sup.name}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      <div>{sup.contactPerson || "-"}</div>
                      <div className="text-slate-400">{sup.phone || sup.email || ""}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate">
                      {sup.address ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={sup.isActive ? "green" : "red"}>
                        {sup.isActive ? "Aktif" : "Non-Aktif"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleToggleStatus(sup)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                          title={sup.isActive ? "Nonaktifkan Supplier" : "Aktifkan Supplier"}
                        >
                          {sup.isActive ? (
                            <XCircle className="w-4 h-4 text-amber-500" />
                          ) : (
                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                          )}
                        </button>
                        <button
                          onClick={() => handleOpenEdit(sup)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                          title="Edit Supplier"
                        >
                          <Edit2 className="w-4 h-4 text-blue-600" />
                        </button>
                        <button
                          onClick={() => {
                            setDeleteTarget(sup);
                            setDeleteError(null);
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                          title="Hapus Supplier"
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
              {editingSup ? "Edit Supplier" : "Tambah Supplier Baru"}
            </h3>

            {error && (
              <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kode Supplier *
                </label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="Contoh: SUP001"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Supplier *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: PT. Sumber Kimia Abadi"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    placeholder="Nama PIC..."
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Telepon</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="021-xxxx..."
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="supplier@example.com"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Alamat</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Alamat lengkap supplier..."
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
                  {saving ? "Menyimpan..." : "Simpan Supplier"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dedicated Delete Confirmation Modal UI */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 border border-slate-100">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 shadow-xs">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">Hapus Master Supplier?</h3>
                <p className="mt-1 text-xs text-slate-600">
                  Anda akan menghapus data pemasok berikut dari database master.
                </p>
              </div>
            </div>

            {/* Rincian Supplier Card */}
            <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-2 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Kode Supplier</span>
                <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {deleteTarget.code}
                </span>
              </div>
              <div className="flex justify-between items-start pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Nama Perusahaan</span>
                <span className="font-semibold text-slate-800 text-right max-w-[240px]">
                  {deleteTarget.name}
                </span>
              </div>
              {deleteTarget.contactPerson && (
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Contact Person</span>
                  <span className="text-slate-700 font-medium">{deleteTarget.contactPerson}</span>
                </div>
              )}
              {deleteTarget.phone && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Telepon</span>
                  <span className="font-mono text-slate-700">{deleteTarget.phone}</span>
                </div>
              )}
            </div>

            {/* Alert Peringatan Umum */}
            {!deleteLinkedTx && (
              <div className="rounded-xl bg-amber-50/80 p-3 text-xs text-amber-900 border border-amber-200/80 leading-relaxed">
                <div className="font-semibold text-amber-950 mb-0.5 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Proteksi Integritas Data</span>
                </div>
                <p className="text-[11px] text-amber-900/90">
                  Supplier yang sudah memiliki riwayat Purchase Order (PO), Pengiriman, atau Akun Pengguna tidak dapat dihapus permanen demi keamanan arsip pengadaan. Disarankan untuk <strong>menonaktifkannya</strong> saja.
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

            {/* Daftar Transaksi PO yang Terikat (LENGKAP DENGAN HREF KLIK LANGSUNG) */}
            {deleteLinkedTx?.purchaseOrders && deleteLinkedTx.purchaseOrders.length > 0 && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-blue-950 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-blue-600" />
                    Terhubung ke {deleteLinkedTx.purchaseOrders.length} Purchase Order:
                  </span>
                  <span className="text-[10px] text-blue-700 font-semibold bg-white px-2 py-0.5 rounded border border-blue-200">
                    Klik No PO untuk buka
                  </span>
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {deleteLinkedTx.purchaseOrders.map((po) => (
                    <Link
                      key={po.id}
                      href={`/purchasing/purchase-orders/${po.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-blue-200/80 hover:border-blue-400 hover:bg-blue-50/80 transition-all text-xs group shadow-2xs"
                      title={`Buka ${po.poNumber} di tab baru`}
                    >
                      <div className="flex items-center gap-1.5 font-mono font-bold text-blue-600 group-hover:underline">
                        <span>{po.poNumber}</span>
                        <ExternalLink className="w-3.5 h-3.5 text-blue-500 opacity-70 group-hover:opacity-100" />
                      </div>
                      <Badge color={statusColor(po.status)}>{po.status}</Badge>
                    </Link>
                  ))}
                </div>

                <div className="rounded-lg bg-white/80 p-2.5 border border-blue-200/60 text-[11px] text-slate-600 space-y-1">
                  <p className="font-semibold text-blue-950 flex items-center gap-1">
                    💡 <span>Cara Hapus Supplier Ini:</span>
                  </p>
                  <p className="leading-snug">
                    Klik tautan nomor PO di atas untuk membuka transaksi tersebut. Jika status PO masih <strong>DRAFT</strong> atau <strong>CANCELLED</strong>, Anda dapat menghapus PO tersebut terlebih dahulu.
                  </p>
                </div>
              </div>
            )}

            {/* Akun Pengguna / Pengiriman Terkait (jika ada) */}
            {((deleteLinkedTx?.users && deleteLinkedTx.users.length > 0) ||
              (deleteLinkedTx?.deliveries && deleteLinkedTx.deliveries.length > 0)) && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1.5 text-slate-700">
                {deleteLinkedTx.users && deleteLinkedTx.users.length > 0 && (
                  <p className="text-[11px]">
                    👤 Terhubung dengan akun login supplier: <strong>{deleteLinkedTx.users.map(u => u.username).join(", ")}</strong> (hapus akun di menu Account Management terlebih dahulu).
                  </p>
                )}
                {deleteLinkedTx.deliveries && deleteLinkedTx.deliveries.length > 0 && (
                  <p className="text-[11px]">
                    📦 Tercatat dalam {deleteLinkedTx.deliveries.length} Surat Jalan Delivery di sistem.
                  </p>
                )}
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
                  title="Ubah status supplier menjadi Non-Aktif tanpa menghapus histori transaksi"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Nonaktifkan Supplier Saja</span>
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
                      <span>{deleteLinkedTx ? "Coba Hapus Lagi" : "Ya, Hapus Supplier"}</span>
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
