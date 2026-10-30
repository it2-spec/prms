import { prisma } from "@/lib/prisma";
import { sendPushToUser, sendPushToUsers } from "@/lib/webpush";

export type NotificationType =
  | "NEW_PO"
  | "PO_APPROVED_L1"
  | "PO_APPROVED_L2"
  | "PO_SENT"
  | "PO_ACCEPTED_SUPPLIER"
  | "PO_CANCELLED"
  | "PR_PENDING_APPROVAL"
  | "PR_APPROVED"
  | "PR_REJECTED"
  | "PR_PARTIAL_PO"
  | "PR_ORDERED"
  | "PR_PARTIAL_RECEIVED"
  | "PR_COMPLETED"
  | "INFO";

interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  link?: string;
}

/**
 * Buat notifikasi individual untuk user tertentu (In-App + Web Push)
 */
export async function createNotification(params: CreateNotificationParams) {
  try {
    const notif = await prisma.notification.create({
      data: {
        userId: params.userId,
        title: params.title,
        message: params.message,
        type: params.type || "INFO",
        link: params.link,
      },
    });

    // Kirim Web Push ke perangkat user
    sendPushToUser(params.userId, {
      title: params.title,
      body: params.message,
      url: params.link || "/",
    }).catch(() => {});

    return notif;
  } catch (err) {
    console.error("[createNotification] Failed to create notification:", err);
    return null;
  }
}

/**
 * Kirim notifikasi ke seluruh Manager Purchasing (approvalLevel === 1) saat ada PO baru dibuat
 */
export async function notifyNewPo(params: {
  poId: string;
  poNumber: string;
  supplierName?: string;
  creatorName?: string;
}) {
  try {
    const managers = await prisma.user.findMany({
      where: {
        approvalLevel: 1,
        isActive: true,
      },
      select: { id: true, name: true },
    });

    if (managers.length === 0) return;

    const supplierText = params.supplierName ? ` (${params.supplierName})` : "";
    const title = "New Purchase Order Awaiting Approval";
    const message = `PO ${params.poNumber}${supplierText} was created and requires your review.`;
    const link = `/purchasing/purchase-orders/${params.poId}`;

    const notifications = managers.map((manager) => ({
      userId: manager.id,
      title,
      message,
      type: "NEW_PO" as NotificationType,
      link,
    }));

    await prisma.notification.createMany({
      data: notifications,
    });

    // Web Push ke seluruh manager
    sendPushToUsers(
      managers.map((m) => m.id),
      {
        title,
        body: message,
        url: link,
      }
    ).catch(() => {});
  } catch (err) {
    console.error("[notifyNewPo] Error notifying managers:", err);
  }
}

/**
 * Kirim notifikasi ke seluruh Manager Purchasing (approvalLevel === 1) saat import batch PO
 */
export async function notifyBatchPoImported(params: {
  count: number;
  poNumbers: string[];
  creatorName?: string;
}) {
  try {
    const managers = await prisma.user.findMany({
      where: {
        approvalLevel: 1,
        isActive: true,
      },
      select: { id: true },
    });

    if (managers.length === 0 || params.count === 0) return;

    const preview = params.poNumbers.slice(0, 3).join(", ") + (params.poNumbers.length > 3 ? "..." : "");
    const title = `${params.count} New Purchase Orders Imported`;
    const message = `${params.count} POs (${preview}) were imported and require your review.`;
    const link = `/purchasing/purchase-orders?tab=PENDING_L1`;

    const notifications = managers.map((manager) => ({
      userId: manager.id,
      title,
      message,
      type: "NEW_PO" as NotificationType,
      link,
    }));

    await prisma.notification.createMany({
      data: notifications,
    });

    sendPushToUsers(
      managers.map((m) => m.id),
      {
        title,
        body: message,
        url: link,
      }
    ).catch(() => {});
  } catch (err) {
    console.error("[notifyBatchPoImported] Error notifying managers:", err);
  }
}

/**
 * Kirim notifikasi ke President Director (approvalLevel === 2) saat PO telah di-approve oleh Manager L1
 */
