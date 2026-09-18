import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { PO_STATUS_LABEL } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "PURCHASING") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "csv";

  const pos = await prisma.purchaseOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      supplier: true,
      warehouse: true,
      details: { include: { item: true } },
    },
  });

  const rows = pos.flatMap((po) =>
    po.details.map((d) => ({
      poNumber: po.poNumber,
      supplier: po.supplier.name,
      warehouse: po.warehouse?.name ?? "",
      poDate: po.poDate.toISOString().slice(0, 10),
      status: PO_STATUS_LABEL[po.status] ?? po.status,
      itemCode: d.item.code,
      itemName: d.item.name,
      qty: d.qty,
      deliveredQty: d.deliveredQty,
      receivedQty: d.receivedQty,
      outstanding: Math.max(0, d.qty - d.receivedQty),
      unitPrice: Number(d.unitPrice),
      total: d.qty * Number(d.unitPrice),
    })),
  );

  if (format === "excel") {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Purchase Orders");

    const headers = [
      "PO Number", "Supplier", "Warehouse", "Tanggal PO", "Status",
      "Item Code", "Item Name", "Qty", "Delivered", "Received", "Outstanding", "Unit Price", "Total",
    ];
    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true };
    rows.forEach((r) => sheet.addRow(Object.values(r)));

    const buf = await workbook.xlsx.writeBuffer();
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=po-report.xlsx",
      },
    });
  }

  // CSV
  const header = Object.keys(rows[0] ?? {}).join(",");
  const lines = rows.map((r) =>
    Object.values(r)
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  const csv = [header, ...lines].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=po-report.csv",
    },
  });
}
