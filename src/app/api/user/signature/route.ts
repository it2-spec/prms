import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/utils";

// POST /api/user/signature
// Allows a user to upload or change their digital signature (or an admin to change a user's signature)
export async function POST(req: NextRequest) {
  try {
    const { user } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { signatureImage, targetUserId } = body;

    if (signatureImage === undefined) {
      return NextResponse.json({ error: "signatureImage is required" }, { status: 400 });
    }

    // If targetUserId is provided and differs from current user, must be PURCHASING role
    let userIdToUpdate = user.id;
    if (targetUserId && targetUserId !== user.id) {
      if (user.role !== "PURCHASING") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      userIdToUpdate = targetUserId;
    }

    const updated = await prisma.user.update({
      where: { id: userIdToUpdate },
      data: { signatureImage: signatureImage || null },
    });

    await writeAuditLog(
      user,
      "UPDATE_SIGNATURE",
      "User",
      updated.id,
      `Tanda tangan digital diperbarui untuk user ${updated.name || updated.username}`
    );

    return NextResponse.json({
      success: true,
      signatureImage: updated.signatureImage,
      userId: updated.id,
    });
  } catch (err: any) {
    console.error("Error updating signature:", err);
    return NextResponse.json({ error: err.message || "Failed to update signature" }, { status: 500 });
  }
}
