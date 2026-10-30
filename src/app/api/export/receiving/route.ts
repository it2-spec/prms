import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { normalizeDepartment } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  const allowedRoles = [
    "PURCHASING",
    "WAREHOUSE",
    "ADMIN_PRODUKSI",
    "ADMIN_INDIRECT",
    "DEPT_APPROVER",
  ];
  if (!session || !allowedRoles.includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canViewPrice = session.role === "PURCHASING";
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "excel";

  const receivings = await prisma.receiving.findMany({
    orderBy: { receivedAt: "desc" },
    include: {
      purchaseOrder: {
        include: {
          supplier: { select: { id: true, name: true } },
          createdBy: { select: { name: true } },
          purchaseRequest: {
            select: {
              department: true,
              requestedBy: { select: { name: true } },
            },
          },
          details: {
            select: {
              id: true,
              itemId: true,
              unitPrice: true,
            },
          },
        },
      },
      delivery: {
        include: {
          supplier: { select: { id: true, name: true } },
        },
      },
      warehouse: { select: { id: true, name: true } },
      receivedBy: { select: { id: true, name: true } },
      details: {
        include: {
          item: true,
          deliveryDetail: {
            select: {
              id: true,
              unitPrice: true,
              purchaseOrderDetailId: true,
            },
          },
        },
      },
    },
  });

  let counter = 1;
  const rows = receivings.flatMap((r) => {
    const dnNumber = r.delivery?.suratJalan || r.delivery?.deliveryNumber || "-";
    const supplierName =
      r.purchaseOrder?.supplier?.name || r.delivery?.supplier?.name || "-";
    const rawDept =
      r.purchaseOrder?.department ||
      r.purchaseOrder?.purchaseRequest?.department ||
      r.purchaseOrder?.purchaseRequest?.requestedBy?.name ||
      r.purchaseOrder?.createdBy?.name ||
      "-";
    const userDept = normalizeDepartment(rawDept);

    const dateStr = r.receivedAt.toISOString().split("T")[0];

    return r.details.map((dt) => {
      let price = 0;
      if (canViewPrice) {
        if (dt.deliveryDetail?.unitPrice && Number(dt.deliveryDetail.unitPrice) > 0) {
          price = Number(dt.deliveryDetail.unitPrice);
        } else if (dt.deliveryDetail?.purchaseOrderDetailId) {
          const pod = r.purchaseOrder?.details?.find(
            (p) => p.id === dt.deliveryDetail?.purchaseOrderDetailId
          );
          if (pod?.unitPrice) price = Number(pod.unitPrice);
        } else if (dt.itemId) {
          const pod = r.purchaseOrder?.details?.find((p) => p.itemId === dt.itemId);
          if (pod?.unitPrice) price = Number(pod.unitPrice);
        }

        if (price === 0 && dt.item?.lastUnitPrice) {
          price = Number(dt.item.lastUnitPrice);
        }
      }

      const qty = dt.qtyReceived || 0;
      const totalAmount = canViewPrice ? Math.round(qty * price * 100) / 100 : 0;

      return {
        no: counter++,
        receivingDate: dateStr,
        supplierName,
        dnNumber,
        poNumber: r.purchaseOrder?.poNumber || "-",
        user: userDept,
        code: dt.item?.code || "-",
        partName: dt.item?.name || "-",
        unit: dt.item?.unit || "Pcs",
        qty,
        unitPrice: canViewPrice ? price : 0,
        totalAmount,
        picReceiving: r.receivedBy?.name || "-",
      };
    });
  });

  const headers = [
    "NO",
    "RECEIVING DATE",
    "SUPPLIER NAME",
    "DN NO.",
    "PO NO.",
    "USER",
    "CODE",
    "PART NAME",
    "UNIT",
    "QTY",
    ...(canViewPrice ? ["UNIT PRICE", "TOTAL AMOUNT"] : []),
    "PIC RECEIVING",
  ];

  if (format === "excel") {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Receiving Report");

    // Header styling
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A8A" }, // Dark Blue
    };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };

    // Column widths
    sheet.columns = [
      { width: 8 }, // NO
      { width: 16 }, // RECEIVING DATE
      { width: 30 }, // SUPPLIER NAME
      { width: 22 }, // DN NO.
      { width: 25 }, // PO NO.
      { width: 20 }, // USER
      { width: 18 }, // CODE
      { width: 35 }, // PART NAME
      { width: 10 }, // UNIT
      { width: 12 }, // QTY
      ...(canViewPrice ? [{ width: 18 }, { width: 20 }] : []),
      { width: 22 }, // PIC RECEIVING
    ];

    rows.forEach((r) => {
      const rowValues = [
        r.no,
        r.receivingDate,
        r.supplierName,
        r.dnNumber,
        r.poNumber,
        r.user,
        r.code,
        r.partName,
        r.unit,
        r.qty,
        ...(canViewPrice ? [r.unitPrice, r.totalAmount] : []),
        r.picReceiving,
      ];
      const row = sheet.addRow(rowValues);

      // Alignments & formats
      row.getCell(1).alignment = { horizontal: "center" };
      row.getCell(2).alignment = { horizontal: "center" };
      row.getCell(9).alignment = { horizontal: "center" };
      row.getCell(10).alignment = { horizontal: "right" };
      row.getCell(10).numFmt = "#,##0";
      if (canViewPrice) {
        row.getCell(11).alignment = { horizontal: "right" };
        row.getCell(11).numFmt = "Rp #,##0";
        row.getCell(12).alignment = { horizontal: "right" };
        row.getCell(12).numFmt = "Rp #,##0";
      }
    });

    const buf = await workbook.xlsx.writeBuffer();
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=receiving-report-${new Date().toISOString().split("T")[0]}.xlsx`,
      },
    });
  }

  // CSV format
  const csvHeaders = headers.join(",");
  const lines = rows.map((r) => {
    const values = [
      r.no,
      `"${r.receivingDate}"`,
      `"${r.supplierName.replace(/"/g, '""')}"`,
      `"${r.dnNumber.replace(/"/g, '""')}"`,
      `"${r.poNumber.replace(/"/g, '""')}"`,
      `"${r.user.replace(/"/g, '""')}"`,
      `"${r.code.replace(/"/g, '""')}"`,
      `"${r.partName.replace(/"/g, '""')}"`,
      `"${r.unit.replace(/"/g, '""')}"`,
      r.qty,
      ...(canViewPrice ? [r.unitPrice, r.totalAmount] : []),
      `"${r.picReceiving.replace(/"/g, '""')}"`,
    ];
    return values.join(",");
  });
  const csv = [csvHeaders, ...lines].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=receiving-report-${new Date().toISOString().split("T")[0]}.csv`,
    },
  });
}
