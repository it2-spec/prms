import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { PageTitle, Card } from "@/components/ui";
import { Laptop, Smartphone, Users, ShieldCheck } from "lucide-react";
import DeviceTableClient from "./DeviceTableClient";

export const dynamic = "force-dynamic";

export default async function DevicesPage() {
  const { user } = await getSessionUser();
  if (!user || user.role !== "PURCHASING") redirect("/login");

  // Manager L1 & Presdir L2 dibatasi hanya PO
  if (user.approvalLevel === 1 || user.approvalLevel === 2) {
    redirect("/purchasing/purchase-orders");
  }

  const [devices, totalUsersWithDevices] = await Promise.all([
    prisma.pushSubscription.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            approvalLevel: true,
            role: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.pushSubscription.groupBy({
      by: ["userId"],
    }),
  ]);

  const serializedDevices = devices.map((d) => ({
    id: d.id,
    endpoint: d.endpoint,
    deviceName: d.deviceName,
    userAgent: d.userAgent,
    createdAt: d.createdAt.toISOString(),
    user: d.user,
  }));

  return (
    <div className="space-y-6">
      <PageTitle
        title="Pengaturan Perangkat Terdaftar"
        subtitle="Daftar browser dan perangkat pengguna yang terhubung untuk menerima Web Push Notifications secara real-time"
        breadcrumb={["Purchasing", "Perangkat Terdaftar"]}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <Laptop className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Total Perangkat Aktif</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{devices.length}</p>
          </div>
        </Card>

        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Pengguna Terhubung</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{totalUsersWithDevices.length}</p>
          </div>
        </Card>

        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Protokol Web Push</p>
            <p className="text-sm font-bold text-emerald-700 mt-0.5">VAPID &amp; Service Worker</p>
          </div>
        </Card>
      </div>

      {/* Device List Client */}
      <DeviceTableClient initialDevices={serializedDevices} />
    </div>
  );
}
