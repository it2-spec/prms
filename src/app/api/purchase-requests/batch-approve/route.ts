import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/utils";
import { notifyPrApproved, notifyPrRejected } from "@/lib/notifications";

export const dynamic = "force-dynamic";

// POST /api/purchase-requests/batch-approve
export async function POST(req: NextRequest) {
  try {
    const { user } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "DEPT_APPROVER") {
      return NextResponse.json(
        {
          error:
            "Hanya Supervisor Departemen (DEPT_APPROVER) yang berwenang menyetujui Purchase Request.",
        },
        { status: 403 }
      );
    }

    const userDepts = Array.isArray(user.departments) ? user.departments : [];
    if (userDepts.length === 0) {
      return NextResponse.json(
        { error: "Akun Anda belum dikaitkan dengan departemen apapun." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { prIds, action = "APPROVE", reason } = body as {
      prIds?: string[];
      action?: "APPROVE" | "REJECT";
      reason?: string;
    };

    if (!Array.isArray(prIds) || prIds.length === 0) {
      return NextResponse.json(
        { error: "Pilih minimal 1 Purchase Request untuk diproses." },
        { status: 400 }
      );
    }

    // Ambil PR yang eligible: status PENDING_APPROVAL dan departemen sesuai wewenang supervisor
    const eligiblePRs = await prisma.purchaseRequest.findMany({
      where: {
        id: { in: prIds },
        status: "PENDING_APPROVAL",
        department: { in: userDepts },
      },
      select: {
        id: true,
        prNumber: true,
        department: true,
        requestedById: true,
      },
    });

    if (eligiblePRs.length === 0) {
      return NextResponse.json(
        {
          error:
            "Tidak ada Purchase Request yang memenuhi syarat untuk disetujui (mungkin sudah disetujui atau bukan dari departemen Anda).",
        },
        { status: 400 }
      );
    }

    const eligibleIds = eligiblePRs.map((p) => p.id);
    const now = new Date();

    if (action === "APPROVE") {
      await prisma.purchaseRequest.updateMany({
        where: { id: { in: eligibleIds } },
        data: {
          status: "APPROVED",
          approvedById: user.id,
          approvedAt: now,
          rejectedById: null,
          rejectedAt: null,
          rejectReason: null,
        },
      });

      // Audit log & notifications
      const prNumbersSummary = eligiblePRs.map((p) => p.prNumber).join(", ");
      await writeAuditLog(
        user,
        "BATCH_APPROVE_PR",
        "PurchaseRequest",
        eligibleIds[0],
        `Batch setujui ${eligibleIds.length} PR (${prNumbersSummary}) oleh ${user.name}`
      );

      // Kirim notifikasi secara asynchronous
      Promise.allSettled(
        eligiblePRs.map((p) =>
          notifyPrApproved({
            prId: p.id,
            prNumber: p.prNumber,
            department: p.department,
            approverName: user.name,
            requesterId: p.requestedById,
          })
        )
      ).catch((err) => console.error("Error batch notifyPrApproved:", err));

      return NextResponse.json({
        success: true,
        count: eligibleIds.length,
        approvedIds: eligibleIds,
        message: `Berhasil menyetujui ${eligibleIds.length} Purchase Request sekaligus.`,
      });
    } else if (action === "REJECT") {
      if (!reason || reason.trim() === "") {
        return NextResponse.json(
          { error: "Alasan penolakan wajib diisi untuk penolakan massal." },
          { status: 400 }
        );
      }

      await prisma.purchaseRequest.updateMany({
        where: { id: { in: eligibleIds } },
        data: {
          status: "REJECTED",
          rejectedById: user.id,
          rejectedAt: now,
          rejectReason: reason.trim(),
        },
      });

      const prNumbersSummary = eligiblePRs.map((p) => p.prNumber).join(", ");
      await writeAuditLog(
        user,
        "BATCH_REJECT_PR",
        "PurchaseRequest",
        eligibleIds[0],
        `Batch tolak ${eligibleIds.length} PR (${prNumbersSummary}) alasan: ${reason.trim()}`
      );

      Promise.allSettled(
        eligiblePRs.map((p) =>
          notifyPrRejected({
            prId: p.id,
            prNumber: p.prNumber,
            department: p.department,
            rejectorName: user.name,
            requesterId: p.requestedById,
            reason: reason.trim(),
          })
        )
      ).catch((err) => console.error("Error batch notifyPrRejected:", err));

      return NextResponse.json({
        success: true,
        count: eligibleIds.length,
        rejectedIds: eligibleIds,
        message: `${eligibleIds.length} Purchase Request telah ditolak.`,
      });
    }

    return NextResponse.json({ error: "Aksi tidak valid." }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/purchase-requests/batch-approve error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal memproses batch approval PR" },
      { status: 500 }
    );
  }
}
