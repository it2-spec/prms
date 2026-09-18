import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { PageTitle } from "@/components/ui";
import { Plus, FileSpreadsheet, Search, Truck } from "lucide-react";
import PurchaseOrderTableClient from "./PurchaseOrderTableClient";

export const dynamic = "force-dynamic";

export default async function PurchaseOrderList({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    search?: string;
    status?: string;
    tab?: string;
    sort?: string;
    order?: string;
  }>;
}) {
  const { user } = await getSessionUser();
  if (!user || user.role !== "PURCHASING") redirect("/login");

  const params = await searchParams;
  const userApprovalLevel = user.approvalLevel || 0;

  // Pagination parameters
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const limit = [10, 25, 50, 100].includes(parseInt(params.limit || "25", 10))
    ? parseInt(params.limit || "25", 10)
    : 25;
  const skip = (page - 1) * limit;

  // Filter parameters
  const search = (params.search || "").trim();
  const statusFilter = params.status || "ALL";
  const defaultTab =
    userApprovalLevel === 1 ? "PENDING_L1" : userApprovalLevel === 2 ? "PENDING_L2" : "ALL";
  const approvalTab = params.tab || defaultTab;
  const sort = params.sort || "poDate";
  const order = params.order === "asc" ? "asc" : "desc";

  // Build whereClause
  const whereClause: any = {};

  // Role constraint (Presdir only sees approved by Manager)
  if (userApprovalLevel === 2) {
    whereClause.approvedById = { not: null };
  }

  // Approval Tab filter
  if (approvalTab === "PENDING_L1") {
    whereClause.approvedById = null;
    whereClause.status = { not: "CANCELLED" };
  } else if (approvalTab === "APPROVED_L1") {
    whereClause.approvedById = { not: null };
  } else if (approvalTab === "PENDING_L2") {
    whereClause.approvedById = { not: null };
    whereClause.approvedL2ById = null;
    whereClause.status = { not: "CANCELLED" };
  } else if (approvalTab === "APPROVED_L2") {
    whereClause.approvedL2ById = { not: null };
  }

  // Status Filter
  if (statusFilter !== "ALL") {
    if (statusFilter === "WAITING_GROUP") {
      whereClause.status = { in: ["WAITING_DELIVERY", "SENT", "DRAFT"] };
    } else if (statusFilter === "PROGRESS_GROUP") {
      whereClause.status = { in: ["PARTIALLY_DELIVERED", "WAITING_RECEIVING", "PARTIALLY_RECEIVED"] };
    } else if (statusFilter === "COMPLETED_GROUP") {
      whereClause.status = { in: ["RECEIVED", "CLOSED"] };
    } else {
      whereClause.status = statusFilter;
    }
  }

  // Search Filter (Case-insensitive multi-field search)
  if (search) {
    whereClause.OR = [
      { poNumber: { contains: search, mode: "insensitive" } },
      { supplier: { name: { contains: search, mode: "insensitive" } } },
      { supplier: { code: { contains: search, mode: "insensitive" } } },
      { warehouse: { name: { contains: search, mode: "insensitive" } } },
      { details: { some: { item: { name: { contains: search, mode: "insensitive" } } } } },
      { details: { some: { item: { code: { contains: search, mode: "insensitive" } } } } },
    ];
  }

  // Dynamic sorting mapping
  let orderBy: any = { poDate: order };
  if (sort === "poNumber") orderBy = { poNumber: order };
  else if (sort === "poDate") orderBy = { poDate: order };
  else if (sort === "supplier") orderBy = { supplier: { name: order } };
  else if (sort === "warehouse") orderBy = { warehouse: { name: order } };
  else if (sort === "status") orderBy = { status: order };
  else if (sort === "createdAt") orderBy = { createdAt: order };

  // Base where for KPI (role-scoped)
  const baseKpiWhere: any = {};
  if (userApprovalLevel === 2) {
    baseKpiWhere.approvedById = { not: null };
  }

  // Execute database queries in parallel
  const [
    filteredCount,
    pos,
    totalAllCount,
    waitingCount,
    progressCount,
    completedCount,
    pendingL1Count,
    approvedL1Count,
    pendingL2Count,
    approvedL2Count,
  ] = await Promise.all([
    prisma.purchaseOrder.count({ where: whereClause }),
    prisma.purchaseOrder.findMany({
      where: whereClause,
      orderBy: orderBy,
      take: limit,
      skip: skip,
      include: {
        supplier: true,
        warehouse: true,
        details: {
          include: { item: true },
        },
        deliveries: true,
        receivings: {
          include: {
            details: true,
          },
        },
      },
    }),
    prisma.purchaseOrder.count({ where: baseKpiWhere }),
    prisma.purchaseOrder.count({
      where: { ...baseKpiWhere, status: { in: ["WAITING_DELIVERY", "SENT", "DRAFT"] } },
    }),
    prisma.purchaseOrder.count({
      where: { ...baseKpiWhere, status: { in: ["PARTIALLY_DELIVERED", "WAITING_RECEIVING", "PARTIALLY_RECEIVED"] } },
    }),
    prisma.purchaseOrder.count({
      where: { ...baseKpiWhere, status: { in: ["RECEIVED", "CLOSED"] } },
    }),
    prisma.purchaseOrder.count({
      where: { approvedById: null, status: { not: "CANCELLED" } },
    }),
    prisma.purchaseOrder.count({
      where: { approvedById: { not: null } },
    }),
    prisma.purchaseOrder.count({
      where: { approvedById: { not: null }, approvedL2ById: null, status: { not: "CANCELLED" } },
    }),
    prisma.purchaseOrder.count({
      where: { approvedL2ById: { not: null } },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredCount / limit));

  // Hitung jumlah penerimaan secara dinamis dari tabel ReceivingDetail (Single Source of Truth)
  const computedPOs = pos.map((po) => {
    const receivedByItem = new Map<string, number>();
    for (const rec of po.receivings) {
      for (const rd of rec.details) {
        receivedByItem.set(rd.itemId, (receivedByItem.get(rd.itemId) || 0) + rd.qtyReceived);
      }
    }

    const computedDetails = po.details.map((d) => {
      const actualReceived = receivedByItem.get(d.itemId) || 0;
      return {
        id: d.id,
        qty: d.qty,
        deliveredQty: d.deliveredQty,
        receivedQty: actualReceived,
        unitPrice: Number(d.unitPrice),
        item: d.item
          ? {
              id: d.item.id,
              name: d.item.name,
              code: d.item.code,
              unit: d.item.unit,
              packageUnit: d.item.packageUnit,
              packageSize: d.item.packageSize ? Number(d.item.packageSize) : null,
            }
          : null,
      };
    });

    const totalReceived = computedDetails.reduce((s, d) => s + d.receivedQty, 0);

    let status = po.status;
    if (["PARTIALLY_RECEIVED", "RECEIVED"].includes(status) && totalReceived === 0) {
      status = "WAITING_DELIVERY";
    }

    return {
      id: po.id,
      poNumber: po.poNumber,
      revisionCount: po.revisionCount,
      poDate: po.poDate.toISOString(),
      status,
      notes: po.notes,
      approvedById: po.approvedById,
      approvedL2ById: po.approvedL2ById,
      supplier: {
        name: po.supplier.name,
        code: po.supplier.code,
      },
      warehouse: po.warehouse ? { name: po.warehouse.name, code: po.warehouse.code } : null,
      details: computedDetails,
      deliveriesCount: po.deliveries.length,
      receivingsCount: po.receivings.length,
    };
  });

  const pageTitle =
    userApprovalLevel === 2
      ? "Purchase Order Approvals (President Director)"
      : userApprovalLevel === 1
      ? "Purchase Order Approvals (Purchasing Manager)"
      : "Purchase Orders";

  const pageSubtitle =
    userApprovalLevel === 2
      ? "Review and authorize final approval (L2) for Purchase Orders verified by Purchasing Manager"
      : userApprovalLevel === 1
      ? "Review and authorize Manager approval (L1) for Purchase Orders submitted by Purchasing staff"
      : "Kelola dan monitor seluruh Purchase Order & progres penerimaan fisik";

  return (
    <div className="space-y-5">
      <PageTitle
        title={pageTitle}
        subtitle={pageSubtitle}
        breadcrumb={
          userApprovalLevel > 0
            ? ["Purchase Orders", "Approvals"]
            : ["Purchasing", "Purchase Orders"]
        }
        action={
          userApprovalLevel === 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/purchasing/deliveries/import"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition-colors"
              >
                <Truck className="w-3.5 h-3.5 text-slate-500" />
                Import Incoming
              </Link>
              <Link
                href="/purchasing/purchase-orders/reconcile"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200/80 rounded-xl shadow-xs transition-colors"
              >
                <Search className="w-3.5 h-3.5 text-indigo-600" />
                Rekonsiliasi & Input Incoming
              </Link>
              <Link
                href="/purchasing/purchase-orders/import"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
                Batch Import PO
              </Link>
              <Link
                href="/purchasing/purchase-orders/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Buat PO Baru
              </Link>
            </div>
          ) : undefined
        }
      />

      <Suspense
        fallback={
          <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mb-2"></div>
            <p className="text-xs font-medium">Memuat data Purchase Order...</p>
          </div>
        }
      >
        <PurchaseOrderTableClient
          initialPOs={computedPOs as any}
          userApprovalLevel={userApprovalLevel}
          pagination={{
            page,
            limit,
            totalCount: filteredCount,
            totalPages,
          }}
          kpis={{
            total: totalAllCount,
            waiting: waitingCount,
            inProgress: progressCount,
            completed: completedCount,
          }}
          tabCounts={{
            pendingL1: pendingL1Count,
            approvedL1: approvedL1Count,
            pendingL2: pendingL2Count,
            approvedL2: approvedL2Count,
          }}
          activeFilters={{
            search,
            status: statusFilter,
            tab: approvalTab,
            sort,
            order,
          }}
        />
      </Suspense>
    </div>
  );
}
