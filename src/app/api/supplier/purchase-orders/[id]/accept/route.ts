import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/utils";
import { notifySupplierAcceptedPo } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, dbUser } = await getSessionUser();

    if (!user || user.role !== "SUPPLIER" || !dbUser?.supplierId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { signerName, signatureImage } = body;

    if (!signerName || !signerName.trim()) {
      return NextResponse.json({ error: "Nama penanda tangan wajib diisi" }, { status: 400 });
    }
    if (!signatureImage || !signatureImage.startsWith("data:image/")) {
      return NextResponse.json({ error: "Format tanda tangan tidak valid" }, { status: 400 });
    }

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { supplier: true },
    });

    if (!po) {
      return NextResponse.json({ error: "Purchase Order tidak ditemukan" }, { status: 404 });
    }

    if (po.supplierId !== dbUser.supplierId) {
      return NextResponse.json(
        { error: "Akses ditolak. PO ini bukan milik perusahaan Anda." },
        { status: 403 }
      );
    }

    const now = new Date();
    let updatedPo;
    try {
      updatedPo = await prisma.purchaseOrder.update({
        where: { id },
        data: {
          supplierAcceptedAt: now,
          supplierAcceptedByName: signerName.trim(),
          supplierAcceptedSignature: signatureImage,
        },
      });
    } catch (updateErr: any) {
      console.warn(
        "[accept] Prisma update error, executing raw SQL fallback:",
        updateErr?.message
      );
      await prisma.$executeRawUnsafe(
        `UPDATE "PurchaseOrder" SET "supplierAcceptedAt" = $1, "supplierAcceptedByName" = $2, "supplierAcceptedSignature" = $3 WHERE "id" = $4`,
        now,
        signerName.trim(),
        signatureImage,
        id
      );
      updatedPo = await prisma.purchaseOrder.findUnique({
        where: { id },
      });
    }

    await writeAuditLog(
      user,
      "SUPPLIER_ACCEPT_PO",
      "PurchaseOrder",
      po.id,
      `Supplier ${po.supplier.name} (${signerName}) telah menerima & menandatangani PO ${po.poNumber}`
    );

    // Kirim notifikasi In-App & Web Push ke Purchasing
    await notifySupplierAcceptedPo({
      poId: po.id,
      poNumber: po.poNumber,
      supplierName: po.supplier.name,
      signerName: signerName.trim(),
      createdById: po.createdById,
    });

    revalidatePath(`/supplier/purchase-orders/${id}`);
    revalidatePath(`/supplier/purchase-orders`);
    revalidatePath(`/purchasing/purchase-orders/${id}`);
    revalidatePath(`/purchasing/purchase-orders/${id}/print`);

    return NextResponse.json({
      success: true,
      message: "PO berhasil diterima dan ditandatangani.",
      acceptedAt: now.toISOString(),
      acceptedByName: signerName.trim(),
    });
  } catch (error: any) {
    console.error("[POST /api/supplier/purchase-orders/[id]/accept] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
