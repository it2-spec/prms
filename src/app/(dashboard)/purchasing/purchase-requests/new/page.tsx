"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageTitle, Card, Button } from "@/components/ui";
import SearchableSelect from "@/components/SearchableSelect";
import {
  ArrowLeft,
  Plus,
  Trash2,
  AlertTriangle,
  Send,
  FileText,
  Save,
  HelpCircle,
  Package,
  Layers,
  Sparkles,
} from "lucide-react";

type ItemOption = {
  id: string;
  code: string;
  name: string;
  unit: string | null;
  packageUnit: string | null;
  lastUnitPrice: number | null;
};

type PRFormItem = {
  isCustom: boolean; // true jika item baru (belum ada di master)
  itemId: string;
  customItemName: string;
  specifications: string;
  qty: number;
  unit: string;
  estimatedPrice: number;
  notes: string;
};

const DEFAULT_PRODUCTION_DEPTS = ["Molding", "Plating", "Painting 1", "Painting 2"];
const DEFAULT_INDIRECT_DEPTS = ["PP", "QC", "QA", "Assembly", "PPIC"];
const ALL_DEPTS = [
  "Molding",
  "Plating",
  "Painting 1",
  "Painting 2",
  "PP",
  "QC",
  "QA",
  "Assembly",
  "PPIC",
  "Maintenance",
  "GA / HR",
];