export async function notifyPoApprovedL1(params: {
  poId: string;
  poNumber: string;
  approverName?: string;
}) {
  try {
    const presdirs = await prisma.user.findMany({
      where: {
        approvalLevel: 2,
        isActive: true,
      },
      select: { id: true },
    });

    if (presdirs.length === 0) return;

    const approverText = params.approverName ? ` by ${params.approverName}` : " by Purchasing Manager";
    const title = "PO Approved by Manager (L1)";
    const message = `PO ${params.poNumber} has been approved${approverText} and is ready for your signature.`;
    const link = `/purchasing/purchase-orders/${params.poId}`;

    const notifications = presdirs.map((presdir) => ({
      userId: presdir.id,
      title,
      message,
      type: "PO_APPROVED_L1" as NotificationType,
      link,
    }));

    await prisma.notification.createMany({
      data: notifications,
    });

    sendPushToUsers(
      presdirs.map((p) => p.id),
      {
        title,
        body: message,
        url: link,
      }
    ).catch(() => {});
  } catch (err) {
    console.error("[notifyPoApprovedL1] Error notifying presdir:", err);
  }
}

/**
 * Kirim notifikasi ke President Director (approvalLevel === 2) saat sejumlah PO di-approve L1 sekaligus (Batch Approval)
 */
export async function notifyBatchPoApprovedL1(params: {
  count: number;
  poNumbers: string[];
  approverName?: string;
}) {
  try {
    const presdirs = await prisma.user.findMany({
      where: {
        approvalLevel: 2,
        isActive: true,
      },
      select: { id: true },
    });

    if (presdirs.length === 0 || params.count === 0) return;

    const preview = params.poNumbers.slice(0, 3).join(", ") + (params.poNumbers.length > 3 ? "..." : "");
    const approverText = params.approverName ? ` by ${params.approverName}` : " by Purchasing Manager";
    const title = `${params.count} POs Approved by Manager (L1)`;
    const message = `${params.count} POs (${preview}) have been approved${approverText} and are awaiting your signature.`;
    const link = `/purchasing/purchase-orders?tab=PENDING_L2`;

    const notifications = presdirs.map((presdir) => ({
      userId: presdir.id,
      title,
      message,
      type: "PO_APPROVED_L1" as NotificationType,
      link,
    }));

    await prisma.notification.createMany({
      data: notifications,
    });

    sendPushToUsers(
      presdirs.map((p) => p.id),
      {
        title,
        body: message,
        url: link,
      }
    ).catch(() => {});
  } catch (err) {
    console.error("[notifyBatchPoApprovedL1] Error notifying presdir:", err);
  }
}

/**
 * Kirim notifikasi ke Staff Purchasing (approvalLevel === 0) saat PO selesai ditandatangani Presdir L2
 * (L1 Manager dan L2 Presdir TIDAK menerima notifikasi ini agar tidak terganggu)
 */
export async function notifyPoApprovedL2(params: {
  poId: string;
  poNumber: string;
  createdById?: string | null;
  presdirName?: string;
}) {
  try {
    const targetUserIds = new Set<string>();

    // Hanya tambahkan pembuat PO jika pembuat PO adalah staff purchasing biasa (bukan approver L1/L2)
    if (params.createdById) {
      const creator = await prisma.user.findUnique({
        where: { id: params.createdById },
        select: { id: true, approvalLevel: true },
      });
      if (creator && (creator.approvalLevel ?? 0) === 0) {
        targetUserIds.add(creator.id);
      }
    }

    // Ambil semua staff purchasing biasa (approvalLevel === 0)
    const purchasingStaff = await prisma.user.findMany({
      where: {
        role: { name: "PURCHASING" },
        approvalLevel: 0,
        isActive: true,
      },
      select: { id: true },
    });
    purchasingStaff.forEach((s) => targetUserIds.add(s.id));

    const uids = Array.from(targetUserIds);
    if (uids.length === 0) return;

    const presdirText = params.presdirName ? ` oleh ${params.presdirName}` : " oleh Presdir";
    const title = "PO Selesai Disetujui Presdir (L2)";
    const message = `PO ${params.poNumber} telah ditandatangani${presdirText}. PO siap dikirim ke Supplier.`;
    const link = `/purchasing/purchase-orders/${params.poId}`;

    const notifications = uids.map((userId) => ({
      userId,
      title,
      message,
      type: "PO_APPROVED_L2" as NotificationType,
      link,
    }));

    await prisma.notification.createMany({
      data: notifications,
    });

    sendPushToUsers(uids, {
      title,
      body: message,
      url: link,
    }).catch(() => {});
  } catch (err) {
    console.error("[notifyPoApprovedL2] Error notifying purchasing staff:", err);
  }
}

