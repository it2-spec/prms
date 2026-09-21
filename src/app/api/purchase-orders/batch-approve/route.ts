import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/utils";
import { notifyBatchPoApprovedL1, notifyBatchPoApprovedL2 } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  try {
    const { user } = await getSessionUser();
    if (!user || user.role !== "PURCHASING") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { poIds, level = 1 } = body as { poIds?: string[]; level?: number };

    if (!Array.isArray(poIds) || poIds.length === 0) {
      return NextResponse.json(
        {
          error: "Please select at least one Purchase Order to approve.",
        },
        { status: 400 }
      );
    }

    // ─── Level 1 (Manager Purchasing) ───
    if (level === 1) {
      if (user.approvalLevel !== 1) {
        return NextResponse.json(
          { error: "Access denied. Only Purchasing Managers (L1) can authorize this approval." },
          { status: 403 }
        );
      }

      const eligiblePOs = await prisma.purchaseOrder.findMany({
        where: {
          id: { in: poIds },
          approvedById: null,
          status: { not: "CANCELLED" },
        },
        select: { id: true, poNumber: true },
      });

      if (eligiblePOs.length === 0) {
        return NextResponse.json(
          { error: "No eligible Purchase Orders found for approval (they may already be approved or cancelled)." },
          { status: 400 }
        );
      }

      const eligibleIds = eligiblePOs.map((p) => p.id);
      const now = new Date();

      await prisma.purchaseOrder.updateMany({
        where: { id: { in: eligibleIds } },
        data: {
          approvedById: user.id,
          approvedAt: now,
        },
      });

      for (const po of eligiblePOs) {
        await writeAuditLog(
          user,
          "APPROVE_PO_L1",
          "PurchaseOrder",
          po.id,
          `PO ${po.poNumber} approved by Purchasing Manager (Batch Approval): ${user.name || user.username}`
        );
      }

      await notifyBatchPoApprovedL1({
        count: eligiblePOs.length,
        poNumbers: eligiblePOs.map((p) => p.poNumber),
        approverName: user.name || user.username,
      });

      revalidatePath("/purchasing/purchase-orders");
      revalidatePath("/purchasing");

      return NextResponse.json({
        success: true,
        count: eligiblePOs.length,
        approvedPoNumbers: eligiblePOs.map((p) => p.poNumber),
        message: `Successfully approved ${eligiblePOs.length} Purchase Order${eligiblePOs.length === 1 ? "" : "s"}.`,
      });
    }

    // ─── Level 2 (President Director - Presdir L2) [English Response] ───
    if (level === 2) {
      if (user.approvalLevel !== 2) {
        return NextResponse.json(
          { error: "Access denied. Only the President Director (L2) can perform final approval." },
          { status: 403 }
        );
      }

      // Eligible: Manager L1 must have approved, Presdir L2 not yet approved, not cancelled/closed
      const eligiblePOs = await prisma.purchaseOrder.findMany({
        where: {
          id: { in: poIds },
          approvedById: { not: null },
          approvedL2ById: null,
          status: { not: "CANCELLED" },
        },
        include: { details: true },
      });

      if (eligiblePOs.length === 0) {
        return NextResponse.json(
          { error: "No eligible Purchase Orders found for President Director approval (they may already be approved, awaiting Manager verification, or cancelled)." },
          { status: 400 }
        );
      }

      const now = new Date();

      // 1. Precompute verification hashes in-memory
      const poUpdates = eligiblePOs.map((po) => {
        const totalValue = po.details.reduce((s, d) => s + d.qty * Number(d.unitPrice), 0);
        const hashPayload = [
          po.id,
          po.poNumber,
          po.supplierId,
          po.createdById,
          po.poDate.toISOString(),
          totalValue.toString(),
        ].join("|");
        const verificationHash = crypto.createHash("sha256").update(hashPayload).digest("hex");

        return {
          id: po.id,
          verificationHash,
        };
      });

      // 2. Execute updates in parallel with 30s transaction timeout
      await prisma.$transaction(
        async (tx) => {
          await Promise.all(
            poUpdates.map((u) =>
              tx.purchaseOrder.update({
                where: { id: u.id },
                data: {
                  approvedL2ById: user.id,
                  approvedL2At: now,
                  verificationHash: u.verificationHash,
                },
              })
            )
          );
        },
        { maxWait: 10000, timeout: 30000 }
      );

      // 3. Write audit logs outside the transaction so it doesn't hold locks
      for (const po of eligiblePOs) {
        await writeAuditLog(
          user,
          "APPROVE_PO_L2",
          "PurchaseOrder",
          po.id,
          `PO ${po.poNumber} approved by President Director (Batch Approval): ${user.name || user.username}`
        );
      }

      await notifyBatchPoApprovedL2({
        count: eligiblePOs.length,
        poNumbers: eligiblePOs.map((p) => p.poNumber),
        createdByIds: eligiblePOs.map((p) => p.createdById).filter(Boolean) as string[],
        presdirName: user.name || user.username,
      });

      revalidatePath("/purchasing/purchase-orders");
      revalidatePath("/purchasing");

      return NextResponse.json({
        success: true,
        count: eligiblePOs.length,
        approvedPoNumbers: eligiblePOs.map((p) => p.poNumber),
        message: `Successfully approved ${eligiblePOs.length} Purchase Orders by President Director.`,
      });
    }

    return NextResponse.json({ error: "Invalid approval level." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error." }, { status: 500 });
  }
}
