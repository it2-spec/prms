"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { nextNumber, writeAuditLog } from "@/lib/utils";

export type CartItem = {
  itemId: string;
  itemCode: string;
  itemName: string;
  packageUnit: string;
  packageSize: number;
  packageQty: number; // jumlah kemasan yang akan dikeluarkan
  notes?: string;
};

export type SubmittedOutgoingResult = {
  outgoingId: string;
  outgoingNumber: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  packageQty: number;
  packageUnit: string;
  balanceRemaining: number;
};

export async function submitOutgoing(
  cart: CartItem[],
  purpose?: string,
  department?: string,
  overrideWarehouseId?: string,
): Promise<{
  error?: string;
  createdOutgoings?: SubmittedOutgoingResult[];
  outgoingNumber?: string;
  outgoingId?: string;
  balanceRemaining?: number;
}> {
  const { user, dbUser } = await getSessionUser();
  if (!user || user.role !== "WAREHOUSE") return { error: "Unauthorized" };

  const warehouseId = overrideWarehouseId || dbUser?.warehouseId;
  if (!warehouseId) return { error: "Anda tidak terhubung ke warehouse manapun" };

  if (!cart.length) return { error: "Keranjang pengeluaran masih kosong" };

  const finalPurpose = purpose?.trim() || "Pengeluaran Standar";
  const finalDept = department?.trim() || null;
  const balanceMap = new Map<string, number>();

  // Validasi stok cukup untuk setiap item
  for (const cartItem of cart) {
    if (cartItem.packageQty <= 0) {
      return { error: `Jumlah kuantitas untuk ${cartItem.itemName} harus lebih dari 0` };
    }

    // Hitung incoming untuk warehouse ini
    const receivingAgg = await prisma.receivingDetail.aggregate({
      where: {
        itemId: cartItem.itemId,
        receiving: {
          status: { in: ["VERIFIED", "RECEIVED", "CLOSED"] },
          warehouseId,
        },
      },
      _sum: { qtyReceived: true },
    });
    const totalIncomingBase = Number(receivingAgg._sum.qtyReceived ?? 0);
    const pkgSize = cartItem.packageSize || 1;
    const totalIncomingPkg = totalIncomingBase / pkgSize;

    // Hitung outgoing yang sudah ada (HANYA status COMPLETED)
    const outgoingAgg = await prisma.stockOutgoingDetail.aggregate({
      where: {
        itemId: cartItem.itemId,
        stockOutgoing: {
          warehouseId,
          status: "COMPLETED",
        },
      },
      _sum: { packageQty: true },
    });
    const totalOutgoingPkg = Number(outgoingAgg._sum.packageQty ?? 0);
    const balancePkg = totalIncomingPkg - totalOutgoingPkg;

    if (cartItem.packageQty > balancePkg) {
      return {
        error: `Stok tidak cukup untuk ${cartItem.itemName}. Saldo gudang: ${balancePkg.toFixed(2)} ${cartItem.packageUnit}, diminta: ${cartItem.packageQty} ${cartItem.packageUnit}`,
      };
    }

    const remaining = Math.max(0, Math.round((balancePkg - cartItem.packageQty) * 100) / 100);
    balanceMap.set(cartItem.itemId, remaining);
  }

  // Simpan setiap item di keranjang menjadi baris transaksi tersendiri (jangan digabung 1 batch)
  const createdList: SubmittedOutgoingResult[] = [];

  await prisma.$transaction(async (tx) => {
    for (const c of cart) {
      const outNum = await nextNumber("stockOutgoing");
      const outgoing = await tx.stockOutgoing.create({
        data: {
          outgoingNumber: outNum,
          warehouseId,
          createdById: user.id,
          purpose: finalPurpose,
          department: finalDept,
          status: "COMPLETED",
          details: {
            create: {
              itemId: c.itemId,
              packageQty: c.packageQty,
              baseQty: c.packageQty * c.packageSize,
              notes: c.notes?.trim() || null,
            },
          },
        },
      });

      createdList.push({
        outgoingId: outgoing.id,
        outgoingNumber: outNum,
        itemId: c.itemId,
        itemCode: c.itemCode,
        itemName: c.itemName,
        packageQty: c.packageQty,
        packageUnit: c.packageUnit,
        balanceRemaining: balanceMap.get(c.itemId) ?? 0,
      });

      await writeAuditLog(
        user,
        "CREATE_OUTGOING",
        "StockOutgoing",
        outgoing.id,
        `Outgoing ${outNum}: ${c.itemCode} - ${c.itemName} (${c.packageQty} ${c.packageUnit})`,
      );
    }
  });

  revalidatePath("/warehouse/outgoing");
  revalidatePath("/warehouse/history");
  revalidatePath("/warehouse/stock");
  revalidatePath("/purchasing/outgoing");

  const first = createdList[0];
  return {
    createdOutgoings: createdList,
    outgoingNumber: first?.outgoingNumber,
    outgoingId: first?.outgoingId,
    balanceRemaining: first?.balanceRemaining,
  };
}

export async function cancelOutgoing(
  outgoingId: string,
  reason?: string,
): Promise<{ success?: boolean; error?: string; outgoingNumber?: string }> {
  const { user, dbUser } = await getSessionUser();
  if (!user || user.role !== "WAREHOUSE") return { error: "Unauthorized" };

  const outgoing = await prisma.stockOutgoing.findUnique({
    where: { id: outgoingId },
    include: { details: true },
  });

  if (!outgoing) {
    return { error: "Transaksi outgoing tidak ditemukan" };
  }

  if (outgoing.status === "CANCELLED") {
    return { error: "Transaksi ini sudah dibatalkan sebelumnya" };
  }

  const cancelReason = reason?.trim() || "Dibatalkan petugas gudang (Salah scan / salah input)";

  await prisma.stockOutgoing.update({
    where: { id: outgoingId },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelReason,
    },
  });

  await writeAuditLog(
    user,
    "CANCEL_OUTGOING",
    "StockOutgoing",
    outgoingId,
    `Batal Outgoing ${outgoing.outgoingNumber}: ${cancelReason}`,
  );

  revalidatePath("/warehouse/outgoing");
  revalidatePath("/warehouse/history");
  revalidatePath("/warehouse/stock");
  revalidatePath("/purchasing/outgoing");

  return { success: true, outgoingNumber: outgoing.outgoingNumber };
}
