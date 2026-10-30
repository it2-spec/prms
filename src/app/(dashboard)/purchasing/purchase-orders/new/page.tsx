import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { nextNumber, writeAuditLog, normalizeDepartment } from "@/lib/utils";
import { notifyNewPo, notifyPrPoCreated } from "@/lib/notifications";
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
  const purchaseRequestId = String(formData.get("purchaseRequestId") ?? "").trim();
  const poDateRaw = String(formData.get("poDate") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim();
  const purposeProject = String(formData.get("purposeProject") ?? "").trim();
  const expectedDeliveryRaw = String(formData.get("expectedDelivery") ?? "").trim();
  const deliveryDateType = String(formData.get("deliveryDateType") ?? "DATE").trim().toUpperCase();
  const notes = String(formData.get("notes") ?? "").trim();
  const detailsRaw = String(formData.get("details") ?? "[]");

  let details: { itemId: string; qty: number; unitPrice: number; prDetailId?: string }[];
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

  // Resolve PO Number format: apakah menggunakan pola urut standar PT SRI atau custom
  const isStandardPattern = !poNumberCustom || /^\d{4}\/SRI\/PUD\/[IVXLCDM]+\/\d{4}$/i.test(poNumberCustom);

  // Jika custom manual non-standar, pastikan belum ada di database
  if (!isStandardPattern && poNumberCustom) {
    const existing = await prisma.purchaseOrder.findUnique({ where: { poNumber: poNumberCustom } });
    if (existing) {
      return { error: `Nomor PO "${poNumberCustom}" sudah terdaftar di sistem. Gunakan nomor lain.` };
    }
  }

  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) return { error: "Supplier tidak ditemukan" };

  // Mekanisme Auto-Retry Concurrency Protection:
  // Jika 2 user menekan tombol simpan bersamaan dengan nomor rekomendasi yang sama,
  // request kedua akan otomatis mendeteksi benturan, mengambil nomor urut berikutnya, dan menyimpannya.
  const MAX_RETRIES = 5;
  let attempt = 0;
  let po: any = null;
  let chosenPoNumber = poNumberCustom;

  while (attempt < MAX_RETRIES) {
    attempt++;

    // Tentukan nomor PO untuk percobaan ini
    if (!chosenPoNumber || attempt > 1) {
      chosenPoNumber = await nextNumber("purchaseOrder", poDate);
    } else {
      const exist = await prisma.purchaseOrder.findUnique({ where: { poNumber: chosenPoNumber } });
      if (exist) {
        if (!isStandardPattern) {
          return { error: `Nomor PO "${chosenPoNumber}" sudah terdaftar di sistem. Gunakan nomor lain.` };
        }
        chosenPoNumber = await nextNumber("purchaseOrder", poDate);
      }
    }

    try {
      po = await prisma.$transaction(async (tx) => {
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
        purchaseRequestDetailId?: string | null;
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
              source: `PO #${chosenPoNumber}`,
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
        purchaseRequestDetailId: d.prDetailId || null,
      });
    }

      if (poDetailsData.length === 0) {
        throw new Error("Tidak ada item yang valid untuk disimpan");
      }

      const createdPo = await tx.purchaseOrder.create({
        data: {
          poNumber: chosenPoNumber,
          purchaseRequestId: purchaseRequestId || null,
          supplierId,
          warehouseId: warehouseId || null,
          createdById: user.id,
          poDate: isNaN(poDate.getTime()) ? new Date() : poDate,
          expectedDelivery: expectedDelivery && !isNaN(expectedDelivery.getTime()) ? expectedDelivery : null,
          deliveryDateType: deliveryDateType === "MONTH" ? "MONTH" : "DATE",
          department: department ? normalizeDepartment(department) : null,
          purposeProject: purposeProject || null,
          notes: notes || null,
          status: "DRAFT",
          details: {
            create: poDetailsData,
          },
        },
      });

      // Jika PO dibuat dari Purchase Request, update status PR dan item-itemnya
      if (purchaseRequestId) {
        const prDetailIds = details.map((d) => d.prDetailId).filter(Boolean) as string[];
        const orderedItemIds = details.map((d) => d.itemId).filter(Boolean);

        if (prDetailIds.length > 0) {
          await tx.purchaseRequestDetail.updateMany({
            where: {
              id: { in: prDetailIds },
              purchaseRequestId,
            },
            data: {
              status: "ORDERED",
            },
          });
        } else {
          await tx.purchaseRequestDetail.updateMany({
            where: {
              purchaseRequestId,
              itemId: { in: orderedItemIds },
            },
            data: {
              status: "ORDERED",
            },
          });
        }

        const remainingPending = await tx.purchaseRequestDetail.count({
          where: {
            purchaseRequestId,
            status: "PENDING",
          },
        });

        await tx.purchaseRequest.update({
          where: { id: purchaseRequestId },
          data: {
            status: remainingPending === 0 ? "ORDERED" : "PARTIAL_PO",
          },
        });
      }

      return createdPo;
    });

    // Jika transaksi berhasil, keluar dari loop retry
    break;
  } catch (err: any) {
    // Tangani benturan concurrency (Prisma P2002 Unique Constraint Violation pada poNumber)
    const isUniqueCollision = err?.code === "P2002" && (
      (Array.isArray(err?.meta?.target) && err.meta.target.includes("poNumber")) ||
      (typeof err?.message === "string" && err.message.includes("poNumber"))
    );

    if (isUniqueCollision && isStandardPattern && attempt < MAX_RETRIES) {
      console.warn(`[Concurrency] Benturan nomor PO (${chosenPoNumber}) terdeteksi pada percobaan ${attempt}. Menunggu dan mengambil nomor urut baru...`);
      // Jitter acak 50 - 150ms agar request kedua tidak bentrok berulang
      await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 100) + 50));
      continue;
    }

    console.error("Error creating PO:", err);
    return { error: err.message || "Gagal menyimpan Purchase Order" };
  }
}

  if (!po) {
    return { error: "Gagal membuat Purchase Order karena benturan nomor urut beruntun. Silakan coba simpan kembali." };
  }

  try {
    await writeAuditLog(user, "CREATE_PO", "PurchaseOrder", po.id, `Membuat PO ${po.poNumber}`);

    await notifyNewPo({
      poId: po.id,
      poNumber: po.poNumber,
      supplierName: supplier?.name,
      creatorName: user.name,
    });

    if (purchaseRequestId) {
      const pr = await prisma.purchaseRequest.findUnique({
        where: { id: purchaseRequestId },
        select: { id: true, prNumber: true, requestedById: true, department: true, status: true },
      });
      if (pr) {
        notifyPrPoCreated({
          prId: pr.id,
          prNumber: pr.prNumber,
          poNumber: po.poNumber,
          isPartial: pr.status === "PARTIAL_PO",
          requesterId: pr.requestedById,
          department: pr.department,
        }).catch((err) => console.error("Error notifyPrPoCreated:", err));
      }
    }

    revalidatePath("/purchasing");
    revalidatePath("/purchasing/purchase-orders");
    revalidatePath("/purchasing/items");
    return { redirect: `/purchasing/purchase-orders/${po.id}` };
  } catch (postErr: any) {
    console.error("Error in post-PO creation hooks:", postErr);
    // PO sudah berhasil dibuat, tetap redirect
    return { redirect: `/purchasing/purchase-orders/${po.id}` };
  }
}