/**
 * Kirim notifikasi ke Staff Purchasing (approvalLevel === 0) saat sejumlah PO disetujui Presdir L2 sekaligus
 */
export async function notifyBatchPoApprovedL2(params: {
  count: number;
  poNumbers: string[];
  createdByIds?: string[];
  presdirName?: string;
}) {
  try {
    const targetUserIds = new Set<string>();

    // Ambil semua staff purchasing biasa (approvalLevel === 0)
    const purchasingStaff = await prisma.user.findMany({
      where: {
        role: { name: "PURCHASING" },
        approvalLevel: 0,
        isActive: true,
      },
      select: { id: true },
    });
    purchasingStaff.forEach((s) => targetUserIds.add(s.id));

    const uids = Array.from(targetUserIds);
    if (uids.length === 0 || params.count === 0) return;

    const preview = params.poNumbers.slice(0, 3).join(", ") + (params.poNumbers.length > 3 ? "..." : "");
    const title = `${params.count} PO Disetujui Presdir (L2)`;
    const message = `${params.count} PO (${preview}) telah ditandatangani Presdir. Silakan kirimkan ke Supplier.`;
    const link = `/purchasing/purchase-orders?tab=WAITING_GROUP`;

    const notifications = uids.map((userId) => ({
      userId,
      title,
      message,
      type: "PO_APPROVED_L2" as NotificationType,
      link,
    }));

    await prisma.notification.createMany({
      data: notifications,
    });

    sendPushToUsers(uids, {
      title,
      body: message,
      url: link,
    }).catch(() => {});
  } catch (err) {
    console.error("[notifyBatchPoApprovedL2] Error notifying purchasing staff:", err);
  }
}

/**
 * Kirim notifikasi ke Supplier saat Purchasing mengirimkan PO (Sent PO)
 * Link langsung membuka halaman detail PO terkait agar supplier dapat langsung meninjau & TTD
 */
export async function notifyPoSentToSupplier(params: {
  poId: string;
  poNumber: string;
  supplierId: string;
}) {
  try {
    // Cari semua akun user milik supplier terkait
    const supplierUsers = await prisma.user.findMany({
      where: {
        supplierId: params.supplierId,
        isActive: true,
      },
      select: { id: true },
    });

    if (supplierUsers.length === 0) return;

    const title = `Pesanan Baru: PO ${params.poNumber} Perlu Diproses`;
    const message = `PO ${params.poNumber} telah dikirim oleh Purchasing. Silakan tinjau pesanan dan lakukan konfirmasi/tanda tangan.`;
    const link = `/supplier/purchase-orders/${params.poId}`;

    const notifications = supplierUsers.map((u) => ({
      userId: u.id,
      title,
      message,
      type: "PO_SENT" as NotificationType,
      link,
    }));

    await prisma.notification.createMany({
      data: notifications,
    });

    sendPushToUsers(
      supplierUsers.map((u) => u.id),
      {
        title,
        body: message,
        url: link,
      }
    ).catch(() => {});
  } catch (err) {
    console.error("[notifyPoSentToSupplier] Error notifying supplier:", err);
  }
}

/**
 * Kirim notifikasi ke Staff Purchasing (approvalLevel === 0) saat Supplier menerima & menandatangani PO
 * (L1 Manager dan L2 Presdir TIDAK menerima notifikasi ini)
 */
