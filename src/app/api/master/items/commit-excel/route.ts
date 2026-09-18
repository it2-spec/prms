import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/utils";

export const runtime = "nodejs";

type ImportItem = {
  name: string;
  packageUnit: string | null;
  packageSize: number | null;
  unit: string | null;
  lastUnitPrice: number | null;
  suggestedCode?: string;
};

function generateCode(name: string, usedCodes: Set<string>): string {
  // Generate code from first 3 words of name, uppercased
  const words = name.trim().split(/\s+/).slice(0, 3);
  let base = words.map(w => w.replace(/[^a-zA-Z0-9]/g, "").substring(0, 4).toUpperCase()).join("-");
  if (!base) base = "ITM";

  let code = base;
  let counter = 1;
  while (usedCodes.has(code.toUpperCase())) {
    code = `${base}-${counter}`;
    counter++;
  }
  usedCodes.add(code.toUpperCase());
  return code;
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await getSessionUser();
    if (!user || user.role !== "PURCHASING") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { items, mode = "upsert" } = body as {
      items: ImportItem[];
      mode?: "upsert" | "skip_existing" | "overwrite";
    };

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Data item kosong" }, { status: 400 });
    }

    // Load existing items for code uniqueness & matching
    const existingItems = await prisma.item.findMany({ select: { id: true, name: true, code: true } });
    const nameToId = new Map<string, string>();
    const usedCodes = new Set<string>();

    for (const ei of existingItems) {
      nameToId.set(ei.name.toLowerCase().trim(), ei.id);
      usedCodes.add(ei.code.toUpperCase());
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const item of items) {
      const nameKey = item.name.toLowerCase().trim();
      const existingId = nameToId.get(nameKey);

      if (existingId) {
        if (mode === "skip_existing") {
          skipped++;
          continue;
        }
        // upsert or overwrite: update existing
        const current = await prisma.item.findUnique({ where: { id: existingId } });
        const newPrice = item.lastUnitPrice;
        const oldPrice = current?.lastUnitPrice ? Number(current.lastUnitPrice) : null;

        await prisma.item.update({
          where: { id: existingId },
          data: {
            packageUnit: item.packageUnit ?? current?.packageUnit,
            packageSize: item.packageSize ?? current?.packageSize,
            unit: item.unit ?? current?.unit,
            lastUnitPrice: newPrice ?? current?.lastUnitPrice,
          },
        });

        // Record price change if price differs
        if (newPrice != null && (oldPrice === null || Math.abs(oldPrice - newPrice) > 0.01)) {
          await prisma.itemPriceHistory.create({
            data: {
              itemId: existingId,
              oldUnitPrice: oldPrice,
              newUnitPrice: newPrice,
              source: "Import Excel Master Item",
            },
          });
        }
        updated++;
      } else {
        // Create new
        const code = item.suggestedCode && !usedCodes.has(item.suggestedCode.toUpperCase())
          ? item.suggestedCode
          : generateCode(item.name, usedCodes);

        const newItem = await prisma.item.create({
          data: {
            code,
            name: item.name,
            unit: item.unit || "kg",
            packageUnit: item.packageUnit || null,
            packageSize: item.packageSize || null,
            lastUnitPrice: item.lastUnitPrice || null,
            isActive: true,
          },
        });

        // Record initial price
        if (item.lastUnitPrice != null) {
          await prisma.itemPriceHistory.create({
            data: {
              itemId: newItem.id,
              oldUnitPrice: null,
              newUnitPrice: item.lastUnitPrice,
              source: "Import Excel Master Item",
            },
          });
        }

        nameToId.set(item.name.toLowerCase().trim(), newItem.id);
        created++;
      }
    }

    await writeAuditLog(
      user,
      "BATCH_IMPORT_ITEMS",
      "Item",
      undefined,
      `Import Master Item dari Excel: ${created} dibuat, ${updated} diperbarui, ${skipped} dilewati`
    );

    return NextResponse.json({
      success: true,
      created,
      updated,
      skipped,
      message: `${created} item dibuat, ${updated} diperbarui, ${skipped} dilewati`,
    });
  } catch (err: any) {
    console.error("commit-items-excel error:", err);
    return NextResponse.json({ error: err.message || "Gagal menyimpan item" }, { status: 500 });
  }
}
