import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "PURCHASING") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "csv";

  const receivings = await prisma.receiving.findMany({
    orderBy: { receivedAt: "desc" },
    include: {
      purchaseOrder: true,
      delivery: true,
      warehouse: true,
      receivedBy: true,
      details: { include: { item: true } },
    },
  });

  const rows = receivings.flatMap((r) =>
    r.details.map((d) => ({
      receivingNumber: r.receivingNumber,
      poNumber: r.purchaseOrder.poNumber,
      deliveryNumber: r.delivery.deliveryNumber,
      warehouse: r.warehouse.name,
      receivedBy: r.receivedBy.name,
      receivedAt: r.receivedAt.toISOString(),
      itemCode: d.item.code,
      itemName: d.item.name,
      qtyOrdered: d.qtyOrdered,
      qtyDelivered: d.qtyDelivered,
      qtyReceived: d.qtyReceived,
      status: r.status,
    })),
  );

  if (format === "excel") {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Receivings");

    const headers = [
      "Receiving", "PO", "Delivery", "Warehouse", "Received By", "Tanggal",
      "Item Code", "Item Name", "Qty Ordered", "Qty Delivered", "Qty Received", "Status",
    ];
    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true };
    rows.forEach((r) => sheet.addRow(Object.values(r)));

    const buf = await workbook.xlsx.writeBuffer();
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=receiving-report.xlsx",
      },
    });
  }

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
      "Content-Disposition": "attachment; filename=receiving-report.csv",
    },
  });
}
