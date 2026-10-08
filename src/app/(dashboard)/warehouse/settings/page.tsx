import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, destroySession } from "@/lib/auth";
import { PageTitle, Card } from "@/components/ui";
import {
  ClipboardList,
  History,
  User,
  Warehouse,
  ChevronRight,
  LogOut,
  ShieldCheck,
  Smartphone,
  Sliders,
  HelpCircle,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function WarehouseSettingsPage() {
  const { user, dbUser } = await getSessionUser();
  if (!user || user.role !== "WAREHOUSE") redirect("/login");

  async function handleLogout() {
    "use server";
    await destroySession();
    redirect("/login?msg=logout");
  }

  const warehouseName = dbUser?.warehouse?.name || "Semua Gudang (Default)";

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-6">
      {/* Judul Halaman */}
      <PageTitle
        title="Pengaturan & Menu Tambahan"
        subtitle="Akses modul manual, riwayat transaksi, dan profil petugas gudang"
        breadcrumb={["Warehouse", "Setting"]}
      />

      {/* Profil Petugas & Lokasi Gudang Card */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 rounded-2xl shadow-sm border border-slate-700/60">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
            {user.name ? user.name.charAt(0).toUpperCase() : "W"}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-base truncate">{user.name}</h2>
            <p className="text-xs text-slate-300 font-mono mt-0.5">@{user.username} · Role Warehouse</p>
            <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-lg bg-white/10 text-[11px] font-medium text-slate-200">
              <Warehouse className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="truncate">{warehouseName}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section: Modul Pendukung Warehouse (Manual & History) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Sliders className="w-4 h-4 text-slate-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Modul Operasional Gudang
          </h3>
        </div>

        <div className="space-y-2.5">
          {/* Menu 1: Manual Receiving */}
          <Link
            href="/warehouse/manual"
            className="block p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-blue-400 hover:shadow-sm transition-all duration-150 group cursor-pointer"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-slate-800 group-hover:text-blue-600 transition-colors">
                      Manual Receiving
                    </h4>
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700">
                      Form Input
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Penerimaan barang manual tanpa pemindaian QR Code Surat Jalan.
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0" />
            </div>
          </Link>

          {/* Menu 2: Riwayat Transaksi */}
          <Link
            href="/warehouse/history"
            className="block p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-emerald-400 hover:shadow-sm transition-all duration-150 group cursor-pointer"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-slate-800 group-hover:text-emerald-600 transition-colors">
                      Riwayat Transaksi
                    </h4>
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                      Log Aktivitas
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Histori lengkap barang masuk (Incoming) dan pengeluaran barang (Outgoing).
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all shrink-0" />
            </div>
          </Link>
        </div>
      </div>

      {/* Section: Bantuan & Sistem */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <HelpCircle className="w-4 h-4 text-slate-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Informasi Aplikasi Mobile
          </h3>
        </div>

        <Card className="!p-4 space-y-3 bg-white border-slate-200/80">
          <div className="flex items-start gap-3">
            <Smartphone className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 leading-relaxed">
              <strong className="text-slate-800 block mb-0.5 font-semibold">Tampilan Dioptimalkan untuk Mobile (Smartphone)</strong>
              Navigasi bawah telah disesuaikan menjadi 5 menu utama yang ringkas dan nyaman dioperasikan satu tangan.
            </div>
          </div>
          <div className="flex items-start gap-3 pt-2 border-t border-slate-100">
            <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 leading-relaxed">
              <strong className="text-slate-800 block mb-0.5 font-semibold">Sistem PRMS Sakae Riken Indonesia</strong>
              Versi sistem mendukung kamera smartphone untuk pemindaian QR Surat Jalan dan QR Item.
            </div>
          </div>
        </Card>
      </div>

      {/* Tombol Logout Akun */}
      <div className="pt-2">
        <form action={handleLogout}>
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar dari Akun Warehouse</span>
          </button>
        </form>
      </div>
    </div>
  );
}
