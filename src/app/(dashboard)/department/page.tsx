import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { Card, Badge, PageTitle } from "@/components/ui";
import { normalizeDepartment } from "@/lib/utils";
import {
  FileText,
  Clock,
  ShoppingBag,
  CheckCircle2,
  Plus,
  Flame,
  AlertCircle,
  FileCheck,
} from "lucide-react";
import {
  DepartmentCharts,
  MonthlyPrData,
  FunnelStageData,
  DeptShareData,
  ActivePrItemTracking,
} from "@/components/department/DepartmentCharts";

export const dynamic = "force-dynamic";

export default async function DepartmentDashboard() {
  const { user, dbUser } = await getSessionUser();
  const allowedRoles = ["ADMIN_PRODUKSI", "ADMIN_INDIRECT", "DEPT_APPROVER", "PURCHASING"];
  if (!user || !allowedRoles.includes(user.role)) redirect("/login");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Inisialisasi jendela 6 bulan terakhir
  const months: MonthlyPrData[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthName = d.toLocaleDateString("id-ID", { month: "short" });
    const label = `${monthName} ${String(d.getFullYear()).slice(-2)}`;
    months.push({
      key,
      label,
      totalPrs: 0,
      completedPrs: 0,
      inProgressPrs: 0,
      pendingPrs: 0,
      totalItems: 0,
    });
  }
  const monthMap = new Map(months.map((m) => [m.key, m]));

  // Role scoping logic
  const userDepts =
    dbUser?.departments && dbUser.departments.length > 0
      ? dbUser.departments
      : user.departments && user.departments.length > 0
      ? user.departments
      : [];

  const where: any = {};
  if (user.role === "ADMIN_PRODUKSI" || user.role === "ADMIN_INDIRECT") {
    where.OR = [
      { requestedById: user.id },
      ...(userDepts.length > 0 ? [{ department: { in: userDepts } }] : []),
    ];
  } else if (user.role === "DEPT_APPROVER") {
    if (userDepts.length > 0) {
      where.department = { in: userDepts };
    }
  }

  // Fetch seluruh PR sesuai scope departemen
  const allPrs = await prisma.purchaseRequest.findMany({
    where,
    include: {
      requestedBy: { select: { id: true, name: true, username: true } },
      supplier: { select: { id: true, name: true } },
      purchaseOrders: { select: { id: true, poNumber: true, status: true } },
      details: {
        include: {
          item: { select: { id: true, code: true, name: true, unit: true } },
          poDetails: {
            include: {
              purchaseOrder: {
                select: {
                  id: true,
                  poNumber: true,
                  status: true,
                  supplier: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { requestDate: "desc" },
  });

  // Agregasi Alur Funnel 5 Tahapan
  let stage1Count = 0; // Draft & Pending Approval
  let stage1Items = 0;
  let stage2Count = 0; // Approved (Siap PO)
  let stage2Items = 0;
  let stage3Count = 0; // Ordered & Partial PO
  let stage3Items = 0;
  let stage4Count = 0; // Partial Received
  let stage4Items = 0;
  let stage5Count = 0; // Completed
  let stage5Items = 0;

  let urgentCount = 0;
  const deptCountMap = new Map<string, { count: number; itemCount: number }>();
  const activeTrackingList: ActivePrItemTracking[] = [];

  for (const pr of allPrs) {
    const prItemsCount = pr.details.length;
    const normDept = normalizeDepartment(pr.department);

    // Hitung per departemen
    const dStat = deptCountMap.get(normDept) || { count: 0, itemCount: 0 };
    dStat.count += 1;
    dStat.itemCount += prItemsCount;
    deptCountMap.set(normDept, dStat);

    if (pr.urgency === "URGENT") {
      urgentCount++;
    }

    // 1. Agregasi Tahap Funnel
    if (pr.status === "DRAFT" || pr.status === "PENDING_APPROVAL") {
      stage1Count++;
      stage1Items += prItemsCount;
    } else if (pr.status === "APPROVED") {
      stage2Count++;
      stage2Items += prItemsCount;
    } else if (
      pr.status === "PARTIAL_PO" ||
      pr.status === "ORDERED" ||
      pr.status === "CONVERTED"
    ) {
      stage3Count++;
      stage3Items += prItemsCount;
    } else if (pr.status === "PARTIAL_RECEIVED") {
      stage4Count++;
      stage4Items += prItemsCount;
    } else if (pr.status === "COMPLETED") {
      stage5Count++;
      stage5Items += prItemsCount;
    }

    // 2. Agregasi Bulanan
    const prD = new Date(pr.requestDate);
    const prMonthKey = `${prD.getFullYear()}-${String(prD.getMonth() + 1).padStart(2, "0")}`;
    const mData = monthMap.get(prMonthKey);
    if (mData) {
      mData.totalPrs += 1;
      mData.totalItems += prItemsCount;
      if (pr.status === "COMPLETED") {
        mData.completedPrs += 1;
      } else if (
        pr.status === "ORDERED" ||
        pr.status === "PARTIAL_PO" ||
        pr.status === "PARTIAL_RECEIVED" ||
        pr.status === "APPROVED"
      ) {
        mData.inProgressPrs += 1;
      } else {
        mData.pendingPrs += 1;
      }
    }

    // 3. Item Tracking Aktif (Yang sedang ditunggu kedatangannya)
    if (
      (pr.status === "ORDERED" ||
        pr.status === "PARTIAL_PO" ||
        pr.status === "PARTIAL_RECEIVED") &&
      activeTrackingList.length < 8
    ) {
      for (const d of pr.details) {
        if (d.status === "RECEIVED") continue; // Abaikan yang sudah tiba lengkap

        const relatedPo = d.poDetails?.[0]?.purchaseOrder || pr.purchaseOrders?.[0];
        activeTrackingList.push({
          id: d.id,
          prNumber: pr.prNumber,
          department: normDept,
          itemName: d.item?.name || d.customItemName || "Item Permintaan",
          qty: d.qty,
          unit: d.unit || d.item?.unit || "Pcs",
          urgency: pr.urgency,
          status: d.status || pr.status,
          poNumber: relatedPo?.poNumber || null,
          supplierName:
            d.poDetails?.[0]?.purchaseOrder?.supplier?.name || pr.supplier?.name || null,
        });

        if (activeTrackingList.length >= 8) break;
      }
    }
  }

  const funnelStages: FunnelStageData[] = [
    {
      stage: "STAGE_1",
      label: "Pengajuan & Approval",
      count: stage1Count,
      itemCount: stage1Items,
      color: "#f59e0b",
      bgColor: "bg-amber-50/50",
      borderColor: "border-amber-200",
      textColor: "text-amber-700",
      description: "Draft baru atau menunggu persetujuan SPV/Manager",
    },
    {
      stage: "STAGE_2",
      label: "Disetujui Dept",
      count: stage2Count,
      itemCount: stage2Items,
      color: "#3b82f6",
      bgColor: "bg-blue-50/50",
      borderColor: "border-blue-200",
      textColor: "text-blue-700",
      description: "Sudah di-approve internal, siap diterbitkan PO",
    },
    {
      stage: "STAGE_3",
      label: "PO Diterbitkan",
      count: stage3Count,
      itemCount: stage3Items,
      color: "#8b5cf6",
      bgColor: "bg-purple-50/50",
      borderColor: "border-purple-200",
      textColor: "text-purple-700",
      description: "Purchasing telah menerbitkan PO ke supplier",
    },
    {
      stage: "STAGE_4",
      label: "Diterima Sebagian",
      count: stage4Count,
      itemCount: stage4Items,
      color: "#06b6d4",
      bgColor: "bg-cyan-50/50",
      borderColor: "border-cyan-200",
      textColor: "text-cyan-700",
      description: "Pengiriman bertahap mulai tiba di dock gudang",
    },
    {
      stage: "STAGE_5",
      label: "Selesai (Barang Tiba)",
      count: stage5Count,
      itemCount: stage5Items,
      color: "#10b981",
      bgColor: "bg-emerald-50/50",
      borderColor: "border-emerald-200",
      textColor: "text-emerald-700",
      description: "Barang lengkap 100% dan siap digunakan produksi",
    },
  ];

  // Donut Dept Shares
  const deptPalette = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#06b6d4", "#64748b"];
  const totalAllPrCount = allPrs.length;
  const deptShares: DeptShareData[] = Array.from(deptCountMap.entries()).map(
    ([dept, val], idx) => ({
      department: dept,
      count: val.count,
      itemCount: val.itemCount,
      sharePercent: totalAllPrCount > 0 ? (val.count / totalAllPrCount) * 100 : 0,
      color: deptPalette[idx % deptPalette.length],
    })
  );

  const completionRate =
    totalAllPrCount > 0 ? Math.round((stage5Count / totalAllPrCount) * 100) : 0;
  const inProcessCount = stage2Count + stage3Count + stage4Count;

  const stats = [
    {
      label: "Total Permintaan",
      value: `${totalAllPrCount} PR`,
      icon: FileText,
      color: "text-blue-600 bg-blue-50",
      href: "/purchasing/purchase-requests",
    },
    {
      label: "Menunggu Approval",
      value: `${stage1Count} PR`,
      icon: Clock,
      color: "text-amber-600 bg-amber-50",
      href: "/purchasing/purchase-requests?status=PENDING_APPROVAL",
    },
    {
      label: "Proses PO & Kirim",
      value: `${inProcessCount} PR`,
      icon: ShoppingBag,
      color: "text-purple-600 bg-purple-50",
      href: "/purchasing/purchase-requests?status=ORDERED,PARTIAL_PO,PARTIAL_RECEIVED",
    },
    {
      label: "Selesai Diterima",
      value: `${stage5Count} PR (${completionRate}%)`,
      icon: CheckCircle2,
      color: "text-emerald-600 bg-emerald-50",
      href: "/purchasing/purchase-requests?status=COMPLETED",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <PageTitle
          title="Dashboard Departemen Pemohon / Produksi"
          subtitle="Monitoring status permintaan barang (PR) dari pengajuan hingga barang tiba"
          breadcrumb={["Dashboard"]}
        />

        <div className="flex items-center gap-2">
          {user.role !== "DEPT_APPROVER" && (
            <Link
              href="/purchasing/purchase-requests/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Buat Request (PR) Baru
            </Link>
          )}
        </div>
      </div>

      {/* KPI Cards Ringkasan */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="group">
            <Card bodyClassName="!p-5 group-hover:border-slate-300 transition-all">
              <div className="flex items-center gap-4">
                <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${s.color}`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xl font-extrabold text-slate-800">{s.value}</div>
                  <div className="truncate text-xs text-slate-500">{s.label}</div>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Grafik Analitik Lifecycle PR & Tracking */}
      <DepartmentCharts
        monthlyPrs={months}
        funnelStages={funnelStages}
        deptShares={deptShares}
        activeTrackingItems={activeTrackingList}
        summary={{
          totalPrCount: totalAllPrCount,
          pendingApprovalCount: stage1Count,
          approvedReadyPoCount: stage2Count,
          orderedCount: stage3Count,
          completedCount: stage5Count,
          completionRate,
          urgentCount,
        }}
      />
    </div>
  );
}
