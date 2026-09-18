import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { nextNumber, writeAuditLog } from "@/lib/utils";
import { notifyNewPo } from "@/lib/notifications";
import { Card, PageTitle } from "@/components/ui";
import PoForm from "./PoForm";

export const dynamic = "force-dynamic";

async function createPo(formData: FormData): Promise<{ error?: string; redirect?: string }> {
  "use server";
  const { user } = await getSessionUser();
  if (!user || user.role !== "PURCHASING") return { error: "Unauthorized" };

  const supplierId = String(formData.get("supplierId") ?? "").trim();
  const warehouseId = String(formData.get("warehouseId") ?? "").trim();
  const poNumberCustom = String(formData.get("poNumber") ?? "").trim();
  const poDateRaw = String(formData.get("poDate") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim();
  const purposeProject = String(formData.get("purposeProject") ?? "").trim();
  const expectedDeliveryRaw = String(formData.get("expectedDelivery") ?? "").trim();
  const deliveryDateType = String(formData.get("deliveryDateType") ?? "DATE").trim().toUpperCase();
  const notes = String(formData.get("notes") ?? "").trim();
  const detailsRaw = String(formData.get("details") ?? "[]");

  let details: { itemId: string; qty: number; unitPrice: number }[];
  try {
    details = JSON.parse(detailsRaw);
  } catch {
    return { error: "Data item tidak valid" };
  }

  if (!supplierId) return { error: "Supplier wajib dipilih" };
  if (!details.length) return { error: "Minimal satu item harus ditambahkan" };

  const poDate = poDateRaw ? new Date(poDateRaw) : new Date();
  let expectedDeliveryDateStr = expectedDeliveryRaw;
  if (expectedDeliveryDateStr && /^\d{4}-\d{2}$/.test(expectedDeliveryDateStr)) {
    expectedDeliveryDateStr += "-01";
  }
  const expectedDelivery = expectedDeliveryDateStr ? new Date(expectedDeliveryDateStr) : null;

  // Resolve PO Number
  let poNumber = poNumberCustom;
  if (!poNumber) {
    poNumber = await nextNumber("purchaseOrder", poDate);
  } else {
    const existing = await prisma.purchaseOrder.findUnique({ where: { poNumber } });
    if (existing) {
      return { error: `Nomor PO "${poNumber}" sudah terdaftar di sistem. Gunakan nomor lain.` };
    }
  }

  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) return { error: "Supplier tidak ditemukan" };

  try {
    const po = await prisma.$transaction(async (tx) => {
      // Ambil data item dari database untuk verifikasi harga terkini
      const itemIds = details.map((d) => d.itemId).filter(Boolean);
      const dbItems = await tx.item.findMany({
        where: { id: { in: itemIds } },
      });
      const dbItemMap = new Map(dbItems.map((i) => [i.id, i]));

      const poDetailsData: {
        itemId: string;
        qty: number;
        unit?: string;
        packageUnit?: string | null;
        packageQty?: number | null;
        unitPrice: number;
      }[] = [];

      for (const d of details) {
        const item = dbItemMap.get(d.itemId);
        if (!item) continue;

        const unitPrice = Math.max(0, Number(d.unitPrice) || 0);
        const qty = Math.max(1, Number(d.qty) || 1);

        // Deteksi apakah harga diubah dari harga master
        const oldPrice = item.lastUnitPrice ? Number(item.lastUnitPrice) : null;
        const isPriceChanged = unitPrice > 0 && (oldPrice === null || Math.abs(oldPrice - unitPrice) > 0.01);

        if (isPriceChanged) {
          // 1. Catat riwayat perubahan harga
          await tx.itemPriceHistory.create({
            data: {
              itemId: item.id,
              oldUnitPrice: oldPrice,
              newUnitPrice: unitPrice,
              source: `PO #${poNumber}`,
            },
          });

          // 2. Update harga terbaru di tabel master item
          await tx.item.update({
            where: { id: item.id },
            data: { lastUnitPrice: unitPrice },
          });
        }

        const pkgSize = item.packageSize ? Number(item.packageSize) : null;
        const packageQty = pkgSize && pkgSize > 0 ? Math.ceil(qty / pkgSize) : null;

        poDetailsData.push({
          itemId: item.id,
          qty,
          unit: item.unit || "kg",
          packageUnit: item.packageUnit || null,
          packageQty,
          unitPrice,
        });
      }

      if (poDetailsData.length === 0) {
        throw new Error("Tidak ada item yang valid untuk disimpan");
      }

      const createdPo = await tx.purchaseOrder.create({
        data: {
          poNumber,
          supplierId,
          warehouseId: warehouseId || null,
          createdById: user.id,
          poDate: isNaN(poDate.getTime()) ? new Date() : poDate,
          expectedDelivery: expectedDelivery && !isNaN(expectedDelivery.getTime()) ? expectedDelivery : null,
          deliveryDateType: deliveryDateType === "MONTH" ? "MONTH" : "DATE",
          department: department || null,
          purposeProject: purposeProject || null,
          notes: notes || null,
          status: "DRAFT",
          details: {
            create: poDetailsData,
          },
        },
      });

      return createdPo;
    });

    await writeAuditLog(user, "CREATE_PO", "PurchaseOrder", po.id, `Membuat PO ${po.poNumber}`);

    const supplier = await prisma.supplier.findUnique({
      where: { id: po.supplierId },
      select: { name: true },
    });
    await notifyNewPo({
      poId: po.id,
      poNumber: po.poNumber,
      supplierName: supplier?.name,
      creatorName: user.name,
    });

    revalidatePath("/purchasing");
    revalidatePath("/purchasing/purchase-orders");
    revalidatePath("/purchasing/items");
    return { redirect: `/purchasing/purchase-orders/${po.id}` };
  } catch (err: any) {
    console.error("Error creating PO:", err);
    return { error: err.message || "Gagal menyimpan Purchase Order" };
  }
}

