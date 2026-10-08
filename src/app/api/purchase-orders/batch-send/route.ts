import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/utils";
import { notifyPoSentToSupplier } from "@/lib/notifications";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { user } = await getSessionUser();
    if (!user || user.role !== "PURCHASING") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { poIds } = body as { poIds?: string[] };

    if (!Array.isArray(poIds) || poIds.length === 0) {
      return NextResponse.json(
        { error: "Pilih setidaknya satu Purchase Order untuk dikirim ke supplier." },
        { status: 400 }
      );
    }

    // Ambil PO yang eligible untuk dikirim:
    // 1. Sudah ditandatangani (approvedL2ById != null atau approvedById != null)
    // 2. Masih dalam status DRAFT atau REVISED
    const eligiblePOs = await prisma.purchaseOrder.findMany({
      where: {
        id: { in: poIds },
        status: { in: ["DRAFT", "REVISED"] },
        OR: [
          { approvedL2ById: { not: null } },
          { approvedById: { not: null } },
        ],
      },
      select: {
        id: true,
        poNumber: true,
        supplierId: true,
      },
    });

    if (eligiblePOs.length === 0) {
      return NextResponse.json(
        {
          error:
            "Tidak ada PO yang memenuhi syarat untuk dikirim (pastikan PO sudah ditandatangani dan belum pernah dikirim).",
        },
        { status: 400 }
      );
    }

    const eligibleIds = eligiblePOs.map((p) => p.id);

    // Update status massal menjadi WAITING_DELIVERY
    await prisma.purchaseOrder.updateMany({
      where: { id: { in: eligibleIds } },
      data: { status: "WAITING_DELIVERY" },
    });

    // Catat audit log dan kirim notifikasi ke masing-masing supplier
    for (const po of eligiblePOs) {
      await writeAuditLog(
        user,
        "SEND_PO",
        "PurchaseOrder",
        po.id,
        `PO ${po.poNumber} dikirim ke supplier (Pengiriman Massal oleh ${user.name || user.username})`
      );

      await notifyPoSentToSupplier({
        poId: po.id,
        poNumber: po.poNumber,
        supplierId: po.supplierId,
      });
    }

    revalidatePath("/purchasing/purchase-orders");
    revalidatePath("/purchasing");
    revalidatePath("/supplier/purchase-orders");

    return NextResponse.json({
      success: true,
      count: eligiblePOs.length,
      sentPoNumbers: eligiblePOs.map((p) => p.poNumber),
      message: `Berhasil mengirim ${eligiblePOs.length} Purchase Order resmi ke supplier!`,
    });
  } catch (error: any) {
    console.error("Error in batch-send PO API:", error);
    return NextResponse.json(
      { error: error?.message || "Terjadi kesalahan saat memproses pengiriman massal PO" },
      { status: 500 }
    );
  }
}