export async function notifySupplierAcceptedPo(params: {
  poId: string;
  poNumber: string;
  supplierName: string;
  signerName?: string;
  createdById?: string | null;
}) {
  try {
    const targetUserIds = new Set<string>();
    if (params.createdById) {
      const creator = await prisma.user.findUnique({
        where: { id: params.createdById },
        select: { id: true, approvalLevel: true },
      });
      if (creator && (creator.approvalLevel ?? 0) === 0) {
        targetUserIds.add(creator.id);
      }
    }

    // Hanya staf purchasing operasional (approvalLevel === 0)
    const purchasingStaff = await prisma.user.findMany({
      where: {
        role: { name: "PURCHASING" },
        approvalLevel: 0,
        isActive: true,
      },
      select: { id: true },
    });
    purchasingStaff.forEach((s) => targetUserIds.add(s.id));

    const uids = Array.from(targetUserIds);
    if (uids.length === 0) return;

    const signerText = params.signerName ? ` (${params.signerName})` : "";
    const title = "PO Diterima & Ditandatangani Supplier";
    const message = `Supplier ${params.supplierName}${signerText} telah menerima dan menandatangani PO ${params.poNumber}. Siap untuk dicetak/PDF.`;
    const link = `/purchasing/purchase-orders/${params.poId}`;

    const notifications = uids.map((userId) => ({
      userId,
      title,
      message,
      type: "PO_ACCEPTED_SUPPLIER" as NotificationType,
      link,
    }));

    await prisma.notification.createMany({
      data: notifications,
    });

    sendPushToUsers(uids, {
      title,
      body: message,
      url: link,
    }).catch(() => {});
  } catch (err) {
    console.error("[notifySupplierAcceptedPo] Error notifying purchasing staff:", err);
  }
}

/**
 * Kirim notifikasi ke Supplier saat PO dibatalkan oleh Purchasing / Approver
 */
export async function notifyPoCancelledToSupplier(params: {
  poId: string;
  poNumber: string;
  supplierId: string;
  cancelledByName?: string;
  reason?: string;
}) {
  try {
    const supplierUsers = await prisma.user.findMany({
      where: {
        supplierId: params.supplierId,
        isActive: true,
      },
      select: { id: true },
    });

    if (supplierUsers.length === 0) return;

    const reasonText = params.reason ? ` Alasan: "${params.reason}".` : "";
    const title = `PO ${params.poNumber} Dibatalkan`;
    const message = `Purchase Order ${params.poNumber} telah dibatalkan oleh Purchasing.${reasonText} Mohon untuk tidak memproses pesanan atau pengiriman untuk PO ini.`;
    const link = `/supplier/purchase-orders/${params.poId}`;

    const notifications = supplierUsers.map((u) => ({
      userId: u.id,
      title,
      message,
      type: "PO_CANCELLED" as NotificationType,
      link,
    }));

    await prisma.notification.createMany({
      data: notifications,
    });

    sendPushToUsers(
      supplierUsers.map((u) => u.id),
      {
        title,
        body: message,
        url: link,
      }
    ).catch(() => {});
  } catch (err) {
    console.error("[notifyPoCancelledToSupplier] Error notifying supplier:", err);
  }
}

/**
 * Kirim notifikasi saat PR baru diajukan (PENDING_APPROVAL) ke Supervisor Departemen terkait.
 * Sesuai aturan bisnis, HANYA supervisor departemen yang berwenang menyetujui PR ini.
 */
export async function notifyPrSubmitted(params: {
  prId: string;
  prNumber: string;
  department: string;
  requesterName: string;
}) {
  try {
    const link = `/purchasing/purchase-requests/${params.prId}`;

    // Supervisor yang bertanggung jawab khusus atas departemen PR ini
    const approvers = await prisma.user.findMany({
      where: {
        role: { name: "DEPT_APPROVER" },
        departments: { has: params.department },
        isActive: true,
      },
      select: { id: true, name: true, departments: true },
    });

    const relevantApproverIds = approvers.map((a) => a.id);

    const title = `PR Baru Menunggu Persetujuan (${params.department})`;
    const message = `PR ${params.prNumber} diajukan oleh ${params.requesterName} dan membutuhkan persetujuan Anda sebagai Supervisor ${params.department}.`;

    if (relevantApproverIds.length > 0) {
      const notifs = relevantApproverIds.map((userId) => ({
        userId,
        title,
        message,
        type: "PR_PENDING_APPROVAL" as NotificationType,
        link,
      }));

      await prisma.notification.createMany({ data: notifs });
      sendPushToUsers(relevantApproverIds, { title, body: message, url: link }).catch(() => {});
    }
  } catch (err) {
    console.error("[notifyPrSubmitted] Error:", err);
  }
}

