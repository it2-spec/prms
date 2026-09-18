"use client";

import { useState, useEffect } from "react";
import { PageTitle, Card, Badge, Button } from "@/components/ui";
import SearchableSelect from "@/components/SearchableSelect";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  User,
  Shield,
  Eye,
  EyeOff,
  RefreshCw,
  X,
  AlertTriangle,
  Loader2,
  Building2,
  Warehouse as WarehouseIcon,
  Check,
  PenTool,
  FileSignature,
} from "lucide-react";
import SignatureModal from "@/components/SignatureModal";

type RoleName = "PURCHASING" | "WAREHOUSE" | "SUPPLIER";

type UserData = {
  id: string;
  username: string;
  name: string;
  email: string | null;
  role: RoleName;
  roleId: string;
  supplierId: string | null;
  supplierName: string | null;
  warehouseId: string | null;
  warehouseName: string | null;
  isActive: boolean;
  approvalLevel?: number;
  signatureImage?: string | null;
  createdAt: string;
};

type SupplierOption = { id: string; name: string; code: string };
type WarehouseOption = { id: string; name: string; code: string };

const ROLE_META: Record<
  RoleName,
  { label: string; badgeClass: string; activeClass: string; icon: typeof Shield; desc: string }
> = {
  PURCHASING: {
    label: "Purchasing",
    badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
    activeClass: "border-indigo-500 bg-indigo-50/60 text-indigo-900 ring-2 ring-indigo-500/20",
    icon: Shield,
    desc: "Kelola PO, master data & penerimaan",
  },
  WAREHOUSE: {
    label: "Warehouse",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    activeClass: "border-amber-500 bg-amber-50/60 text-amber-900 ring-2 ring-amber-500/20",
    icon: WarehouseIcon,
    desc: "Scan QR & konfirmasi fisik barang",
  },
  SUPPLIER: {
    label: "Supplier",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    activeClass: "border-emerald-500 bg-emerald-50/60 text-emerald-900 ring-2 ring-emerald-500/20",
    icon: Building2,
    desc: "Cetak surat jalan, QR & pantau PO",
  },
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<RoleName | "ALL">("ALL");

  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    username: "",
    name: "",
    email: "",
    password: "",
    role: "PURCHASING" as RoleName,
    supplierId: "",
    warehouseId: "",
    isActive: true,
    approvalLevel: 0,
  });

  const [signatureTarget, setSignatureTarget] = useState<UserData | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<UserData | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [usersRes, suppRes, whRes] = await Promise.all([
        fetch("/api/master/users"),
        fetch("/api/master/suppliers"),
        fetch("/api/master/warehouses"),
      ]);
      const usersData = await usersRes.json();
      const suppData = await suppRes.json();
      const whData = await whRes.json();
      if (Array.isArray(usersData)) setUsers(usersData);
      if (Array.isArray(suppData)) setSuppliers(suppData);
      if (Array.isArray(whData)) setWarehouses(whData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditingUser(null);
    setForm({
      username: "",
      name: "",
      email: "",
      password: "",
      role: "PURCHASING",
      supplierId: "",
      warehouseId: "",
      isActive: true,
      approvalLevel: 0,
    });
    setError(null);
    setShowPassword(false);
    setShowModal(true);
  }

  function openEdit(u: UserData) {
    setEditingUser(u);
    setForm({
      username: u.username,
      name: u.name,
      email: u.email ?? "",
      password: "",
      role: u.role,
      supplierId: u.supplierId ?? "",
      warehouseId: u.warehouseId ?? "",
      isActive: u.isActive,
      approvalLevel: u.approvalLevel ?? 0,
    });
    setError(null);
    setShowPassword(false);
    setShowModal(true);
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const payload = {
        ...(editingUser ? { id: editingUser.id } : {}),
        username: form.username.trim(),
        name: form.name.trim(),
        email: form.email.trim() || null,
        password: form.password,
        roleName: form.role,
        supplierId: form.role === "SUPPLIER" ? form.supplierId || null : null,
        warehouseId: form.role === "WAREHOUSE" ? form.warehouseId || null : null,
        isActive: form.isActive,
        approvalLevel: form.role === "PURCHASING" ? form.approvalLevel : 0,
      };

      const res = await fetch("/api/master/users", {
        method: editingUser ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Terjadi kesalahan saat menyimpan akun");
        return;
      }

      setShowModal(false);
      load();
    } catch (e: any) {
      setError(e.message || "Terjadi kesalahan jaringan");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(u: UserData) {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/master/users?id=${u.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error || "Gagal menghapus user");
        return;
      }
      setDeleteConfirm(null);
      load();
    } catch (e: any) {
      setDeleteError(e.message || "Terjadi kesalahan saat menghapus user");
    } finally {
      setDeleting(false);
    }
  }

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch =
      u.username.toLowerCase().includes(q) ||
      u.name.toLowerCase().includes(q) ||
      (u.email ?? "").toLowerCase().includes(q);
    const matchRole = filterRole === "ALL" || u.role === filterRole;
    return matchSearch && matchRole;
  });

  const stats = {
    total: users.length,
    purchasing: users.filter((u) => u.role === "PURCHASING").length,
    warehouse: users.filter((u) => u.role === "WAREHOUSE").length,
    supplier: users.filter((u) => u.role === "SUPPLIER").length,
    active: users.filter((u) => u.isActive).length,
  };

  return (
    <div className="space-y-6">
      <PageTitle
        title="Account Management"
        subtitle="Kelola akun pengguna dan hak akses sistem"
        breadcrumb={["Master Data", "Account Management"]}
        action={
          <Button onClick={openCreate} variant="primary" className="gap-2">
            <Plus className="w-4 h-4" />
            Tambah Akun
          </Button>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          {
            label: "Total Akun",
            value: stats.total,
            color: "text-indigo-600 bg-indigo-50 border-indigo-100",
            icon: User,
            sub: `${stats.active} akun aktif`,
          },
          {
            label: "Purchasing",
            value: stats.purchasing,
            color: "text-blue-600 bg-blue-50 border-blue-100",
            icon: Shield,
            sub: "Admin & procurement",
          },
          {
            label: "Warehouse",
            value: stats.warehouse,
            color: "text-amber-600 bg-amber-50 border-amber-100",
            icon: WarehouseIcon,
            sub: "Petugas gudang",
          },
          {
            label: "Supplier",
            value: stats.supplier,
            color: "text-emerald-600 bg-emerald-50 border-emerald-100",
            icon: Building2,
            sub: "Mitra pemasok",
          },
        ].map((s) => (
          <Card key={s.label} bodyClassName="!p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium mb-1">{s.label}</p>
                <p className="text-2xl font-bold text-slate-800">{s.value}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{s.sub}</p>
              </div>
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center border ${s.color}`}
              >
                <s.icon className="w-5 h-5" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari username, nama, atau email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap items-center">
            <span className="text-xs font-medium text-slate-500 mr-1">Filter Role:</span>
            {(["ALL", "PURCHASING", "WAREHOUSE", "SUPPLIER"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setFilterRole(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filterRole === r
                    ? "bg-slate-900 text-white shadow-sm font-semibold"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {r === "ALL" ? "Semua" : ROLE_META[r]?.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
              <span className="text-sm">Memuat data pengguna...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
              <User className="w-10 h-10 opacity-30" />
              <p className="text-sm">
                {search || filterRole !== "ALL"
                  ? "Tidak ada akun yang cocok dengan filter"
                  : "Belum ada akun terdaftar"}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Pengguna</th>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Role &amp; Level</th>
                  <th className="px-4 py-3">Tanda Tangan (TTD)</th>
                  <th className="px-4 py-3 hidden md:table-cell">Entitas Terkait</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold shrink-0 border border-slate-200">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">{u.name}</p>
                          {u.email ? (
                            <p className="text-xs text-slate-400">{u.email}</p>
                          ) : (
                            <p className="text-xs text-slate-300 italic">No email</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-mono text-xs font-medium">
                      {u.username}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 items-start">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${ROLE_META[u.role].badgeClass}`}
                        >
                          {ROLE_META[u.role].label}
                        </span>
                        {u.role === "PURCHASING" && (
                          <span className="text-[10px] font-semibold text-slate-500">
                            {u.approvalLevel === 2
                              ? "⭐ Presdir (L2 Final)"
                              : u.approvalLevel === 1
                              ? "🛡️ Manager (L1)"
                              : "Staff Purchasing"}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {u.signatureImage ? (
                        <div
                          onClick={() => setSignatureTarget(u)}
                          className="group flex items-center gap-2 cursor-pointer p-1 rounded-lg hover:bg-slate-100 transition"
                          title="Klik untuk ubah TTD"
                        >
                          <div className="h-7 w-16 bg-white border border-slate-200 rounded flex items-center justify-center p-0.5 overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={u.signatureImage}
                              alt="TTD"
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                          <span className="text-[11px] text-emerald-600 font-medium group-hover:underline">
                            Ada TTD
                          </span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSignatureTarget(u)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-dashed border-slate-300 transition"
                        >
                          <PenTool className="w-3 h-3" />
                          + Upload TTD
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {u.role === "SUPPLIER" && u.supplierName ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                          <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                          {u.supplierName}
                        </span>
                      ) : u.role === "WAREHOUSE" && u.warehouseName ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                          <WarehouseIcon className="w-3.5 h-3.5 text-amber-600" />
                          {u.warehouseName}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge color={u.isActive ? "green" : "red"}>
                        {u.isActive ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSignatureTarget(u)}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors"
                          title="Kelola Tanda Tangan"
                        >
                          <PenTool className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEdit(u)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                          title="Edit Akun"
                        >
                          <Edit2 className="w-4 h-4 text-blue-600" />
                        </button>
                        <button
                          onClick={() => {
                            setDeleteConfirm(u);
                            setDeleteError(null);
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                          title="Hapus Akun"
                        >
                          <Trash2 className="w-4 h-4 text-rose-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-500 font-medium bg-slate-50/50">
            Menampilkan {filtered.length} dari {users.length} akun pengguna
          </div>
        )}
      </Card>

      {/* Modal Create / Edit Akun */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl border border-slate-100 flex flex-col max-h-[92vh] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 via-white to-slate-50/50">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100/80 shadow-xs">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {editingUser ? "Edit Akun Pengguna" : "Tambah Akun Pengguna Baru"}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {editingUser
                      ? "Perbarui hak akses, kredensial login, dan entitas terkait"
                      : "Buat kredensial login baru untuk tim internal atau mitra supplier"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
              {error && (
                <div className="bg-rose-50 border border-rose-200/80 rounded-xl px-4 py-3 text-xs text-rose-700 font-medium flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{error}</span>
                </div>
              )}

              {/* Role Selection Cards */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Role & Hak Akses <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {(["PURCHASING", "WAREHOUSE", "SUPPLIER"] as RoleName[]).map((r) => {
                    const isSelected = form.role === r;
                    const meta = ROLE_META[r];
                    const IconComp = meta.icon;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() =>
                          setForm({ ...form, role: r, supplierId: "", warehouseId: "" })
                        }
                        className={`group p-3.5 rounded-xl text-left border text-xs transition-all relative flex flex-col justify-between h-full ${
                          isSelected
                            ? "border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20 shadow-xs"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70 text-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-2.5">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                              isSelected
                                ? "bg-blue-600 text-white shadow-xs"
                                : "bg-slate-100 text-slate-500 group-hover:text-slate-700 group-hover:bg-slate-200/70"
                            }`}
                          >
                            <IconComp className="w-4 h-4" />
                          </div>
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                              isSelected
                                ? "border-blue-600 bg-blue-600 text-white"
                                : "border-slate-300 bg-white"
                            }`}
                          >
                            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                        </div>
                        <div>
                          <div className={`font-bold ${isSelected ? "text-blue-950" : "text-slate-800"}`}>
                            {meta.label}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 leading-snug line-clamp-2">
                            {meta.desc}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Hak Approval (Khusus Purchasing) */}
              {form.role === "PURCHASING" && (
                <div className="p-4 rounded-xl border border-indigo-200/90 bg-indigo-50/40 space-y-2">
                  <label className="block text-xs font-bold text-indigo-900">
                    Tingkat Persetujuan PO (Approval Level)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { level: 0, label: "Staff", desc: "Pembuat PO" },
                      { level: 1, label: "Manager", desc: "Persetujuan L1" },
                      { level: 2, label: "Presdir", desc: "Persetujuan L2 (Final)" },
                    ].map((opt) => (
                      <button
                        key={opt.level}
                        type="button"
                        onClick={() => setForm({ ...form, approvalLevel: opt.level })}
                        className={`p-2.5 rounded-lg border text-left transition-all ${
                          form.approvalLevel === opt.level
                            ? "border-indigo-600 bg-white ring-2 ring-indigo-500/20 font-semibold text-indigo-950 shadow-xs"
                            : "border-indigo-100 bg-white/70 hover:bg-white text-slate-700"
                        }`}
                      >
                        <div className="text-xs font-bold">{opt.label}</div>
                        <div className="text-[10px] text-slate-500">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Nama Lengkap & Username */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Nama Lengkap <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all"
                    placeholder="Contoh: Budi Santoso"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Username Login <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-mono text-sm">
                      @
                    </span>
                    <input
                      type="text"
                      className="w-full pl-8 pr-3.5 py-2.5 text-sm font-mono bg-white border border-slate-200 rounded-xl placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all"
                      placeholder="username"
                      value={form.username}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          username: e.target.value.toLowerCase().replace(/\s/g, ""),
                        })
                      }
                      autoComplete="off"
                    />
                  </div>
                </div>
              </div>

              {/* Email & Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Email <span className="text-slate-400 font-normal">(opsional)</span>
                  </label>
                  <input
                    type="email"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all"
                    placeholder="user@perusahaan.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Password{" "}
                    {editingUser ? (
                      <span className="text-slate-400 font-normal">(opsional jika tidak diubah)</span>
                    ) : (
                      <span className="text-rose-500">*</span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-white border border-slate-200 rounded-xl placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all"
                      placeholder={editingUser ? "•••••••• (tidak diubah)" : "Minimal 6 karakter"}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Linked Entity for Supplier */}
              {form.role === "SUPPLIER" && (
                <div className="p-4 rounded-xl border border-emerald-200/90 bg-emerald-50/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-emerald-600" />
                      Hubungkan ke Mitra Supplier <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] text-emerald-700 font-medium">Portal Akses Supplier</span>
                  </div>
                  <SearchableSelect
                    options={suppliers
                      .filter((s: any) => s.isActive)
                      .map((s) => ({
                        value: s.id,
                        label: `${s.code} – ${s.name}`,
                      }))}
                    value={form.supplierId}
                    onChange={(val) => setForm({ ...form, supplierId: val })}
                    placeholder="-- Pilih Supplier --"
                    searchPlaceholder="Cari nama atau kode supplier..."
                  />
                  <p className="text-[11px] text-emerald-700/90 leading-relaxed">
                    Akun ini akan otomatis terhubung ke portal Supplier dan hanya dapat melihat Purchase Order serta Pengiriman milik supplier yang dipilih.
                  </p>
                </div>
              )}

              {/* Linked Entity for Warehouse */}
              {form.role === "WAREHOUSE" && (
                <div className="p-4 rounded-xl border border-amber-200/90 bg-amber-50/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <WarehouseIcon className="w-4 h-4 text-amber-600" />
                      Hubungkan ke Lokasi Gudang <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] text-amber-700 font-medium">Penugasan Fisik Gudang</span>
                  </div>
                  <SearchableSelect
                    options={warehouses
                      .filter((w: any) => w.isActive)
                      .map((w) => ({
                        value: w.id,
                        label: `${w.code} – ${w.name}`,
                      }))}
                    value={form.warehouseId}
                    onChange={(val) => setForm({ ...form, warehouseId: val })}
                    placeholder="-- Pilih Warehouse --"
                    searchPlaceholder="Cari nama atau kode warehouse..."
                  />
                  <p className="text-[11px] text-amber-700/90 leading-relaxed">
                    Akun ini akan dialokasikan ke gudang yang dipilih saat memindai QR Code dan mengonfirmasi penerimaan fisik barang di lapangan.
                  </p>
                </div>
              )}

              {/* Status Switch (Edit Mode Only) */}
              {editingUser && (
                <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50/70">
                  <div>
                    <p className="text-xs font-bold text-slate-800">Status Akun Pengguna</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {form.isActive
                        ? "Akun aktif dan diizinkan login ke aplikasi"
                        : "Akun dinonaktifkan (akses login diblokir)"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, isActive: !form.isActive })}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      form.isActive ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        form.isActive ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50/90 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowModal(false)}
                disabled={saving}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleSave}
                disabled={saving}
                className="min-w-[145px]"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
                {saving
                  ? "Menyimpan..."
                  : editingUser
                  ? "Simpan Perubahan"
                  : "Buat Akun Pengguna"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-100 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">Hapus Akun Pengguna?</h3>
                <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                  Anda akan menghapus akun{" "}
                  <strong className="text-slate-900 font-mono">@{deleteConfirm.username}</strong> (
                  {deleteConfirm.name}) dengan role{" "}
                  <strong className="text-slate-800">{deleteConfirm.role}</strong>.
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-amber-50 p-3.5 text-xs text-amber-800 border border-amber-200/80 leading-relaxed">
              <strong>Perhatian:</strong> Penghapusan akun bersifat permanen. Jika akun ini pernah
              melakukan transaksi atau tercatat pada audit log sistem, disarankan untuk{" "}
              <strong>menonaktifkan akun</strong> saja agar riwayat sistem tetap terjaga.
            </div>

            {deleteError && (
              <div className="rounded-xl bg-rose-50 p-3.5 text-xs text-rose-700 border border-rose-200 font-medium">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="secondary"
                disabled={deleting}
                onClick={() => setDeleteConfirm(null)}
              >
                Batal
              </Button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => handleDelete(deleteConfirm)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 shadow-sm transition-colors disabled:opacity-50"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                {deleting ? "Menghapus..." : "Ya, Hapus Akun"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Signature Modal */}
      {signatureTarget && (
        <SignatureModal
          isOpen={!!signatureTarget}
          onClose={() => setSignatureTarget(null)}
          userName={signatureTarget.name}
          userId={signatureTarget.id}
          currentSignature={signatureTarget.signatureImage}
          onSaved={(newSig) => {
            setUsers((prev) =>
              prev.map((u) => (u.id === signatureTarget.id ? { ...u, signatureImage: newSig } : u))
            );
          }}
        />
      )}
    </div>
  );
}
