import { redirect } from "next/navigation";
import { getSessionUser, destroySession } from "@/lib/auth";
import DashboardShell from "@/components/DashboardShell";
import BottomNavigation from "@/components/BottomNavigation";

export const dynamic = "force-dynamic";

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

const NAV: Record<string, NavItem[]> = {
  PURCHASING: [
    { href: "/purchasing", label: "Dashboard", icon: "stroke-home" },
    { href: "/purchasing/purchase-orders", label: "Purchase Orders", icon: "stroke-file" },
    { href: "/purchasing/deliveries", label: "Deliveries", icon: "stroke-progress-delivery" },
    { href: "/purchasing/receivings", label: "Receivings", icon: "stroke-package" },
    { href: "/purchasing/stock", label: "Stok Material", icon: "stroke-table" },
    { href: "/purchasing/outgoing", label: "Outgoing Material", icon: "stroke-delivered" },
    { href: "/purchasing/items", label: "Master Item", icon: "stroke-table" },
    { href: "/purchasing/suppliers", label: "Master Supplier", icon: "stroke-user" },
    { href: "/purchasing/warehouses", label: "Master Warehouse", icon: "stroke-widget" },
    { href: "/purchasing/reports", label: "Laporan", icon: "stroke-reports" },
    { href: "/purchasing/audit", label: "Audit Log", icon: "stroke-activity" },
    { href: "/purchasing/users", label: "Account Management", icon: "stroke-user" },
    { href: "/purchasing/devices", label: "Perangkat Terdaftar", icon: "stroke-device" },
  ],
  WAREHOUSE: [
    { href: "/warehouse", label: "Dashboard", icon: "stroke-home" },
    { href: "/warehouse/scan", label: "Scan QR (Incoming)", icon: "stroke-search" },
    { href: "/warehouse/outgoing", label: "Outgoing Material", icon: "stroke-progress-delivery" },
    { href: "/warehouse/manual", label: "Manual Receiving", icon: "stroke-form" },
    { href: "/warehouse/history", label: "Riwayat Transaksi", icon: "stroke-delivered" },
    { href: "/warehouse/stock", label: "Stok Material", icon: "stroke-package" },
  ],
  SUPPLIER: [
    { href: "/supplier", label: "Dashboard", icon: "stroke-home" },
    { href: "/supplier/purchase-orders", label: "Purchase Orders", icon: "stroke-file" },
    { href: "/supplier/deliveries", label: "Delivery", icon: "stroke-progress-delivery" },
  ],
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getSessionUser();
  if (!user) redirect("/login");

  const role = user.role as keyof typeof NAV;
  let items = NAV[role] ?? [];
  const isApprover = user.approvalLevel === 1 || user.approvalLevel === 2;

  // Presdir L2 dan Manager L1 hanya melihat menu Purchase Orders
  if (isApprover) {
    items = [
      { href: "/purchasing/purchase-orders", label: "Purchase Orders", icon: "stroke-file" },
    ];
  }

  const roleLabel =
    role === "WAREHOUSE"
      ? "Warehouse"
      : role === "SUPPLIER"
      ? "Supplier"
      : user.approvalLevel === 2
      ? "President Director"
      : user.approvalLevel === 1
      ? "Purchasing Manager"
      : "Purchasing";


  async function logout() {
    "use server";
    await destroySession();
    redirect("/login?msg=logout");
  }

  return (
    <DashboardShell
      user={{ name: user.name ?? "", username: user.username, role: user.role, approvalLevel: user.approvalLevel }}
      roleLabel={roleLabel}
      items={items}
      logoutAction={logout}
    >
      {children}
      {role === "WAREHOUSE" && <BottomNavigation items={items} />}
    </DashboardShell>
  );
}
