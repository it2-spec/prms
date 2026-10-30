import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  try {
    const { user } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      approvalLevel: user.approvalLevel,
      departments: user.departments || [],
      supplierId: user.supplierId,
      warehouseId: user.warehouseId,
    });
  } catch (err: any) {
    console.error("GET /api/user/profile error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
