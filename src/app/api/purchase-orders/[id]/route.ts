import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/utils";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user } = await getSessionUser();
    if (!user || user.role !== "PURCHASING") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Manager Purchasing & Presdir tidak boleh menghapus PO
    if (user.approvalLevel && user.approvalLevel > 0) {
      return NextResponse.json(
        { error: "Manager Purchasing dan Presdir tidak diizinkan menghapus PO. Gunakan fitur Pembatalan PO jika diperlukan." },
        { status: 403 }
      );
    }

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        deliveries: true,
        receivings: true,
      },
    });

    if (!po) {
      return NextResponse.json({ error: "Purchase Order tidak ditemukan." }, { status: 404 });
    }

    // PO hanya boleh dihapus jika status masih DRAFT atau CANCELLED (Dibatalkan)
    if (!["DRAFT", "CANCELLED"].includes(po.status)) {
      return NextResponse.json(
        {
          error: `PO tidak dapat dihapus karena berstatus ${po.status}. Hanya PO berstatus DRAFT atau CANCELLED yang boleh dihapus.`,
        },
        { status: 400 }
      );
    }

    // Pastikan tidak ada data penerimaan fisik di gudang
    if (po.receivings.length > 0) {
      return NextResponse.json(
        { error: "PO tidak dapat dihapus karena sudah memiliki data penerimaan barang (Receiving) di gudang." },
        { status: 400 }
      );
    }

    // Hapus relasi deliveries (jika ada pada PO yang dicancel), detail PO, dan Purchase Order
    await prisma.$transaction(async (tx) => {
      const dlvIds = po.deliveries.map((d) => d.id);
      if (dlvIds.length > 0) {
        await tx.deliveryDetail.deleteMany({ where: { deliveryId: { in: dlvIds } } });
        await tx.delivery.deleteMany({ where: { id: { in: dlvIds } } });
      }
      await tx.purchaseOrderDetail.deleteMany({ where: { purchaseOrderId: id } });
      await tx.purchaseOrder.delete({ where: { id } });
    });

    await writeAuditLog(
      user,
      "DELETE_PO",
      "PurchaseOrder",
      id,
      `PO ${po.poNumber} dihapus oleh ${user.name || user.username} saat berstatus ${po.status}`
    );

    return NextResponse.json({
      success: true,
      message: `Purchase Order ${po.poNumber} berhasil dihapus.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
