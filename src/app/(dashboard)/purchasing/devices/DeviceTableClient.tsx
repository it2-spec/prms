"use client";

import React, { useState } from "react";
import { Laptop, Smartphone, Send, Trash2, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { Card, Badge, Button } from "@/components/ui";

interface DeviceItem {
  id: string;
  endpoint: string;
  deviceName: string | null;
  userAgent: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    username: string;
    approvalLevel: number;
    role: { name: string };
  };
}

export default function DeviceTableClient({ initialDevices }: { initialDevices: DeviceItem[] }) {
  const [devices, setDevices] = useState<DeviceItem[]>(initialDevices);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showAlert = (type: "success" | "error", message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleTestPush = async (device: DeviceItem) => {
    try {
      setTestingId(device.id);
      const res = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: device.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showAlert("success", `Notifikasi uji coba berhasil dikirim ke perangkat ${device.user.name} (${device.deviceName || "Browser"})!`);
      } else {
        showAlert("error", data.error || "Gagal mengirim push notification.");
      }
    } catch (err: any) {
      showAlert("error", err.message || "Terjadi kesalahan jaringan.");
    } finally {
      setTestingId(null);
    }
  };

  const handleDeleteDevice = async (id: string, name: string) => {
    if (!confirm(`Cabut pendaftaran perangkat untuk ${name}? Perangkat ini tidak akan lagi menerima push notification.`)) {
      return;
    }

    try {
      setDeletingId(id);
      const res = await fetch(`/api/push/devices?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDevices((prev) => prev.filter((d) => d.id !== id));
        showAlert("success", "Perangkat berhasil dicabut.");
      } else {
        showAlert("error", "Gagal mencabut perangkat.");
      }
    } catch (err: any) {
      showAlert("error", err.message || "Terjadi kesalahan jaringan.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Alert banner */}
      {alert && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-sm animate-in fade-in slide-in-from-top-1 ${
            alert.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {alert.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span>{alert.message}</span>
          </div>
          <button
            onClick={() => setAlert(null)}
            className="text-xs font-semibold hover:underline cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Device Table */}
      <Card>
        <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800">Daftar Perangkat Aktif</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Menampilkan {devices.length} perangkat yang terhubung dengan Web Push Service
            </p>
          </div>
        </div>

        {devices.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Laptop className="w-12 h-12 mx-auto mb-3 text-slate-300 stroke-[1.5]" />
            <p className="text-sm font-semibold text-slate-600">Belum ada perangkat terdaftar</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Perangkat akan otomatis terdaftar saat pengguna mengizinkan notifikasi browser pada pop-up aktivasi.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-xs font-semibold text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3.5">Pengguna &amp; Role</th>
                  <th className="px-6 py-3.5">Perangkat &amp; Browser</th>
                  <th className="px-6 py-3.5">Status Web Push</th>
                  <th className="px-6 py-3.5">Terdaftar Sejak</th>
                  <th className="px-6 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {devices.map((d) => {
                  const isMobile = (d.userAgent || "").includes("Android") || (d.userAgent || "").includes("iPhone");
                  const roleLabel =
                    d.user.approvalLevel === 2
                      ? "President Director (L2)"
                      : d.user.approvalLevel === 1
                      ? "Purchasing Manager (L1)"
                      : d.user.role?.name || "User";

                  return (
                    <tr key={d.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* User Info */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                            {d.user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                              {d.user.name}
                              {d.user.approvalLevel > 0 && (
                                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                              )}
                            </div>
                            <div className="text-xs text-slate-400 font-mono">@{d.user.username}</div>
                            <div className="mt-1">
                              <Badge
                                color={
                                  d.user.approvalLevel === 2
                                    ? "green"
                                    : d.user.approvalLevel === 1
                                    ? "blue"
                                    : "gray"
                                }
                              >
                                {roleLabel}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Device / Browser */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                            {isMobile ? (
                              <Smartphone className="w-4 h-4" />
                            ) : (
                              <Laptop className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-slate-800 text-xs">
                              {d.deviceName || "Unknown Browser"}
                            </p>
                            <p className="text-[11px] text-slate-400 max-w-[240px] truncate" title={d.userAgent || ""}>
                              {d.userAgent || "-"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Web Push Status */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span>Terhubung (Active)</span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5 max-w-[180px] truncate" title={d.endpoint}>
                          {d.endpoint.slice(0, 30)}...
                        </p>
                      </td>

                      {/* Registered Date */}
                      <td className="px-6 py-4 text-xs text-slate-600">
                        {new Intl.DateTimeFormat("id-ID", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(d.createdAt))}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Button
                            variant="secondary"
                            className="text-xs py-1.5 px-2.5 gap-1 border-slate-200 hover:border-blue-300 hover:text-blue-600"
                            disabled={testingId === d.id}
                            onClick={() => handleTestPush(d)}
                            title="Kirim notifikasi uji coba ke browser ini"
                          >
                            {testingId === d.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                            <span>{testingId === d.id ? "Menguji..." : "Test Push"}</span>
                          </Button>

                          <Button
                            variant="danger"
                            className="text-xs py-1.5 px-2.5 gap-1"
                            disabled={deletingId === d.id}
                            onClick={() => handleDeleteDevice(d.id, d.user.name)}
                            title="Cabut pendaftaran perangkat ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Cabut</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