export default async function NewPurchaseOrderPage() {
  const { user } = await getSessionUser();
  if (!user || user.role !== "PURCHASING") redirect("/login");

  // Manager L1 & Presdir L2 tidak diizinkan membuat PO baru (hanya approve/batal)
  if (user.approvalLevel === 1 || user.approvalLevel === 2) {
    redirect("/purchasing/purchase-orders");
  }

  const [items, suppliers, warehouses, suggestedPoNumber, depts] = await Promise.all([
    prisma.item.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        unit: true,
        packageUnit: true,
        packageSize: true,
        lastUnitPrice: true,
      },
    }),
    prisma.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        address: true,
        phone: true,
        contactPerson: true,
      },
    }),
    prisma.warehouse.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
      },
    }),
    nextNumber("purchaseOrder"),
    (async () => {
      try {
        if ((prisma as any).dept?.findMany) {
          return await (prisma as any).dept.findMany({
            where: { isActive: true },
            orderBy: { name: "asc" },
            select: { id: true, code: true, name: true },
          });
        }
        return await prisma.$queryRaw<{ id: string; code: string; name: string }[]>`
          SELECT id, code, name FROM "Dept" WHERE "isActive" = true ORDER BY name ASC
        `;
      } catch (err) {
        console.error("Failed to load depts:", err);
        return [];
      }
    })(),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10">
      <PageTitle
        title="Buat Purchase Order"
        subtitle="Deck formulir pembuatan PO resmi (Format Template Excel PT. Sakae Riken Indonesia)"
        breadcrumb={["Purchase Orders", "Buat PO"]}
      />
      <PoForm
        suggestedPoNumber={suggestedPoNumber}
        departments={depts}
        items={items.map((i) => ({
          id: i.id,
          code: i.code,
          name: i.name,
          unit: i.unit,
          packageUnit: i.packageUnit,
          packageSize: i.packageSize ? Number(i.packageSize) : null,
          lastUnitPrice: i.lastUnitPrice ? Number(i.lastUnitPrice) : 0,
        }))}
        suppliers={suppliers.map((s) => ({
          id: s.id,
          code: s.code,
          name: s.name,
          address: s.address,
          phone: s.phone,
          contactPerson: s.contactPerson,
        }))}
        warehouses={warehouses.map((w) => ({
          id: w.id,
          code: w.code,
          name: w.name,
        }))}
        createPo={createPo}
      />
    </div>
  );
}

