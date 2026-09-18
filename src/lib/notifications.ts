import { prisma } from "@/lib/prisma";
import { sendPushToUser, sendPushToUsers } from "@/lib/webpush";

export type NotificationType = "NEW_PO" | "PO_APPROVED_L1" | "PO_APPROVED_L2" | "PO_SENT" | "PO_ACCEPTED_SUPPLIER" | "PO_CANCELLED" | "INFO";

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

