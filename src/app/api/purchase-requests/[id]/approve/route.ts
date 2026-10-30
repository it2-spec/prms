import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/utils";
import { notifyPrApproved, notifyPrRejected } from "@/lib/notifications";

// POST /api/purchase-requests/[id]/approve
export async function POST(
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
    });

    if (!pr) {
      return NextResponse.json({ error: "Purchase Request tidak ditemukan" }, { status: 404 });
    }

    if (pr.status !== "PENDING_APPROVAL") {
      return NextResponse.json(
        { error: `PR tidak dalam status menunggu approval (Status saat ini: ${pr.status})` },
        { status: 400 }
      );
    }

    // Hak approver: HANYA Supervisor Departemen (DEPT_APPROVER) dari departemen pemohon terkait.
    // Purchasing TIDAK PERLU dan TIDAK DIIZINKAN menyetujui PR.
    if (user.role !== "DEPT_APPROVER") {
      return NextResponse.json(
        {
          error:
            "Hanya Supervisor Departemen (DEPT_APPROVER) yang berwenang menyetujui atau menolak Purchase Request ini. Tim Purchasing tidak perlu dan tidak diizinkan menyetujui PR.",
        },
        { status: 403 }
      );
    }

    // Pastikan supervisor membawahi departemen spesifik PR tersebut
    const userDepts = Array.isArray(user.departments) ? user.departments : [];
    if (!userDepts.includes(pr.department)) {
      return NextResponse.json(
        {
          error: `Anda bukan supervisor untuk departemen '${pr.department}'. Purchase Request ini hanya dapat disetujui oleh Supervisor Departemen ${pr.department}.`,
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { decision, reason } = body; // decision: "APPROVE" | "REJECT"

    if (decision === "APPROVE") {
      const updated = await prisma.purchaseRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedById: user.id,
          approvedAt: new Date(),
          rejectedById: null,
          rejectedAt: null,
          rejectReason: null,
        },
      });

      await writeAuditLog(
        user,
        "APPROVE_PR",
        "PurchaseRequest",
        id,
        `Setujui PR ${pr.prNumber} (${pr.department}) siap diproses PO oleh Purchasing`
      );

      notifyPrApproved({
        prId: id,
        prNumber: pr.prNumber,
        department: pr.department,
        approverName: user.name,
        requesterId: pr.requestedById,
      }).catch((err) => console.error("Error notifyPrApproved:", err));

      return NextResponse.json({ success: true, status: "APPROVED", pr: updated });
    } else if (decision === "REJECT") {
      if (!reason || reason.trim() === "") {
        return NextResponse.json({ error: "Alasan penolakan wajib diisi" }, { status: 400 });
      }

      const updated = await prisma.purchaseRequest.update({
        where: { id },
        data: {
          status: "REJECTED",
          rejectedById: user.id,
          rejectedAt: new Date(),
          rejectReason: reason.trim(),
        },
      });

      await writeAuditLog(
        user,
        "REJECT_PR",
        "PurchaseRequest",
        id,
        `Tolak PR ${pr.prNumber}: ${reason.trim()}`
      );

      notifyPrRejected({
        prId: id,
        prNumber: pr.prNumber,
        department: pr.department,
        rejectorName: user.name,
        requesterId: pr.requestedById,
        reason: reason.trim(),
      }).catch((err) => console.error("Error notifyPrRejected:", err));

      return NextResponse.json({ success: true, status: "REJECTED", pr: updated });
    } else {
      return NextResponse.json({ error: "Keputusan approval tidak valid (harus APPROVE atau REJECT)" }, { status: 400 });
    }
  } catch (err: any) {
    console.error("POST /api/purchase-requests/[id]/approve error:", err);
    return NextResponse.json({ error: err.message || "Gagal memproses approval" }, { status: 500 });
  }
}