/**
 * Kirim notifikasi saat PR disetujui Head Dept ke Pemohon (Admin Produksi/Indirect) & Tim Purchasing
 */
export async function notifyPrApproved(params: {
  prId: string;
  prNumber: string;
  department: string;
  approverName: string;
  requesterId: string;
}) {
  try {
    const link = `/purchasing/purchase-requests/${params.prId}`;

    // 1. Notifikasi ke pemohon & admin departemen yang sama
    const deptAdmins = await prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { id: params.requesterId },
          {
            departments: { has: params.department },
            role: { name: { in: ["ADMIN_PRODUKSI", "ADMIN_INDIRECT"] } },
          },
        ],
      },
      select: { id: true },
    });

    const targetUserIds = Array.from(new Set(deptAdmins.map((u) => u.id).concat(params.requesterId)));

    const reqTitle = `PR ${params.prNumber} Disetujui Head Dept`;
    const reqMsg = `Purchase Request ${params.prNumber} (${params.department}) telah disetujui oleh ${params.approverName} dan siap diproses Purchasing.`;

    if (targetUserIds.length > 0) {
      await prisma.notification.createMany({
        data: targetUserIds.map((userId) => ({
          userId,
          title: reqTitle,
          message: reqMsg,
          type: "PR_APPROVED" as NotificationType,
          link,
        })),
      });
      sendPushToUsers(targetUserIds, { title: reqTitle, body: reqMsg, url: link }).catch(() => {});
    }

    // 2. Notifikasi ke tim Purchasing (staff operasional) untuk diproses ke PO
    const purchasingUsers = await prisma.user.findMany({
      where: {
        role: { name: "PURCHASING" },
        approvalLevel: 0,
        isActive: true,
      },
      select: { id: true },
    });

    if (purchasingUsers.length > 0) {
      const pTitle = `PR Siap Dibuatkan PO`;
      const pMsg = `PR ${params.prNumber} (${params.department}) telah disetujui Head Dept dan siap diterbitkan Purchase Order.`;
      const pUids = purchasingUsers.map((u) => u.id);

      await prisma.notification.createMany({
        data: pUids.map((userId) => ({
          userId,
          title: pTitle,
          message: pMsg,
          type: "PR_APPROVED" as NotificationType,
          link,
        })),
      });
      sendPushToUsers(pUids, { title: pTitle, body: pMsg, url: link }).catch(() => {});
    }
  } catch (err) {
    console.error("[notifyPrApproved] Error:", err);
  }
}

/**
 * Kirim notifikasi saat PR ditolak Head Dept ke Pemohon (Admin Produksi/Indirect)
 */
export async function notifyPrRejected(params: {
  prId: string;
  prNumber: string;
  department: string;
  rejectorName: string;
  requesterId: string;
  reason: string;
}) {
  try {
    const link = `/purchasing/purchase-requests/${params.prId}`;

    const deptAdmins = await prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { id: params.requesterId },
          {
            departments: { has: params.department },
            role: { name: { in: ["ADMIN_PRODUKSI", "ADMIN_INDIRECT"] } },
          },
        ],
      },
      select: { id: true },
    });

    const targetUserIds = Array.from(new Set(deptAdmins.map((u) => u.id).concat(params.requesterId)));

    const title = `PR ${params.prNumber} Ditolak`;
    const message = `Purchase Request ${params.prNumber} (${params.department}) ditolak oleh ${params.rejectorName}. Alasan: "${params.reason}".`;

    if (targetUserIds.length > 0) {
      await prisma.notification.createMany({
        data: targetUserIds.map((userId) => ({
          userId,
          title,
          message,
          type: "PR_REJECTED" as NotificationType,
          link,
        })),
      });
      sendPushToUsers(targetUserIds, { title, body: message, url: link }).catch(() => {});
    }
  } catch (err) {
    console.error("[notifyPrRejected] Error:", err);
  }
}

