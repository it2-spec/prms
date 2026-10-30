import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/utils";
import { notifyPrSubmitted } from "@/lib/notifications";

// GET /api/purchase-requests/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isPurchasing = user.role === "PURCHASING";

    const pr = await prisma.purchaseRequest.findUnique({
      where: { id },
      include: {
        requestedBy: { select: { id: true, name: true, username: true, email: true } },
        approvedBy: { select: { id: true, name: true, username: true } },
        rejectedBy: { select: { id: true, name: true, username: true } },
        supplier: { select: { id: true, name: true, code: true } },
        purchaseOrders: {
          select: { id: true, poNumber: true, status: true, poDate: true },
        },
        details: {
          include: {
            item: {
              select: {
                id: true,
                code: true,
                name: true,
                unit: true,
                packageUnit: true,
                ...(isPurchasing ? { lastUnitPrice: true } : {}),
              },
            },
            poDetails: {
              include: {
                purchaseOrder: {
                  select: {
                    id: true,
                    poNumber: true,
                    status: true,
                    poDate: true,
                    supplier: { select: { id: true, name: true } },
                    approvedAt: true,
                    approvedBy: { select: { id: true, name: true, username: true } },
                    approvedL2At: true,
                    approvedL2By: { select: { id: true, name: true, username: true } },
                    verificationHash: true,
                    supplierAcceptedAt: true,
                    supplierAcceptedByName: true,
                  },
                },
                deliveryDetails: {
                  select: {
                    id: true,
                    qty: true,
                    delivery: {
                      select: {
                        id: true,
                        deliveryNumber: true,
                        suratJalan: true,
                        shipDate: true,
                        status: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { id: "asc" },
        },
      },
    });

    if (!pr) {
      return NextResponse.json({ error: "Purchase Request tidak ditemukan" }, { status: 404 });
    }

    // Self-healing: jika status PR di database masih COMPLETED dari data lama padahal belum di-receiving
    if (pr.status === "COMPLETED" && pr.details.some((d) => d.status === "ORDERED")) {
      const anyReceived = pr.details.some((d) => d.status === "RECEIVED" || d.status === "PARTIAL_RECEIVED");
      const correctedStatus = anyReceived ? "PARTIAL_RECEIVED" : "ORDERED";
      await prisma.purchaseRequest.update({
        where: { id },
        data: { status: correctedStatus },
      });
      pr.status = correctedStatus;
    }

    // Ambil Purchase Order yang benar-benar memuat item dari PR ini
    const itemLinkedPoIds = new Set<string>();
    pr.details.forEach((d) => {
      d.poDetails?.forEach((pod) => {
        if (pod.purchaseOrder?.id) itemLinkedPoIds.add(pod.purchaseOrder.id);
      });
    });

    const linkedPoIds = new Set<string>();
    if (itemLinkedPoIds.size > 0) {
      // Prioritaskan PO yang benar-benar memuat item PR ini
      itemLinkedPoIds.forEach((id) => linkedPoIds.add(id));
    } else if (pr.purchaseOrders && pr.purchaseOrders.length > 0) {
      // Fallback jika belum ada detail mapping granular
      pr.purchaseOrders.forEach((po) => linkedPoIds.add(po.id));
    }

    let deliveries: any[] = [];
    let receivings: any[] = [];
    let linkedPOs: any[] = [];

    if (linkedPoIds.size > 0) {
      const pos = await prisma.purchaseOrder.findMany({
        where: { id: { in: Array.from(linkedPoIds) } },
        select: {
          id: true,
          poNumber: true,
          status: true,
          poDate: true,
          supplier: { select: { id: true, name: true, code: true } },
          approvedAt: true,
          approvedBy: { select: { id: true, name: true, username: true } },
          approvedL2At: true,
          approvedL2By: { select: { id: true, name: true, username: true } },
          verificationHash: true,
          supplierAcceptedAt: true,
          supplierAcceptedByName: true,
          deliveries: {
            select: {
              id: true,
              deliveryNumber: true,
              suratJalan: true,
              shipDate: true,
              status: true,
              notes: true,
              supplier: { select: { id: true, name: true } },
              createdBy: { select: { id: true, name: true } },
              details: {
                select: {
                  id: true,
                  qty: true,
                  item: { select: { id: true, code: true, name: true, unit: true } },
                },
              },
            },
            orderBy: { shipDate: "desc" },
          },
          receivings: {
            select: {
              id: true,
              receivingNumber: true,
              receivedAt: true,
              status: true,
              notes: true,
              warehouse: { select: { id: true, name: true } },
              receivedBy: { select: { id: true, name: true } },
              delivery: {
                select: {
                  id: true,
                  deliveryNumber: true,
                  suratJalan: true,
                  shipDate: true,
                  supplier: { select: { id: true, name: true } },
                },
              },
              details: {
                select: {
                  id: true,
                  qtyOrdered: true,
                  qtyDelivered: true,
                  qtyReceived: true,
                  item: { select: { id: true, code: true, name: true, unit: true } },
                },
              },
            },
            orderBy: { receivedAt: "desc" },
          },
          details: {
            select: {
              id: true,
              qty: true,
              deliveredQty: true,
              receivedQty: true,
              purchaseRequestDetailId: true,
            },
          },
        },
      });

      for (const po of pos) {
        if (po.deliveries) {
          po.deliveries.forEach((del) => {
            deliveries.push({
              ...del,
              poNumber: po.poNumber,
            });
          });
        }
        if (po.receivings) {
          po.receivings.forEach((rec) => {
            receivings.push({
              ...rec,
              poNumber: po.poNumber,
            });
          });
        }

        const totalPoQty = po.details.reduce((s, d) => s + (d.qty || 0), 0);
        const totalDeliveredQty = po.details.reduce((s, d) => s + (d.deliveredQty || 0), 0);
        const totalReceivedQty = po.details.reduce((s, d) => s + (d.receivedQty || 0), 0);

        linkedPOs.push({
          id: po.id,
          poNumber: po.poNumber,
          status: po.status,
          poDate: po.poDate,
          supplier: po.supplier?.name || "—",
          approvedL1: po.approvedAt
            ? { approvedAt: po.approvedAt, approver: po.approvedBy?.name }
            : null,
          approvedL2: po.approvedL2At
            ? { approvedAt: po.approvedL2At, approver: po.approvedL2By?.name, hash: po.verificationHash }
            : null,
          supplierAccepted: po.supplierAcceptedAt
            ? { acceptedAt: po.supplierAcceptedAt, name: po.supplierAcceptedByName }
            : null,
          totalPoQty,
          totalDeliveredQty,
          totalReceivedQty,
          isDeliveredAll: totalDeliveredQty >= totalPoQty && totalPoQty > 0,
          isDeliveredPartial: totalDeliveredQty > 0 && totalDeliveredQty < totalPoQty,
          isReceivedAll: totalReceivedQty >= totalPoQty && totalPoQty > 0,
          isReceivedPartial: totalReceivedQty > 0 && totalReceivedQty < totalPoQty,
        });
      }
    }

    // Urutkan riwayat pengiriman & penerimaan terbaru di paling atas
    deliveries.sort((a, b) => new Date(b.shipDate).getTime() - new Date(a.shipDate).getTime());
    receivings.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());

    // Hitung fulfillment & masking harga jika bukan Purchasing
    const formattedDetails = pr.details.map((d: any) => {
      const totalOrdered = (d.poDetails || []).reduce((s: number, p: any) => s + (p.qty || 0), 0);
      const totalReceived = (d.poDetails || []).reduce((s: number, p: any) => s + (p.receivedQty || 0), 0);
      const totalDelivered = (d.poDetails || []).reduce((s: number, p: any) => s + (p.deliveredQty || 0), 0);
      const outstandingQty = Math.max(0, d.qty - totalReceived);

      const sanitizedPoDetails = (d.poDetails || []).map((pod: any) => {
        const podCopy = { ...pod };
        if (!isPurchasing) {
          delete podCopy.unitPrice;
        }
        return podCopy;
      });

      return {
        ...d,
        estimatedPrice: isPurchasing ? Number(d.estimatedPrice || 0) : null,
        totalOrdered,
        totalReceived,
        totalDelivered,
        outstandingQty,
        poDetails: sanitizedPoDetails,
      };
    });

    const responseData = {
      ...pr,
      details: formattedDetails,
      deliveries,
      receivings,
      linkedPOs,
      canViewPrice: isPurchasing,
    };

    return NextResponse.json(responseData);

    return NextResponse.json(responseData);
  } catch (err: any) {
    console.error("GET /api/purchase-requests/[id] error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

// PUT /api/purchase-requests/[id] - Edit PR
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pr = await prisma.purchaseRequest.findUnique({
      where: { id },
      include: { details: true },
    });

    if (!pr) {
      return NextResponse.json({ error: "Purchase Request tidak ditemukan" }, { status: 404 });
    }

    // Hanya bisa diedit jika status masih DRAFT atau PENDING_APPROVAL
    if (!["DRAFT", "PENDING_APPROVAL"].includes(pr.status)) {
      return NextResponse.json(
        { error: `PR tidak dapat diubah karena sudah berstatus ${pr.status}` },
        { status: 400 }
      );
    }

    // Validasi wewenang (pemohon atau Purchasing)
    if (user.role !== "PURCHASING" && pr.requestedById !== user.id) {
      return NextResponse.json(
        { error: "Hanya pemohon atau Purchasing yang dapat mengubah PR ini" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      department,
      requiredDate,
      urgency,
      purposeNotes,
      attachmentUrl,
      action, // "DRAFT" | "SUBMIT"
      details,
    } = body;

    const updated = await prisma.$transaction(async (tx) => {
      // Hapus detail lama jika diberikan details baru
      if (Array.isArray(details) && details.length > 0) {
        await tx.purchaseRequestDetail.deleteMany({
          where: { purchaseRequestId: id },
        });

        await tx.purchaseRequestDetail.createMany({
          data: details.map((d: any) => ({
            purchaseRequestId: id,
            itemId: d.itemId || null,
            customItemName: d.itemId ? null : (d.customItemName?.trim() || null),
            specifications: d.specifications?.trim() || null,
            qty: Number(d.qty) || 1,
            unit: d.unit?.trim() || "Pcs",
            estimatedPrice: Number(d.estimatedPrice) || 0,
            notes: d.notes?.trim() || null,
            status: "PENDING",
          })),
        });
      }

      const newStatus =
        action === "SUBMIT"
          ? "PENDING_APPROVAL"
          : action === "DRAFT"
          ? "DRAFT"
          : pr.status;

      return tx.purchaseRequest.update({
        where: { id },
        data: {
          ...(department ? { department } : {}),
          ...(requiredDate !== undefined ? { requiredDate: requiredDate ? new Date(requiredDate) : null } : {}),
          ...(urgency ? { urgency } : {}),
          ...(purposeNotes !== undefined ? { purposeNotes: purposeNotes?.trim() || null } : {}),
          ...(attachmentUrl !== undefined ? { attachmentUrl: attachmentUrl?.trim() || null } : {}),
          status: newStatus,
        },
      });
    });

    await writeAuditLog(
      user,
      "UPDATE_PR",
      "PurchaseRequest",
      id,
      `Update PR ${pr.prNumber} (${updated.status})`
    );

    if (action === "SUBMIT" && pr.status !== "PENDING_APPROVAL") {
      notifyPrSubmitted({
        prId: id,
        prNumber: updated.prNumber,
        department: updated.department,
        requesterName: user.name,
      }).catch((err) => console.error("Error notifyPrSubmitted:", err));
    }

    return NextResponse.json({ success: true, pr: updated });
  } catch (err: any) {
    console.error("PUT /api/purchase-requests/[id] error:", err);
    return NextResponse.json({ error: err.message || "Gagal memperbarui PR" }, { status: 500 });
  }
}

// DELETE /api/purchase-requests/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pr = await prisma.purchaseRequest.findUnique({
      where: { id },
      include: {
        details: {
          include: { poDetails: true },
        },
      },
    });

    if (!pr) {
      return NextResponse.json({ error: "Purchase Request tidak ditemukan" }, { status: 404 });
    }

    // Pastikan belum ada PO yang terbentuk
    const hasPO = pr.details.some((d) => d.poDetails.length > 0);
    if (hasPO) {
      return NextResponse.json(
        { error: "PR tidak dapat dihapus karena sudah memiliki item yang terbit menjadi Purchase Order" },
        { status: 400 }
      );
    }

    if (!["DRAFT", "CANCELLED", "REJECTED"].includes(pr.status)) {
      return NextResponse.json(
        { error: `Hanya PR berstatus DRAFT, REJECTED, atau CANCELLED yang dapat dihapus.` },
        { status: 400 }
      );
    }

    await prisma.purchaseRequest.delete({ where: { id } });

    await writeAuditLog(
      user,
      "DELETE_PR",
      "PurchaseRequest",
      id,
      `Hapus PR ${pr.prNumber}`
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /api/purchase-requests/[id] error:", err);
    return NextResponse.json({ error: err.message || "Gagal menghapus PR" }, { status: 500 });
  }
}
