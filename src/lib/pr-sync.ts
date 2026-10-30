import { prisma } from "@/lib/prisma";
import { notifyPrReceived, notifyPrPoCreated } from "@/lib/notifications";

/**
 * Sinkronisasi status Purchase Request & Purchase Request Detail
 * berdasarkan progres penerimaan barang (Receiving) pada Purchase Order terkait.
 *
 * Alur Status PR:
 * 1. APPROVED -> Disetujui SPV/Manager, siap dibuatkan PO
 * 2. PARTIAL_PO -> Sebagian item sudah dibuatkan PO, masih ada item pending
 * 3. ORDERED -> Semua item sudah dibuatkan PO (menunggu pengiriman vendor)
 * 4. PARTIAL_RECEIVED -> Sebagian barang sudah diterima di gudang oleh Warehouse
 * 5. COMPLETED -> Seluruh barang dari PR telah diterima lengkap di gudang (Receiving Selesai)
 */
export async function syncPurchaseRequestFromPo(
  poId: string,
  tx?: any
) {
  const db = tx || prisma;

  try {
    const po = await db.purchaseOrder.findUnique({
      where: { id: poId },
      include: {
        details: {
          select: {
            id: true,
            purchaseRequestDetailId: true,
            purchaseRequestDetail: {
              select: { purchaseRequestId: true },
            },
          },
        },
      },
    });

    if (!po) return;

    // Kumpulkan semua PR ID yang terhubung dengan PO ini
    const prIds = new Set<string>();
    if (po.purchaseRequestId) {
      prIds.add(po.purchaseRequestId);
    }
    po.details.forEach((d: any) => {
      if (d.purchaseRequestDetail?.purchaseRequestId) {
        prIds.add(d.purchaseRequestDetail.purchaseRequestId);
      }
    });

    for (const prId of prIds) {
      const pr = await db.purchaseRequest.findUnique({
        where: { id: prId },
        include: {
          details: {
            include: {
              poDetails: true,
            },
          },
        },
      });

      if (!pr) continue;

      // Update status masing-masing item detail PR
      const updatedDetails = [];
      for (const d of pr.details) {
        if (d.status === "CANCELLED") {
          updatedDetails.push({ ...d, computedStatus: "CANCELLED" });
          continue;
        }

        const totalOrdered = d.poDetails.reduce((sum: number, pod: any) => sum + (pod.qty || 0), 0);
        const totalReceived = d.poDetails.reduce(
          (sum: number, pod: any) => sum + (pod.receivedQty || 0),
          0
        );

        let newStatus = d.status;
        if (d.poDetails.length === 0) {
          newStatus = "PENDING";
        } else if (totalReceived >= d.qty && d.qty > 0) {
          newStatus = "RECEIVED";
        } else if (totalReceived > 0) {
          newStatus = "PARTIAL_RECEIVED";
        } else {
          newStatus = "ORDERED";
        }

        if (newStatus !== d.status || totalOrdered !== d.orderedQty) {
          await db.purchaseRequestDetail.update({
            where: { id: d.id },
            data: {
              status: newStatus,
              orderedQty: totalOrdered,
            },
          });
        }

        updatedDetails.push({ ...d, computedStatus: newStatus });
      }

      // Hitung status header PR
      const activeDetails = updatedDetails.filter((d) => d.computedStatus !== "CANCELLED");
      if (activeDetails.length === 0) continue;

      const hasPending = activeDetails.some((d) => d.computedStatus === "PENDING");
      const hasOrdered = activeDetails.some((d) => d.computedStatus === "ORDERED");
      const hasPartialReceived = activeDetails.some((d) => d.computedStatus === "PARTIAL_RECEIVED");
      const hasReceived = activeDetails.some((d) => d.computedStatus === "RECEIVED");
      const allReceived = activeDetails.every((d) => d.computedStatus === "RECEIVED");

      let newPrStatus = pr.status;

      if (hasPending) {
        // Jika masih ada item pending dan ada item yang sudah PO / diterima
        if (hasOrdered || hasPartialReceived || hasReceived) {
          newPrStatus = "PARTIAL_PO";
        }
      } else {
        // Tidak ada item pending (semua sudah dibuatkan PO)
        if (allReceived) {
          // SELESAI jika dan hanya jika seluruh barang sudah diterima di gudang!
          newPrStatus = "COMPLETED";
        } else if (hasPartialReceived || hasReceived) {
          // Ada barang yang sudah sampai sebagian
          newPrStatus = "PARTIAL_RECEIVED";
        } else {
          // Seluruh item sudah PO tapi belum ada penerimaan
          newPrStatus = "ORDERED";
        }
      }

      if (newPrStatus !== pr.status) {
        await db.purchaseRequest.update({
          where: { id: prId },
          data: { status: newPrStatus },
        });

        // Kirim notifikasi progres ke Pemohon (Admin Produksi / Indirect)
        if (newPrStatus === "COMPLETED" || newPrStatus === "PARTIAL_RECEIVED") {
          notifyPrReceived({
            prId,
            prNumber: pr.prNumber,
            isCompleted: newPrStatus === "COMPLETED",
            requesterId: pr.requestedById,
            department: pr.department,
          }).catch((err) => console.error("Error notifyPrReceived in pr-sync:", err));
        } else if (
          (newPrStatus === "ORDERED" || newPrStatus === "PARTIAL_PO") &&
          pr.status !== "ORDERED" &&
          pr.status !== "PARTIAL_PO"
        ) {
          notifyPrPoCreated({
            prId,
            prNumber: pr.prNumber,
            poNumber: po.poNumber,
            isPartial: newPrStatus === "PARTIAL_PO",
            requesterId: pr.requestedById,
            department: pr.department,
          }).catch((err) => console.error("Error notifyPrPoCreated in pr-sync:", err));
        }
      }
    }
  } catch (err) {
    console.error(`Error syncing PR from PO ${poId}:`, err);
  }
}