/**
 * Kirim notifikasi saat PO diterbitkan untuk PR ke Pemohon (Admin Produksi/Indirect)
 */
export async function notifyPrPoCreated(params: {
  prId: string;
  prNumber: string;
  poNumber: string;
  isPartial: boolean;
  requesterId: string;
  department?: string;
}) {
  try {
    const link = `/purchasing/purchase-requests/${params.prId}`;

    const whereOr: any[] = [{ id: params.requesterId }];
    if (params.department) {
      whereOr.push({
        departments: { has: params.department },
        role: { name: { in: ["ADMIN_PRODUKSI", "ADMIN_INDIRECT"] } },
      });
    }

    const deptAdmins = await prisma.user.findMany({
      where: {
        isActive: true,
        OR: whereOr,
      },
      select: { id: true },
    });

    const targetUserIds = Array.from(new Set(deptAdmins.map((u) => u.id).concat(params.requesterId)));

    const title = params.isPartial
      ? `PO Sebagian Terbit (${params.prNumber})`
      : `PO Terbit untuk PR ${params.prNumber}`;

    const message = params.isPartial
      ? `Sebagian item pada PR ${params.prNumber} telah dibuatkan PO (${params.poNumber}).`
      : `Seluruh item pada PR ${params.prNumber} telah dibuatkan PO (${params.poNumber}) dan sedang diproses pengiriman oleh vendor.`;

    const type: NotificationType = params.isPartial ? "PR_PARTIAL_PO" : "PR_ORDERED";

    if (targetUserIds.length > 0) {
      await prisma.notification.createMany({
        data: targetUserIds.map((userId) => ({
          userId,
          title,
          message,
          type,
          link,
        })),
      });
      sendPushToUsers(targetUserIds, { title, body: message, url: link }).catch(() => {});
    }
  } catch (err) {
    console.error("[notifyPrPoCreated] Error:", err);
  }
}

/**
 * Kirim notifikasi saat barang dari PR tiba & diterima di Warehouse (PARTIAL_RECEIVED / COMPLETED)
 */
export async function notifyPrReceived(params: {
  prId: string;
  prNumber: string;
  isCompleted: boolean;
  requesterId: string;
  department?: string;
}) {
  try {
    const link = `/purchasing/purchase-requests/${params.prId}`;

    const whereOr: any[] = [{ id: params.requesterId }];
    if (params.department) {
      whereOr.push({
        departments: { has: params.department },
        role: { name: { in: ["ADMIN_PRODUKSI", "ADMIN_INDIRECT"] } },
      });
    }

    const deptAdmins = await prisma.user.findMany({
      where: {
        isActive: true,
        OR: whereOr,
      },
      select: { id: true },
    });

    const targetUserIds = Array.from(new Set(deptAdmins.map((u) => u.id).concat(params.requesterId)));

    const title = params.isCompleted
      ? `PR ${params.prNumber} Selesai (Barang Lengkap)`
      : `Barang Tiba Sebagian (${params.prNumber})`;

    const message = params.isCompleted
      ? `Seluruh barang pada Purchase Request ${params.prNumber} telah selesai diterima lengkap di Gudang oleh Warehouse.`
      : `Sebagian barang pada Purchase Request ${params.prNumber} telah tiba dan diverifikasi oleh tim Warehouse.`;

    const type: NotificationType = params.isCompleted ? "PR_COMPLETED" : "PR_PARTIAL_RECEIVED";

    if (targetUserIds.length > 0) {
      await prisma.notification.createMany({
        data: targetUserIds.map((userId) => ({
          userId,
          title,
          message,
          type,
          link,
        })),
      });
      sendPushToUsers(targetUserIds, { title, body: message, url: link }).catch(() => {});
    }
  } catch (err) {
    console.error("[notifyPrReceived] Error:", err);
  }
}