export default function NewPurchaseRequestPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [masterItems, setMasterItems] = useState<ItemOption[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  const canSeePrice = currentUser?.role === "PURCHASING";

  // Form states
  const [department, setDepartment] = useState("");
  const [availableDepts, setAvailableDepts] = useState<string[]>([]);
  const [requiredDate, setRequiredDate] = useState("");
  const [urgency, setUrgency] = useState<"NORMAL" | "URGENT">("NORMAL");
  const [purposeNotes, setPurposeNotes] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");

  const [items, setItems] = useState<PRFormItem[]>([
    {
      isCustom: false,
      itemId: "",
      customItemName: "",
      specifications: "",
      qty: 1,
      unit: "Pcs",
      estimatedPrice: 0,
      notes: "",
    },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load user profile & available departments
  useEffect(() => {
    async function initUser() {
      try {
        const userRes = await fetch("/api/user/profile").catch(() => null);
        let userDepts: string[] = [];
        if (userRes && userRes.ok) {
          const u = await userRes.json();
          setCurrentUser(u);

          if (u.role === "ADMIN_PRODUKSI") {
            userDepts = u.departments?.length ? u.departments : DEFAULT_PRODUCTION_DEPTS;
          } else if (u.role === "ADMIN_INDIRECT") {
            userDepts = u.departments?.length ? u.departments : DEFAULT_INDIRECT_DEPTS;
          } else {
            userDepts = u.departments?.length ? u.departments : ALL_DEPTS;
          }
        } else {
          userDepts = ALL_DEPTS;
        }

        setAvailableDepts(userDepts);
        if (userDepts.length > 0) {
          setDepartment(userDepts[0]);
        }
      } catch (e) {
        console.error("Error loading user profile:", e);
      }
    }

    initUser();
  }, []);

  // Load master items filtered by selected department
  useEffect(() => {
    if (!department) return;
    let isCancelled = false;
    setLoadingItems(true);

    fetch(`/api/master/items?department=${encodeURIComponent(department)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!isCancelled && Array.isArray(data)) {
          setMasterItems(data);
        }
      })
      .catch((err) => console.error("Error fetching items for department:", err))
      .finally(() => {
        if (!isCancelled) setLoadingItems(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [department]);


  function handleAddItem() {
    setItems((prev) => [
      ...prev,
      {
        isCustom: false,
        itemId: "",
        customItemName: "",
        specifications: "",
        qty: 1,
        unit: "Pcs",
        estimatedPrice: 0,
        notes: "",
      },
    ]);
  }

  function handleRemoveItem(index: number) {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleItemChange(index: number, patch: Partial<PRFormItem>) {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };

      // Jika user memilih item master, autofill unit & estimatedPrice jika ada
      if (patch.itemId && patch.itemId !== "") {
        const found = masterItems.find((m) => m.id === patch.itemId);
        if (found) {
          next[index].unit = found.unit || found.packageUnit || "Pcs";
          if (canSeePrice && found.lastUnitPrice) {
            next[index].estimatedPrice = Number(found.lastUnitPrice);
          } else {
            next[index].estimatedPrice = 0;
          }
        }
      }

      return next;
    });
  }

  async function handleSubmit(action: "DRAFT" | "SUBMIT") {
    setError(null);

    if (!department) {
      setError("Silakan pilih departemen pemohon");
      return;
    }

    if (items.length === 0) {
      setError("Minimal harus ada 1 item kebutuhan");
      return;
    }

    // Validasi baris item
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.isCustom && !it.itemId) {
        setError(`Baris item #${i + 1}: Silakan pilih barang dari master item atau pilih 'Item Baru'`);
        return;
      }
      if (it.isCustom && (!it.customItemName || it.customItemName.trim() === "")) {
        setError(`Baris item #${i + 1}: Nama item request baru wajib diisi`);
        return;
      }
      if (!it.qty || it.qty <= 0) {
        setError(`Baris item #${i + 1}: Qty harus lebih besar dari 0`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        department,
        requiredDate: requiredDate || null,
        urgency,
        purposeNotes: purposeNotes.trim() || null,
        attachmentUrl: attachmentUrl.trim() || null,
        action,
        details: items.map((it) => ({
          itemId: it.isCustom ? null : it.itemId,
          customItemName: it.isCustom ? it.customItemName.trim() : null,
          specifications: it.specifications.trim() || null,
          qty: it.qty,
          unit: it.unit || "Pcs",
          estimatedPrice: canSeePrice ? (it.estimatedPrice || 0) : 0,
          notes: it.notes.trim() || null,
        })),
      };

      const res = await fetch("/api/purchase-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal membuat Purchase Request");
        return;
      }

      router.push(`/purchasing/purchase-requests/${data.pr.id}`);
    } catch (e: any) {
      setError(e.message || "Terjadi kesalahan koneksi");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <Link href="/purchasing/purchase-requests">
          <button
            type="button"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Buat Purchase Request (PR)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Ajukan permohonan pengadaan barang untuk departemen Anda
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Header Form */}
      <Card bodyClassName="space-y-4 !p-5">
        <div className="border-b border-slate-100 pb-3 mb-2">
          <h2 className="text-sm font-bold text-slate-800">Informasi Permohonan</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Departemen Pemohon */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Departemen Pemohon <span className="text-rose-500">*</span>
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-medium"
            >
              {availableDepts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">Sesuai bagian/unit yang membutuhkan</p>
          </div>

          {/* Target Tanggal Dibutuhkan */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Target Tanggal Dibutuhkan
            </label>
            <input
              type="date"
              value={requiredDate}
              onChange={(e) => setRequiredDate(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">Kapan barang harus sudah tiba</p>
          </div>

          {/* Tingkat Urgensi */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Tingkat Urgensi <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setUrgency("NORMAL")}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${urgency === "NORMAL"
                    ? "border-blue-600 bg-blue-50 text-blue-800 ring-2 ring-blue-500/20"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => setUrgency("URGENT")}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${urgency === "URGENT"
                    ? "border-rose-600 bg-rose-50 text-rose-800 ring-2 ring-rose-500/20 shadow-xs"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-rose-50/50"
                  }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                URGENT
              </button>
            </div>
          </div>
        </div>

        {/* Keperluan / Notes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Keperluan / Catatan Permohonan
            </label>
            <textarea
              rows={2}
              value={purposeNotes}
              onChange={(e) => setPurposeNotes(e.target.value)}
              placeholder="Contoh: Penggantian part mesin molding line 2 yang aus / Kebutuhan project trial"
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Lampiran Dokumen / Foto (URL / Link)
            </label>
            <input
              type="text"
              value={attachmentUrl}
              onChange={(e) => setAttachmentUrl(e.target.value)}
              placeholder="Link file spek / foto teknis part (Google Drive / URL)"
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Opsional: Lampirkan link foto kerusakan atau drawing teknis jika ada
            </p>
          </div>
        </div>
      </Card>

      {/* Rincian Item */}
      <Card bodyClassName="!p-0">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Daftar Barang yang Diminta</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pilih dari Master Item atau gunakan tombol &apos;Request Item Baru&apos; jika barang belum terdaftar
            </p>
          </div>
          <Button variant="secondary" onClick={handleAddItem} className="gap-1.5 text-xs !py-1.5 !px-3">
            <Plus className="w-4 h-4" />
            Tambah Baris Barang
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3 w-12 text-center">#</th>
                <th className="px-4 py-3 min-w-[280px]">Barang &amp; Spesifikasi</th>
                <th className="px-4 py-3 w-32">Qty</th>
                <th className="px-4 py-3 w-28">Satuan</th>
                {canSeePrice && <th className="px-4 py-3 w-36">Estimasi Harga</th>}
                <th className="px-4 py-3 min-w-[160px]">Catatan / Keterangan</th>
                <th className="px-4 py-3 w-12 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((it, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 text-center text-xs text-slate-400 font-mono">
                    {idx + 1}
                  </td>

                  {/* Barang & Spesifikasi */}
                  <td className="px-4 py-3">
                    <div className="space-y-1.5">
                      <SearchableSelect
                        options={masterItems.map((m) => ({
                          value: m.id,
                          label: `${m.code} – ${m.name}`,
                        }))}
                        value={it.isCustom ? it.customItemName : it.itemId}
                        creatable={true}
                        creatableText={(q) => `+ Buat Item Baru: "${q}" (Non-Master)`}
                        onCreateNew={(customName) => {
                          handleItemChange(idx, {
                            isCustom: true,
                            itemId: "",
                            customItemName: customName,
                          });
                        }}
                        onChange={(selectedId) => {
                          handleItemChange(idx, {
                            isCustom: false,
                            itemId: selectedId,
                            customItemName: "",
                          });
                        }}
                        placeholder="Ketik kode / nama barang..."
                      />

                      {it.isCustom && it.customItemName ? (
                        <div className="space-y-1 p-2 rounded-lg bg-purple-50/70 border border-purple-200 text-xs animate-in fade-in-50">
                          <div className="flex items-center justify-between">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700">
                              <Sparkles className="w-3 h-3 text-purple-600" />
                              Item Baru: &ldquo;{it.customItemName}&rdquo;
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                handleItemChange(idx, {
                                  isCustom: false,
                                  itemId: "",
                                  customItemName: "",
                                })
                              }
                              className="text-[10px] text-slate-400 hover:text-slate-600 underline"
                            >
                              Ganti
                            </button>
                          </div>
                          <input
                            type="text"
                            placeholder="Spesifikasi teknis / tipe / merk (opsional)"
                            value={it.specifications}
                            onChange={(e) =>
                              handleItemChange(idx, { specifications: e.target.value })
                            }
                            className="w-full px-2.5 py-1 text-[11px] bg-white border border-purple-200 rounded focus:outline-none focus:border-purple-400"
                          />
                        </div>
                      ) : null}
                    </div>
                  </td>

                  {/* Qty */}
                  <td className="px-4 py-3 align-top">
                    <input
                      type="number"
                      min={1}
                      value={it.qty}
                      onChange={(e) =>
                        handleItemChange(idx, { qty: Math.max(1, parseInt(e.target.value) || 1) })
                      }
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-center font-bold"
                    />
                  </td>

                  {/* Satuan */}
                  <td className="px-4 py-3 align-top">
                    <input
                      type="text"
                      placeholder="Satuan"
                      value={it.unit}
                      onChange={(e) => handleItemChange(idx, { unit: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </td>

                  {/* Estimasi Harga (Hanya Purchasing) */}
                  {canSeePrice && (
                    <td className="px-4 py-3 align-top">
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[10px] text-slate-400">
                          Rp
                        </span>
                        <input
                          type="number"
                          min={0}
                          value={it.estimatedPrice || ""}
                          onChange={(e) =>
                            handleItemChange(idx, {
                              estimatedPrice: Math.max(0, parseFloat(e.target.value) || 0),
                            })
                          }
                          placeholder="0"
                          className="w-full pl-7 pr-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-right"
                        />
                      </div>
                    </td>
                  )}

                  {/* Catatan Baris */}
                  <td className="px-4 py-3 align-top">
                    <input
                      type="text"
                      placeholder="Catatan tambahan..."
                      value={it.notes}
                      onChange={(e) => handleItemChange(idx, { notes: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </td>

                  {/* Aksi Hapus */}
                  <td className="px-4 py-3 align-top text-center">
                    <button
                      type="button"
                      disabled={items.length <= 1}
                      onClick={() => handleRemoveItem(idx)}
                      className={`p-1.5 rounded-lg transition ${items.length <= 1
                          ? "text-slate-200 cursor-not-allowed"
                          : "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        }`}
                      title="Hapus baris ini"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Total: {items.length} jenis barang</span>
          <button
            type="button"
            onClick={handleAddItem}
            className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            + Tambah Baris Barang
          </button>
        </div>
      </Card>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200">
        <Link href="/purchasing/purchase-requests">
          <Button variant="secondary" type="button">
            Batal
          </Button>
        </Link>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            type="button"
            disabled={submitting}
            onClick={() => handleSubmit("DRAFT")}
            className="gap-2"
          >
            <Save className="w-4 h-4 text-slate-500" />
            Simpan sebagai Draft
          </Button>

          <Button
            variant="primary"
            type="button"
            disabled={submitting}
            onClick={() => handleSubmit("SUBMIT")}
            className="gap-2 shadow-sm"
          >
            <Send className="w-4 h-4" />
            {submitting ? "Memproses..." : "Ajukan PR (Submit Approval)"}
          </Button>
        </div>
      </div>
    </div>
  );
}
