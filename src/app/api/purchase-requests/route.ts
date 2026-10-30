import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { nextPrNumber, writeAuditLog } from "@/lib/utils";
import { notifyPrSubmitted } from "@/lib/notifications";

// GET /api/purchase-requests
export async function GET(req: NextRequest) {
  try {
    const { user } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status") || "ALL";
    const department = searchParams.get("department") || "ALL";
    const urgency = searchParams.get("urgency") || "ALL";

    // Filtering berdasarkan role
    const where: any = {};

    if (user.role === "ADMIN_PRODUKSI" || user.role === "ADMIN_INDIRECT") {
      // Hanya melihat PR departemennya atau PR yang dia buat sendiri
      const userDepts = user.departments && user.departments.length > 0 ? user.departments : [];
      where.OR = [
        { requestedById: user.id },
        { department: { in: userDepts } },
      ];
    } else if (user.role === "DEPT_APPROVER") {
      // Approver melihat PR departemennya
      const userDepts = user.departments && user.departments.length > 0 ? user.departments : [];
      if (userDepts.length > 0) {
        where.department = { in: userDepts };
      }
    } else if (user.role === "PURCHASING") {
      // Purchasing bisa melihat semua PR
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (status !== "ALL") {
      if (status === "READY_FOR_PO") {
        where.status = { in: ["APPROVED", "PARTIAL_PO"] };
      } else if (status.includes(",")) {
        where.status = { in: status.split(",").map((s: string) => s.trim()) };
      } else {
        where.status = status;
      }
    }

    if (department !== "ALL") {
      where.department = department;
    }

    if (urgency !== "ALL") {
      where.urgency = urgency;
    }

    if (search) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { prNumber: { contains: search, mode: "insensitive" } },
            { department: { contains: search, mode: "insensitive" } },
            { purposeNotes: { contains: search, mode: "insensitive" } },
            {
              details: {
                some: {
                  OR: [
                    { item: { name: { contains: search, mode: "insensitive" } } },
                    { item: { code: { contains: search, mode: "insensitive" } } },
                    { customItemName: { contains: search, mode: "insensitive" } },
                  ],
                },
              },
            },
          ],
        },
      ];
    }

    const prs = await prisma.purchaseRequest.findMany({
      where,
      include: {
        requestedBy: { select: { id: true, name: true, username: true } },
        approvedBy: { select: { id: true, name: true } },
        rejectedBy: { select: { id: true, name: true } },
        details: {
          include: {
            item: {
              select: {
                id: true,
                code: true,
                name: true,
                unit: true,
                packageUnit: true,
                packageSize: true,
                lastUnitPrice: true,
              },
            },
            poDetails: {
              select: {
                id: true,
                purchaseOrderId: true,
                purchaseOrder: { select: { id: true, poNumber: true, status: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Self-healing data lama: jika status PR tercatat COMPLETED padahal itemnya masih ORDERED
    const isPurchasing = user.role === "PURCHASING";
    for (const pr of prs) {
      if (pr.status === "COMPLETED" && pr.details.some((d: any) => d.status === "ORDERED")) {
        const anyReceived = pr.details.some((d: any) => d.status === "RECEIVED" || d.status === "PARTIAL_RECEIVED");
        const corrected = anyReceived ? "PARTIAL_RECEIVED" : "ORDERED";
        await prisma.purchaseRequest.update({
          where: { id: pr.id },
          data: { status: corrected },
        });
        pr.status = corrected;
      }

      if (!isPurchasing) {
        pr.details.forEach((d: any) => {
          d.estimatedPrice = null;
          if (d.item && "lastUnitPrice" in d.item) {
            delete d.item.lastUnitPrice;
          }
        });
      }
    }

    return NextResponse.json(prs);
  } catch (err: any) {
    console.error("GET /api/purchase-requests error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

// POST /api/purchase-requests - Buat PR baru
export async function POST(req: NextRequest) {
  try {
    const { user } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowedRoles = ["ADMIN_PRODUKSI", "ADMIN_INDIRECT", "PURCHASING", "DEPT_APPROVER"];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json({ error: "Role tidak diizinkan membuat PR" }, { status: 403 });
    }

    const body = await req.json();
    const {
      department,
      requiredDate,
      urgency = "NORMAL",
      purposeNotes,
      attachmentUrl,
      action = "SUBMIT", // "DRAFT" | "SUBMIT"
      details = [],
    } = body;

    if (!department) {
      return NextResponse.json({ error: "Departemen pemohon wajib diisi" }, { status: 400 });
    }

    if (!Array.isArray(details) || details.length === 0) {
      return NextResponse.json({ error: "Minimal harus ada 1 item kebutuhan" }, { status: 400 });
    }

    // Validasi wewenang departemen
    if (user.role === "ADMIN_PRODUKSI" || user.role === "ADMIN_INDIRECT") {
      if (user.departments && user.departments.length > 0 && !user.departments.includes(department)) {
        return NextResponse.json(
          { error: `Anda tidak memiliki hak akses untuk departemen '${department}'` },
          { status: 403 }
        );
      }
    }

    const prNumber = await nextPrNumber(department, new Date());
    const initialStatus = action === "DRAFT" ? "DRAFT" : "PENDING_APPROVAL";

    const createdPR = await prisma.$transaction(async (tx) => {
      const pr = await tx.purchaseRequest.create({
        data: {
          prNumber,
          department,
          requestedById: user.id,
          requiredDate: requiredDate ? new Date(requiredDate) : null,
          urgency,
          status: initialStatus,
          purposeNotes: purposeNotes?.trim() || null,
          attachmentUrl: attachmentUrl?.trim() || null,
          details: {
            create: details.map((d: any) => ({
              itemId: d.itemId || null,
              customItemName: d.itemId ? null : (d.customItemName?.trim() || null),
              specifications: d.specifications?.trim() || null,
              qty: Number(d.qty) || 1,
              unit: d.unit?.trim() || "Pcs",
              estimatedPrice: user.role === "PURCHASING" ? (Number(d.estimatedPrice) || 0) : 0,
              notes: d.notes?.trim() || null,
              status: "PENDING",
            })),
          },
        },
        include: { details: true },
      });

      return pr;
    });

    await writeAuditLog(
      user,
      "CREATE_PR",
      "PurchaseRequest",
      createdPR.id,
      `Buat PR ${createdPR.prNumber} (${createdPR.department}) status ${createdPR.status}`
    );

    if (createdPR.status === "PENDING_APPROVAL") {
      notifyPrSubmitted({
        prId: createdPR.id,
        prNumber: createdPR.prNumber,
        department: createdPR.department,
        requesterName: user.name,
      }).catch((err) => console.error("Error sending notifyPrSubmitted:", err));
    }

    return NextResponse.json({ success: true, pr: createdPR });
  } catch (err: any) {
    console.error("POST /api/purchase-requests error:", err);
    return NextResponse.json({ error: err.message || "Gagal membuat Purchase Request" }, { status: 500 });
  }
}