export default async function NewPurchaseOrderPage(props: {
  searchParams?: Promise<{ prId?: string; detailIds?: string }>;
}) {
  const { user } = await getSessionUser();
  if (!user || user.role !== "PURCHASING") redirect("/login");

  // Manager L1 & Presdir L2 tidak diizinkan membuat PO baru (hanya approve/batal)
  if (user.approvalLevel === 1 || user.approvalLevel === 2) {
    redirect("/purchasing/purchase-orders");
  }

  const searchParams = props.searchParams ? await props.searchParams : {};
  const prId = searchParams.prId;
  const detailIds = searchParams.detailIds ? searchParams.detailIds.split(",").filter(Boolean) : null;

  const linkedPR = prId
    ? await prisma.purchaseRequest.findUnique({
        where: { id: prId },
        include: {
          details: {
            include: { item: true },
          },
        },
      })
    : null;

  // Filter PR details jika spesifik detailIds diminta
  let targetPrDetails = linkedPR?.details.filter((d) => d.status === "PENDING") || [];
  if (detailIds && detailIds.length > 0) {
    targetPrDetails = targetPrDetails.filter((d) => detailIds.includes(d.id));
  }

  // Jika ada custom item di PR (itemId == null), otomatis daftarkan ke master item
  for (const d of targetPrDetails) {
    if (!d.itemId && d.customItemName) {
      let matchedItem = await prisma.item.findFirst({
        where: { name: { equals: d.customItemName.trim(), mode: "insensitive" } },
      });
      if (!matchedItem) {
        const autoCode = `REQ-${Date.now().toString(36).toUpperCase()}`;
        matchedItem = await prisma.item.create({
          data: {
            code: autoCode,
            name: d.customItemName.trim(),
            unit: d.unit || "Pcs",
            lastUnitPrice: d.estimatedPrice || null,
            description: d.specifications || null,
            departmentScope: "GENERAL",
            isActive: true,
          },
        });
      }
      await prisma.purchaseRequestDetail.update({
        where: { id: d.id },
        data: { itemId: matchedItem.id },
      });
      d.itemId = matchedItem.id;
      (d as any).item = matchedItem;
    }
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
        initialPurchaseRequestId={linkedPR?.id}
        initialPrNumber={linkedPR?.prNumber}
        initialDepartment={linkedPR?.department}
        initialPurposeProject={linkedPR?.purposeNotes ?? undefined}
        initialRows={
          targetPrDetails.length > 0
            ? targetPrDetails
                .filter((d) => d.itemId)
                .map((d) => ({
                  prDetailId: d.id,
                  itemId: d.itemId!,
                  qty: d.qty,
                  packageQty: "",
                  unitPrice: Number(d.estimatedPrice || d.item?.lastUnitPrice || 0),
                }))
            : undefined
        }
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

